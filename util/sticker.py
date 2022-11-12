import string
from random import choices

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import Message, Sticker, User as TelegramUser
from imagehash import ImageHash
from sqlalchemy.ext.asyncio import AsyncSession

from config.app import ENVIRONMENT, PROD_ENV_NAME
from config.log import logger
from model.models import StickerSetModel, UserModel
from util.query.sticker import save_sticker, is_more_than_one_sticker_in_set, remove_sticker
from util.query.sticker_set import create_sticker_set


def random_letter_string(length: int) -> str:
    return "".join(choices(string.ascii_letters, k=length))


def build_sticker_set_prefix(telegram_user_username: str) -> str:
    if ENVIRONMENT == PROD_ENV_NAME:
        return f"{telegram_user_username}_{random_letter_string(3)}"

    return random_letter_string(length=6)


async def create_new_sticker_set(
    bot: Bot,
    message: Message,
    sticker: Sticker,
    async_session: AsyncSession,
    telegram_user: TelegramUser,
    telegram_user_username: str,
    user: UserModel,
    bot_username: str,
    emoji: str,
    image_hash: ImageHash,
) -> None:
    sticker_pack_prefix: str = build_sticker_set_prefix(telegram_user_username=telegram_user_username)
    sticker_set_name = f"{sticker_pack_prefix}_by_{bot_username}"

    sticker_set = await create_sticker_set(
        async_session=async_session, user=user, is_animated=sticker.is_animated, name=sticker_set_name
    )

    sticker_model = await save_sticker(
        async_session=async_session,
        sticker_set=sticker_set,
        sticker=sticker,
        image_hash=image_hash,
    )

    await bot.create_new_sticker_set(
        user_id=telegram_user.id,
        name=sticker_set_name,
        title=f"{telegram_user_username}'s Greatest Hits",
        emojis=emoji,
        png_sticker=sticker_model.file_id,
    )

    await message.reply(f"Sticker pack created!\n\nLink: https://t.me/addstickers/{sticker_set.name}")


async def handle_sticker_removal(
    async_session: AsyncSession,
    bot: Bot,
    message: Message,
    user_sticker_set: StickerSetModel,
    received_sticker: Sticker,
    image_hash: ImageHash,
) -> None:
    if await is_more_than_one_sticker_in_set(async_session=async_session, sticker_set=user_sticker_set):
        try:
            await bot.delete_sticker_from_set(sticker=received_sticker.file_id)
        except TelegramBadRequest as e:
            if "STICKERSET_NOT_MODIFIED" in e.message:
                logger.warning(f"User tried to remove sticker from set, but it wasn't in the set.")
                await message.reply(
                    "It seems like you tried to remove a sticker from the pack, "
                    "but it wasn't in the set due to a bug in Telegram, most likely. "
                    "Please wait 15 minutes and check if sticker is in your pack still.\n"
                    f"If it's not, please contact me and report this issue."
                )
        else:
            await message.reply("Sticker removed from the pack.")
        finally:
            await remove_sticker(
                async_session=async_session, image_hash=image_hash, file_unique_id=received_sticker.file_unique_id
            )

        return

    await message.reply("Can't remove last sticker in the pack.")
    return


async def handle_sticker_addition(
    async_session: AsyncSession,
    bot: Bot,
    message: Message,
    user_sticker_set: StickerSetModel,
    received_sticker: Sticker,
    image_hash: ImageHash,
    telegram_user: TelegramUser,
    emoji: str,
) -> None:
    await save_sticker(
        async_session=async_session,
        sticker_set=user_sticker_set,
        sticker=received_sticker,
        image_hash=image_hash,
    )

    await bot.add_sticker_to_set(
        user_id=telegram_user.id,
        name=user_sticker_set.name,
        emojis=emoji,
        png_sticker=received_sticker.file_id,
    )

    await message.reply(f"Sticker added to the pack.\nLink: https://t.me/addstickers/{user_sticker_set.name}")
