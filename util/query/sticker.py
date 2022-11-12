from typing import Optional, Sequence

from aiogram.types import Sticker
from imagehash import ImageHash
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config.log import logger
from model.models import StickerModel, StickerSetModel


async def save_sticker(
    async_session: AsyncSession, sticker_set: StickerSetModel, sticker: Sticker, image_hash: ImageHash
) -> StickerModel:
    sticker_model = StickerModel(
        file_unique_id=sticker.file_unique_id,
        file_id=sticker.file_id,
        image_hash=str(image_hash),
        sticker_set=sticker_set,
    )

    async_session.add(sticker_model)

    return sticker_model


async def get_sticker_by_file_unique_id_or_image_hash(
    async_session: AsyncSession, sticker_set: StickerSetModel, file_unique_id: str, image_hash: ImageHash
) -> Optional[StickerModel]:
    result_file_unique_id = await async_session.execute(
        select(StickerModel).where(
            StickerModel.file_unique_id == file_unique_id,
            StickerModel.sticker_set == sticker_set,
        )
    )

    sticker: Optional[StickerModel] = result_file_unique_id.scalars().first()

    if sticker:
        return sticker

    result_image_hash = await async_session.execute(
        select(StickerModel).where(
            StickerModel.image_hash == str(image_hash),
            StickerModel.sticker_set == sticker_set,
        )
    )

    return result_image_hash.scalars().first()


async def is_more_than_one_sticker_in_set(async_session: AsyncSession, sticker_set: StickerSetModel) -> int:
    result = await async_session.execute(select(StickerModel).where(StickerModel.sticker_set == sticker_set))

    stickers: Sequence[StickerModel] = result.scalars().all()

    sticker_count = len(stickers)
    logger.info(f"Sticker count: {sticker_count}")
    return sticker_count > 1


async def remove_sticker(async_session: AsyncSession, image_hash: ImageHash, file_unique_id: str) -> None:
    logger.info("Removing sticker")
    logger.info(f"Image hash: {image_hash}")
    logger.info(f"File unique id: {file_unique_id}")

    await async_session.execute(
        delete(StickerModel).filter(StickerModel.image_hash == str(image_hash)),
    )

    await async_session.execute(delete(StickerModel).filter(StickerModel.file_unique_id == file_unique_id))
