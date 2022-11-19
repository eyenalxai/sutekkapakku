from typing import Any, Dict, Awaitable, Callable, Optional

from aiogram.types import Message
from asyncpg import ConnectionDoesNotExistError  # type: ignore
from emoji import distinct_emoji_list
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from config.database_engine import async_engine
from config.log import logger
from model.models import UserModel, StickerSetModel
from util.photo import get_largest_picture
from util.query.sticker_set import get_sticker_set_by_user_and_type, get_sticker_set_type_from_message
from util.query.user import get_user_by_telegram_id


async def get_async_database_session(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    try:
        async with AsyncSession(bind=async_engine) as async_session:
            async with async_session.begin():
                data["async_session"] = async_session
                return await handler(message, data)
    except DBAPIError as e:
        logger.error(f"DBAPIError error: {e}")
        await message.reply("An error occurred. Please try again.")
        return None
    except ConnectionDoesNotExistError as e:
        logger.error(f"ConnectionDoesNotExistError error: {e}")
        await message.reply("An error occurred. Please try again.")
        return None


async def filter_non_user(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    if not message.from_user:
        logger.error(f"No user in message?! Message: {message}")
        return None

    if not message.from_user.username:
        await message.reply("Please set a username to use this bot.")
        return None

    data["telegram_user"] = message.from_user
    data["telegram_user_username"] = message.from_user.username

    return await handler(message, data)


async def get_user_sticker_set_async_session(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    if not message.from_user:
        return None

    if not message.sticker and not message.photo:
        return None

    async with AsyncSession(bind=async_engine) as async_session:
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

            sticker_set_type = get_sticker_set_type_from_message(message=message)

            sticker_set: Optional[StickerSetModel] = await get_sticker_set_by_user_and_type(
                async_session=async_session, user=user, sticker_set_type=sticker_set_type
            )

            data["async_session"] = async_session
            data["user"] = user
            data["sticker_set_type"] = sticker_set_type
            data["sticker_set"] = sticker_set

            return await handler(message, data)


async def filter_non_sticker(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    if not message.from_user:
        return None

    if not message.sticker:
        logger.error(
            f"No sticker in message?! User: {message.from_user.full_name} - @{message.from_user.username or 'None'}")
        return

    if not message.sticker.emoji:
        logger.error(
            f"Sticker has no emoji! User: {message.from_user.full_name} - @{message.from_user.username or 'None'}")
        return None

    data["message_sticker"] = message.sticker
    data["sticker_emoji"] = message.sticker.emoji

    return await handler(message, data)


async def filter_no_emoji_caption(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    def get_emoji_list(text: str) -> list[str]:
        return distinct_emoji_list(text)  # type: ignore

    if not message.caption:
        await message.reply("Please add a caption with an emoji to your picture (e.g. 🥰)")
        return None

    emoji_list = get_emoji_list(text=message.caption)

    if len(emoji_list) < 1:
        await message.reply("Your caption does not contain an emoji 🥲")
        return None

    data["emoji"] = emoji_list[0]

    return await handler(message, data)


async def filter_non_photo(
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        message: Message,
        data: Dict[str, Any],
) -> Any:
    if not message.from_user or not message.from_user.username:
        return None

    if not message.photo:
        logger.error(
            f"No photo in message?! User: {message.from_user.full_name} - @{message.from_user.username}"
        )
        return None

    largest_photo = get_largest_picture(pictures=message.photo)

    data["picture"] = largest_photo
    return await handler(message, data)
