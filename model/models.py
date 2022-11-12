from datetime import datetime
from enum import Enum

from sqlalchemy import func, TIMESTAMP, String, ForeignKey, Enum as EnumType
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped, relationship


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    telegram_id: Mapped[str] = mapped_column(String(512), unique=True)

    sticker_sets: Mapped[list["StickerSetModel"]] = relationship(back_populates="user")


class StickerSetType(Enum):
    regular = 1
    animated = 2


class StickerSetModel(Base):
    __tablename__ = "sticker_set"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    name: Mapped[str] = mapped_column(String(256), unique=True)
    sticker_set_type: Mapped[StickerSetType] = mapped_column(EnumType(StickerSetType, name="sticker_set_type"))

    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    user: Mapped["UserModel"] = relationship(back_populates="sticker_sets")

    stickers: Mapped[list["StickerModel"]] = relationship(back_populates="sticker_set")


class StickerModel(Base):
    __tablename__ = "sticker"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    file_id: Mapped[str] = mapped_column(String(512))
    file_unique_id: Mapped[str] = mapped_column(String(512))
    image_hash: Mapped[str] = mapped_column(String(256))

    sticker_set_id: Mapped[int] = mapped_column(ForeignKey("sticker_set.id"))
    sticker_set: Mapped["StickerSetModel"] = relationship(back_populates="stickers")
