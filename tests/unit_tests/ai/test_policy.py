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
"""Tests for the pre-tool-use guards."""

import pytest
from pytest_mock import MockerFixture


def test_read_only_policy_allows_plain_reads() -> None:
    """Ordinary read shapes are permitted."""
    from superset.ai.policy import ReadOnlySqlPolicy

    policy = ReadOnlySqlPolicy()
    for sql in (
        "SELECT 1",
        "select a, b from t where c = 1",
        "WITH x AS (SELECT 1 AS n) SELECT n FROM x",
        "EXPLAIN SELECT * FROM t",
    ):
        assert policy.check("execute_sql", {"sql": sql}) is None, sql


@pytest.mark.parametrize(
    "sql",
    [
        # Plain DML and DDL.
        "DELETE FROM t",
        "UPDATE t SET a = 1",
        "INSERT INTO t VALUES (1)",
        "DROP TABLE t",
        "TRUNCATE TABLE t",
        "ALTER TABLE t ADD COLUMN c int",
        "CREATE TABLE t2 AS SELECT * FROM t",
        # A leading comment defeats a prefix match.
        "-- harmless\nDELETE FROM t",
        "/* still harmless */ DROP TABLE t",
        # A second statement smuggled after a legitimate read.
        "SELECT 1; DELETE FROM t",
        # A CTE wrapping a mutation.
        "WITH x AS (SELECT 1) DELETE FROM t",
    ],
)
def test_read_only_policy_refuses_mutations(sql: str) -> None:
    """
    Every way of hiding a write is refused.

    These are precisely the cases a leading-keyword regex lets through, which
    is why the check delegates to Superset's parser.
    """
    from superset.ai.policy import ReadOnlySqlPolicy

    denial = ReadOnlySqlPolicy().check("execute_sql", {"sql": sql})
    assert denial is not None, f"should have been refused: {sql}"
    assert denial.reason


def test_read_only_policy_refuses_unparseable_sql() -> None:
    """SQL we cannot analyse is refused rather than assumed safe."""
    from superset.ai.policy import ReadOnlySqlPolicy

    policy = ReadOnlySqlPolicy()
    denial = policy.check("execute_sql", {"sql": "SELECT FROM WHERE ((("})
    assert denial is not None


def test_read_only_policy_uses_the_selected_database_dialect(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    database = mocker.Mock()
    database.db_engine_spec.engine = "mssql"
    find = mocker.patch(
        "superset.daos.database.DatabaseDAO.find_by_id", return_value=database
    )

    from superset.ai.policy import ReadOnlySqlPolicy

    denial = ReadOnlySqlPolicy().check(
        "execute_sql",
        {
            "database_id": 7,
            "sql": "SELECT TOP 5 id FROM dbo.sample_events",
        },
    )

    assert denial is None
    find.assert_called_once_with(7)


def test_read_only_policy_protects_namespaced_virtual_dataset_sql() -> None:
    from superset.ai.policy import ReadOnlySqlPolicy

    denial = ReadOnlySqlPolicy().check(
        "mcp__superset__create_virtual_dataset",
        {
            "request": {
                "database_id": 7,
                "sql": "DELETE FROM dbo.sample_events",
            }
        },
    )

    assert denial is not None
    assert "read-only" in denial.reason


@pytest.mark.parametrize(
    "sql",
    [
        "EXPLAIN SELECT * FROM t",
        "SHOW TABLES",
        "DESCRIBE t",
        "DESC t",
        "show tables",
    ],
)
def test_read_only_policy_allows_introspection_commands(sql: str) -> None:
    """
    Schema and plan inspection survives the fail-closed rule.

    Most dialects hand these back as an opaque node, so without an explicit
    allowlist the guard would refuse the very calls an analysis agent needs to
    orient itself.
    """
    from superset.ai.policy import ReadOnlySqlPolicy

    assert ReadOnlySqlPolicy().check("execute_sql", {"sql": sql}) is None, sql


@pytest.mark.parametrize(
    "sql",
    [
        # A write hidden behind a permitted introspection command.
        "SHOW TABLES; DELETE FROM t",
        "EXPLAIN SELECT 1; DROP TABLE t",
        # An opaque command that is not on the allowlist.
        "GRANT SELECT ON t TO someone",
        "COPY t FROM '/etc/passwd'",
        "CALL some_procedure()",
    ],
)
def test_read_only_policy_refuses_writes_behind_introspection(sql: str) -> None:
    """The introspection allowlist does not become a bypass."""
    from superset.ai.policy import ReadOnlySqlPolicy

    denial = ReadOnlySqlPolicy().check("execute_sql", {"sql": sql})
    assert denial is not None, f"should have been refused: {sql}"


def test_read_only_policy_requires_sql_argument() -> None:
    """A malformed call is reported in terms the model can act on."""
    from superset.ai.policy import ReadOnlySqlPolicy

    policy = ReadOnlySqlPolicy()
    assert policy.check("execute_sql", {}) is not None
    assert policy.check("execute_sql", {"sql": "   "}) is not None


def test_read_only_policy_ignores_unrelated_tools() -> None:
    """A policy that does not apply stays out of the way."""
    from superset.ai.policy import ReadOnlySqlPolicy

    policy = ReadOnlySqlPolicy()
    assert policy.check("search_assets", {"query": "DELETE FROM t"}) is None


def test_identifier_policy_allows_plain_names() -> None:
    """Bare and dotted identifiers, and the column wildcard, are accepted."""
    from superset.ai.policy import IdentifierPolicy

    policy = IdentifierPolicy()
    assert policy.check("get_schema", {"table": "orders"}) is None
    assert policy.check("get_schema", {"table": "sales.orders"}) is None
    assert policy.check("get_schema", {"columns": "*"}) is None
    assert policy.check("get_schema", {"columns": ["a", "b"]}) is None
    assert policy.check("get_schema", {"columns": "a, b"}) is None


@pytest.mark.parametrize(
    "value",
    [
        'orders"; DROP TABLE t --',
        "orders; SELECT 1",
        "orders WHERE 1=1",
        "orders(",
        "'orders'",
        "orders\nunion",
        "1orders",
    ],
)
def test_identifier_policy_refuses_suspicious_names(value: str) -> None:
    """Anything that is not a plain name is refused, not escaped."""
    from superset.ai.policy import IdentifierPolicy

    denial = IdentifierPolicy().check("get_schema", {"table": value})
    assert denial is not None, f"should have been refused: {value}"


def test_identifier_policy_checks_every_element_of_a_list() -> None:
    """One bad entry in a column list is enough to refuse the call."""
    from superset.ai.policy import IdentifierPolicy

    denial = IdentifierPolicy().check(
        "get_schema", {"columns": ["good", "bad; DROP TABLE t"]}
    )
    assert denial is not None


def test_identifier_policy_ignores_free_text_arguments() -> None:
    """Free-text arguments are not identifiers and are left alone."""
    from superset.ai.policy import IdentifierPolicy

    policy = IdentifierPolicy()
    assert policy.check("search_assets", {"query": "orders; anything goes"}) is None


def test_policy_chain_stops_at_first_denial() -> None:
    """The chain short-circuits and reports which guard refused."""
    from superset.ai.policy import Denial, PolicyChain, ToolPolicy

    class AlwaysDeny(ToolPolicy):
        name = "always_deny"

        def check(self, tool_name: str, arguments: dict) -> Denial | None:  # type: ignore[type-arg]
            return Denial("nope")

    class Explode(ToolPolicy):
        name = "explode"

        def check(self, tool_name: str, arguments: dict) -> Denial | None:  # type: ignore[type-arg]
            raise AssertionError("must not be reached")

    chain = PolicyChain([AlwaysDeny(), Explode()])
    denial = chain.check("execute_sql", {"sql": "SELECT 1"})
    assert denial is not None
    assert denial.reason == "nope"


def test_policy_chain_allows_when_all_allow() -> None:
    """An empty or fully permissive chain permits the call."""
    from superset.ai.policy import IdentifierPolicy, PolicyChain, ReadOnlySqlPolicy

    chain = PolicyChain([ReadOnlySqlPolicy(), IdentifierPolicy()])
    assert chain.check("execute_sql", {"sql": "SELECT 1"}) is None
    assert PolicyChain([]).check("anything", {}) is None


def test_load_policy_chain_from_config(app_context: None) -> None:
    """The configured default chain resolves and behaves."""
    from superset.ai.policy import load_policy_chain

    chain = load_policy_chain()
    assert [p.name for p in chain.policies] == [
        "read_only_sql",
        "identifier",
        "foreign_tool",
    ]
    assert chain.check("execute_sql", {"sql": "DELETE FROM t"}) is not None


def test_load_policy_chain_fails_loudly_on_a_bad_path(app_context: None) -> None:
    """
    A typo in configuration is fatal.

    Skipping an unimportable guard would quietly weaken the deployment.
    """
    from superset.ai.policy import load_policy_chain

    with pytest.raises(AttributeError, match="NoSuchPolicy"):
        load_policy_chain(["superset.ai.policy.NoSuchPolicy"])
