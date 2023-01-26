def str_to_bool(s: str) -> bool:
    """
    Converts a string to a boolean.

    :param s: String
    :return: Boolean
    """
    return s.lower() in ("true", "t", "1")
