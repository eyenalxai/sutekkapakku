from os import getenv
from random import choices
from string import ascii_letters

DOMAIN = getenv("DOMAIN", "NONE")
assert DOMAIN != "NONE", "DOMAIN is not set"

PORT_STR = getenv("PORT", "NONE")
assert PORT_STR != "NONE", "PORT is not set"
PORT: int = int(PORT_STR)

RANDOM_STRING = "".join(choices(ascii_letters, k=6))
MAIN_BOT_PATH_INITIAL = "/webhook/main"

MAIN_BOT_PATH = f"{MAIN_BOT_PATH_INITIAL}_{RANDOM_STRING}"
