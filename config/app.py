from os import getenv

API_TOKEN: str = getenv("API_TOKEN", "NONE")
assert API_TOKEN != "NONE", "API_TOKEN is not set"

WEBHOOK = "WEBHOOK"
POLLING = "POLLING"
POLL_TYPE = getenv("POLL_TYPE", "NONE")
assert POLL_TYPE != "NONE", "POLL_TYPE is not set"
assert POLL_TYPE in [POLLING, WEBHOOK], "POLL_TYPE is not valid"

PROD_ENV_NAME = "PROD"
DEV_ENV_NAME = "DEV"
ENVIRONMENT = getenv("ENVIRONMENT", "NONE")
assert ENVIRONMENT != "NONE", "ENVIRONMENT is not set"
assert ENVIRONMENT in [DEV_ENV_NAME, PROD_ENV_NAME], "ENVIRONMENT is not set"

ADMIN_USERNAME = getenv("ADMIN_USERNAME", "NONE")
assert ADMIN_USERNAME != "NONE", "ADMIN_USERNAME is not set"

# In seconds
SLEEPING_TIME = 60
