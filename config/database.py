import os

DATABASE_URL: str = os.getenv(key="DATABASE_URL", default="NONE")
assert DATABASE_URL != "NONE", "DATABASE_URL is not set"
assert DATABASE_URL.startswith("postgresql"), "DATABASE_URL must start with postgresql"

ASYNC_DATABASE_URL: str = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
assert ASYNC_DATABASE_URL.startswith("postgresql+asyncpg://"), "DATABASE_URL must start with postgresql+asyncpg://"
