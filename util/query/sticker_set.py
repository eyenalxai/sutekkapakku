from typing import Optional

from aiogram.types import Sticker, Message
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from model.models import StickerSetModel, StickerSetType, UserModel


def get_sticker_set_type_from_sticker(sticker: Sticker) -> StickerSetType:
    if sticker.is_animated:
        return StickerSetType.ANIMATED

    if sticker.is_video:
        return StickerSetType.VIDEO

    return StickerSetType.REGULAR


def get_sticker_set_type_from_message(message: Message) -> StickerSetType:
    if message.sticker:
        if message.sticker.is_animated:
            return StickerSetType.ANIMATED

        if message.sticker.is_video:
            return StickerSetType.VIDEO

        return StickerSetType.REGULAR

    if message.photo:
        return StickerSetType.REGULAR

    raise ValueError("Message is not a sticker or a photo.")


async def get_sticker_set_by_user_and_type(
        async_session: AsyncSession, user: UserModel, sticker_set_type: StickerSetType
) -> Optional[StickerSetModel]:
    result = await async_session.execute(
        select(StickerSetModel).where(
            StickerSetModel.user == user,
            StickerSetModel.sticker_set_type == sticker_set_type,
        )
    )

    return result.scalars().first()


async def create_sticker_set(
        async_session: AsyncSession, user: UserModel, sticker_set_type: StickerSetType, name: str, title: str
) -> StickerSetModel:
    sticker_set: StickerSetModel = StickerSetModel(user=user, sticker_set_type=sticker_set_type, name=name, title=title)
    async_session.add(sticker_set)

    return sticker_set
