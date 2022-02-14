"""
Business type request class
"""

from typing import List, TypedDict, Union

from superset.typing import FilterValues


class BusinessTypeRequest(TypedDict):
    """
    Business type request
    """

    business_type: str
    values: List[
        Union[FilterValues, None]
    ]  # unparsed value (usually text when passed from text box)
