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
"""
Tests Superset's BigQuery string-literal escaping (superset/db_engine_specs/
bigquery.py's ``_monkeypatch_bigquery_string_literal``) against a real
GoogleSQL query engine, spun up on demand via testcontainers. Run via
.github/workflows/testcontainers.yml.

sc-120493-adjacent investigation: an apostrophe in a filter value used to
break BigQuery queries (apache/superset#35857 / #38835, doubled single
quotes -- BigQuery rejects ``'Armando''s'`` as two adjacent string literals
needing whitespace between them). The current fix backslash-escapes instead.
Reasoning about correctness from the ``sqlalchemy-bigquery`` dialect source
and the BigQuery DBAPI's ``pyformat`` paramstyle handling is necessary but
not sufficient; this locks in the actual compiled-and-executed behavior
against a real engine instead.
"""

from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.google")

from google.cloud import bigquery  # noqa: E402
from sqlalchemy_bigquery import BigQueryDialect  # noqa: E402
from testcontainers.community.google import BigQueryContainer  # noqa: E402

# Importing this triggers _monkeypatch_bigquery_string_literal(), exactly as
# it runs in a real Superset process.
import superset.db_engine_specs.bigquery  # noqa: E402, F401

DATASET = "ds"
TABLE = "t"


@pytest.fixture(scope="module")
def bq_client() -> Iterator[bigquery.Client]:
    with BigQueryContainer() as container:
        client = container.get_client()
        client.create_dataset(f"{client.project}.{DATASET}")
        client.query(f"CREATE TABLE {DATASET}.{TABLE} (name STRING)").result()
        yield client


@pytest.fixture(scope="module")
def engine(bq_client) -> Engine:
    # user_supplied_client=true is a URL query param, not just a connect_args
    # key: parse_url() only sets BigQueryDialect.create_connect_args() to
    # accept the connect_args={"client": ...} override when it's present,
    # otherwise it tries to build a client from real GCP credentials.
    return sa.create_engine(
        "bigquery://?user_supplied_client=true", connect_args={"client": bq_client}
    )


def _compiled_literal(expr: sa.ColumnElement) -> str:
    """Render ``expr`` exactly as Superset's actual code path does: compiled
    with ``literal_binds=True``, then executed as a plain string with no
    separate bind parameters (superset.db_engine_specs.base.BaseEngineSpec
    .execute() calls ``cursor.execute(query)``, nothing else)."""
    return str(
        expr.compile(dialect=BigQueryDialect(), compile_kwargs={"literal_binds": True})
    )


def _insert_and_find(engine: Engine, value: str) -> list[str]:
    t = sa.table(TABLE, sa.column("name"))
    with engine.connect() as conn:
        conn.execute(sa.text(f"DELETE FROM {DATASET}.{TABLE} WHERE TRUE"))  # noqa: S608
        insert_literal = _compiled_literal(sa.literal(value))
        conn.execute(
            sa.text(
                f"INSERT INTO {DATASET}.{TABLE} (name) VALUES ({insert_literal})"  # noqa: S608
            )
        )
        where = _compiled_literal(t.c.name == value)
        rows = conn.execute(
            sa.text(f"SELECT name FROM {DATASET}.{TABLE} WHERE {where}")  # noqa: S608
        ).fetchall()
        return [row[0] for row in rows]


def test_apostrophe_value_round_trips(engine: Engine) -> None:
    """Regression test for apache/superset#35857: an apostrophe in a filter
    value must not corrupt the compiled query or fail to match."""
    assert _insert_and_find(engine, "O'Brien") == ["O'Brien"]


def test_percent_sign_value_round_trips(engine: Engine) -> None:
    """
    A literal percent sign must survive Superset's actual execution path
    unchanged. Superset's literal_processor does not double it (unlike the
    upstream sqlalchemy-bigquery function it replaces), which is correct
    specifically because Superset always executes via cursor.execute(query)
    with no separate `parameters` -- the BigQuery DBAPI's own pyformat
    handling only applies `%%` -> `%` de-escaping in that case
    (google.cloud.bigquery.dbapi.cursor._format_operation), so a lone `%`
    passes through untouched either way. A doubled `%%` would also survive
    (de-escaped back to one `%`), so this test would not by itself catch a
    regression toward doubling -- it exists to pin the actually-shipped
    behavior, not to distinguish the two.
    """
    assert _insert_and_find(engine, "100% sure") == ["100% sure"]


def test_combined_percent_and_apostrophe_round_trips(engine: Engine) -> None:
    assert _insert_and_find(engine, "50% off for O'Brien") == ["50% off for O'Brien"]


def test_doubled_single_quotes_are_rejected_by_bigquery(bq_client) -> None:
    """
    Documents *why* the fix in #38835 was needed: BigQuery does not accept
    the standard-SQL doubled-single-quote escape convention Superset used to
    emit. If this test ever starts failing because the query succeeds, that
    is a BigQuery/GoogleSQL behavior change worth knowing about, not a
    Superset regression.

    Goes through the raw client with retries disabled, not engine.connect():
    the emulator reports this syntax error as a generic retryable INTERNAL
    rather than a 400, so the client library's default retry policy spends
    close to a minute retrying a failure that will never succeed.
    """
    with pytest.raises(Exception, match="concatenated string literals"):
        bq_client.query(
            f"SELECT * FROM {DATASET}.{TABLE} WHERE name IN ('Armando''s')",  # noqa: S608
            job_retry=None,
        ).result(retry=None)
