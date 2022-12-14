from random import choices
from string import ascii_letters
from typing import TypedDict

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import (
    Message,
    Sticker,
    User as TelegramUser,
    File,
    URLInputFile,
    BufferedInputFile,
    PhotoSize,
)
from sqlalchemy.ext.asyncio import AsyncSession

from model.models import StickerSetModel, UserModel, StickerSetType
from util.photo import get_picture_buffered_input
from util.query.sticker_set import create_sticker_set


class StickerFileInput(TypedDict, total=False):
    png_sticker: str | BufferedInputFile
    tgs_sticker: URLInputFile
    webm_sticker: URLInputFile


async def get_sticker_file_input_from_picture(
    bot: Bot, picture: PhotoSize
) -> StickerFileInput:
    picture_buffered_input: BufferedInputFile = await get_picture_buffered_input(
        bot=bot, picture=picture
    )

    return {"png_sticker": picture_buffered_input}


async def get_sticker_file_input_from_sticker(  # noqa: CFQ004, CCR001
    bot: Bot,
    sticker_set_type: StickerSetType,
    sticker: Sticker,
) -> StickerFileInput:
    def build_file_url(_bot: Bot, file_path: str) -> str:
        return f"https://api.telegram.org/file/bot{_bot.token}/{file_path}"

    if (
        sticker_set_type == StickerSetType.ANIMATED
        or sticker_set_type == StickerSetType.VIDEO
    ):
        sticker_file: File = await bot.get_file(file_id=sticker.file_id)

        if not sticker_file.file_path:
            raise Exception("File path is oof.")

        sticker_url = build_file_url(_bot=bot, file_path=sticker_file.file_path)

        url_input_file = URLInputFile(url=sticker_url)

        if sticker_set_type == StickerSetType.ANIMATED:
            return StickerFileInput(tgs_sticker=url_input_file)

        if sticker_set_type == StickerSetType.VIDEO:
            return StickerFileInput(webm_sticker=url_input_file)

    return StickerFileInput(png_sticker=sticker.file_id)


async def create_new_sticker_set(  # noqa: CFQ004, CFQ002
    bot: Bot,
    message: Message,
    sticker_set_type: StickerSetType,
    async_session: AsyncSession,
    telegram_user: TelegramUser,
    telegram_user_username: str,
    user: UserModel,
    emojis: str,
    sticker_file_input: StickerFileInput,
) -> None:
    def build_sticker_set_title(
        _sticker_set_type: StickerSetType, username: str
    ) -> str:
        if _sticker_set_type == StickerSetType.ANIMATED:
            return f"{username}'s Greatest Animated Hits"

        if _sticker_set_type == StickerSetType.VIDEO:
            return f"{username}'s Greatest Video Hits"

        return f"{username}'s Greatest Hits"

    def build_sticker_set_prefix(_telegram_user_username: str) -> str:
        def random_letter_string(length: int) -> str:
            return "".join(choices(ascii_letters, k=length))

        return f"{_telegram_user_username}_{random_letter_string(length=4)}"

    bot_user = await bot.get_me()
    bot_username = bot_user.username

    if not bot_username:
        raise ValueError("Bot username is not set!")

    sticker_set_title = build_sticker_set_title(
        _sticker_set_type=sticker_set_type, username=telegram_user_username
    )

    sticker_pack_prefix: str = build_sticker_set_prefix(
        _telegram_user_username=telegram_user_username
    )
    sticker_set_name = f"{sticker_pack_prefix}_by_{bot_username}"

    sticker_set = await create_sticker_set(
        async_session=async_session,
        user=user,
        sticker_set_type=sticker_set_type,
        name=sticker_set_name,
        title=sticker_set_title,
    )

    await bot.create_new_sticker_set(
        user_id=telegram_user.id,
        name=sticker_set.name,
        title=sticker_set.title,
        emojis=emojis,
        **sticker_file_input,
    )

    await message.reply(
        "Sticker pack created!\n\n"
        f"Link: <a href='https://t.me/addstickers/{sticker_set_name}'>{sticker_set.title}</a>",  # noqa: E501
        parse_mode="HTML",
    )


async def handle_sticker_removal(
    bot: Bot,
    message: Message,
    received_sticker: Sticker,
    admin_username: str,
) -> None:
    try:
        await bot.delete_sticker_from_set(sticker=received_sticker.file_id)
    except TelegramBadRequest as telegram_bad_request:
        if "STICKERSET_NOT_MODIFIED" in telegram_bad_request.message:
            text = (
                "It seems like you tried to remove a sticker from the pack, "
                "but it wasn't in the pack due to a bug in Telegram, most likely. "
                "Please wait 15 minutes and check if sticker is in your pack still.\n"
                "If it is, please contact me!\n\n"
                f"<a href='https://t.me/{admin_username}'>Contact</a>"
            )
            await message.reply(text=text, parse_mode="HTML")
    else:
        await message.reply(
            text="Sticker removed from the pack. It may take a few minutes for sticker pack to update."  # noqa: E501
        )


async def handle_sticker_addition(
    bot: Bot,
    message: Message,
    user_sticker_set: StickerSetModel,
    telegram_user: TelegramUser,
    sticker_file_input: StickerFileInput,
    emojis: str,
) -> None:
    await bot.add_sticker_to_set(
        user_id=telegram_user.id,
        name=user_sticker_set.name,
        emojis=emojis,
        **sticker_file_input,
    )

    await message.reply(
        "Sticker added to the pack.\n\n"
        f"Link: <a href='https://t.me/addstickers/{user_sticker_set.name}'>{user_sticker_set.title}</a>",  # noqa: E501
        parse_mode="HTML",
    )
