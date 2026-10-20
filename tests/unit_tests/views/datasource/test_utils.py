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
from typing import Protocol
from unittest.mock import MagicMock, patch

import pytest


class FakeDatasourceFactory(Protocol):
    def __call__(self, supports_offset: bool) -> MagicMock: ...


@pytest.fixture
def fake_datasource_factory() -> FakeDatasourceFactory:
    """Builds a MagicMock datasource whose db_engine_spec is configurable."""

    def _build(supports_offset: bool) -> MagicMock:
        datasource = MagicMock(name="SqlaTable")
        datasource.type = "table"
        datasource.id = 1
        datasource.columns = []
        datasource.database.db_engine_spec.supports_offset = supports_offset
        return datasource

    return _build


def test_get_samples_uses_normal_path_when_engine_supports_offset(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    Engines with supports_offset=True continue to use the existing
    QueryContext/get_payload path. No cursor-method calls.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)
    datasource.database.db_engine_spec.fetch_data_with_cursor = MagicMock()

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        samples_ctx = MagicMock()
        samples_ctx.get_payload.return_value = {
            "queries": [
                {
                    "data": [{"a": 1}],
                    "colnames": ["a"],
                    "coltypes": [],
                    "status": "success",
                }
            ]
        }
        count_ctx = MagicMock()
        count_ctx.get_payload.return_value = {
            "queries": [{"data": [{"COUNT(*)": 42}], "status": "success"}]
        }
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=2,
            per_page=50,
        )

    assert result["data"] == [{"a": 1}]
    assert result["page"] == 2
    assert result["per_page"] == 50
    assert result["total_count"] == 42
    datasource.database.db_engine_spec.fetch_data_with_cursor.assert_not_called()


def test_get_samples_normal_path_cleans_count_cache_when_sample_data_failed(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    On the normal (non-cursor) path, a FAILED samples payload must evict the
    count-star cache and raise DatasetSamplesFailedError — mirroring the
    cursor path's failure handling.
    """
    from superset.commands.dataset.exceptions import DatasetSamplesFailedError
    from superset.constants import CacheRegion
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)

    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [
            {
                "status": "failed",
                "error": "backend query failed",
            }
        ]
    }
    count_ctx = MagicMock()
    count_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [{"COUNT(*)": 1}],
                "status": "success",
                "cache_key": "count-cache-key",
            }
        ]
    }

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
        patch.object(utils, "QueryCacheManager") as cache_mgr,
    ):
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        with pytest.raises(DatasetSamplesFailedError) as excinfo:
            utils.get_samples(
                datasource_type="table",
                datasource_id=1,
                page=1,
                per_page=50,
            )

    cache_mgr.delete.assert_called_once_with("count-cache-key", CacheRegion.DATA)
    assert "backend query failed" in str(excinfo.value)


def test_get_samples_uses_cursor_path_when_engine_disallows_offset(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    When the engine reports supports_offset=False and the requested
    page is > 1, get_samples delegates to fetch_data_with_cursor with SQL
    compiled statically (without executing the normal samples payload).
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor.return_value = (
        [[99]],
        ["a"],
    )

    samples_ctx = MagicMock()
    samples_ctx.queries = [MagicMock()]
    samples_ctx.datasource.get_query_str.return_value = "SELECT a FROM idx LIMIT 50"
    count_ctx = MagicMock()
    count_ctx.get_payload.return_value = {
        "queries": [{"data": [{"COUNT(*)": 200}], "status": "success"}]
    }

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=3,
            per_page=50,
        )

    datasource.database.db_engine_spec.fetch_data_with_cursor.assert_called_once()
    kwargs = datasource.database.db_engine_spec.fetch_data_with_cursor.call_args.kwargs
    assert kwargs["page_index"] == 2
    assert kwargs["page_size"] == 50
    # The cursor path compiles SQL statically via get_query_str, without
    # executing the normal samples payload; the engine spec is responsible
    # for any sanitation (strip ``;``/``LIMIT``).
    assert kwargs["sql"] == "SELECT a FROM idx LIMIT 50"
    samples_ctx.get_payload.assert_not_called()

    assert result["data"] == [{"a": 99}]
    assert result["colnames"] == ["a"]
    assert result["page"] == 3
    assert result["per_page"] == 50
    assert result["total_count"] == 200


def test_get_samples_cursor_path_infers_coltypes_from_cursor_rows(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    coltypes on the cursor path are inferred from the returned rows via
    extract_dataframe_dtypes — the same function the normal (non-cursor)
    path uses to type page 1 — so SamplesPane's useGridColumns() picks up
    type-based cell renderers on page 2+ without an extra query.
    """
    from superset.utils.core import GenericDataType
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor.return_value = (
        [["x", 1]],
        ["a", "b"],
    )

    samples_ctx = MagicMock()
    samples_ctx.queries = [MagicMock()]
    samples_ctx.datasource.get_query_str.return_value = "SELECT a, b FROM idx LIMIT 50"
    count_ctx = MagicMock()
    count_ctx.get_payload.return_value = {
        "queries": [{"data": [{"COUNT(*)": 2000}], "status": "success"}]
    }

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=2,
            per_page=50,
        )

    assert result["coltypes"] == [GenericDataType.STRING, GenericDataType.NUMERIC]
    assert result["colnames"] == ["a", "b"]
    assert result["data"] == [{"a": "x", "b": 1}]


def test_get_samples_cursor_path_cleans_count_cache_on_failure(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    Issue 2: if fetch_data_with_cursor raises, the count-star cache must be
    evicted (mirroring the normal FAILED path) and the error re-raised as
    DatasetSamplesFailedError.
    """
    from superset.commands.dataset.exceptions import DatasetSamplesFailedError
    from superset.constants import CacheRegion
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor.side_effect = (
        RuntimeError("boom: internal es stack trace details")
    )

    samples_ctx = MagicMock()
    samples_ctx.queries = [MagicMock()]
    samples_ctx.datasource.get_query_str.return_value = "SELECT a FROM idx LIMIT 50"
    count_ctx = MagicMock()
    count_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [{"COUNT(*)": 200}],
                "status": "success",
                "cache_key": "count-cache-key",
            }
        ]
    }

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
        patch.object(utils, "QueryCacheManager") as cache_mgr,
    ):
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        with pytest.raises(DatasetSamplesFailedError) as excinfo:
            utils.get_samples(
                datasource_type="table",
                datasource_id=1,
                page=3,
                per_page=50,
            )

    cache_mgr.delete.assert_called_once_with("count-cache-key", CacheRegion.DATA)
    # Backend-internal error text must not leak into the user-facing message;
    # only the original exception (chained via ``from exc``) retains the detail.
    assert "internal es stack trace details" not in str(excinfo.value)
    assert isinstance(excinfo.value.__cause__, RuntimeError)


def test_get_samples_cursor_path_raises_when_compiled_sql_is_empty(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    If get_query_str compiles to an empty string, the cursor path has
    nothing to submit. Fail fast with a descriptive error and evict the
    count cache, instead of handing an empty statement to the engine driver.
    """
    from superset.commands.dataset.exceptions import DatasetSamplesFailedError
    from superset.constants import CacheRegion
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=False)

    samples_ctx = MagicMock()
    samples_ctx.queries = [MagicMock()]
    samples_ctx.datasource.get_query_str.return_value = ""
    count_ctx = MagicMock()
    count_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [{"COUNT(*)": 200}],
                "status": "success",
                "cache_key": "count-cache-key",
            }
        ]
    }

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
        patch.object(utils, "QueryCacheManager") as cache_mgr,
    ):
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        with pytest.raises(DatasetSamplesFailedError):
            utils.get_samples(
                datasource_type="table",
                datasource_id=1,
                page=2,
                per_page=50,
            )

    cache_mgr.delete.assert_called_once_with("count-cache-key", CacheRegion.DATA)
    datasource.database.db_engine_spec.fetch_data_with_cursor.assert_not_called()


def test_get_samples_cursor_path_unused_for_page_one(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    Page 1 (row_offset = 0) does not need cursor iteration — the normal
    path already returns the first page correctly without emitting OFFSET.
    Keep the fast path.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor = MagicMock()

    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [{"a": 1}],
                "colnames": ["a"],
                "coltypes": [],
                "status": "success",
            }
        ]
    }
    count_ctx = MagicMock()
    count_ctx.get_payload.return_value = {
        "queries": [{"data": [{"COUNT(*)": 1}], "status": "success"}]
    }

    with (
        patch.object(
            utils, "DatasourceDAO", MagicMock(get_datasource=lambda **kw: datasource)
        ),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [samples_ctx, count_ctx]

        utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=1,
            per_page=50,
        )

    datasource.database.db_engine_spec.fetch_data_with_cursor.assert_not_called()


def _samples_ctx(rows: list[dict[str, int]]) -> MagicMock:
    ctx = MagicMock()
    ctx.get_payload.return_value = {
        "queries": [
            {
                "data": rows,
                "colnames": ["a"],
                "coltypes": [],
                "rowcount": len(rows),
                "status": "success",
            }
        ]
    }
    return ctx


def _count_ctx(count: int) -> MagicMock:
    ctx = MagicMock()
    ctx.get_payload.return_value = {
        "queries": [{"data": [{"COUNT(*)": count}], "status": "success"}]
    }
    return ctx


def _created_queries(qcf: MagicMock) -> list[dict[str, object]]:
    return [
        call.kwargs["queries"][0] for call in qcf.return_value.create.call_args_list
    ]


@pytest.mark.parametrize("payload", [None, {"filters": [], "columns": ["a"]}])
def test_get_samples_partitioned_dataset_skips_count_star(
    fake_datasource_factory: FakeDatasourceFactory,
    payload: dict[str, object] | None,
) -> None:
    """
    A dataset with a partition column never builds the COUNT(*) query: on a
    40B-row Impala/Hive table it is an unbounded full scan. The rows query asks
    for one probe row past the page instead, and since the probe came back the
    total is reported as a lower bound with the probe trimmed off.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)
    datasource.partition_column = "ds"

    with (
        patch.object(utils, "is_feature_enabled", return_value=True),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [
            _samples_ctx([{"a": i} for i in range(51)])
        ]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=3,
            per_page=50,
            payload=payload,  # type: ignore[arg-type]
            datasource=datasource,
        )

    queries = _created_queries(qcf)
    assert len(queries) == 1
    assert "metrics" not in queries[0]
    assert queries[0]["row_limit"] == 51
    assert queries[0]["row_offset"] == 100
    assert result["data"] == [{"a": i} for i in range(50)]
    assert result["rowcount"] == 50
    assert result["total_count"] == 150
    assert result["total_count_is_lower_bound"] is True


def test_get_samples_partitioned_dataset_last_page_is_exact(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    No probe row means this page is the last one, so offset plus the rows on it
    is the exact total.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)
    datasource.partition_column = "ds"

    with (
        patch.object(utils, "is_feature_enabled", return_value=True),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [_samples_ctx([{"a": 1}] * 7)]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=2,
            per_page=50,
            datasource=datasource,
        )

    assert len(result["data"]) == 7
    assert result["total_count"] == 57
    assert result["total_count_is_lower_bound"] is False


def test_get_samples_partitioned_dataset_default_page_size_probes(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    ``per_page=0`` resolves to the configured SAMPLES_ROW_LIMIT downstream; the
    probe has to be one past that, not one past zero.
    """
    from flask import current_app

    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)
    datasource.partition_column = "ds"
    samples_row_limit = current_app.config["SAMPLES_ROW_LIMIT"]

    with (
        patch.object(utils, "is_feature_enabled", return_value=True),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [_samples_ctx([{"a": 1}] * 3)]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=1,
            per_page=0,
            datasource=datasource,
        )

    assert _created_queries(qcf)[0]["row_limit"] == samples_row_limit + 1
    assert result["total_count"] == 3
    assert result["total_count_is_lower_bound"] is False


def test_get_samples_partitioned_dataset_cursor_path_full_page_is_lower_bound(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """
    The cursor path pages by exact page size and carries no probe row, so a
    full page is reported as a lower bound; there is still no COUNT(*).
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=False)
    datasource.partition_column = "ds"
    datasource.database.db_engine_spec.fetch_data_with_cursor.return_value = (
        [(i,) for i in range(50)],
        ["a"],
    )

    with (
        patch.object(utils, "is_feature_enabled", return_value=True),
        patch.object(utils, "QueryContextFactory") as qcf,
        patch.object(utils, "extract_dataframe_dtypes", return_value=[]),
    ):
        samples_ctx = MagicMock()
        samples_ctx.datasource.get_query_str.return_value = "SELECT a FROM t"
        qcf.return_value.create.side_effect = [samples_ctx]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=2,
            per_page=50,
            datasource=datasource,
        )

    assert len(_created_queries(qcf)) == 1
    fetch = datasource.database.db_engine_spec.fetch_data_with_cursor
    assert fetch.call_args.kwargs["page_index"] == 1
    assert fetch.call_args.kwargs["page_size"] == 50
    assert result["total_count"] == 100
    assert result["total_count_is_lower_bound"] is True


def test_get_samples_partitioned_dataset_samples_failure_still_raises(
    fake_datasource_factory: FakeDatasourceFactory,
) -> None:
    """With no count query there is no count cache entry to evict."""
    from superset.commands.dataset.exceptions import DatasetSamplesFailedError
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)
    datasource.partition_column = "ds"
    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [{"status": "failed", "error": "timed out"}]
    }

    with (
        patch.object(utils, "is_feature_enabled", return_value=True),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [samples_ctx]

        with pytest.raises(DatasetSamplesFailedError, match="timed out"):
            utils.get_samples(
                datasource_type="table",
                datasource_id=1,
                datasource=datasource,
            )


@pytest.mark.parametrize(
    ("flag_enabled", "partition_column"),
    [(False, "ds"), (True, None), (True, "")],
)
def test_get_samples_keeps_exact_count_without_partition_mapping(
    fake_datasource_factory: FakeDatasourceFactory,
    flag_enabled: bool,
    partition_column: str | None,
) -> None:
    """
    Datasets without a partition column, or deployments with the feature off,
    keep the exact COUNT(*) and the un-probed row limit.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(supports_offset=True)
    datasource.partition_column = partition_column

    with (
        patch.object(utils, "is_feature_enabled", return_value=flag_enabled),
        patch.object(utils, "QueryContextFactory") as qcf,
    ):
        qcf.return_value.create.side_effect = [
            _samples_ctx([{"a": 1}] * 50),
            _count_ctx(1234),
        ]

        result = utils.get_samples(
            datasource_type="table",
            datasource_id=1,
            page=1,
            per_page=50,
            datasource=datasource,
        )

    queries = _created_queries(qcf)
    assert len(queries) == 2
    assert queries[0]["row_limit"] == 50
    assert queries[1]["metrics"][0]["sqlExpression"] == "COUNT(*)"  # type: ignore[index]
    assert len(result["data"]) == 50
    assert result["total_count"] == 1234
    assert result["total_count_is_lower_bound"] is False
