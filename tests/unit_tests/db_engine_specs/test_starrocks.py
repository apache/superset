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

from typing import Any, Optional

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import JSON, types
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.starrocks import (
    ARRAY,
    BITMAP,
    DOUBLE,
    HLL,
    LARGEINT,
    MAP,
    PERCENTILE,
    STRUCT,
    TINYINT,
)
from superset.utils.core import GenericDataType
from tests.unit_tests.conftest import with_feature_flags
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("tinyint", TINYINT, None, GenericDataType.NUMERIC, False),
        ("largeint", LARGEINT, None, GenericDataType.NUMERIC, False),
        ("decimal(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("double", DOUBLE, None, GenericDataType.NUMERIC, False),
        # String
        ("char(10)", types.CHAR, None, GenericDataType.STRING, False),
        ("varchar(65533)", types.VARCHAR, None, GenericDataType.STRING, False),
        ("binary", types.String, None, GenericDataType.STRING, False),
        # Complex type
        ("array<varchar(65533)>", ARRAY, None, GenericDataType.STRING, False),
        ("map<string,int>", MAP, None, GenericDataType.STRING, False),
        ("struct<int,string>", STRUCT, None, GenericDataType.STRING, False),
        ("json", JSON, None, GenericDataType.STRING, False),
        ("bitmap", BITMAP, None, GenericDataType.STRING, False),
        ("hll", HLL, None, GenericDataType.STRING, False),
        ("percentile", PERCENTILE, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.starrocks import (
        StarRocksEngineSpec as spec,  # noqa: N813
    )

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "sqlalchemy_uri,connect_args,return_schema,return_connect_args",
    [
        (
            "starrocks://user:password@host/db1",
            {"param1": "some_value"},
            "db1.",  # Single value is treated as schema (in default catalog)
            {"param1": "some_value"},
        ),
        (
            "starrocks://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            "catalog1.db1",
            {"param1": "some_value"},
        ),
        (
            "starrocks://user:password@host",
            {"param1": "some_value"},
            "default_catalog.",
            {"param1": "some_value"},
        ),
    ],
)
def test_adjust_engine_params(
    sqlalchemy_uri: str,
    connect_args: dict[str, Any],
    return_schema: Optional[str],
    return_connect_args: dict[str, Any],
) -> None:
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    url = make_url(sqlalchemy_uri)
    returned_url, returned_connect_args = StarRocksEngineSpec.adjust_engine_params(
        url, connect_args
    )
    assert returned_url.database == return_schema
    assert returned_connect_args == return_connect_args


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    # With catalog.schema format
    assert (
        StarRocksEngineSpec.get_schema_from_engine_params(
            make_url("starrocks://localhost:9030/hive.default"),
            {},
        )
        == "default"
    )

    # With only catalog (no schema) - should return None
    assert (
        StarRocksEngineSpec.get_schema_from_engine_params(
            make_url("starrocks://localhost:9030/sales"),
            {},
        )
        is None
    )

    # With no database - should return None
    assert (
        StarRocksEngineSpec.get_schema_from_engine_params(
            make_url("starrocks://localhost:9030"),
            {},
        )
        is None
    )


def test_impersonation_username(mocker: MockerFixture) -> None:
    """
    Test impersonation and make sure that `impersonate_user` leaves the URL
    unchanged and that `get_prequeries` returns the appropriate impersonation query.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    database = mocker.MagicMock()
    database.impersonate_user = True
    database.get_effective_user.return_value = "alice"

    assert StarRocksEngineSpec.impersonate_user(
        database,
        username="alice",
        user_token=None,
        url=make_url("starrocks://service_user@localhost:9030/hive.default"),
        engine_kwargs={},
    ) == (make_url("starrocks://service_user@localhost:9030/hive.default"), {})

    assert StarRocksEngineSpec.get_prequeries(database) == [
        'EXECUTE AS "alice" WITH NO REVERT;'
    ]


def test_impersonation_disabled(mocker: MockerFixture) -> None:
    """
    Test that impersonation is not applied when the feature is disabled in
    `impersonate_user` and `get_prequeries`.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    database = mocker.MagicMock()
    database.impersonate_user = False
    database.get_effective_user.return_value = "alice"

    assert StarRocksEngineSpec.impersonate_user(
        database,
        username="alice",
        user_token=None,
        url=make_url("starrocks://service_user@localhost:9030/hive.default"),
        engine_kwargs={},
    ) == (make_url("starrocks://service_user@localhost:9030/hive.default"), {})

    assert StarRocksEngineSpec.get_prequeries(database) == []


def test_get_default_catalog(mocker: MockerFixture) -> None:
    """
    Test the ``get_default_catalog`` method.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    # Test case 1: Catalog is in the URI
    database = mocker.MagicMock()
    database.url_object.database = "hive.default"

    assert StarRocksEngineSpec.get_default_catalog(database) == "hive"

    # Test case 2: Catalog is not in the URI, returns default
    database = mocker.MagicMock()
    database.url_object.database = "default"

    assert StarRocksEngineSpec.get_default_catalog(database) == "default_catalog"


def test_get_catalog_names(mocker: MockerFixture) -> None:
    """
    Test the ``get_catalog_names`` method.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    database = mocker.MagicMock()
    inspector = mocker.MagicMock()

    # Mock the actual StarRocks SHOW CATALOGS format
    # StarRocks returns rows with keys: ['Catalog', 'Type', 'Comment']
    mock_row_1 = mocker.MagicMock()
    mock_row_1.keys.return_value = ["Catalog", "Type", "Comment"]
    mock_row_1.__getitem__ = lambda self, key: (
        "default_catalog" if key == "Catalog" else None
    )

    mock_row_2 = mocker.MagicMock()
    mock_row_2.keys.return_value = ["Catalog", "Type", "Comment"]
    mock_row_2.__getitem__ = lambda self, key: "hive" if key == "Catalog" else None

    mock_row_3 = mocker.MagicMock()
    mock_row_3.keys.return_value = ["Catalog", "Type", "Comment"]
    mock_row_3.__getitem__ = lambda self, key: "iceberg" if key == "Catalog" else None

    inspector.bind.execute.return_value = [mock_row_1, mock_row_2, mock_row_3]

    catalogs = StarRocksEngineSpec.get_catalog_names(database, inspector)
    assert catalogs == {"default_catalog", "hive", "iceberg"}


@pytest.mark.parametrize(
    "uri,catalog,schema,expected_database",
    [
        # Test with catalog and schema/db in URI
        ("starrocks://host/hive.sales", None, None, "hive.sales"),
        # Test overriding catalog
        ("starrocks://host/hive.sales", "iceberg", None, "iceberg."),
        # Test overriding schema/db
        ("starrocks://host/hive.sales", None, "marketing", "hive.marketing"),
        # Test overriding both
        ("starrocks://host/hive.sales", "iceberg", "marketing", "iceberg.marketing"),
        # Test with only catalog in URI (no schema/db), add new schema
        ("starrocks://host/hive", None, "marketing", "hive.marketing"),
        # Test with catalog in URI, override catalog
        ("starrocks://host/hive", "iceberg", None, "iceberg."),
        # Test with no catalog/database in URI, overriding catalog"
        ("starrocks://host", "iceberg", None, "iceberg."),
        # Test with no catalog/database in URI, catalog and schema/db
        ("starrocks://host", "iceberg", "sales", "iceberg.sales"),
        # Test with empty database and empty overrides, uses default catalog
        ("starrocks://host", None, None, "default_catalog."),
        # Test schema only (no catalog) when URI has no database, uses default_catalog
        ("starrocks://host", None, "sales", "default_catalog.sales"),
    ],
)
def test_adjust_engine_params_with_catalog(
    uri: str,
    catalog: Optional[str],
    schema: Optional[str],
    expected_database: Optional[str],
) -> None:
    """
    Test the ``adjust_engine_params`` method with catalog parameter.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    url = make_url(uri)
    returned_url, _ = StarRocksEngineSpec.adjust_engine_params(
        url, {}, catalog=catalog, schema=schema
    )
    assert returned_url.database == expected_database


@with_feature_flags(IMPERSONATE_WITH_EMAIL_PREFIX=True)
def test_get_prequeries_with_email_prefix(mocker: MockerFixture) -> None:
    """Test that get_prequeries uses email prefix when IMPERSONATE_WITH_EMAIL_PREFIX"""
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch(
        "superset.db_engine_specs.starrocks.security_manager.find_user",
        return_value=user,
    )

    database = mocker.MagicMock()
    database.impersonate_user = True
    database.url_object = make_url("starrocks://localhost:9030/")
    database.get_effective_user.return_value = "alice@example.org"

    assert StarRocksEngineSpec.get_prequeries(database) == [
        'EXECUTE AS "alice" WITH NO REVERT;'
    ]
