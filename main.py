from time import sleep
from typing import Optional

from aiogram import Dispatcher, Bot, F as MagicFilter, Router
from aiogram.filters import Command
from aiogram.fsm.storage.memory import SimpleEventIsolation
from aiogram.types import Message, User as TelegramUser, Sticker, PhotoSize, BufferedInputFile
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from sqlalchemy.ext.asyncio import AsyncSession

from config.app import API_TOKEN, ADMIN_TELEGRAM_ID, WEBHOOK, POLL_TYPE, POLLING
from config.log import logger
from model.models import UserModel, StickerSetModel, StickerSetType
from util.photo import get_picture_buffered_input
from util.query.user import get_user_by_telegram_id, save_user
from util.session_middleware import get_async_database_session, filter_non_sticker, filter_non_user, filter_no_caption, \
    get_user_sticker_set_async_session
from util.sticker import create_new_sticker_set, handle_sticker_removal, handle_sticker_addition, \
    get_sticker_file_input_from_picture, get_sticker_file_input_from_sticker
from util.webhook import configure_webhook, get_webhook_url

bot = Bot(API_TOKEN, parse_mode="HTML")

dp = Dispatcher(events_isolation=SimpleEventIsolation())

start_router = Router(name="start router")
sticker_router = Router(name="sticker router")
picture_router = Router(name="picture router")


@start_router.message(Command("start"))
async def command_start_handler(message: Message, async_session: AsyncSession, telegram_user: TelegramUser) -> None:
    text = (
        "Send me a sticker and I'll put it in your personal sticker pack.\n"
        "Send me a sticker from a created sticker pack and I'll remove it.\n\n"
        f"If you have any questions, please contact me. <a href='tg://user?id={ADMIN_TELEGRAM_ID}'>Contact</a>"
    )

    user: Optional[UserModel] = await get_user_by_telegram_id(async_session=async_session, telegram_id=telegram_user.id)

    if not user:
        await save_user(async_session=async_session, telegram_user=telegram_user)
        await message.reply(f"Welcome, {telegram_user.full_name}!\n\n{text}", parse_mode="HTML")
        return

    await message.reply(f"Hello, {telegram_user.full_name}!\n\n{text}")


@sticker_router.message(MagicFilter.sticker)
async def handle_sticker(
        message: Message,
        async_session: AsyncSession,
        user: UserModel,
        sticker_set: Optional[StickerSetModel],
        sticker_set_type: StickerSetType,
        telegram_user: TelegramUser,
        telegram_user_username: str,
        message_sticker: Sticker,
        sticker_emoji: str
) -> None:
    if sticker_set and message_sticker.set_name == sticker_set.name:
        return await handle_sticker_removal(
            bot=bot,
            message=message,
            received_sticker=message_sticker,
        )

    sticker_file_input = await get_sticker_file_input_from_sticker(
        bot=bot,
        api_token=API_TOKEN,
        sticker_set_type=sticker_set_type,
        sticker=message_sticker
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


@picture_router.message(MagicFilter.photo)
async def handle_picture(
        message: Message,
        async_session: AsyncSession,
        user: UserModel,
        sticker_set: StickerSetModel,
        sticker_set_type: StickerSetType,
        telegram_user: TelegramUser,
        telegram_user_username: str,
        picture: PhotoSize,
        emojis: str
) -> None:
    picture_buffered_input: BufferedInputFile = await get_picture_buffered_input(bot=bot, picture=picture)

    sticker_file_input = get_sticker_file_input_from_picture(
        picture_buffered_input=picture_buffered_input
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
            emojis=emojis,
        )

    return await handle_sticker_addition(
        bot=bot,
        message=message,
        user_sticker_set=sticker_set,
        telegram_user=telegram_user,
        emojis=emojis,
        sticker_file_input=sticker_file_input,
    )


async def on_startup() -> None:
    if POLL_TYPE == WEBHOOK:
        webhook_url = get_webhook_url()
        await bot.set_webhook(webhook_url)


async def on_shutdown() -> None:
    if POLL_TYPE == WEBHOOK:
        await bot.session.close()
        await bot.delete_webhook()


def main() -> None:
    dp.include_router(start_router)
    dp.include_router(sticker_router)
    dp.include_router(picture_router)

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    dp.message.middleware(filter_non_user)  # type: ignore

    start_router.message.middleware(get_async_database_session)  # type: ignore

    sticker_router.message.middleware(filter_non_sticker)  # type: ignore
    sticker_router.message.middleware(get_user_sticker_set_async_session)  # type: ignore

    picture_router.message.middleware(filter_no_caption)  # type: ignore
    picture_router.message.middleware(get_user_sticker_set_async_session)  # type: ignore

    if POLL_TYPE == WEBHOOK:
        sleeping_time, webhook_path, port = configure_webhook()
        logger.info(f"Sleeping for {sleeping_time} seconds...")
        sleep(sleeping_time)

        app = web.Application()
        SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=webhook_path)
        setup_application(app, dp, bot=bot)
        logger.info(f"Port: {port}")

        web.run_app(app, host="0.0.0.0", port=port)

    if POLL_TYPE == POLLING:
        dp.run_polling(bot, skip_updates=True)


if __name__ == "__main__":
    main()
