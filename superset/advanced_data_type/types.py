# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from dataclasses import dataclass
from typing import Any, Callable, List, Optional, TypedDict, Union

from sqlalchemy import Column
from sqlalchemy.sql.expression import BinaryExpression

from superset.superset_typing import FilterValues
from superset.utils.core import FilterOperator, FilterStringOperators


class AdvancedDataTypeRequest(TypedDict):
    """
    AdvancedDataType request class
    """

    advanced_data_type: str
    values: List[
        Union[FilterValues, None]
    ]  # unparsed value (usually text when passed from text box)


class AdvancedDataTypeResponse(TypedDict, total=False):
    """
    AdvancedDataType response
    """

    error_message: Optional[str]
    values: List[Any]  # parsed value (can be any value)
    display_value: str  # The string representation of the parsed values
    valid_filter_operators: List[FilterStringOperators]


@dataclass
class AdvancedDataType:
    """
    Used for coverting base type value into an advanced type value
    """

    verbose_name: str
    description: str
    valid_data_types: List[str]
    translate_type: Callable[[AdvancedDataTypeRequest], AdvancedDataTypeResponse]
    translate_filter: Callable[[Column, FilterOperator, Any], BinaryExpression]
