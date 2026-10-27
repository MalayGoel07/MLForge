import os

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI is not set. Add it to your .env file.")

client = MongoClient(MONGO_URI)
db = client[os.getenv("DB_NAME", "mlforge")]

users_collection = db["users"]
chats_collection = db["chats"]

# One account per username; one chat id per owner; fast "my chats, newest first".
users_collection.create_index("username", unique=True)
chats_collection.create_index([("owner", ASCENDING), ("id", ASCENDING)], unique=True)
chats_collection.create_index([("owner", ASCENDING), ("updatedAt", DESCENDING)])