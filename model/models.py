from datetime import datetime
from enum import Enum

from sqlalchemy import func, TIMESTAMP, String, ForeignKey, Enum as EnumType
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped, relationship


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)  # noqa: A003, VNE003
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    telegram_id: Mapped[str] = mapped_column(String(512), unique=True)

    sticker_sets: Mapped[list["StickerSetModel"]] = relationship(back_populates="user")


class StickerSetType(Enum):
    REGULAR = 1
    ANIMATED = 2
    VIDEO = 3


class StickerSetModel(Base):
    __tablename__ = "sticker_set"

    id: Mapped[int] = mapped_column(primary_key=True)  # noqa: A003, VNE003
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    name: Mapped[str] = mapped_column(String(256), unique=True)
    title: Mapped[str] = mapped_column(String(256), unique=True)
    sticker_set_type: Mapped[StickerSetType] = mapped_column(
        EnumType(StickerSetType, name="sticker_set_type")
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    user: Mapped["UserModel"] = relationship(back_populates="sticker_sets")
