from os import getenv

API_TOKEN: str = getenv("API_TOKEN", "NONE")
assert API_TOKEN != "NONE", "API_TOKEN is not set"

PROD_DEPLOY = "WEBHOOK"
DEV_DEPLOY = "POLLING"
DEPLOY_METHOD = getenv("DEPLOY_METHOD", "NONE")
assert DEPLOY_METHOD != "NONE", "DEPLOY_METHOD is not set"
assert DEPLOY_METHOD in [DEV_DEPLOY, PROD_DEPLOY], "DEPLOY_METHOD is not valid"

# In seconds
SLEEPING_TIME = 60
