from os import getenv

API_TOKEN: str = getenv("API_TOKEN", "NONE")
assert API_TOKEN != "NONE", "API_TOKEN is not set"

PROD_ENV_NAME = "PROD"
DEV_ENV_NAME = "DEV"
ENVIRONMENT = getenv("ENVIRONMENT", "NONE")
assert ENVIRONMENT != "NONE", "ENVIRONMENT is not set"
assert ENVIRONMENT in [DEV_ENV_NAME, PROD_ENV_NAME], "ENVIRONMENT is not valid"

# In seconds
SLEEPING_TIME = 60
