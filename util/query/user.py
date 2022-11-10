from typing import Optional

from aiogram.types import User as TelegramUser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from model.models import UserModel


async def get_user_by_telegram_id(async_session: AsyncSession, telegram_id: int) -> Optional[UserModel]:
    result = await async_session.execute(select(UserModel).where(UserModel.telegram_id == str(telegram_id)))

    return result.scalars().first()


async def save_user(telegram_user: TelegramUser, async_session: AsyncSession) -> None:
    user: UserModel = UserModel(
        telegram_id=str(telegram_user.id),
    )
    async_session.add(user)

    return None
