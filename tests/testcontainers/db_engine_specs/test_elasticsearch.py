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
Tests db_engine_specs.elasticsearch against a real Elasticsearch instance,
spun up on demand via testcontainers. Run via
.github/workflows/testcontainers.yml.

Unlike the SQL-native dialects in this directory, Elasticsearch has no
CREATE TABLE / INSERT: indices and documents get created via its REST API
(elasticsearch-dbapi's SQLAlchemy dialect is read-focused, translating SQL
to the _sql endpoint), matching how Superset actually encounters
Elasticsearch in practice -- data arrives via ingestion tooling, not
through Superset itself.
"""

from collections.abc import Iterator

import pytest
import requests
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec
from superset.sql.parse import Table

pytest.importorskip("testcontainers.community.elasticsearch")

from testcontainers.community.elasticsearch import ElasticSearchContainer  # noqa: E402

INDEX = "pilot_pagination"


def _index_document(
    base_url: str, index: str, doc_id: int, body: dict[str, int]
) -> None:
    response = requests.put(f"{base_url}/{index}/_doc/{doc_id}", json=body, timeout=10)
    response.raise_for_status()


def _refresh(base_url: str, index: str) -> None:
    response = requests.post(f"{base_url}/{index}/_refresh", timeout=10)
    response.raise_for_status()


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with ElasticSearchContainer("elasticsearch:8.11.0") as container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(container.port)
        base_url = f"http://{host}:{port}"

        for i in range(10):
            _index_document(base_url, INDEX, i, {"id": i})
        _refresh(base_url, INDEX)

        yield create_engine(f"elasticsearch+http://{host}:{port}/")


def test_ordered_limited_query_returns_correct_rows(engine: Engine) -> None:
    """
    A plain LIMIT query, compiled and executed against a real instance.
    Mocked tests cannot catch a dialect compiling this incorrectly (see
    apache/superset#42899, where Trino emitted OFFSET before LIMIT) -- only
    real execution can. No OFFSET here: Elasticsearch's SQL layer genuinely
    doesn't support it (a protocol limitation, not a bug -- confirmed
    against a real instance, which raises a parsing_exception on OFFSET).
    ElasticSearchEngineSpec.supports_offset = False documents this already.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT id FROM {INDEX} ORDER BY id LIMIT 3")  # noqa: S608
        ).fetchall()

    assert [row.id for row in rows] == [0, 1, 2]


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    ElasticSearchEngineSpec.get_columns wraps a real SQLAlchemy Inspector;
    this exercises that against actual server-reported field mappings
    rather than a mocked Inspector.
    """
    inspector = inspect(engine)
    columns = ElasticSearchEngineSpec.get_columns(inspector, Table(INDEX))

    by_name = {col["column_name"]: col for col in columns}
    assert "id" in by_name
    spec = ElasticSearchEngineSpec.get_column_spec(str(by_name["id"]["type"]))
    assert spec is not None
