from io import BytesIO
from typing import BinaryIO, Optional

from PIL import Image  # type: ignore
from aiogram import Bot
from aiogram.types import PhotoSize


def get_image_bytes(bytes_io: BytesIO, resized_image: Image) -> bytes:
    resized_image.save(bytes_io, format="JPEG")
    return bytes_io.getvalue()


async def get_resized_image_bytes(bot: Bot, picture: PhotoSize) -> bytes:
    downloaded_image: Optional[BinaryIO] = await bot.download(file=picture.file_id)

    if not downloaded_image:
        raise ValueError("Can't download downloaded_image")

    with BytesIO() as bytes_io:
        with Image.open(downloaded_image) as pil_image:
            ratio = pil_image.width / pil_image.height

            if ratio > 1:
                resized_image = pil_image.resize((512, int(512 / ratio)))
                return get_image_bytes(bytes_io=bytes_io, resized_image=resized_image)

            resized_image = pil_image.resize((int(512 * ratio), 512))
            return get_image_bytes(bytes_io=bytes_io, resized_image=resized_image)


def get_largest_picture(pictures: list[PhotoSize]) -> PhotoSize:
    return max(pictures, key=lambda photo: photo.width * photo.height)
