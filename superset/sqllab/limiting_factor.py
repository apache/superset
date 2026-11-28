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
from superset.utils.backports import StrEnum


class LimitingFactor(StrEnum):
    QUERY = "QUERY"
    DROPDOWN = "DROPDOWN"
    QUERY_AND_DROPDOWN = "QUERY_AND_DROPDOWN"
    NOT_LIMITED = "NOT_LIMITED"
    # The engine stopped fetching early to stay within a memory budget
    # (e.g. ``BQ_FETCH_MAX_MB``), so rows were dropped below the row limit.
    MEMORY = "MEMORY"
    UNKNOWN = "UNKNOWN"


# Limiting factors whose executed SQL carries the ``limit + 1`` probe row, so an
# export that reruns it has to drop that row again.
PADDED_LIMIT_FACTORS = frozenset(
    {
        LimitingFactor.QUERY,
        LimitingFactor.DROPDOWN,
        LimitingFactor.QUERY_AND_DROPDOWN,
        LimitingFactor.MEMORY,
    }
)
