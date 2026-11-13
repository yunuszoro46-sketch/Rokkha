
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

        # Saved locations: 2dsphere on their GeoJSON geometry, and the list order.
        locations = cls.db["locations"]
        await locations.create_index([("geometry", GEOSPHERE)], name="geometry_2dsphere")
        await locations.create_index([("created_at", ASCENDING)], name="created_at")

        # Weather observations: time-ordered lists and lookups by place.
        weather = cls.db["weather_observations"]
        await weather.create_index([("observed_at", ASCENDING)], name="observed_at")
        await weather.create_index([("location_name", ASCENDING)], name="location_name")

        # Ingestion (Milestone 18): time series per site, run log, call budget.
        for name in ("rain_daily", "rain_recent_daily", "river_discharge_daily"):
            await cls.db[name].create_index(
                [("site_id", ASCENDING), ("date", ASCENDING)], name="site_date"
            )
        await cls.db["rain_forecast_hourly"].create_index(
            [("site_id", ASCENDING), ("fetched_at", ASCENDING), ("valid_time", ASCENDING)],
            name="site_fetch_valid",
        )
        await cls.db["ingestion_runs"].create_index([("started_at", ASCENDING)], name="started_at")
        await cls.db["ingestion_api_usage"].create_index([("date", ASCENDING)], name="date")

        # Flood predictions: one document per district and target day.
        await cls.db["flood_predictions"].create_index(
            [("target_date", ASCENDING), ("pcode", ASCENDING)], name="target_pcode"
        )

        # Accounts: one account per email; MongoDB itself deletes expired
        # logins and old wrong-password counters (TTL indexes).
        await cls.db["users"].create_index([("email", ASCENDING)], name="email_unique", unique=True)
        await cls.db["sessions"].create_index(
            [("expires_at", ASCENDING)], name="expires_at_ttl", expireAfterSeconds=0
        )
        await cls.db["sessions"].create_index([("user_id", ASCENDING)], name="user_id")
        await cls.db["login_failures"].create_index(
            [("at", ASCENDING)], name="at_ttl", expireAfterSeconds=900
        )
        await cls.db["login_failures"].create_index([("email", ASCENDING)], name="email")

        # Rescue requests: one per phone-made key; lists by status and time.
        sos = cls.db["sos_requests"]
        await sos.create_index([("client_key_hash", ASCENDING)], name="client_key_unique", unique=True)
        await sos.create_index([("status", ASCENDING), ("received_at", ASCENDING)], name="status_received")
        await sos.create_index([("user_id", ASCENDING)], name="user_id")
        await sos.create_index([("district.pcode", ASCENDING)], name="district_pcode")
        await cls.db["sos_senders"].create_index(
            [("at", ASCENDING)], name="at_ttl", expireAfterSeconds=3600
        )
        await cls.db["sos_senders"].create_index([("sender_hash", ASCENDING)], name="sender_hash")

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
