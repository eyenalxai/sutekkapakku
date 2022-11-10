from typing import Any, Dict, Awaitable, Callable

from aiogram.types import Update

from util.database.configure import async_session_maker


async def get_db_session(
    handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]],
    event: Update,
    data: Dict[str, Any],
) -> Any:
    async with async_session_maker() as async_session:
        async with async_session.begin():
            data["async_session"] = async_session
            return await handler(event, data)
