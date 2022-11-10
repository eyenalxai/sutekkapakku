from os import getenv

from config.app import API_TOKEN

DOMAIN = getenv("DOMAIN", "NONE")
assert DOMAIN != "NONE", "DOMAIN is not set"

PORT_STR = getenv("PORT", "NONE")
assert PORT_STR != "NONE", "PORT is not set"
PORT: int = int(PORT_STR)

# Configure webhook
WEBHOOK_PATH = f"/webhook/${API_TOKEN}"
WEBHOOK_URL = f"https://{DOMAIN}{WEBHOOK_PATH}"
