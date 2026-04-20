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
from datetime import datetime
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from sqlalchemy import column  # noqa: F401

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,db_extra,expected_result",
    [
        ("DateTime", None, "CAST('2019-01-02T03:04:05' AS DATETIME)"),
        (
            "DateTime",
            {"version": "7.7"},
            "CAST('2019-01-02T03:04:05' AS DATETIME)",
        ),
        (
            "DateTime",
            {"version": "7.8"},
            "DATETIME_PARSE('2019-01-02 03:04:05', 'yyyy-MM-dd HH:mm:ss')",
        ),
        (
            "DateTime",
            {"version": "unparseable semver version"},
            "CAST('2019-01-02T03:04:05' AS DATETIME)",
        ),
        ("Unknown", None, None),
    ],
)
def test_elasticsearch_convert_dttm(
    target_type: str,
    db_extra: Optional[dict[str, Any]],
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.elasticsearch import (
        ElasticSearchEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm, db_extra)


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("DateTime", "'2019-01-02T03:04:05'"),
        ("Unknown", None),
    ],
)
def test_opendistro_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.elasticsearch import (
        OpenDistroEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "original,expected",
    [
        ("Col", "Col"),
        ("Col.keyword", "Col_keyword"),
    ],
)
def test_opendistro_sqla_column_label(original: str, expected: str) -> None:
    """
    DB Eng Specs (opendistro): Test column label
    """
    from superset.db_engine_specs.elasticsearch import OpenDistroEngineSpec

    assert OpenDistroEngineSpec.make_label_compatible(original) == expected


def test_elasticsearch_spec_opts_out_of_offset_fetch() -> None:
    """
    Elasticsearch SQL does not support OFFSET. The spec must opt out so the
    query builder does not emit OFFSET clauses that crash the parser.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    assert ElasticSearchEngineSpec.allows_offset_fetch is False


def test_opendistro_spec_opts_out_of_offset_fetch() -> None:
    """
    OpenDistro/OpenSearch SQL also does not support OFFSET.
    """
    from superset.db_engine_specs.elasticsearch import OpenDistroEngineSpec

    assert OpenDistroEngineSpec.allows_offset_fetch is False


def _build_fake_database(transport_responses: list[dict[str, Any]]) -> MagicMock:
    """
    Build a mocked Database whose get_raw_connection() yields a connection
    whose es.transport.perform_request returns transport_responses sequentially.
    """
    database = MagicMock(name="Database")

    responses_iter = iter(transport_responses)

    def perform_request(method, path, body=None, **_kwargs):
        return next(responses_iter)

    transport = MagicMock()
    transport.perform_request.side_effect = perform_request
    conn = MagicMock()
    conn.es.transport = transport

    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=conn)
    ctx.__exit__ = MagicMock(return_value=False)
    database.get_raw_connection.return_value = ctx
    database._transport = transport  # expose for assertions
    return database


def test_fetch_data_with_cursor_returns_first_page_when_page_index_zero() -> None:
    """
    Page index 0 = return the rows from the initial query, no cursor
    iteration needed. The cursor must still be closed if present.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    database = _build_fake_database(
        [
            {
                "columns": [{"name": "a"}, {"name": "b"}],
                "rows": [[1, "x"], [2, "y"]],
                "cursor": "CUR-1",
            },
            {},  # close
        ]
    )

    rows, cols, _ = ElasticSearchEngineSpec.fetch_data_with_cursor(
        database=database,
        sql="SELECT a, b FROM idx",
        page_index=0,
        page_size=2,
    )

    assert rows == [[1, "x"], [2, "y"]]
    assert cols == ["a", "b"]

    calls = database._transport.perform_request.call_args_list
    assert len(calls) == 2
    assert calls[0][0][0] == "POST"
    assert calls[0][0][1] == "/_sql"
    assert calls[0].kwargs["body"] == {"query": "SELECT a, b FROM idx", "fetch_size": 2}
    assert calls[1][0][1] == "/_sql/close"
    assert calls[1].kwargs["body"] == {"cursor": "CUR-1"}


def test_fetch_data_with_cursor_iterates_to_target_page() -> None:
    """
    For page_index=2, the code executes the initial query, then sends the
    cursor twice. The rows returned belong to the third page.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    database = _build_fake_database(
        [
            {"columns": [{"name": "a"}], "rows": [[0]], "cursor": "C1"},
            {"rows": [[1]], "cursor": "C2"},
            {"rows": [[2]], "cursor": "C3"},
            {},  # close
        ]
    )

    rows, cols, _ = ElasticSearchEngineSpec.fetch_data_with_cursor(
        database=database,
        sql="SELECT a FROM idx",
        page_index=2,
        page_size=1,
    )

    assert rows == [[2]]
    assert cols == ["a"]

    calls = database._transport.perform_request.call_args_list
    assert len(calls) == 4
    assert calls[1].kwargs["body"] == {"cursor": "C1"}
    assert calls[2].kwargs["body"] == {"cursor": "C2"}
    assert calls[3][0][1] == "/_sql/close"
    assert calls[3].kwargs["body"] == {"cursor": "C3"}


def test_fetch_data_with_cursor_returns_empty_when_dataset_exhausted() -> None:
    """
    If the dataset has fewer pages than the requested page_index, the
    cursor becomes falsy mid-iteration. Return empty rows, do not call
    close, do not raise.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    database = _build_fake_database(
        [
            {"columns": [{"name": "a"}], "rows": [[0]], "cursor": "C1"},
            {"rows": [[1]]},  # no cursor → dataset ends here
        ]
    )

    rows, cols, _ = ElasticSearchEngineSpec.fetch_data_with_cursor(
        database=database,
        sql="SELECT a FROM idx",
        page_index=5,
        page_size=1,
    )

    assert rows == []
    assert cols == ["a"]
    assert len(database._transport.perform_request.call_args_list) == 2


def test_fetch_data_with_cursor_does_not_close_when_no_cursor_present() -> None:
    """
    Some responses (tiny result sets) come back without a cursor token.
    The code must not send a close request with a missing cursor.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    database = _build_fake_database(
        [
            {"columns": [{"name": "a"}], "rows": [[0], [1]]},
        ]
    )

    rows, _, _ = ElasticSearchEngineSpec.fetch_data_with_cursor(
        database=database,
        sql="SELECT a FROM idx",
        page_index=0,
        page_size=50,
    )

    assert rows == [[0], [1]]
    assert len(database._transport.perform_request.call_args_list) == 1


def test_fetch_data_with_cursor_closes_cursor_even_if_iteration_raises() -> None:
    """
    If an intermediate cursor request raises, the cursor from the most
    recent successful response must still be closed. Prevents server-side
    cursor leaks on transport errors.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    class BoomError(RuntimeError):
        pass

    responses = [
        {"columns": [{"name": "a"}], "rows": [[0]], "cursor": "C1"},
    ]
    raises_on_call_index = 1

    call_count = {"n": 0}
    recorded_close = {}

    def perform_request(method, path, body=None, **_kwargs):
        call_count["n"] += 1
        # calls: 0=initial query, 1=cursor follow-up (raises), 2=close
        if call_count["n"] - 1 == raises_on_call_index:
            raise BoomError("transport blew up")
        if path.endswith("/close"):
            recorded_close["body"] = body
            return {}
        return responses[call_count["n"] - 1]

    from unittest.mock import MagicMock

    import pytest

    transport = MagicMock()
    transport.perform_request.side_effect = perform_request
    conn = MagicMock()
    conn.es.transport = transport
    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=conn)
    ctx.__exit__ = MagicMock(return_value=False)
    database = MagicMock()
    database.get_raw_connection.return_value = ctx

    with pytest.raises(BoomError):
        ElasticSearchEngineSpec.fetch_data_with_cursor(
            database=database,
            sql="SELECT a FROM idx",
            page_index=3,
            page_size=1,
        )

    assert recorded_close.get("body") == {"cursor": "C1"}, (
        "The cursor from the last successful response must be closed "
        "even when a later iteration raises."
    )


@pytest.mark.parametrize(
    "sql_in,expected_query",
    [
        # Superset's SQL builder terminates statements with `;` for DB-API
        # execution; the ES SQL API rejects that.
        ("SELECT a FROM idx;", "SELECT a FROM idx"),
        # A trailing LIMIT from the normal samples pipeline would cap the
        # cursor to a single fetch; it must be stripped so `fetch_size`
        # drives pagination instead.
        ("SELECT a FROM idx LIMIT 50", "SELECT a FROM idx"),
        ("SELECT a FROM idx LIMIT 50;", "SELECT a FROM idx"),
        ("SELECT a FROM idx LIMIT 50 ;  ", "SELECT a FROM idx"),
        # Case-insensitive LIMIT recognition, since the builder's output is
        # not guaranteed to be uppercase across backends.
        ("SELECT a FROM idx limit 100", "SELECT a FROM idx"),
        # LIMIT that is *not* the final clause (e.g. inside a subquery) must
        # not be mangled.
        (
            "SELECT * FROM (SELECT a FROM idx LIMIT 10) sub",
            "SELECT * FROM (SELECT a FROM idx LIMIT 10) sub",
        ),
    ],
)
def test_fetch_data_with_cursor_sanitizes_sql(sql_in: str, expected_query: str) -> None:
    """
    The Elasticsearch SQL API has two ergonomic landmines for Superset SQL:
    a trailing ``;`` is rejected, and a trailing ``LIMIT N`` caps the cursor
    to a single fetch. ``_fetch_page_via_cursor`` must strip both before
    submitting the query.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    database = _build_fake_database([{"columns": [{"name": "a"}], "rows": []}])

    ElasticSearchEngineSpec.fetch_data_with_cursor(
        database=database,
        sql=sql_in,
        page_index=0,
        page_size=25,
    )

    first_call = database._transport.perform_request.call_args_list[0]
    assert first_call.kwargs["body"]["query"] == expected_query
    # fetch_size is independent of the SQL rewrite — it's what actually
    # controls the page window.
    assert first_call.kwargs["body"]["fetch_size"] == 25


def test_fetch_data_with_cursor_sets_json_content_type_header() -> None:
    """
    The raw ES transport does not auto-set Content-Type the way the DB-API
    driver does; without it the cluster responds with HTTP 406. Every
    perform_request issued by the cursor helper must carry the JSON header.
    """
    from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec

    database = _build_fake_database(
        [
            {"columns": [{"name": "a"}], "rows": [[0]], "cursor": "C1"},
            {"rows": [[1]], "cursor": "C2"},
            {},  # close
        ]
    )

    ElasticSearchEngineSpec.fetch_data_with_cursor(
        database=database,
        sql="SELECT a FROM idx",
        page_index=1,
        page_size=1,
    )

    for call in database._transport.perform_request.call_args_list:
        assert call.kwargs.get("headers") == {"Content-Type": "application/json"}


def test_opendistro_fetch_data_with_cursor_uses_opendistro_endpoints() -> None:
    """
    OpenDistro's SQL plugin historically lives at /_opendistro/_sql rather
    than /_sql. Verify the classmethod sends requests to the OpenDistro paths.
    """
    from superset.db_engine_specs.elasticsearch import OpenDistroEngineSpec

    database = _build_fake_database(
        [
            {"columns": [{"name": "a"}], "rows": [[42]], "cursor": "OD-1"},
            {},  # close
        ]
    )

    rows, cols, _ = OpenDistroEngineSpec.fetch_data_with_cursor(
        database=database,
        sql="SELECT a FROM idx",
        page_index=0,
        page_size=1,
    )

    assert rows == [[42]]
    assert cols == ["a"]

    calls = database._transport.perform_request.call_args_list
    assert calls[0][0][1] == "/_opendistro/_sql"
    assert calls[1][0][1] == "/_opendistro/_sql/close"
