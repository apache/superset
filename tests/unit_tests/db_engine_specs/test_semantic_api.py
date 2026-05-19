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

# pylint: disable=import-outside-toplevel

from typing import Any
from unittest.mock import MagicMock

from sqlalchemy.engine.url import make_url

from superset.utils import json


def _columns() -> list[dict[str, Any]]:
    return [
        {
            "name": "region",
            "type": "TEXT",
            "nullable": True,
            "default": None,
            "comment": "dimension",
        },
        {
            "name": "total_revenue",
            "type": "FLOAT",
            "nullable": True,
            "default": None,
            "comment": "metric",
            "computed": {"sqltext": "total_revenue", "persisted": True},
        },
    ]


def test_engine_spec_identity() -> None:
    """
    The engine and dialect names line up with the shillelagh dialect.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    assert SemanticAPIEngineSpec.engine == "semanticapi"
    assert SemanticAPIEngineSpec.engine_name == "Semantic Layer API"
    assert "semanticapi://" in SemanticAPIEngineSpec.sqlalchemy_uri_placeholder


def test_select_star_returns_warning() -> None:
    """
    Data preview is replaced with a single-row warning message.
    """
    from superset.db_engine_specs.semantic_api import (
        SELECT_STAR_MESSAGE,
        SemanticAPIEngineSpec,
    )

    sql = SemanticAPIEngineSpec.select_star()
    assert sql.startswith("SELECT '")
    assert sql.endswith("' AS warning")
    # The single-quote escape is preserved verbatim.
    assert SELECT_STAR_MESSAGE.replace("'", "''") in sql


def test_get_columns_filters_metrics() -> None:
    """
    Only non-computed columns (dimensions) flow through ``get_columns``.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    inspector = MagicMock()
    inspector.get_columns.return_value = _columns()

    table = MagicMock()
    table.table = "sales"
    table.schema = None

    columns = SemanticAPIEngineSpec.get_columns(inspector, table)
    assert [c["name"] for c in columns] == ["region"]
    assert columns[0]["column_name"] == "region"


def test_adjust_engine_params_folds_extra_into_url() -> None:
    """
    ``additional_configuration`` from ``connect_args`` ends up on the URL query.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri, connect_args = SemanticAPIEngineSpec.adjust_engine_params(
        make_url("sqlite://"),
        {"additional_configuration": {"workspace": "acme"}, "other": 1},
    )
    assert "additional_configuration" not in connect_args
    assert connect_args["other"] == 1
    assert json.loads(uri.query["additional_configuration"]) == {"workspace": "acme"}


def test_adjust_engine_params_string_passthrough() -> None:
    """
    A pre-serialised string config is forwarded verbatim.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri, _ = SemanticAPIEngineSpec.adjust_engine_params(
        make_url("sqlite://"),
        {"additional_configuration": '{"workspace":"acme"}'},
    )
    assert uri.query["additional_configuration"] == '{"workspace":"acme"}'


def test_adjust_engine_params_no_extra() -> None:
    """
    Without ``additional_configuration`` the URL is untouched.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri, connect_args = SemanticAPIEngineSpec.adjust_engine_params(
        make_url("sqlite://"),
        {"other": 1},
    )
    assert uri.query == {}
    assert connect_args == {"other": 1}


def test_get_metrics_extracts_computed() -> None:
    """
    Computed columns become Superset metric definitions.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    inspector = MagicMock()
    inspector.get_columns.return_value = _columns()

    table = MagicMock()
    table.table = "sales"
    table.schema = None

    metrics = SemanticAPIEngineSpec.get_metrics(MagicMock(), inspector, table)
    assert metrics == [
        {
            "metric_name": "total_revenue",
            "expression": "total_revenue",
            "description": "metric",
        },
    ]
