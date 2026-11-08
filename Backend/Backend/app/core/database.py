
from pymongo import AsyncMongoClient

from app.core.config import settings


class Database:

    client = None
    db = None

    @classmethod
    async def connect(cls):

        cls.client = AsyncMongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=10000
        )

        try:
            await cls.client.admin.command("ping")

            cls.db = cls.client[settings.MONGODB_DATABASE]

            print("MongoDB Atlas connected successfully!")

        except Exception:
            await cls.client.close()
            cls.client = None
            cls.db = None
            raise

    @classmethod
    async def disconnect(cls):

        if cls.client is not None:

            await cls.client.close()

            cls.client = None
            cls.db = None

            print("MongoDB connection closed.")
