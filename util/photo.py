from aiogram.types import PhotoSize


def get_largest_picture(photos: list[PhotoSize]) -> PhotoSize:
    # List all width and height of a photo
    photo_sizes = [(photo.width, photo.height) for photo in photos]
    print(photo_sizes)

    return max(photos, key=lambda photo: photo.width * photo.height)
