import json
import os
import sys
from pathlib import Path
from typing import List, Literal
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ollama import Client
from pydantic import BaseModel

load_dotenv()

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from backend.ml.MlLogic import ml_router
else:
    from backend.ml.MlLogic import ml_router

app = FastAPI(title="MlForge API", version="0.0.1")
app.add_middleware( CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],)
app.include_router(ml_router)
client = Client(host="http://localhost:11434")

SYSTEM_PROMPT = "Write concise answers only. Do not add extra wording."
TEXT_EXTS = {".csv", ".json", ".txt", ".md"}
MAX_TEXT_CHARS = 6000
MAX_FILE_BYTES = 10 * 1024 * 1024
NUM_PREDICT = int(os.getenv("NUM_PREDICT", "512"))

class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"

@app.get("/")
async def root():
    return {"message": "Running!"}

@app.post("/chat")
async def chat( message: str = Form(""), history: str = Form("[]"), files: List[UploadFile] = File(default=[]),):
    try:
        past = [Message(**m) for m in json.loads(history)]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history format.")

    text = message.strip()
    images: List[bytes] = []
    file_blocks: List[str] = []

    for f in files:
        data = await f.read()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"{f.filename} is too large.")
        ext = Path(f.filename or "").suffix.lower()
        if (f.content_type or "").startswith("image/"):
            images.append(data)
        elif ext in TEXT_EXTS:
            body = data.decode("utf-8", errors="replace")
            note = "\n[truncated]" if len(body) > MAX_TEXT_CHARS else ""
            file_blocks.append(f"--- file: {f.filename} ---\n{body[:MAX_TEXT_CHARS]}{note}")
        else:
            raise HTTPException(status_code=415, detail=f"Unsupported file type: {f.filename}")

    if not text and not (images or file_blocks):
        raise HTTPException(status_code=400, detail="Message is empty.")
    if not text:
        text = "Describe the attached file(s)."

    user_content = text + ("\n\n" + "\n\n".join(file_blocks) if file_blocks else "")
    user_msg = {"role": "user", "content": user_content}
    if images:
        user_msg["images"] = images

    messages = ([{"role": "system", "content": SYSTEM_PROMPT}]+ [{"role": m.role, "content": m.content} for m in past] + [user_msg])
    model = os.getenv("vision_model") if images else os.getenv("model")

    def generate():
        if not model:
            yield sse({"error": "No vision model configured. Set vision_model in .env to analyze images."})
            return
        try:
            stream = client.chat( model=model, messages=messages, stream=True, keep_alive="1m", options={"temperature": 0.5, "num_predict": NUM_PREDICT},)
            for chunk in stream:
                yield sse({"t": chunk["message"]["content"]})
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield sse({"error": str(e)})
    return StreamingResponse(generate(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)