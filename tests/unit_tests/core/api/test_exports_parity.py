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
"""Keep the `superset_core.exports` enums in step with the host values they mirror."""

from superset_core.exports.types import (
    GenericDataType as CoreGenericDataType,
    SkipReason,
)

from superset.dashboards.excel_export import email
from superset.utils.core import GenericDataType as HostGenericDataType


def test_generic_data_type_matches_host() -> None:
    assert [(m.name, m.value) for m in CoreGenericDataType] == [
        (m.name, m.value) for m in HostGenericDataType
    ]


def test_skip_reason_matches_excel_error_keys() -> None:
    assert {reason.value for reason in SkipReason} == {
        email.ERROR_NO_QUERY_CONTEXT,
        email.ERROR_UNBOUNDED,
        email.ERROR_GENERAL,
    }
