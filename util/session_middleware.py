from typing import Any, Dict, Awaitable, Callable

from aiogram.types import Message

from config.database_engine import async_session_maker


async def get_async_database_session(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    async with async_session_maker() as async_session:
        async with async_session.begin():
            data["async_session"] = async_session
            return await handler(message, data)


async def filter_non_user(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    if not message.from_user:
        return None

    if not message.from_user.username:
        await message.reply("Please set a username to use this bot.")
        return None

    data["telegram_user"] = message.from_user
    data["telegram_user_username"] = message.from_user.username

    return await handler(message, data)
