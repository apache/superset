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
from unittest.mock import MagicMock

import pytest
from flask_appbuilder import Model
from jinja2.exceptions import TemplateError
from pytest_mock import MockerFixture

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.sql_lab import Query, SavedQuery


@pytest.mark.parametrize(
    "klass",
    [
        Query,
        SavedQuery,
    ],
)
@pytest.mark.parametrize(
    "exception",
    [
        SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                message="",
                level=ErrorLevel.ERROR,
            )
        ),
        TemplateError,
    ],
)
def test_sql_tables_mixin_sql_tables_exception(
    klass: type[Model],
    exception: Exception,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.models.sql_lab.extract_tables_from_jinja_sql",
        side_effect=exception,
    )

    assert klass(sql="SELECT 1", database=MagicMock()).sql_tables == []
