
from pymongo import ASCENDING, GEOSPHERE, AsyncMongoClient

from app.core.config import settings


class Database:

    client = None
    db = None

    @classmethod
    async def connect(cls):

        cls.client = AsyncMongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=10000,
            # Return datetimes with their time zone (UTC), so the API keeps
            # sending "...Z" timestamps exactly as before MongoDB.
            tz_aware=True
        )

        try:
            await cls.client.admin.command("ping")

            cls.db = cls.client[settings.MONGODB_DATABASE]

            await cls.ensure_indexes()

            print("MongoDB connected successfully!")

        except Exception:
            await cls.client.close()
            cls.client = None
            cls.db = None
            raise

    @classmethod
    async def ensure_indexes(cls):

        # create_index does nothing if the index already exists, so this is
        # safe to run on every start.
        assets = cls.db["assets"]

        # 2dsphere: MongoDB's index for GeoJSON on the Earth's surface. It
        # makes "near this point" and "inside this polygon" queries fast.
        await assets.create_index([("location", GEOSPHERE)], name="location_2dsphere")

        # Indexes for the list filters and the stable sort order.
        await assets.create_index([("created_at", ASCENDING)], name="created_at")
        await assets.create_index([("asset_type", ASCENDING)], name="asset_type")
        await assets.create_index([("district.pcode", ASCENDING)], name="district_pcode")

    @classmethod
    async def disconnect(cls):

        if cls.client is not None:

            await cls.client.close()

            cls.client = None
            cls.db = None

            print("MongoDB connection closed.")


def get_db():

    # The connected database. Raises if the app started without MongoDB,
    # instead of failing later with a confusing "NoneType" error.
    if Database.db is None:
        raise RuntimeError("MongoDB is not connected (the app's lifespan connects it on startup).")

    return Database.db
