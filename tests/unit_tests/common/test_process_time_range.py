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
from superset.common.query_object_factory import QueryObjectFactory
from superset.constants import NO_TIME_RANGE


def test_process_time_range():
    """
    correct empty time range
    """
    assert QueryObjectFactory._process_time_range(None) == NO_TIME_RANGE

    """
    Use the first temporal filter as time range
    """
    filters = [
        {"col": "dttm", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"},
        {"col": "dttm2", "op": "TEMPORAL_RANGE", "val": "2002 : 2003"},
    ]
    assert QueryObjectFactory._process_time_range(None, filters) == "2001 : 2002"

    """
    Use the BASE_AXIS temporal filter as time range
    """
    columns = [
        {
            "columnType": "BASE_AXIS",
            "label": "dttm2",
            "sqlExpression": "dttm",
        }
    ]
    assert (
        QueryObjectFactory._process_time_range(None, filters, columns) == "2002 : 2003"
    )
