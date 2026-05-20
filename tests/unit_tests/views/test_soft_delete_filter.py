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
"""Unit tests for ``BaseDeletedStateFilter`` and ``SoftDeleteApiMixin``.

These tests use a synthetic ``_SoftDeletable`` model + ``MagicMock``
collaborators rather than real Superset entities, so the filter and
mixin behavior is pinned at the infrastructure level independently of
which entity has adopted ``SoftDeleteMixin``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar
from unittest.mock import MagicMock

import pytest
from flask import Flask, g
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm.session import Session

from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES, SoftDeleteMixin
from superset.views.filters import (
    AUGMENT_RESPONSE_WITH_DELETED_AT,
    BaseDeletedStateFilter,
    DELETED_STATE_ADDED_CLASSES,
    SoftDeleteApiMixin,
)

_TestBase = declarative_base()


class _SoftDeletable(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    __tablename__ = "_soft_deletable_filter_test"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


class _ConcreteFilter(BaseDeletedStateFilter):
    arg_name = "deleted_state"
    model: ClassVar[type[SoftDeleteMixin]] = _SoftDeletable


@pytest.fixture
def flask_request_ctx() -> Any:
    """Minimal Flask request context so the filter and mixin can read /
    write ``g`` without booting the full Superset app."""
    app = Flask(__name__)
    with app.test_request_context("/"):
        yield


@pytest.fixture
def query_with_session() -> MagicMock:
    """A MagicMock that quacks like a SQLAlchemy Query with a real
    Session whose ``info`` dict the filter can mutate."""
    q = MagicMock()
    real_session = Session()
    q.session = real_session
    return q


@pytest.fixture
def concrete_filter() -> _ConcreteFilter:
    """Filter wired with a datamodel whose ``.obj`` is the synthetic
    soft-deletable. FAB's ``BaseFilter.__init__`` sets
    ``self.model = datamodel.obj`` — without setting this on the mock,
    ``self.model`` becomes a MagicMock attribute and the filter
    misroutes the bypass.
    """
    datamodel = MagicMock()
    datamodel.obj = _SoftDeletable
    return _ConcreteFilter("id", datamodel)


def test_filter_value_absent_is_noop(
    flask_request_ctx: None,
    concrete_filter: _ConcreteFilter,
    query_with_session: MagicMock,
) -> None:
    """A missing / unrecognised filter value returns the query unchanged
    and leaves the session info untouched. No augmentation flag set."""
    result = concrete_filter.apply(query_with_session, None)
    assert result is query_with_session
    assert SKIP_VISIBILITY_FILTER_CLASSES not in query_with_session.session.info
    assert not getattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, False)


def test_filter_value_include_sets_session_bypass_and_flag(
    flask_request_ctx: None,
    concrete_filter: _ConcreteFilter,
    query_with_session: MagicMock,
) -> None:
    """``include`` adds the filter's model to ``session.info`` (bypass
    set) and signals augmentation. Returns the query unchanged
    (no additional WHERE clause — listener does the filtering)."""
    result = concrete_filter.apply(query_with_session, "include")
    assert (
        _SoftDeletable
        in query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES]
    )
    assert getattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT) is True
    # No .filter() call on the query for ``include`` — the query is
    # returned as-is so the listener-bypass alone surfaces both live
    # and soft-deleted rows.
    assert result is query_with_session


def test_filter_value_only_adds_deleted_at_predicate(
    flask_request_ctx: None,
    concrete_filter: _ConcreteFilter,
    query_with_session: MagicMock,
) -> None:
    """``only`` sets the bypass + augmentation flag AND adds a
    ``deleted_at IS NOT NULL`` filter to restrict the result to
    soft-deleted rows."""
    concrete_filter.apply(query_with_session, "only")
    assert (
        _SoftDeletable
        in query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES]
    )
    assert getattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT) is True
    query_with_session.filter.assert_called_once()


def test_filter_value_case_insensitive(
    flask_request_ctx: None,
    concrete_filter: _ConcreteFilter,
    query_with_session: MagicMock,
) -> None:
    """The filter normalises the value (lowercase, stripped) so
    ``"INCLUDE"`` and ``" only "`` work."""
    concrete_filter.apply(query_with_session, "  INCLUDE  ")
    assert (
        _SoftDeletable
        in query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES]
    )


def test_filter_unknown_value_is_noop(
    flask_request_ctx: None,
    concrete_filter: _ConcreteFilter,
    query_with_session: MagicMock,
) -> None:
    """An unrecognised value (e.g., ``"all"``) is a no-op — same as
    absent."""
    result = concrete_filter.apply(query_with_session, "all")
    assert result is query_with_session
    assert SKIP_VISIBILITY_FILTER_CLASSES not in query_with_session.session.info


# --- SoftDeleteApiMixin ---------------------------------------------------


class _StubDatamodel:
    """Mimics FAB's ``SQLAInterface`` for the mixin's PK resolution."""

    obj = _SoftDeletable

    def get_pk_name(self) -> str:
        return "id"


class _StubBaseApi:
    """Stub for the FAB ``ModelRestApi`` base. The mixin's
    ``pre_get_list`` calls ``super().pre_get_list(data)``; without a
    super-chain that defines the method, the call would raise
    ``AttributeError`` and the mixin's own logic wouldn't run.
    """

    def pre_get_list(self, _data: dict[str, Any]) -> None:
        pass


class _ConcreteApi(SoftDeleteApiMixin, _StubBaseApi):
    """Concrete REST API class that doesn't depend on FAB's
    ``ModelRestApi`` — sufficient for testing the mixin's
    ``pre_get_list`` behaviour in isolation."""

    datamodel = _StubDatamodel()

    def __init__(self, deleted_at_map: dict[Any, str | None]) -> None:
        self._deleted_at_map = deleted_at_map

    def _get_deleted_at_map(self, _ids: list[Any]) -> dict[Any, str | None]:
        # Tests provide the map directly so they don't need the DB.
        return self._deleted_at_map


def test_mixin_pre_get_list_noop_when_flag_unset(flask_request_ctx: None) -> None:
    """Without the augmentation flag, ``pre_get_list`` leaves the
    response untouched — the typical case for any request that didn't
    use ``deleted_state``."""
    api = _ConcreteApi(deleted_at_map={})
    data: dict[str, Any] = {"ids": [1, 2], "result": [{"id": 1}, {"id": 2}]}
    api.pre_get_list(data)
    assert "deleted_at" not in data["result"][0]
    assert "deleted_at" not in data["result"][1]


def test_mixin_pre_get_list_injects_deleted_at_when_flag_set(
    flask_request_ctx: None,
) -> None:
    """With the flag set, each result row gains a ``deleted_at`` field
    (None for live rows, ISO timestamp for soft-deleted)."""
    setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, True)
    api = _ConcreteApi(deleted_at_map={1: None, 2: "2026-05-14T12:00:00"})
    data: dict[str, Any] = {"ids": [1, 2], "result": [{"id": 1}, {"id": 2}]}
    api.pre_get_list(data)
    assert data["result"][0]["deleted_at"] is None
    assert data["result"][1]["deleted_at"] == "2026-05-14T12:00:00"


def test_mixin_pre_get_list_consumes_flag(flask_request_ctx: None) -> None:
    """The augmentation flag is read-and-cleared. A second list
    operation within the same request (e.g., a batch endpoint
    dispatching multiple list views) won't see the flag set by an
    earlier filter."""
    setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, True)
    api = _ConcreteApi(deleted_at_map={})
    api.pre_get_list({"ids": [], "result": []})
    assert getattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT) is False


def test_serialize_deleted_at_handles_none() -> None:
    """``_serialize_deleted_at(None)`` returns ``None`` (live row);
    a datetime value returns its ISO 8601 form. Pins the contract
    that's used by every entity's list response augmentation."""
    serialize = SoftDeleteApiMixin._serialize_deleted_at
    assert serialize(None) is None
    assert serialize(datetime(2026, 5, 14, 12, 0, 0)) == "2026-05-14T12:00:00"


# --- F-002: session bypass cleanup ----------------------------------------


def test_filter_records_added_classes_on_g(
    flask_request_ctx: None,
    concrete_filter: _ConcreteFilter,
    query_with_session: MagicMock,
) -> None:
    """The filter records each class it adds to the bypass set on
    ``g._deleted_state_added_classes`` so the mixin's release step can
    distinguish filter-added entries from those installed by
    programmatic callers (the context manager or DAO bypass).
    """
    concrete_filter.apply(query_with_session, "include")
    added: set[type] = getattr(g, DELETED_STATE_ADDED_CLASSES, set())
    assert added == {_SoftDeletable}


def test_mixin_releases_bypass_after_inject(
    flask_request_ctx: None, query_with_session: MagicMock
) -> None:
    """After the augmentation step in ``pre_get_list``, the classes the
    filter added are removed from ``session.info[SKIP_VISIBILITY_FILTER_CLASSES]``.
    Code that runs later in the same request (audit hooks, after_request
    handlers) sees normal filtered visibility rather than the widened
    scope the filter installed for the list query.
    """
    # Simulate the filter having installed the bypass.
    query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {_SoftDeletable}
    setattr(g, DELETED_STATE_ADDED_CLASSES, {_SoftDeletable})
    setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, True)

    # Patch db.session to point at our test session so the release
    # step finds the same info dict.
    import superset.views.filters as filters_module

    original_db = filters_module.db
    filters_module.db = MagicMock()
    filters_module.db.session = query_with_session.session
    try:
        api = _ConcreteApi(deleted_at_map={})
        api.pre_get_list({"ids": [], "result": []})
    finally:
        filters_module.db = original_db

    bypass = query_with_session.session.info.get(SKIP_VISIBILITY_FILTER_CLASSES, set())
    assert _SoftDeletable not in bypass
    # And the per-request tracker is itself cleared so a second list
    # operation in the same request starts clean.
    assert getattr(g, DELETED_STATE_ADDED_CLASSES) == set()


def test_mixin_release_does_not_touch_unrelated_bypass_entries(
    flask_request_ctx: None, query_with_session: MagicMock
) -> None:
    """If a programmatic caller (e.g., the ``skip_visibility_filter``
    context manager or a DAO call) installed a bypass for a *different*
    class earlier in the request, the mixin's release step must leave
    that entry alone. Pinning this guards against the filter cleanup
    accidentally clobbering bypasses owned by other callers.
    """

    class _OtherSoftDeletable(SoftDeleteMixin):
        pass

    # Both classes are in the bypass set, but only ``_SoftDeletable``
    # was added by the filter (the other was installed by some other
    # caller). The release must remove ``_SoftDeletable`` only.
    query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {
        _SoftDeletable,
        _OtherSoftDeletable,
    }
    setattr(g, DELETED_STATE_ADDED_CLASSES, {_SoftDeletable})
    setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, True)

    import superset.views.filters as filters_module

    original_db = filters_module.db
    filters_module.db = MagicMock()
    filters_module.db.session = query_with_session.session
    try:
        api = _ConcreteApi(deleted_at_map={})
        api.pre_get_list({"ids": [], "result": []})
    finally:
        filters_module.db = original_db

    bypass = query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES]
    assert _SoftDeletable not in bypass
    assert _OtherSoftDeletable in bypass


def test_mixin_release_is_noop_when_filter_was_not_invoked(
    flask_request_ctx: None, query_with_session: MagicMock
) -> None:
    """If ``pre_get_list`` runs without the augmentation flag (e.g., a
    request that didn't use ``deleted_state``), the release step has
    nothing to do and must not raise or touch unrelated state.
    """
    query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {_SoftDeletable}

    api = _ConcreteApi(deleted_at_map={})
    api.pre_get_list({"ids": [], "result": []})

    # Unrelated entry is left alone.
    assert (
        _SoftDeletable
        in query_with_session.session.info[SKIP_VISIBILITY_FILTER_CLASSES]
    )
