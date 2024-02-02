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
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Literal, Optional, TYPE_CHECKING, TypedDict, Union

from typing_extensions import NotRequired
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
    label: str
    sqlExpression: str
    columnType: Optional[Literal["BASE_AXIS", "SERIES"]]
    timeGrain: Optional[str]


class SQLAColumnType(TypedDict):
    name: str
    type: Optional[str]
    is_dttm: bool


class ResultSetColumnType(TypedDict):
    """
    Superset virtual dataset column interface
    """

    name: str  # legacy naming convention keeping this for backwards compatibility
    column_name: str
    type: Optional[str]
    is_dttm: Optional[bool]
    type_generic: NotRequired[Optional["GenericDataType"]]

    nullable: NotRequired[Any]
    default: NotRequired[Any]
    comment: NotRequired[Any]
    precision: NotRequired[Any]
    scale: NotRequired[Any]
    max_length: NotRequired[Any]

    query_as: NotRequired[Any]


CacheConfig = dict[str, Any]
DbapiDescriptionRow = tuple[
    Union[str, bytes],
    str,
    Optional[str],
    Optional[str],
    Optional[int],
    Optional[int],
    bool,
]
DbapiDescription = Union[list[DbapiDescriptionRow], tuple[DbapiDescriptionRow, ...]]
DbapiResult = Sequence[Union[list[Any], tuple[Any, ...]]]
FilterValue = Union[bool, datetime, float, int, str]
FilterValues = Union[FilterValue, list[FilterValue], tuple[FilterValue]]
FormData = dict[str, Any]
Granularity = Union[str, dict[str, Union[str, float]]]
Column = Union[AdhocColumn, str]
Metric = Union[AdhocMetric, str]
OrderBy = tuple[Metric, bool]
QueryObjectDict = dict[str, Any]
VizData = Optional[Union[list[Any], dict[Any, Any]]]
VizPayload = dict[str, Any]

# Flask response.
Base = Union[bytes, str]
Status = Union[int, str]
Headers = dict[str, Any]
FlaskResponse = Union[
    Response,
    Base,
    tuple[Base, Status],
    tuple[Base, Status, Headers],
    tuple[Response, Status],
]
