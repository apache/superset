"""
A docstring
"""

from typing import Any, List, Literal, Optional, TypedDict

from superset.utils.core import FilterOperator


class BusinessTypeResponse(TypedDict, total=False):
    """
    A docstring
    """

    status: Literal["valid", "invalid"]
    values: List[Any]  # parsed value (can be any value)
    formatted_value: Optional[str]  # a string representation of the parsed value
<<<<<<< HEAD
    display_value: str # The string representation of the parsed vlaues 
    valid_filter_operators: List[Literal["==", "<=", "<", "IN", ">=", ">"]]
=======
    valid_filter_operators: List[FilterOperator]
>>>>>>> e6d0de6c36eae90ddf1a21dfc770637fc6d8c593
