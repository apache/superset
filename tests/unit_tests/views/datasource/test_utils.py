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
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def fake_datasource_factory():
    """Builds a MagicMock datasource whose db_engine_spec is configurable."""

    def _build(allows_offset_fetch: bool) -> MagicMock:
        datasource = MagicMock(name="SqlaTable")
        datasource.type = "table"
        datasource.id = 1
        datasource.database.db_engine_spec.allows_offset_fetch = allows_offset_fetch
        return datasource

    return _build


def test_get_samples_uses_normal_path_when_engine_supports_offset(
    fake_datasource_factory,
):
    """
    Engines with allows_offset_fetch=True continue to use the existing
    QueryContext/get_payload path. No cursor-method calls.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(allows_offset_fetch=True)
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


def test_get_samples_uses_cursor_path_when_engine_disallows_offset(
    fake_datasource_factory,
):
    """
    When the engine reports allows_offset_fetch=False and the requested
    page is > 1, get_samples delegates to fetch_data_with_cursor with the
    SQL that Superset already compiled for the normal samples payload.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(allows_offset_fetch=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor.return_value = (
        [[99]],
        ["a"],
        None,
    )

    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [],
                "colnames": ["a"],
                "coltypes": [2],
                "status": "success",
                "query": "SELECT a FROM idx LIMIT 50",
            }
        ]
    }
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
    # The cursor path reuses the already-compiled samples SQL verbatim; the
    # engine spec is responsible for any sanitation (strip ``;``/``LIMIT``).
    assert kwargs["sql"] == "SELECT a FROM idx LIMIT 50"

    assert result["data"] == [{"a": 99}]
    assert result["colnames"] == ["a"]
    assert result["page"] == 3
    assert result["per_page"] == 50
    assert result["total_count"] == 200


def test_get_samples_cursor_path_propagates_coltypes_from_samples_payload(
    fake_datasource_factory,
):
    """
    Issue 1: coltypes from the normal samples payload must flow into the
    cursor-path response dict so that SamplesPane's useGridColumns() picks
    up type-based cell renderers on page 2+.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(allows_offset_fetch=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor.return_value = (
        [["x", 1]],
        ["a", "b"],
        None,
    )

    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [],
                "colnames": ["a", "b"],
                "coltypes": [2, 1],
                "status": "success",
                "query": "SELECT a, b FROM idx LIMIT 50",
            }
        ]
    }
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

    assert result["coltypes"] == [2, 1]
    assert result["colnames"] == ["a", "b"]
    assert result["data"] == [{"a": "x", "b": 1}]


def test_get_samples_cursor_path_cleans_count_cache_on_failure(
    fake_datasource_factory,
):
    """
    Issue 2: if fetch_data_with_cursor raises, the count-star cache must be
    evicted (mirroring the normal FAILED path) and the error re-raised as
    DatasetSamplesFailedError.
    """
    from superset.commands.dataset.exceptions import DatasetSamplesFailedError
    from superset.constants import CacheRegion
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(allows_offset_fetch=False)
    datasource.database.db_engine_spec.fetch_data_with_cursor.side_effect = (
        RuntimeError("boom")
    )

    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [],
                "colnames": ["a"],
                "coltypes": [2],
                "status": "success",
                "query": "SELECT a FROM idx LIMIT 50",
            }
        ]
    }
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
                page=3,
                per_page=50,
            )

    cache_mgr.delete.assert_called_once_with("count-cache-key", CacheRegion.DATA)


def test_get_samples_cursor_path_raises_when_sample_payload_has_no_sql(
    fake_datasource_factory,
):
    """
    If the samples payload is ``success`` but carries no compiled ``query``
    string, the cursor path has nothing to submit. Fail fast with a
    descriptive error and evict the count cache, instead of handing an empty
    statement to the engine driver.
    """
    from superset.commands.dataset.exceptions import DatasetSamplesFailedError
    from superset.constants import CacheRegion
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(allows_offset_fetch=False)

    samples_ctx = MagicMock()
    samples_ctx.get_payload.return_value = {
        "queries": [
            {
                "data": [],
                "colnames": ["a"],
                "coltypes": [2],
                "status": "success",
                # No ``query`` key — simulates a backend that reports success
                # without emitting SQL (e.g. fully cached empty result).
            }
        ]
    }
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


def test_get_samples_cursor_path_unused_for_page_one(fake_datasource_factory):
    """
    Page 1 (row_offset = 0) does not need cursor iteration — the normal
    path already returns the first page correctly without emitting OFFSET.
    Keep the fast path.
    """
    from superset.views.datasource import utils

    datasource = fake_datasource_factory(allows_offset_fetch=False)
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
