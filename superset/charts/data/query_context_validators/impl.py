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
from __future__ import annotations

from typing import List, TYPE_CHECKING

from . import QueryContextValidator

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject


class QueryContextValidatorImpl(
    QueryContextValidator
):  # pylint: disable=too-few-public-methods
    _access_validator: QueryContextValidator

    def __init__(self, access_validator: QueryContextValidator):
        self._access_validator = access_validator

    def validate(self, query_context: QueryContext) -> None:
        self._access_validator.validate(query_context)
        self._validate_queries_context(query_context.queries)

    def _validate_queries_context(  # pylint: disable=no-self-use
        self, query_objects: List[QueryObject]
    ) -> None:
        query: QueryObject
        for query in query_objects:
            query.validate()


class QueryContextValidatorWrapper(
    QueryContextValidator
):  # pylint: disable=too-few-public-methods
    def validate(self, query_context: QueryContext) -> None:
        query_context.raise_for_access()
