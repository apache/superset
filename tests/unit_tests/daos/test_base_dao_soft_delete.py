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
"""Tests for BaseDAO soft_delete / hard_delete / delete routing.

Uses a synthetic model + DAO so the routing logic is exercised in
isolation. Concrete entity DAOs (ChartDAO, DashboardDAO, DatasetDAO)
acquire ``SoftDeleteMixin`` via their model classes in the entity-
rollout PRs and cover end-to-end behaviour there.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from superset.daos.base import BaseDAO
from superset.models.helpers import SoftDeleteMixin

_TestBase = declarative_base()


class _SoftDeletable(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    __tablename__ = "_soft_deletable_dao_test"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


class _Plain(_TestBase):  # type: ignore[misc, valid-type]
    """Plain model — does NOT inherit SoftDeleteMixin."""

    __tablename__ = "_plain_dao_test"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


class _SoftDeletableDAO(BaseDAO[_SoftDeletable]):
    model_cls = _SoftDeletable


class _PlainDAO(BaseDAO[_Plain]):
    model_cls = _Plain


@patch("superset.daos.base.is_feature_enabled", return_value=True)
def test_delete_routes_to_soft_delete_for_mixin_models(
    mock_flag: MagicMock, app_context: None
) -> None:
    """delete() soft-deletes a mixin model when the SOFT_DELETE gate is ON."""
    items: list[MagicMock] = [MagicMock(), MagicMock()]

    with patch.object(_SoftDeletableDAO, "soft_delete") as mock_soft:
        _SoftDeletableDAO.delete(items)
        mock_soft.assert_called_once_with(items)


@patch("superset.daos.base.is_feature_enabled", return_value=False)
def test_delete_hard_deletes_mixin_model_when_gate_off(
    mock_flag: MagicMock, app_context: None
) -> None:
    """With the SOFT_DELETE gate OFF (default), even a mixin model hard-deletes
    — the substrate ships dark."""
    items: list[MagicMock] = [MagicMock(), MagicMock()]

    with patch.object(_SoftDeletableDAO, "hard_delete") as mock_hard:
        _SoftDeletableDAO.delete(items)
        mock_hard.assert_called_once_with(items)


@patch("superset.daos.base.is_feature_enabled", return_value=True)
def test_delete_routes_to_hard_delete_for_non_mixin_models(
    mock_flag: MagicMock, app_context: None
) -> None:
    """delete() calls hard_delete() for non-SoftDeleteMixin models — regardless
    of the gate (here ON, to show the gate doesn't make a plain model soft)."""
    items: list[MagicMock] = [MagicMock(), MagicMock()]

    with patch.object(_PlainDAO, "hard_delete") as mock_hard:
        _PlainDAO.delete(items)
        mock_hard.assert_called_once_with(items)


@patch("superset.daos.base.is_feature_enabled", return_value=False)
def test_delete_hard_deletes_non_mixin_model_when_gate_off(
    mock_flag: MagicMock, app_context: None
) -> None:
    """A non-SoftDeleteMixin model hard-deletes with the gate OFF too — the
    mixin check short-circuits to hard_delete before the gate is evaluated.
    Completes the (gate, model_type) matrix's fourth cell."""
    items: list[MagicMock] = [MagicMock(), MagicMock()]

    with patch.object(_PlainDAO, "hard_delete") as mock_hard:
        _PlainDAO.delete(items)
        mock_hard.assert_called_once_with(items)


@patch("superset.daos.base.db")
def test_hard_delete_calls_session_delete(
    mock_db: MagicMock, app_context: None
) -> None:
    """hard_delete() calls db.session.delete() on each item."""
    items: list[MagicMock] = [MagicMock(), MagicMock()]

    BaseDAO.hard_delete(items)

    assert mock_db.session.delete.call_count == 2
    mock_db.session.delete.assert_any_call(items[0])
    mock_db.session.delete.assert_any_call(items[1])


def test_soft_delete_calls_item_soft_delete(app_context: None) -> None:
    """soft_delete() calls soft_delete() on each item."""
    items: list[MagicMock] = [MagicMock(), MagicMock()]

    BaseDAO.soft_delete(items)
    items[0].soft_delete.assert_called_once()
    items[1].soft_delete.assert_called_once()
