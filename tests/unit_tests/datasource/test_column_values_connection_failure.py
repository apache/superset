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
import pytest
from sqlalchemy.exc import OperationalError

from superset.datasource.api import _is_connection_failure


@pytest.mark.parametrize(
    "orig, connection_invalidated, expected",
    [
        (Exception(1040, "Too many connections"), False, True),
        (Exception(2003, "Can't connect to MySQL server"), False, True),
        (Exception("could not connect to server: Connection refused"), False, True),
        (
            Exception("FATAL: remaining connection slots are reserved"),
            False,
            True,
        ),
        (Exception("server closed the connection unexpectedly"), False, True),
        (Exception("FATAL: sorry, too many clients already"), False, True),
        (Exception("anything"), True, True),
        (Exception("no such column: nope"), False, False),
        (Exception(1054, "Unknown column 'x' in 'field list'"), False, False),
        (
            Exception("canceling statement due to statement timeout"),
            False,
            False,
        ),
    ],
)
def test_is_connection_failure(
    orig: Exception, connection_invalidated: bool, expected: bool
) -> None:
    ex = OperationalError("SELECT 1", {}, orig)
    ex.connection_invalidated = connection_invalidated
    assert _is_connection_failure(ex) is expected
