import re

from typing import Optional


def remove_special_characters(input_string: Optional[str]) -> Optional[str]:
    """
    Removes all special characters and non-ASCII characters from the input string,
    and replaces spaces with underscores.
    """
    if input_string is None:
        return None
    # Remove non-ASCII characters
    ascii_only = re.sub(r"[^\x00-\x7F]", "", input_string)
    # Remove special characters (keeping only alphanumeric and spaces)
    cleaned_string = re.sub(r"[^a-zA-Z0-9\s]", "", ascii_only)
    stripped_string = cleaned_string.strip()
    # Replace spaces with underscores
    result_string = re.sub(r"\s+", "_", stripped_string)
    # Label has a max length of 63 characters, truncate if it is exceeded
    return result_string.lower()[:63]
