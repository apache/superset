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
Tests db_engine_specs.elasticsearch.OpenDistroEngineSpec against a real
OpenSearch instance, spun up on demand via testcontainers. Run via
.github/workflows/testcontainers.yml.

OpenSearch forked from Elasticsearch and its SQL plugin answers in a
different, JDBC-style response shape (``schema``/``datarows`` on the legacy
``/_opendistro/_sql`` endpoint Superset still targets, vs Elasticsearch's own
``columns``/``rows``) -- apache/superset#44703 fixed
``OpenDistroEngineSpec.fetch_data_with_cursor`` reading the wrong keys (an
empty page past page 1) and sending a duplicate ``Content-Type`` header
opensearch-py already sets (OpenSearch rejects the request outright). Both
were already covered by mocked unit tests
(``tests/unit_tests/db_engine_specs/test_elasticsearch.py``); this exercises
the same code path against a real server's real response, which is the only
way to catch a *third* undiscovered shape surprise the mocks don't model.

Unlike the SQL-native dialects in this directory, OpenSearch has no CREATE
TABLE / INSERT: documents get indexed via its REST API, matching how
Superset actually encounters it in practice.
"""

from collections.abc import Iterator
from typing import Any

import pytest
import requests

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.opensearch")

import es.opendistro  # noqa: E402
from testcontainers.community.opensearch import OpenSearchContainer  # noqa: E402

from superset.db_engine_specs.elasticsearch import OpenDistroEngineSpec  # noqa: E402

INDEX = "pilot_pagination"


def _index_document(
    base_url: str, index: str, doc_id: int, body: dict[str, int]
) -> None:
    response = requests.put(f"{base_url}/{index}/_doc/{doc_id}", json=body, timeout=10)
    response.raise_for_status()


def _refresh(base_url: str, index: str) -> None:
    response = requests.post(f"{base_url}/{index}/_refresh", timeout=10)
    response.raise_for_status()


class _RealRawConnection:
    """
    Stands in for the one piece of ``Database`` that
    ``OpenDistroEngineSpec.fetch_data_with_cursor`` actually touches:
    ``get_raw_connection()`` as a context manager yielding the real
    elasticsearch-dbapi ``Connection`` -- whose ``.es`` is a genuine
    ``opensearchpy.OpenSearch`` client already pointed at the container, the
    same object production code drives via ``conn.es.transport.perform_request``.
    Nothing here is mocked; this only avoids constructing a full Superset
    ``Database`` ORM row (and the app/DB-session machinery that implies) for
    a test that only needs one real DBAPI connection.
    """

    def __init__(self, host: str, port: int) -> None:
        self._conn = es.opendistro.connect(host=host, port=port, scheme="http")

    def get_raw_connection(self) -> "_RealRawConnection":
        return self

    def __enter__(self) -> Any:
        return self._conn

    def __exit__(self, *exc_info: object) -> None:
        self._conn.close()


@pytest.fixture(scope="module")
def container() -> Iterator[OpenSearchContainer]:
    with OpenSearchContainer(
        "opensearchproject/opensearch:2.4.0", security_enabled=False
    ) as c:
        cfg = c.get_config()
        base_url = f"http://{cfg['host']}:{cfg['port']}"

        for i in range(3):
            _index_document(base_url, INDEX, i, {"id": i})
        _refresh(base_url, INDEX)

        yield c


def test_fetch_data_with_cursor_reads_later_pages(
    container: OpenSearchContainer,
) -> None:
    """
    Regression test for apache/superset#44703: reading Elasticsearch's
    ``columns``/``rows`` keys against OpenSearch's actual ``schema``/
    ``datarows`` response returned an empty page for anything past page 1.
    page_size=1 against 3 real documents forces real cursor pagination --
    this is a live-wire-format check that only a real server can give.
    """
    cfg = container.get_config()
    database = _RealRawConnection(cfg["host"], int(cfg["port"]))

    rows, columns = OpenDistroEngineSpec.fetch_data_with_cursor(
        database=database,  # type: ignore[arg-type]
        sql=f"SELECT id FROM {INDEX} ORDER BY id",  # noqa: S608
        page_index=2,
        page_size=1,
    )

    assert columns == ["id"]
    assert rows == [[2]]


def test_fetch_data_with_cursor_does_not_duplicate_content_type(
    container: OpenSearchContainer,
) -> None:
    """
    opensearch-py's transport already sets Content-Type; apache/superset#44703
    stopped also passing an explicit one, which OpenSearch's SQL plugin
    rejects outright ("only one Content-Type header should be provided").
    A passing fetch here is itself proof the duplicate header regressed.
    """
    cfg = container.get_config()
    database = _RealRawConnection(cfg["host"], int(cfg["port"]))

    rows, _columns = OpenDistroEngineSpec.fetch_data_with_cursor(
        database=database,  # type: ignore[arg-type]
        sql=f"SELECT id FROM {INDEX} ORDER BY id",  # noqa: S608
        page_index=0,
        page_size=10,
    )

    assert len(rows) == 3
