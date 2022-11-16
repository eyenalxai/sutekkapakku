from os import getenv

DOMAIN = getenv("DOMAIN", "NONE")
assert DOMAIN != "NONE", "DOMAIN is not set"

PORT_STR = getenv("PORT", "NONE")
assert PORT_STR != "NONE", "PORT is not set"
PORT: int = int(PORT_STR)

RANDOM_SEED = getenv("RANDOM_SEED", "NONE")
assert RANDOM_SEED != "NONE", "RANDOM_SEED is not set"

MAIN_BOT_PATH = "/webhook/main"
