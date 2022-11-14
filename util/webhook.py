def get_webhook_url() -> str:
    from config.webhook import DOMAIN, MAIN_BOT_PATH

    return f"https://{DOMAIN}{MAIN_BOT_PATH}"


def configure_webhook() -> tuple[int, str, int]:
    from config.app import SLEEPING_TIME
    from config.webhook import PORT, MAIN_BOT_PATH

    return SLEEPING_TIME, MAIN_BOT_PATH, PORT
