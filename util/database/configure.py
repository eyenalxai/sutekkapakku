from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession, create_async_engine, AsyncEngine

from config.database import ASYNC_DATABASE_URL

async_engine: AsyncEngine = create_async_engine(url=ASYNC_DATABASE_URL)
async_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(bind=async_engine)
