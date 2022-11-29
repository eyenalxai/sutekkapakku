import logging

from aiogram import F, Router, Dispatcher, Bot
from aiogram.filters import Command
from aiogram.fsm.storage.memory import SimpleEventIsolation
from aiogram.types import Message, User as TelegramUser, Sticker, PhotoSize
from aiogram.webhook.aiohttp_server import (
    SimpleRequestHandler,
    setup_application,
)
from aiohttp import web
from aiohttp_healthcheck import HealthCheck  # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from model.models import UserModel, StickerSetModel, StickerSetType
from settings_reader import PollType, settings
from util.middleware import (
    get_async_database_session,
    filter_non_sticker,
    filter_non_user,
    filter_no_emoji_caption,
    get_user_sticker_set_async_session,
    filter_non_photo,
)
from util.query.user import get_user_by_telegram_id, save_user_to_database
from util.sticker import (
    create_new_sticker_set,
    handle_sticker_removal,
    handle_sticker_addition,
    get_sticker_file_input_from_picture,
    get_sticker_file_input_from_sticker,
)

start_router = Router(name="start router")
sticker_router = Router(name="sticker router")
picture_router = Router(name="picture router")

logging.basicConfig(level=logging.INFO, datefmt="%Y-%m-%d %H:%M:%S")


@start_router.message(Command("start", "help"))
async def command_start_handler(
    message: Message,
    async_session: AsyncSession,
    admin_username: str,
    telegram_user: TelegramUser,
) -> None:
    text = (
        f"Send me a sticker and I'll put it in your personal sticker pack.\n"
        f"Send me a sticker from a pack create by this bot and this sticker will be removed.\n"
        f"Send me a picture with an emoji caption and I'll create a sticker from it.\n"
        f"If you have any questions, please contact me.\n\n"
        f"<a href='https://t.me/{admin_username}'>Contact</a>"
    )

    user: UserModel | None = await get_user_by_telegram_id(async_session=async_session, telegram_id=telegram_user.id)

    if not user:
        await save_user_to_database(async_session=async_session, telegram_user=telegram_user)
        await message.reply(
            text=f"Welcome, {telegram_user.full_name}!\n\n{text}",
            parse_mode="HTML",
        )
        return

    await message.reply(text=f"Hello, {telegram_user.full_name}!\n\n{text}")


@sticker_router.message(F.sticker)
async def handle_sticker(  # pylint: disable=too-many-arguments # noqa: CFQ002
    message: Message,
    bot: Bot,
    admin_username: str,
    async_session: AsyncSession,
    user: UserModel,
    sticker_set: StickerSetModel | None,
    sticker_set_type: StickerSetType,
    telegram_user: TelegramUser,
    telegram_user_username: str,
    message_sticker: Sticker,
    sticker_emoji: str,
) -> None:
    if sticker_set and message_sticker.set_name == sticker_set.name:
        return await handle_sticker_removal(
            bot=bot,
            message=message,
            admin_username=admin_username,
            received_sticker=message_sticker,
        )

    sticker_file_input = await get_sticker_file_input_from_sticker(
        bot=bot, sticker_set_type=sticker_set_type, sticker=message_sticker
    )

    if not sticker_set:
        return await create_new_sticker_set(
            bot=bot,
            message=message,
            async_session=async_session,
            telegram_user=telegram_user,
            telegram_user_username=telegram_user_username,
            user=user,
            sticker_set_type=sticker_set_type,
            sticker_file_input=sticker_file_input,
            emojis=sticker_emoji,
        )

    return await handle_sticker_addition(
        bot=bot,
        message=message,
        user_sticker_set=sticker_set,
        telegram_user=telegram_user,
        emojis=sticker_emoji,
        sticker_file_input=sticker_file_input,
    )


@picture_router.message(F.photo)
async def handle_picture(  # pylint: disable=too-many-arguments # noqa: CFQ002
    message: Message,
    bot: Bot,
    async_session: AsyncSession,
    user: UserModel,
    sticker_set: StickerSetModel,
    sticker_set_type: StickerSetType,
    telegram_user: TelegramUser,
    telegram_user_username: str,
    picture: PhotoSize,
    emoji: str,
) -> None:
    sticker_file_input = await get_sticker_file_input_from_picture(bot=bot, picture=picture)

    if not sticker_set:
        return await create_new_sticker_set(
            bot=bot,
            message=message,
            async_session=async_session,
            telegram_user=telegram_user,
            telegram_user_username=telegram_user_username,
            user=user,
            sticker_set_type=sticker_set_type,
            sticker_file_input=sticker_file_input,
            emojis=emoji,
        )

    return await handle_sticker_addition(
        bot=bot,
        message=message,
        user_sticker_set=sticker_set,
        telegram_user=telegram_user,
        emojis=emoji,
        sticker_file_input=sticker_file_input,
    )


async def on_startup(bot: Bot) -> None:
    if settings.poll_type == PollType.WEBHOOK:
        webhook_url = settings.webhook_url
        await bot.set_webhook(webhook_url)
        logging.info("Webhook set to: %s", webhook_url)


async def on_shutdown() -> None:
    logging.info("Shutting down...")


def main() -> None:
    bot = Bot(settings.api_token, parse_mode="HTML")

    dp = Dispatcher(events_isolation=SimpleEventIsolation())  # pylint: disable=invalid-name

    dp["async_engine"] = create_async_engine(url=settings.async_database_url, pool_size=20, pool_pre_ping=True)
    dp["admin_username"] = settings.admin_username

    dp.include_router(start_router)
    dp.include_router(sticker_router)
    dp.include_router(picture_router)

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    dp.message.middleware(filter_non_user)  # type: ignore

    start_router.message.middleware(get_async_database_session)  # type: ignore

    sticker_router.message.middleware(filter_non_sticker)  # type: ignore
    sticker_router.message.middleware(get_user_sticker_set_async_session)  # type: ignore

    picture_router.message.middleware(filter_non_photo)  # type: ignore
    picture_router.message.middleware(filter_no_emoji_caption)  # type: ignore
    picture_router.message.middleware(get_user_sticker_set_async_session)  # type: ignore

    if settings.poll_type == PollType.WEBHOOK:
        health = HealthCheck()

        app = web.Application()
        SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=settings.main_bot_path)
        setup_application(app, dp, bot=bot)

        app.add_routes([web.get("/health", health)])

        web.run_app(app, host="0.0.0.0", port=settings.port)

    if settings.poll_type == PollType.POLLING:
        dp.run_polling(bot, skip_updates=True)


if __name__ == "__main__":
    main()
