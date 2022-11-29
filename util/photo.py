from io import BytesIO
from typing import BinaryIO

from PIL import Image  # type: ignore
from aiogram import Bot
from aiogram.types import PhotoSize, BufferedInputFile


def get_picture_bytes(bytes_io: BytesIO, resized_picture: Image, filename: str) -> BufferedInputFile:
    resized_picture.save(bytes_io, format="JPEG")
    picture_bytes = bytes_io.getvalue()
    return BufferedInputFile(picture_bytes, filename=filename)


async def get_picture_buffered_input(bot: Bot, picture: PhotoSize) -> BufferedInputFile:
    downloaded_image: BinaryIO | None = await bot.download(file=picture.file_id)

    if not downloaded_image:
        raise ValueError("Can't download downloaded_image")

    with BytesIO() as bytes_io:
        with Image.open(downloaded_image) as pil_image:
            ratio = pil_image.width / pil_image.height
            filename = f"{picture.file_unique_id}.png"
            if ratio > 1:
                resized_picture = pil_image.resize((512, int(512 / ratio)))
                return get_picture_bytes(
                    bytes_io=bytes_io,
                    resized_picture=resized_picture,
                    filename=filename,
                )

            resized_picture = pil_image.resize((int(512 * ratio), 512))
            return get_picture_bytes(
                bytes_io=bytes_io,
                resized_picture=resized_picture,
                filename=filename,
            )


def get_largest_picture(pictures: list[PhotoSize]) -> PhotoSize:
    return max(pictures, key=lambda photo: photo.width * photo.height)
