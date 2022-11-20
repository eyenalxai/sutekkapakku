from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

from config.database import ASYNC_DATABASE_URL

async_engine: AsyncEngine = create_async_engine(url=ASYNC_DATABASE_URL, pool_size=20, pool_pre_ping=True)
