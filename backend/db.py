import os

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient
from urllib.parse import quote_plus
load_dotenv()

username=os.getenv("MONGO_USERNAME")
password=os.getenv("MONGO_PASSWORD")
cluster=os.getenv("MONGO_CLUSTER")
MONGO_URI=f"mongodb+srv://{quote_plus(username)}:{quote_plus(password)}@{cluster}/"

client = MongoClient(MONGO_URI)
db = client[os.getenv("DB_NAME", "mlforge")]

users_collection = db["users"]
chats_collection = db["chats"]

# One account per username; one chat id per owner; fast "my chats, newest first".
users_collection.create_index("username", unique=True)
chats_collection.create_index([("owner", ASCENDING), ("id", ASCENDING)], unique=True)
chats_collection.create_index([("owner", ASCENDING), ("updatedAt", DESCENDING)])