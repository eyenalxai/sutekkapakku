from random import choices
from string import ascii_letters


def get_main_bot_path() -> str:
    from config.webhook import MAIN_BOT_PATH
    random_string = "".join(choices(ascii_letters, k=8))

    return f"{MAIN_BOT_PATH}_{random_string}"


def get_webhook_url() -> str:
    from config.webhook import DOMAIN

    main_bot_path = get_main_bot_path()
    return f"https://{DOMAIN}{main_bot_path}"


def configure_webhook() -> tuple[str, int]:
    from config.webhook import PORT

    main_bot_path = get_main_bot_path()
    return main_bot_path, PORT
