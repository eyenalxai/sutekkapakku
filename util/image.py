from typing import BinaryIO

from PIL import Image  # type: ignore
from imagehash import average_hash, ImageHash


async def calculate_hash(sticker_image: BinaryIO) -> ImageHash:
    image = Image.open(sticker_image)
    return average_hash(image, 8)
