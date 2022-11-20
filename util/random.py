from random import choices
from string import ascii_letters


def random_letter_string(length: int) -> str:
    return "".join(choices(ascii_letters, k=length))
