def configure_webhook() -> tuple[int, str, int]:
    from config.app import SLEEPING_TIME
    from config.webhook import PORT, WEBHOOK_PATH

    return SLEEPING_TIME, WEBHOOK_PATH, PORT


def get_webhook_url() -> str:
    from config.webhook import WEBHOOK_URL

    return WEBHOOK_URL
