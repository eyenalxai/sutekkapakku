from config.webhook import MAIN_BOT_PATH


def get_webhook_url() -> str:
    from config.webhook import DOMAIN

    return f"https://{DOMAIN}{MAIN_BOT_PATH}"


def configure_webhook() -> tuple[str, int]:
    from config.webhook import PORT

    return MAIN_BOT_PATH, PORT
