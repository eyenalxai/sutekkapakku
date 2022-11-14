from os import getenv

DOMAIN = getenv("DOMAIN", "NONE")
assert DOMAIN != "NONE", "DOMAIN is not set"

PORT_STR = getenv("PORT", "NONE")
assert PORT_STR != "NONE", "PORT is not set"
PORT: int = int(PORT_STR)

MAIN_BOT_PATH = "/webhook/main"
