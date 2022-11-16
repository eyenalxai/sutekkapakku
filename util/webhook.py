def get_webhook_url() -> str:
    from config.webhook import DOMAIN, MAIN_BOT_PATH

    return f"https://{DOMAIN}{MAIN_BOT_PATH}"


def configure_webhook() -> tuple[str, int]:
    from config.webhook import PORT, MAIN_BOT_PATH

    return MAIN_BOT_PATH, PORT
