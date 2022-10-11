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
from typing import Any, List

from werkzeug.routing import BaseConverter, Map

from superset.tags.models import ObjectTypes


class RegexConverter(BaseConverter):
    def __init__(self, url_map: Map, *items: List[str]) -> None:
        super().__init__(url_map)  # type: ignore
        self.regex = items[0]


class ObjectTypeConverter(BaseConverter):
    """Validate that object_type is indeed an object type."""

    def to_python(self, value: str) -> Any:
        return ObjectTypes[value]

    def to_url(self, value: Any) -> str:
        return value.name
