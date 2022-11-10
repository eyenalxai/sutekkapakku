from time import sleep
from typing import Optional

from aiogram import Dispatcher, Bot
from aiogram.types import Message, User as TelegramUser
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from sqlalchemy.ext.asyncio import AsyncSession

from config.app import PROD_ENV_NAME, API_TOKEN, ENVIRONMENT, DEV_ENV_NAME
from config.log import logger
from model.models import UserModel
from util.query.user import get_user_by_telegram_id, save_user
from util.session_middleware import get_async_database_session, filter_non_user
from util.webhook import configure_webhook, get_webhook_url

dp = Dispatcher()
bot = Bot(API_TOKEN, parse_mode="HTML")


@dp.message()
async def command_start_handler(message: Message, async_session: AsyncSession, telegram_user: TelegramUser) -> None:
    user: Optional[UserModel] = await get_user_by_telegram_id(async_session=async_session, telegram_id=telegram_user.id)

    if not user:
        await save_user(async_session=async_session, telegram_user=telegram_user)
        await message.answer(f"Welcome, {telegram_user.full_name}!")
        return

    await message.answer(f"Welcome back, {telegram_user.full_name}!")


async def on_startup() -> None:
    if ENVIRONMENT == PROD_ENV_NAME:
        webhook_url = get_webhook_url()
        await bot.set_webhook(webhook_url)


async def on_shutdown() -> None:
    if ENVIRONMENT == PROD_ENV_NAME:
        await bot.session.close()
        await bot.delete_webhook()


def main() -> None:
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    dp.message.middleware(filter_non_user)  # type: ignore
    dp.message.middleware(get_async_database_session)  # type: ignore

    if ENVIRONMENT == PROD_ENV_NAME:
        sleeping_time, webhook_path, port = configure_webhook()
        logger.info(f"Sleeping for {sleeping_time} seconds...")
        sleep(sleeping_time)

        app = web.Application()
        SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=webhook_path)
        setup_application(app, dp, bot=bot)
        logger.info(f"Port: {port}")

        web.run_app(app, host="0.0.0.0", port=port)

    if ENVIRONMENT == DEV_ENV_NAME:
        dp.run_polling(bot, skip_updates=True)


if __name__ == "__main__":
    main()
