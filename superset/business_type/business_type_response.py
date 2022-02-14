"""
Business type response class
"""

from typing import Any, List, Optional, TypedDict

from superset.utils.core import FilterStringOperators


class BusinessTypeResponse(TypedDict, total=False):
    """
    Business type response
    """

    error_message: Optional[str]
    values: List[Any]  # parsed value (can be any value)
    display_value: str  # The string representation of the parsed vlaues
    valid_filter_operators: List[FilterStringOperators]
