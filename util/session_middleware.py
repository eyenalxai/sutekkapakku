from typing import Any, Dict, Awaitable, Callable, Optional

from aiogram.types import Message

from config.database_engine import async_session_maker
from config.log import logger
from model.models import UserModel, StickerSetModel
from util.query.sticker_set import get_sticker_set_by_user_and_type
from util.query.user import get_user_by_telegram_id


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


async def get_sticker_stuff_and_filter_stuff(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    if not message.from_user:
        return None

    if not message.sticker:
        logger.warning(
            f"No sticker in message?! User: {message.from_user.full_name} - @{message.from_user.username or 'None'}")
        return

    if not message.sticker.emoji:
        logger.warning(
            f"Sticker has no emoji! User: {message.from_user.full_name} - @{message.from_user.username or 'None'}")
        return None

    async with async_session_maker() as async_session:
        async with async_session.begin():
            user: Optional[UserModel] = await get_user_by_telegram_id(
                async_session=async_session,
                telegram_id=message.from_user.id
            )

            if not user:
                await message.reply(
                    "You are not registered yet.\n"
                    "Please use /start command.."
                )
                return

            sticker_set: Optional[StickerSetModel] = await get_sticker_set_by_user_and_type(
                async_session=async_session, user=user, sticker=message.sticker
            )

            data["async_session"] = async_session
            data["user"] = user
            data["sticker_set"] = sticker_set

            data["message_sticker"] = message.sticker
            data["sticker_emoji"] = message.sticker.emoji

            return await handler(message, data)
