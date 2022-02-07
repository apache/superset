import ipaddress
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Literal, Optional, TypedDict

from numpy import vectorize
from sqlalchemy import Column

from superset.business_type.business_type_request import BusinessTypeRequest
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterOperator


@dataclass
class BusinessType:
    verbose_name: str
    description: str
    valid_data_types: List[str]
    translate_type: Callable[[BusinessTypeRequest], BusinessTypeResponse]
    translate_filter: Callable[[Column, FilterOperator, Any], List[Any]]
