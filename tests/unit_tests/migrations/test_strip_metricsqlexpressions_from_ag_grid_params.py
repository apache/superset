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
"""Tests for migration ``d24e6b0a9c7f_strip_metricsqlexpressions_from_ag_grid_params``.

Covers the two helper functions (_strip_params, _strip_query_context) and the
full upgrade() path that seeds an ag_grid_table slice with metricSqlExpressions
in both params and query_context, then asserts both fields are stripped.
"""

from __future__ import annotations

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-06-30_00-00_d24e6b0a9c7f_strip_metricsqlexpressions_from_ag_grid_params"
)

Slice = migration.Slice
_strip_params = migration._strip_params
_strip_query_context = migration._strip_query_context
_FIELD = migration._FIELD
_VIZ_TYPE = migration._VIZ_TYPE

_SQL_EXPR = {"col1": "SELECT col1 FROM t", "col2": "SUM(revenue)"}


def _contaminated_params() -> str:
    return json.dumps(
        {
            "viz_type": _VIZ_TYPE,
            "extra_form_data": {
                _FIELD: _SQL_EXPR,
                "filters": [{"col": "col1", "op": "==", "val": "a"}],
            },
        }
    )


def _contaminated_query_context() -> str:
    return json.dumps(
        {
            "form_data": {
                "extra_form_data": {
                    _FIELD: _SQL_EXPR,
                },
            },
            "queries": [],
        }
    )


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:")
    migration.Base.metadata.create_all(engine)
    return engine


# ---------------------------------------------------------------------------
# Helper-function unit tests
# ---------------------------------------------------------------------------


def test_strip_params_removes_field() -> None:
    slc = Slice(params=_contaminated_params())
    changed = _strip_params(slc)
    assert changed
    result = json.loads(slc.params)
    assert _FIELD not in result["extra_form_data"]
    assert result["extra_form_data"]["filters"] == [
        {"col": "col1", "op": "==", "val": "a"}
    ]


def test_strip_params_noop_when_field_absent() -> None:
    params = json.dumps({"extra_form_data": {"filters": []}})
    slc = Slice(params=params)
    changed = _strip_params(slc)
    assert not changed
    assert json.loads(slc.params) == {"extra_form_data": {"filters": []}}


def test_strip_params_noop_when_params_empty() -> None:
    assert not _strip_params(Slice(params=None))


def test_strip_params_noop_on_invalid_json() -> None:
    slc = Slice(params="not-json")
    changed = _strip_params(slc)
    assert not changed
    assert slc.params == "not-json"


def test_strip_query_context_removes_field() -> None:
    slc = Slice(query_context=_contaminated_query_context())
    changed = _strip_query_context(slc)
    assert changed
    result = json.loads(slc.query_context)
    assert _FIELD not in result["form_data"]["extra_form_data"]


def test_strip_query_context_noop_when_field_absent() -> None:
    qc = json.dumps({"form_data": {"extra_form_data": {}}})
    slc = Slice(query_context=qc)
    assert not _strip_query_context(slc)


def test_strip_query_context_noop_when_query_context_empty() -> None:
    assert not _strip_query_context(Slice(query_context=None))


def test_strip_query_context_noop_on_invalid_json() -> None:
    slc = Slice(query_context="not-json")
    changed = _strip_query_context(slc)
    assert not changed
    assert slc.query_context == "not-json"


# ---------------------------------------------------------------------------
# Full upgrade() integration test
# ---------------------------------------------------------------------------


def test_upgrade_strips_both_fields(engine) -> None:
    """upgrade() must strip _FIELD from params and query_context for ag_grid_table
    slices, and must not touch slices of other viz types."""
    with Session(engine) as seed:
        seed.add_all(
            [
                Slice(
                    id=1,
                    viz_type=_VIZ_TYPE,
                    params=_contaminated_params(),
                    query_context=_contaminated_query_context(),
                ),
                # Different viz type — must be left unchanged.
                Slice(
                    id=2,
                    viz_type="table",
                    params=_contaminated_params(),
                    query_context=_contaminated_query_context(),
                ),
            ]
        )
        seed.commit()

    # Simulate the Alembic transaction: bind the migration session to an explicit
    # connection opened via engine.begin() so the transaction auto-commits on
    # context exit.  The session.flush() inside upgrade() must emit the SQL
    # UPDATEs before the connection is committed; without it the outer commit
    # has nothing to write and the data is left unchanged.
    with engine.begin() as conn:
        upgrade_session = Session(bind=conn)
        with (
            patch.object(migration, "op") as mock_op,
            patch.object(migration, "db") as mock_db,
        ):
            mock_op.get_bind.return_value = conn
            mock_db.Session.return_value = upgrade_session
            migration.upgrade()

    with Session(engine) as verify:
        slc1 = verify.get(Slice, 1)
        params1 = json.loads(slc1.params)
        assert _FIELD not in params1["extra_form_data"], (
            "upgrade() must strip _FIELD from params.extra_form_data"
        )
        assert params1["extra_form_data"]["filters"] == [
            {"col": "col1", "op": "==", "val": "a"}
        ]

        qc1 = json.loads(slc1.query_context)
        assert _FIELD not in qc1["form_data"]["extra_form_data"], (
            "upgrade() must strip _FIELD from query_context.form_data.extra_form_data"
        )

        slc2 = verify.get(Slice, 2)
        params2 = json.loads(slc2.params)
        assert _FIELD in params2["extra_form_data"], (
            "upgrade() must not touch non-ag_grid_table slices"
        )
