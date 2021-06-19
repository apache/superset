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
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

from flask import Flask
from flask_caching import Cache
from typing_extensions import TypedDict
from werkzeug.wrappers import Response


class AdhocMetricColumn(TypedDict):
    column_name: Optional[str]
    type: str


class AdhocMetric(TypedDict):
    aggregate: str
    column: AdhocMetricColumn
    expressionType: str
    label: str
    sqlExpression: Optional[str]


CacheConfig = Union[Callable[[Flask], Cache], Dict[str, Any]]
DbapiDescriptionRow = Tuple[
    str, str, Optional[str], Optional[str], Optional[int], Optional[int], bool
]
DbapiDescription = Union[List[DbapiDescriptionRow], Tuple[DbapiDescriptionRow, ...]]
DbapiResult = Sequence[Union[List[Any], Tuple[Any, ...]]]
FilterValue = Union[datetime, float, int, str]
FilterValues = Union[FilterValue, List[FilterValue], Tuple[FilterValue]]
FormData = Dict[str, Any]
Granularity = Union[str, Dict[str, Union[str, float]]]
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
    Response, Base, Tuple[Base, Status], Tuple[Base, Status, Headers],
]
