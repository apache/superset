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
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple, TYPE_CHECKING, Union

from typing_extensions import Literal, TypedDict
from werkzeug.wrappers import Response

if TYPE_CHECKING:
    from superset.utils.core import GenericDataType


class LegacyMetric(TypedDict):
    label: Optional[str]


class AdhocMetricColumn(TypedDict, total=False):
    column_name: Optional[str]
    description: Optional[str]
    expression: Optional[str]
    filterable: bool
    groupby: bool
    id: int
    is_dttm: bool
    python_date_format: Optional[str]
    type: str
    type_generic: "GenericDataType"
    verbose_name: Optional[str]


class AdhocMetric(TypedDict, total=False):
    aggregate: str
    column: Optional[AdhocMetricColumn]
    expressionType: Literal["SIMPLE", "SQL"]
    hasCustomLabel: Optional[bool]
    label: Optional[str]
    sqlExpression: Optional[str]


class AdhocColumn(TypedDict, total=False):
    hasCustomLabel: Optional[bool]
    label: Optional[str]
    sqlExpression: Optional[str]


CacheConfig = Dict[str, Any]
DbapiDescriptionRow = Tuple[
    str, str, Optional[str], Optional[str], Optional[int], Optional[int], bool
]
DbapiDescription = Union[List[DbapiDescriptionRow], Tuple[DbapiDescriptionRow, ...]]
DbapiResult = Sequence[Union[List[Any], Tuple[Any, ...]]]
FilterValue = Union[bool, datetime, float, int, str]
FilterValues = Union[FilterValue, List[FilterValue], Tuple[FilterValue]]
FormData = Dict[str, Any]
Granularity = Union[str, Dict[str, Union[str, float]]]
Column = Union[AdhocColumn, str]
Metric = Union[AdhocMetric, str]
OrderBy = Tuple[Metric, bool]
QueryObjectDict = Dict[str, Any]
VizData = Optional[Union[List[Any], Dict[Any, Any]]]
VizPayload = Dict[str, Any]

# Flask response.
Base = Union[bytes, str]
Status = Union[int, str]
Headers = Dict[str, Any]
FlaskResponse = Union[
    Response,
    Base,
    Tuple[Base, Status],
    Tuple[Base, Status, Headers],
    Tuple[Response, Status],
]
