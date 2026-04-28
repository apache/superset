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
"""Tests for BaseDAO soft_delete / hard_delete / delete routing."""

from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_delete_routes_to_soft_delete_for_mixin_models(
    app_context: None,
) -> None:
    """delete() should call soft_delete() when model_cls includes SoftDeleteMixin."""
    from superset.daos.chart import ChartDAO

    items = [MagicMock(), MagicMock()]

    with patch.object(ChartDAO, "soft_delete") as mock_soft:
        ChartDAO.delete(items)
        mock_soft.assert_called_once_with(items)


def test_delete_routes_to_hard_delete_for_non_mixin_models(
    app_context: None,
) -> None:
    """delete() calls hard_delete() for non-SoftDeleteMixin models."""
    from superset.daos.database import DatabaseDAO

    items = [MagicMock(), MagicMock()]

    with patch.object(DatabaseDAO, "hard_delete") as mock_hard:
        DatabaseDAO.delete(items)
        mock_hard.assert_called_once_with(items)


@patch("superset.daos.base.db")
def test_hard_delete_calls_session_delete(
    mock_db: MagicMock,
    app_context: None,
) -> None:
    """hard_delete() should call db.session.delete() on each item."""
    from superset.daos.base import BaseDAO

    items = [MagicMock(), MagicMock()]

    BaseDAO.hard_delete(items)

    assert mock_db.session.delete.call_count == 2
    mock_db.session.delete.assert_any_call(items[0])
    mock_db.session.delete.assert_any_call(items[1])


def test_soft_delete_calls_item_soft_delete(
    app_context: None,
) -> None:
    """soft_delete() should call soft_delete() on each item."""
    from superset.daos.base import BaseDAO

    items = [MagicMock(), MagicMock()]

    BaseDAO.soft_delete(items)
    items[0].soft_delete.assert_called_once()
    items[1].soft_delete.assert_called_once()
