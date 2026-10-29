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
"""Partition validation compares row pairs, not membership in a set of keys."""

from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pandas as pd
import pytest
from flask import Flask

from superset.connectors.sqla.partition_mapping import (
    epoch_mapping_refusal,
    evaluate_transform,
    preview_partition_mapping,
    resolve_partition_mapping,
)
from superset.connectors.sqla.partition_validation import validate_partition_data
from superset.db_engine_specs.ascend import AscendEngineSpec
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.databricks import (
    DatabricksHiveEngineSpec,
    DatabricksPythonConnectorEngineSpec,
)
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.impala import ImpalaEngineSpec
from superset.db_engine_specs.spark import SparkEngineSpec
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.utils.core import QueryStatus
from tests.unit_tests.models.partition_mirroring_test import _table


@pytest.mark.parametrize(
    "spec",
    [
        HiveEngineSpec,
        ImpalaEngineSpec,
        SparkEngineSpec,
        DatabricksHiveEngineSpec,
        AscendEngineSpec,
    ],
)
@pytest.mark.parametrize(
    "transform",
    [
        "unix_timestamp(:value)",
        "(UNIX_TIMESTAMP(:value))",
        " unix_timestamp( :value ) ",
    ],
)
def test_former_default_is_declined_without_probing(
    app: Flask, spec: type[BaseEngineSpec], transform: str
) -> None:
    """Stored mappings cannot bypass the guard through a positive cached verdict."""
    table = _table(transform=transform)
    with (
        app.app_context(),
        patch.object(
            Database, "db_engine_spec", new_callable=PropertyMock, return_value=spec
        ),
        patch("superset.connectors.sqla.partition_mapping.evaluate_transform") as probe,
        patch(
            "superset.connectors.sqla.models.known_mirror_verdict", return_value=True
        ),
        patch(
            "superset.connectors.sqla.partition_mapping.feature_flag_manager.is_feature_enabled",
            return_value=True,
        ),
    ):
        assert spec.partition_value_transform_default is None
        assert epoch_mapping_refusal(table, "event_time", "dt_epoch", transform)
        # The chart path reaches `build_mirrored_predicates` only through this.
        assert resolve_partition_mapping(table) is None
        preview = preview_partition_mapping(
            table,
            mapped_column="event_time",
            value_transform=transform,
            sample_values=["2026-01-15 10:47:23"],
        )
        assert preview["reason"] == "unbucketed_epoch"
        probe.assert_not_called()


def test_floor_and_unrelated_databricks_spec_are_not_refused(app: Flask) -> None:
    """The refusal is expression- and resolved-spec-specific."""
    table = _table()
    with (
        app.app_context(),
        patch.object(
            Database,
            "db_engine_spec",
            new_callable=PropertyMock,
            return_value=HiveEngineSpec,
        ),
    ):
        assert (
            epoch_mapping_refusal(
                table,
                "event_time",
                "dt_epoch",
                "floor(unix_timestamp(:value)/3600)*3600",
            )
            is None
        )
    with (
        app.app_context(),
        patch.object(
            Database,
            "db_engine_spec",
            new_callable=PropertyMock,
            return_value=DatabricksPythonConnectorEngineSpec,
        ),
    ):
        assert (
            epoch_mapping_refusal(
                table, "event_time", "dt_epoch", "unix_timestamp(:value)"
            )
            is None
        )


def test_half_typed_transform_is_not_refused_and_does_not_raise(app: Flask) -> None:
    """An unterminated quote tokenizes badly; the dataset must still load."""
    table = _table(transform="unix_timestamp(':value)")
    with (
        app.app_context(),
        patch.object(
            Database,
            "db_engine_spec",
            new_callable=PropertyMock,
            return_value=HiveEngineSpec,
        ),
    ):
        assert (
            epoch_mapping_refusal(
                table, "event_time", "dt_epoch", "unix_timestamp(':value)"
            )
            is None
        )


@pytest.mark.parametrize(
    "answers,status",
    [
        ([3600, 7200], "matched"),
        ([7200, 7200], "mismatch"),
        ([None, 7200], "mismatch"),
        (None, "inconclusive"),
    ],
)
def test_data_validation_checks_corresponding_rows(
    app: Flask, answers: list[Any] | None, status: str
) -> None:
    """An answer existing in another partition is still wrong for this row."""
    table = _table(transform="floor(:value/3600)*3600")
    table.id = 1
    context = MagicMock()
    context.queries = [MagicMock()]
    sample = SimpleNamespace(
        status=QueryStatus.SUCCESS,
        df=pd.DataFrame({"event_time": [4000, 8000], "dt_epoch": [3600, 7200]}),
    )
    with (
        app.app_context(),
        patch(
            "superset.connectors.sqla.partition_validation.QueryContextFactory"
        ) as factory,
        patch.object(table, "query", return_value=sample),
        patch(
            "superset.connectors.sqla.partition_validation.evaluate_transform",
            return_value=answers,
        ) as probe,
    ):
        factory.return_value.create.return_value = context
        result = validate_partition_data(
            table,
            mapped_column="event_time",
            partition_column="dt_epoch",
            value_transform="floor(:value/3600)*3600",
            partition_values=["3600"],
        )
        assert result["status"] == status
        context.raise_for_access.assert_called_once()
        request = factory.return_value.create.call_args.kwargs["queries"][0]
        assert request["filters"] == [{"col": "dt_epoch", "op": "==", "val": 3600}]
        assert request["columns"] == ["event_time", "dt_epoch"]
        assert request["row_limit"] == 50
        assert "metrics" not in request
        assert probe.call_args.kwargs["fresh"] is True
        if status == "mismatch":
            assert result["examples"][0]["stored_key"] == "3600"


def test_validation_authorizes_before_reading_rows(app: Flask) -> None:
    """An editor without data access cannot read sample pairs."""
    table = _table()
    table.id = 1
    with (
        app.app_context(),
        patch(
            "superset.connectors.sqla.partition_validation.QueryContextFactory"
        ) as factory,
        patch.object(table, "query") as query,
    ):
        factory.return_value.create.return_value.raise_for_access.side_effect = (
            SupersetSecurityException(MagicMock())
        )
        with pytest.raises(SupersetSecurityException):
            validate_partition_data(
                table,
                mapped_column="event_time",
                partition_column="dt_epoch",
                value_transform="unix_timestamp(:value)",
                partition_values=["3600"],
            )
        query.assert_not_called()


@pytest.mark.parametrize("values", [[], [None], [datetime(2026, 1, 15, 10, 47)]])
def test_empty_null_or_failed_sample_cannot_pass(app: Flask, values: list[Any]) -> None:
    """Empty coverage and failed evaluations are inconclusive, never matched."""
    table = _table()
    table.id = 1
    context = MagicMock()
    context.queries = [MagicMock()]
    sample = SimpleNamespace(
        status=QueryStatus.SUCCESS,
        df=pd.DataFrame({"event_time": values, "dt_epoch": [3600] * len(values)}),
    )
    with (
        app.app_context(),
        patch(
            "superset.connectors.sqla.partition_validation.QueryContextFactory"
        ) as factory,
        patch.object(table, "query", return_value=sample),
        patch(
            "superset.connectors.sqla.partition_validation.evaluate_transform",
            return_value=None,
        ),
    ):
        factory.return_value.create.return_value = context
        assert (
            validate_partition_data(
                table,
                mapped_column="event_time",
                partition_column="dt_epoch",
                value_transform="unix_timestamp(:value)",
                partition_values=["3600"],
            )["status"]
            == "inconclusive"
        )


def test_fresh_validation_does_not_read_or_write_probe_or_verdict_cache(
    app: Flask,
) -> None:
    """A previous successful probe is not evidence about these rows."""
    table = _table()
    with (
        app.app_context(),
        patch(
            "superset.connectors.sqla.partition_mapping._probe", return_value=[3600]
        ) as probe,
        patch("superset.connectors.sqla.partition_mapping._cache_get") as cache_get,
        patch("superset.connectors.sqla.partition_mapping._cache_set") as cache_set,
        patch(
            "superset.connectors.sqla.partition_mapping.record_mirror_verdict"
        ) as verdict,
    ):
        assert evaluate_transform(
            table.database, None, None, ":value", [4000, 4000], fresh=True
        ) == [3600, 3600]
        assert probe.call_args.args[4] == [4000]
        cache_get.assert_not_called()
        cache_set.assert_not_called()
        verdict.assert_not_called()


def test_real_sampling_query_preserves_partition_filter_and_rls(app: Flask) -> None:
    """Build and execute the sampling query, rather than mocking returned pairs."""
    import sqlite3

    from superset.common.query_context import QueryContext
    from superset.common.query_context_factory import QueryContextFactory

    table = _table(transform="floor(:value/3600)*3600")
    table.id = 1
    table.columns[0].type = "BIGINT"
    table.columns[0].is_dttm = False
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE web_events (event_time BIGINT, dt_epoch BIGINT, country TEXT)"
    )
    connection.executemany(
        "INSERT INTO web_events VALUES (?, ?, ?)",
        [(4000, 3600, "allowed"), (4000, 7200, "hidden"), (8000, 7200, "allowed")],
    )
    executed = []

    def fetch(sql: str, *args: object, **kwargs: Any) -> pd.DataFrame:
        executed.append(sql)
        frame = pd.read_sql_query(sql, connection)
        if mutator := kwargs.get("mutator"):
            frame = mutator(frame)
        return frame

    import sqlalchemy as sa

    with (
        app.app_context(),
        patch.object(QueryContextFactory, "_convert_to_model", return_value=table),
        patch.object(QueryContext, "raise_for_access"),
        patch.object(
            table,
            "get_sqla_row_level_filters",
            return_value=[sa.text("country = 'allowed'")],
        ),
        patch.object(Database, "get_df", side_effect=fetch),
    ):
        result = validate_partition_data(
            table,
            mapped_column="event_time",
            partition_column="dt_epoch",
            value_transform=":value - :value % 3600",
            partition_values=["3600", "7200"],
        )
    assert result["status"] == "matched"
    assert result["checked_rows"] == 2
    reads = [sql for sql in executed if "FROM web_events" in sql]
    assert len(reads) == 2
    assert all("LIMIT 50" in sql and "country = 'allowed'" in sql for sql in reads)
    assert all("COUNT(" not in sql.upper() for sql in executed)
    # A raw read stops at the limit; GROUP BY would aggregate the whole partition.
    assert all("GROUP BY" not in sql.upper() for sql in reads)
    connection.close()
