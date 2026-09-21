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
# pylint: disable=invalid-name, unused-argument, import-outside-toplevel, redefined-outer-name
from __future__ import annotations

from datetime import datetime

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import types
from sqlalchemy.engine.url import make_url

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize("schema", [None, "main"])
def test_get_table_names_hides_internal_tables(
    mocker: MockerFixture,
    schema: str | None,
) -> None:
    """
    Test that the ``_cf_*`` tables D1 keeps in every database are not listed.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec

    database = mocker.MagicMock()
    inspector = mocker.MagicMock()
    inspector.get_table_names.return_value = ["_cf_KV", "cf_notes", "orders"]

    tables = CloudflareD1EngineSpec.get_table_names(database, inspector, schema)

    assert tables == {"cf_notes", "orders"}


@pytest.mark.parametrize("schema", [None, "main"])
def test_get_view_names_hides_internal_views(
    mocker: MockerFixture,
    schema: str | None,
) -> None:
    """
    Test that ``_cf_*`` views are not listed and ordinary views are.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec

    database = mocker.MagicMock()
    inspector = mocker.MagicMock()
    inspector.get_view_names.return_value = ["_cf_internal", "daily_orders"]

    views = CloudflareD1EngineSpec.get_view_names(database, inspector, schema)

    assert views == {"daily_orders"}
    inspector.get_view_names.assert_called_once_with(schema)


@pytest.mark.parametrize(
    "native_type,sqla_type,generic_type,is_dttm",
    [
        ("DATETIME", types.DateTime, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, GenericDataType.TEMPORAL, True),
        ("DATE", types.Date, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, GenericDataType.TEMPORAL, True),
        ("BOOLEAN", types.Boolean, GenericDataType.BOOLEAN, False),
        ("INTEGER", types.Integer, GenericDataType.NUMERIC, False),
        ("TEXT", types.String, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    """
    Test the type names the ``d1`` dialect of sqlalchemy-d1 0.2.0 reports.

    The dialect prints ``DATETIME``, ``TIMESTAMP``, ``DATE``, ``TIME`` and
    ``BOOLEAN`` for columns declared with those types, so they must map to
    temporal and boolean columns rather than to strings and numbers.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, None, generic_type, is_dttm)


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Text", "'2019-01-02 03:04:05'"),
        ("DateTime", "'2019-01-02 03:04:05'"),
        ("TimeStamp", "'2019-01-02 03:04:05'"),
        ("Other", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    """
    Test that D1 formats datetime literals the way SQLite does.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_metadata_points_at_sqlalchemy_d1() -> None:
    """
    Test that the docs metadata names ``sqlalchemy-d1`` as the only package and
    no longer reports a SQLAlchemy 2.0 incompatibility.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec

    metadata = CloudflareD1EngineSpec.metadata

    assert metadata["pypi_packages"] == ["sqlalchemy-d1"]
    assert metadata["install_instructions"] == "pip install sqlalchemy-d1"
    assert "known_incompatibilities" not in metadata


def test_connection_string_matches_engine() -> None:
    """
    Test that the documented connection string is a ``d1://`` URL that this
    spec supports, with the account ID, API token and database ID in the
    username, password and host positions.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec

    template = CloudflareD1EngineSpec.metadata["connection_string"]
    url = make_url(
        template.format(
            cloudflare_account_id="account",
            cloudflare_api_token="token",  # noqa: S106
            cloudflare_d1_database_id="database",
        )
    )

    assert url.get_backend_name() == "d1"
    assert (url.username, url.password, url.host) == ("account", "token", "database")
    assert CloudflareD1EngineSpec.supports_backend(url.get_backend_name())
