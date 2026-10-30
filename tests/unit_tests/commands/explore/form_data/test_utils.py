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
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.commands.explore.form_data.utils import check_access
from superset.commands.temporary_cache.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheResourceNotFoundError,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils.core import DatasourceType


@pytest.mark.parametrize(
    "error, expected",
    [
        (ChartAccessDeniedError(), TemporaryCacheAccessDeniedError),
        (DatasetAccessDeniedError(), TemporaryCacheAccessDeniedError),
        (
            SupersetSecurityException(
                SupersetError(
                    message="Query access denied",
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.WARNING,
                )
            ),
            TemporaryCacheAccessDeniedError,
        ),
        (ChartNotFoundError(), TemporaryCacheResourceNotFoundError),
        (DatasetNotFoundError(), TemporaryCacheResourceNotFoundError),
    ],
)
def test_check_access_maps_exceptions(
    mocker: MockerFixture,
    error: Exception,
    expected: type[Exception],
) -> None:
    """All form-data commands translate authorization and missing-object errors."""
    explore_check = mocker.patch(
        "superset.commands.explore.form_data.utils.explore_check_access",
        side_effect=error,
    )
    with pytest.raises(expected) as excinfo:
        check_access(1, None, DatasourceType.QUERY)
    assert excinfo.value.__cause__ is error
    explore_check.assert_called_once_with(1, None, DatasourceType.QUERY)
