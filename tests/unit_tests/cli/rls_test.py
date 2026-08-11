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
import click
from click.testing import CliRunner
from pytest_mock import MockerFixture

from superset.cli import rls


class _FakeDatabase:
    def __init__(self) -> None:
        self.catalog = None

    def get_default_schema(self, _catalog: object) -> str:
        return "public"


class _FakeTable:
    def __init__(self, pk: int, sql: str | None) -> None:
        self.id: int = pk
        self.sql: str | None = sql
        self.schema: str = "public"
        self.catalog: str | None = None
        self.database = _FakeDatabase()


class _FakeSlice:
    def __init__(self, pk: int, name: str, table: _FakeTable | None) -> None:
        self.id: int = pk
        self.slice_name: str = name
        self.datasource_id: int | None = table.id if table else None
        self.datasource_type: str = "table"
        self.table = table


class _FakeSavedQuery:
    def __init__(self, pk: int, label: str, sql: str) -> None:
        self.id: int = pk
        self.label: str = label
        self.sql: str = sql
        self.schema: str = "public"
        self.catalog: str | None = None
        self.database = _FakeDatabase()


def _wire_queries(
    mocker: MockerFixture,
    tables: list[_FakeTable],
    slices: list[_FakeSlice],
    saved_queries: list[_FakeSavedQuery],
) -> object:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery

    results = {
        SqlaTable: tables,
        Slice: slices,
        SavedQuery: saved_queries,
    }

    def _query(model: object) -> object:
        q = mocker.MagicMock()
        q.filter.return_value = q
        q.all.return_value = results.get(model, [])
        return q

    db_mock = mocker.patch("superset.cli.rls.db")
    db_mock.session.query.side_effect = _query
    return db_mock


def test_find_at_risk_lists_seeded_chart(
    mocker: MockerFixture, app_context: None
) -> None:
    """A chart on ad-hoc SQL over a governed table is reported."""
    # @AC-FR13-01
    governed = _FakeTable(10, "SELECT * FROM events")
    chart = _FakeSlice(1, "Governed Chart", governed)
    _wire_queries(mocker, [governed], [chart], [])
    mocker.patch(
        "superset.cli.rls.collect_rls_predicates_for_sql",
        return_value=["tenant_id = 1"],
    )

    result = CliRunner().invoke(rls.find_at_risk)

    assert result.exit_code == 0, result.output
    assert "Governed Chart" in result.output


def test_find_at_risk_lists_seeded_saved_query(
    mocker: MockerFixture, app_context: None
) -> None:
    """A saved query on ad-hoc SQL over a governed table is reported."""
    # @AC-FR13-02
    saved = _FakeSavedQuery(2, "Governed Query", "SELECT * FROM events")
    _wire_queries(mocker, [], [], [saved])
    mocker.patch(
        "superset.cli.rls.collect_rls_predicates_for_sql",
        return_value=["tenant_id = 1"],
    )

    result = CliRunner().invoke(rls.find_at_risk)

    assert result.exit_code == 0, result.output
    assert "Governed Query" in result.output


def test_find_at_risk_omits_ungoverned_artifacts(
    mocker: MockerFixture, app_context: None
) -> None:
    """Charts whose tables carry no RLS predicate are not reported."""
    # @AC-FR13-03
    ungoverned = _FakeTable(11, "SELECT * FROM public_data")
    chart = _FakeSlice(3, "Safe Chart", ungoverned)
    _wire_queries(mocker, [ungoverned], [chart], [])
    mocker.patch(
        "superset.cli.rls.collect_rls_predicates_for_sql",
        return_value=[],
    )

    result = CliRunner().invoke(rls.find_at_risk)

    assert result.exit_code == 0, result.output
    assert "Safe Chart" not in result.output


def test_find_at_risk_is_read_only(
    mocker: MockerFixture, app_context: None
) -> None:
    """The command never writes to the metadata database."""
    # @AC-FR13-04
    governed = _FakeTable(10, "SELECT * FROM events")
    chart = _FakeSlice(1, "Governed Chart", governed)
    db_mock = _wire_queries(mocker, [governed], [chart], [])
    mocker.patch(
        "superset.cli.rls.collect_rls_predicates_for_sql",
        return_value=["tenant_id = 1"],
    )

    result = CliRunner().invoke(rls.find_at_risk)

    assert result.exit_code == 0, result.output
    db_mock.session.commit.assert_not_called()
    db_mock.session.add.assert_not_called()
    db_mock.session.delete.assert_not_called()
    db_mock.session.merge.assert_not_called()


def test_find_at_risk_has_no_enforcement_disabling_option() -> None:
    """No option can disable or bypass RLS enforcement (FR-14)."""
    # @AC-FR13-05
    option_names = [
        name
        for param in rls.find_at_risk.params
        if isinstance(param, click.Option)
        for name in param.opts + param.secondary_opts
    ]
    joined = " ".join(option_names).lower()
    for forbidden in ("disable", "bypass", "no-rls", "skip", "off", "escape"):
        assert forbidden not in joined
