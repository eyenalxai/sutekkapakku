from random import choices
from string import ascii_letters
from typing import TypedDict

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import Message, Sticker, User as TelegramUser, File, URLInputFile
from sqlalchemy.ext.asyncio import AsyncSession

from config.app import ADMIN_TELEGRAM_ID, PROD_ENV_NAME, ENVIRONMENT
from config.log import logger
from model.models import StickerSetModel, UserModel, StickerSetType
from util.query.sticker_set import create_sticker_set, get_sticker_set_type_from_sticker


class StickerFileInput(TypedDict, total=False):
    png_sticker: str
    tgs_sticker: URLInputFile
    webm_sticker: URLInputFile


async def get_sticker_file_input(
        bot: Bot, api_token: str, sticker_set_type: StickerSetType, sticker: Sticker
) -> StickerFileInput:
    def build_file_url(_api_token: str, file_path: str) -> str:
        return f"https://api.telegram.org/file/bot{_api_token}/{file_path}"

    if sticker_set_type == StickerSetType.ANIMATED or sticker_set_type == StickerSetType.VIDEO:
        file: File = await bot.get_file(file_id=sticker.file_id)

        if not file.file_path:
            raise ValueError("File path is oof.")

        sticker_url = build_file_url(_api_token=api_token, file_path=file.file_path)

        url_input_file = URLInputFile(url=sticker_url)

        if sticker_set_type == StickerSetType.ANIMATED:
            return StickerFileInput(tgs_sticker=url_input_file)

        if sticker_set_type == StickerSetType.VIDEO:
            return StickerFileInput(webm_sticker=url_input_file)

    return StickerFileInput(png_sticker=sticker.file_id)


async def create_new_sticker_set(
        bot: Bot,
        api_token: str,
        message: Message,
        sticker: Sticker,
        async_session: AsyncSession,
        telegram_user: TelegramUser,
        telegram_user_username: str,
        user: UserModel,
        emoji: str,
) -> None:
    def build_sticker_set_title(_sticker_set_type: StickerSetType, username: str) -> str:
        if _sticker_set_type == StickerSetType.ANIMATED:
            return f"{username}'s Greatest Animated Hits"

        if _sticker_set_type == StickerSetType.VIDEO:
            return f"{username}'s Greatest Video Hits"

        return f"{username}'s Greatest Hits"

    def build_sticker_set_prefix(_telegram_user_username: str) -> str:
        def random_letter_string(length: int) -> str:
            return "".join(choices(ascii_letters, k=length))

        if ENVIRONMENT == PROD_ENV_NAME:
            return f"{_telegram_user_username}_{random_letter_string(3)}"

        return random_letter_string(length=6)

    bot_user = await bot.get_me()
    bot_username = bot_user.username

    if not bot_username:
        raise ValueError("Bot username is not set!")

    sticker_set_type = get_sticker_set_type_from_sticker(sticker=sticker)

    sticker_set_title = build_sticker_set_title(_sticker_set_type=sticker_set_type, username=telegram_user_username)

    sticker_pack_prefix: str = build_sticker_set_prefix(_telegram_user_username=telegram_user_username)
    sticker_set_name = f"{sticker_pack_prefix}_by_{bot_username}"

    sticker_set = await create_sticker_set(
        async_session=async_session,
        user=user,
        sticker=sticker,
        name=sticker_set_name,
        title=sticker_set_title,
    )

    sticker_file_input: StickerFileInput = await get_sticker_file_input(
        bot=bot, api_token=api_token, sticker_set_type=sticker_set_type, sticker=sticker
    )

    await bot.create_new_sticker_set(
        user_id=telegram_user.id,
        name=sticker_set.name,
        title=sticker_set.title,
        emojis=emoji,
        **sticker_file_input,
    )

    await message.reply(
        "Sticker pack created!\n\n"
        f"Link: <a href='https://t.me/addstickers/{sticker_set_name}'>{sticker_set.title}</a>",
        parse_mode="HTML",
    )


async def handle_sticker_removal(
        bot: Bot,
        message: Message,
        received_sticker: Sticker,
) -> None:
    try:
        await bot.delete_sticker_from_set(sticker=received_sticker.file_id)
    except TelegramBadRequest as e:
        if "STICKERSET_NOT_MODIFIED" in e.message:
            logger.warning(f"User tried to remove sticker from set, but it wasn't in the set.")
            await message.reply(
                "It seems like you tried to remove a sticker from the pack, "
                "but it wasn't in the pack due to a bug in Telegram, most likely. "
                "Please wait 15 minutes and check if sticker is in your pack still.\n"
                f"If it is, please contact me. <a href='tg://user?id={ADMIN_TELEGRAM_ID}'>Contact</a>",
                parse_mode="HTML",
            )
    else:
        await message.reply("Sticker removed from the pack.")


async def handle_sticker_addition(
        bot: Bot,
        api_token: str,
        message: Message,
        user_sticker_set: StickerSetModel,
        sticker: Sticker,
        telegram_user: TelegramUser,
        emoji: str,
) -> None:
    sticker_set_type = get_sticker_set_type_from_sticker(sticker=sticker)

    sticker_file_input: StickerFileInput = await get_sticker_file_input(
        bot=bot, api_token=api_token, sticker_set_type=sticker_set_type, sticker=sticker
    )

    await bot.add_sticker_to_set(
        user_id=telegram_user.id,
        name=user_sticker_set.name,
        emojis=emoji,
        **sticker_file_input,
    )

    await message.reply("Sticker added to the pack.")
