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
"""Regression test for #38012.

``RefreshDatasetCommand`` runs after ``UpdateDatasetCommand`` when the
Dataset Editor modal saves with ``override_columns=True``. Historically
it re-parsed the dataset's SQL with an empty runtime template context;
Jinja-templated virtual datasets like
``SELECT * FROM t {% if from_dttm %}WHERE ds > '{{ from_dttm }}'{% endif %}``
render to malformed SQL, sqlglot rejects it, and the whole PUT surfaces
as an "Invalid SQL" toast — even though the dataset row was already
committed successfully by ``UpdateDatasetCommand``.

The command now catches ``SupersetGenericDBErrorException`` from
``fetch_metadata()``, logs a warning, and returns the model. This tests
both:

1. Jinja parse failures become a warning (no re-raise).
2. Other exception classes still propagate (security failures, unknown
   errors, etc.).
"""

from __future__ import annotations

import logging

import pytest
from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
)
from superset.commands.dataset.refresh import RefreshDatasetCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)


def test_refresh_swallows_generic_db_error_from_jinja_sql(
    mocker: MockerFixture, caplog: pytest.LogCaptureFixture
) -> None:
    """Jinja parse failures during metadata refresh must NOT bubble up as
    a hard error — the dataset has already been persisted by the caller
    (``UpdateDatasetCommand``), so the refresh is best-effort when the
    SQL contains Jinja markers that cannot be rendered at save time.
    See #38012.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.refresh.DatasetDAO")
    mock_model = mocker.MagicMock()
    mock_model.table_name = "jinja_dataset"
    mock_model.sql = (
        "SELECT * FROM foo {% if from_dttm %}WHERE ds > '{{ from_dttm }}'{% endif %}"
    )
    mock_model.fetch_metadata.side_effect = SupersetGenericDBErrorException(
        message="Invalid SQL: unexpected token"
    )
    mock_dataset_dao.find_by_id.return_value = mock_model
    mocker.patch(
        "superset.commands.dataset.refresh.security_manager.raise_for_editorship"
    )
    # Skip datetime-format detection to keep the test focused.
    mocker.patch(
        "superset.commands.dataset.refresh.current_app.config.get",
        return_value=False,
    )

    with caplog.at_level(logging.WARNING, logger="superset.commands.dataset.refresh"):
        result = RefreshDatasetCommand(model_id=1).run()

    assert result is mock_model, "command should return the model, not re-raise"
    assert any(
        "Dataset column refresh skipped for jinja_dataset" in rec.message
        for rec in caplog.records
    ), "expected a warning naming the dataset"


def test_refresh_still_raises_generic_db_error_for_non_jinja_sql(
    mocker: MockerFixture,
) -> None:
    """When the dataset SQL has NO Jinja markers, a
    ``SupersetGenericDBErrorException`` from ``fetch_metadata`` must
    still bubble up as a real failure — ``get_columns_description`` wraps
    connection / permission / driver failures in the same exception
    class, and those must NOT be silenced. See #38012."""
    mock_dataset_dao = mocker.patch("superset.commands.dataset.refresh.DatasetDAO")
    mock_model = mocker.MagicMock()
    mock_model.table_name = "plain_dataset"
    mock_model.sql = "SELECT * FROM foo WHERE ds > '2024-01-01'"  # no Jinja
    mock_model.fetch_metadata.side_effect = SupersetGenericDBErrorException(
        message="Connection refused"
    )
    mock_dataset_dao.find_by_id.return_value = mock_model
    mocker.patch(
        "superset.commands.dataset.refresh.security_manager.raise_for_editorship"
    )
    mocker.patch(
        "superset.commands.dataset.refresh.current_app.config.get",
        return_value=False,
    )

    with pytest.raises(SupersetGenericDBErrorException):
        RefreshDatasetCommand(model_id=1).run()


def test_refresh_still_raises_on_security_exception(
    mocker: MockerFixture,
) -> None:
    """``SupersetSecurityException`` must still fail hard — softening the
    refresh path must not become a bypass for security checks. See #38012.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.refresh.DatasetDAO")
    mock_model = mocker.MagicMock()
    mock_model.table_name = "restricted_dataset"
    mock_model.fetch_metadata.side_effect = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="Access denied",
            level=ErrorLevel.ERROR,
        )
    )
    mock_dataset_dao.find_by_id.return_value = mock_model
    mocker.patch(
        "superset.commands.dataset.refresh.security_manager.raise_for_editorship"
    )
    mocker.patch(
        "superset.commands.dataset.refresh.current_app.config.get",
        return_value=False,
    )

    # ``on_error`` only wraps ``SQLAlchemyError`` into
    # ``DatasetRefreshFailedError``; other exception classes propagate
    # unchanged. We just need to prove the softening does NOT swallow
    # this one.
    with pytest.raises(SupersetSecurityException):
        RefreshDatasetCommand(model_id=1).run()


def test_refresh_dataset_not_found(mocker: MockerFixture) -> None:
    """Sanity check that the pre-existing not-found path still works.
    Guards against the softening change accidentally masking validation
    errors.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.refresh.DatasetDAO")
    mock_dataset_dao.find_by_id.return_value = None

    with pytest.raises(DatasetNotFoundError):
        RefreshDatasetCommand(model_id=999).run()


def test_refresh_forbidden(mocker: MockerFixture) -> None:
    """Sanity check that the pre-existing forbidden path still works."""
    mock_dataset_dao = mocker.patch("superset.commands.dataset.refresh.DatasetDAO")
    mock_dataset_dao.find_by_id.return_value = mocker.MagicMock()
    mocker.patch(
        "superset.commands.dataset.refresh.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message="Access denied",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    with pytest.raises(DatasetForbiddenError):
        RefreshDatasetCommand(model_id=1).run()
