from aiogram.types import Sticker, Message
from multipledispatch import dispatch  # type: ignore
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from model.models import StickerSetModel, StickerSetType, UserModel


@dispatch(Message)
def get_sticker_set_type(message: Message) -> StickerSetType:  # noqa: CFQ004
    if message.sticker:
        if message.sticker.is_animated:
            return StickerSetType.ANIMATED

        if message.sticker.is_video:
            return StickerSetType.VIDEO

        return StickerSetType.REGULAR

    if message.photo:
        return StickerSetType.REGULAR

    raise ValueError("Message is not a sticker or a photo.")


@dispatch(Sticker)  # type: ignore
def get_sticker_set_type(sticker: Sticker) -> StickerSetType:  # noqa: F811
    if sticker.is_animated:
        return StickerSetType.ANIMATED

    if sticker.is_video:
        return StickerSetType.VIDEO

    return StickerSetType.REGULAR


async def get_sticker_set_for_user_by_type(
    async_session: AsyncSession,
    user: UserModel,
    sticker_set_type: StickerSetType,
) -> StickerSetModel | None:
    result = await async_session.execute(
        select(StickerSetModel).where(
            StickerSetModel.user == user,
            StickerSetModel.sticker_set_type == sticker_set_type,
        )
    )

    return result.scalars().first()


async def create_sticker_set(
    async_session: AsyncSession,
    user: UserModel,
    sticker_set_type: StickerSetType,
    name: str,
    title: str,
) -> StickerSetModel:
    sticker_set: StickerSetModel = StickerSetModel(user=user, sticker_set_type=sticker_set_type, name=name, title=title)
    async_session.add(sticker_set)

    return sticker_set
