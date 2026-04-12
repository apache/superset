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
"""Unit tests for per-object access check in DuplicateDatasetCommand."""

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.dataset.exceptions import DatasetAccessDeniedError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="Access denied to dataset",
            level=ErrorLevel.ERROR,
        )
    )


def test_duplicate_dataset_forbidden_when_no_access() -> None:
    """DuplicateDatasetCommand.validate() must raise DatasetAccessDeniedError
    when the caller lacks read access to the source dataset."""
    from superset.commands.dataset.duplicate import DuplicateDatasetCommand

    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.kind = "virtual"

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_dataset,
    ):
        with patch(
            "superset.commands.dataset.duplicate.security_manager.raise_for_access",
            side_effect=_security_exception(),
        ):
            with patch(
                "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                return_value=[],
            ):
                command = DuplicateDatasetCommand(
                    {
                        "base_model_id": 1,
                        "table_name": "duplicate_name",
                        "is_managed_externally": False,
                    }
                )
                with pytest.raises(DatasetAccessDeniedError):
                    command.validate()


def test_duplicate_dataset_access_check_passes_through() -> None:
    """DuplicateDatasetCommand.validate() must not raise DatasetAccessDeniedError
    when security_manager.raise_for_access() does not raise."""
    from superset.commands.dataset.duplicate import DuplicateDatasetCommand

    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.kind = "virtual"

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_dataset,
    ):
        with patch(
            "superset.commands.dataset.duplicate.security_manager.raise_for_access"
        ) as mock_access:
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.find_one_or_none",
                return_value=None,
            ):
                with patch(
                    "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    command = DuplicateDatasetCommand(
                        {
                            "base_model_id": 1,
                            "table_name": "new_unique_name",
                            "is_managed_externally": False,
                        }
                    )
                    command.validate()  # should not raise
                    # Confirm access check was called with the base dataset
                    mock_access.assert_called_once_with(datasource=mock_dataset)
