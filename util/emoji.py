from emoji import distinct_emoji_list


def get_emoji_list(text: str) -> list[str]:
    return distinct_emoji_list(text)  # type: ignore
