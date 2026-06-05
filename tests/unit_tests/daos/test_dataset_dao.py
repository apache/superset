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
"""Unit tests for DatasetDAO helpers."""

from __future__ import annotations

from unittest.mock import MagicMock, patch


def _mock_dataset(catalog: str | None, default_catalog: str) -> MagicMock:
    """A SqlaTable-shaped mock with controllable catalog values."""
    model = MagicMock()
    model.id = 1
    model.database_id = 7
    model.schema = "public"
    model.table_name = "users"
    model.catalog = catalog
    model.database.get_default_catalog.return_value = default_catalog
    return model


def test_has_active_logical_duplicate_normalizes_unset_catalog(
    app_context: None,
) -> None:
    """A row stored with ``catalog = None`` is matched against the database
    default catalog, the same rule ``validate_uniqueness`` applies.

    This is the gap the soft-delete reviews flagged: restore/re-import
    compared the raw stored ``catalog`` while create/update normalized it, so
    a soft-deleted ``catalog = NULL`` row and an active default-catalog twin
    could be treated as different physical tables.
    """
    from superset.daos.dataset import DatasetDAO

    model = _mock_dataset(catalog=None, default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        assert DatasetDAO.has_active_logical_duplicate(model) is False

    # Normalization must consult the database default when catalog is unset.
    model.database.get_default_catalog.assert_called_once()


def test_has_active_logical_duplicate_keeps_explicit_catalog(
    app_context: None,
) -> None:
    """When the row carries an explicit catalog, the default is not consulted."""
    from superset.daos.dataset import DatasetDAO

    model = _mock_dataset(catalog="explicit_cat", default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        assert DatasetDAO.has_active_logical_duplicate(model) is False

    model.database.get_default_catalog.assert_not_called()


def test_has_active_logical_duplicate_true_when_twin_found(
    app_context: None,
) -> None:
    """A matching active row makes the helper report a duplicate."""
    from superset.daos.dataset import DatasetDAO

    model = _mock_dataset(catalog="explicit_cat", default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = (
            MagicMock()
        )

        assert DatasetDAO.has_active_logical_duplicate(model) is True
