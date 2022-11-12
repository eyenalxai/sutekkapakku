from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from model.models import StickerSetModel, StickerSetType, UserModel


async def get_sticker_set_by_user_and_type(
    async_session: AsyncSession, user: UserModel, is_animated: bool
) -> Optional[StickerSetModel]:
    result = await async_session.execute(
        select(StickerSetModel).where(
            StickerSetModel.user == user,
            StickerSetModel.sticker_set_type == (StickerSetType.animated if is_animated else StickerSetType.regular),
        )
    )

    return result.scalars().first()


async def create_sticker_set(
    async_session: AsyncSession, user: UserModel, is_animated: bool, name: str
) -> StickerSetModel:
    sticker_set: StickerSetModel = StickerSetModel(
        user=user,
        sticker_set_type=StickerSetType.animated if is_animated else StickerSetType.regular,
        name=name,
    )
    async_session.add(sticker_set)

    return sticker_set
