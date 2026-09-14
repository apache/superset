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
from typing import Any, cast, Optional
from unittest.mock import Mock

import pytest
from sqlalchemy.engine.url import make_url
from sqlalchemy.types import (
    Boolean,
    Date,
    DateTime,
    DECIMAL,
    Float,
    Integer,
    String,
    TypeEngine,
)
from urllib3.connection import HTTPConnection

from superset.db_engine_specs.base import BasicParametersType
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "to_date('2019-01-02')"),
        ("DateTime", "to_dateTime('2019-01-02 03:04:05')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.databend import (
        DatabendEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_engine_spec_supports_parameters() -> None:
    """
    Regression test: configuring Databend via individual parameters must
    resolve to an engine spec that supports the dynamic form.

    Previously two specs were registered under engine ``databend`` and neither
    declared a distinct ``drivers`` set, so ``get_engine_spec`` resolved to the
    first-defined legacy spec, which lacked ``parameters_schema`` /
    ``build_sqlalchemy_uri``. This made the "configure via individual
    parameters" flow fail with:
        Engine spec "InvalidEngine" does not support being configured via
        individual parameters.
    """
    from superset.db_engine_specs import get_engine_spec
    from superset.db_engine_specs.databend import (
        DatabendConnectEngineSpec,
        DatabendEngineSpec,
    )

    # Both with and without an explicit driver, the resolved spec must support
    # configuration via individual parameters.
    for driver in (None, "databend"):
        spec = get_engine_spec("databend", driver)
        assert hasattr(spec, "parameters_schema"), (
            f"resolved spec {spec.__name__} (driver={driver!r}) is missing "
            "parameters_schema"
        )
        assert hasattr(spec, "build_sqlalchemy_uri"), (
            f"resolved spec {spec.__name__} (driver={driver!r}) is missing "
            "build_sqlalchemy_uri"
        )

    # The legacy alias must point to the same merged spec for backwards
    # compatibility.
    assert DatabendConnectEngineSpec is DatabendEngineSpec


def test_execute_connection_error() -> None:
    from urllib3.exceptions import NewConnectionError

    from superset.db_engine_specs.databend import DatabendEngineSpec
    from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError

    database = Mock()
    cursor = Mock()
    cursor.execute.side_effect = NewConnectionError(
        HTTPConnection("Dummypool"), "Exception with sensitive data"
    )
    with pytest.raises(SupersetDBAPIDatabaseError) as excinfo:
        DatabendEngineSpec.execute(cursor, "SELECT col1 from table1", database)
    assert str(excinfo.value) == "Connection failed"


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("Varchar", String, None, GenericDataType.STRING, False),
        ("Nullable(Varchar)", String, None, GenericDataType.STRING, False),
        ("Array(UInt8)", String, None, GenericDataType.STRING, False),
        ("Int8", Integer, None, GenericDataType.NUMERIC, False),
        ("Int16", Integer, None, GenericDataType.NUMERIC, False),
        ("Int32", Integer, None, GenericDataType.NUMERIC, False),
        ("Int64", Integer, None, GenericDataType.NUMERIC, False),
        ("Int128", Integer, None, GenericDataType.NUMERIC, False),
        ("Int256", Integer, None, GenericDataType.NUMERIC, False),
        ("Nullable(Int64)", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt8", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt16", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt32", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt64", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt128", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt256", Integer, None, GenericDataType.NUMERIC, False),
        ("Float", Float, None, GenericDataType.NUMERIC, False),
        ("Double", Float, None, GenericDataType.NUMERIC, False),
        ("Decimal(1, 2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal32(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal64(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal128(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal256(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Bool", Boolean, None, GenericDataType.BOOLEAN, False),
        ("Nullable(Bool)", Boolean, None, GenericDataType.BOOLEAN, False),
        ("Date", Date, None, GenericDataType.TEMPORAL, True),
        ("Nullable(Date)", Date, None, GenericDataType.TEMPORAL, True),
        ("Datetime", DateTime, None, GenericDataType.TEMPORAL, True),
        ("Nullable(Datetime)", DateTime, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.databend import (
        DatabendConnectEngineSpec as spec,  # noqa: N813
    )

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "column_name,expected_result",
    [
        # SHA-256 hash suffix (first 6 chars) with default HASH_ALGORITHM
        ("time", "time_336074"),
        ("count", "count_6c3549"),
    ],
)
def test_make_label_compatible(column_name: str, expected_result: str) -> None:
    from superset.db_engine_specs.databend import (
        DatabendConnectEngineSpec as spec,  # noqa: N813
    )

    label = spec.make_label_compatible(column_name)
    assert label == expected_result


def _parameters(**overrides: Any) -> BasicParametersType:
    parameters: dict[str, Any] = {
        "username": "user",
        "password": "pwd",
        "host": "localhost",
        "port": 443,
        "database": "testdb",
        "query": {},
        "encryption": True,
        **overrides,
    }
    return cast(BasicParametersType, parameters)


@pytest.mark.parametrize(
    "encryption,expected_sslmode",
    [
        (True, "require"),
        (False, "disable"),
    ],
)
def test_build_sqlalchemy_uri_always_states_sslmode(
    encryption: bool, expected_sslmode: str
) -> None:
    """
    The driver does not infer TLS from the port, so an unencrypted connection
    needs ``sslmode=disable`` spelled out rather than the parameter omitted.
    """
    from superset.db_engine_specs.databend import DatabendEngineSpec

    uri = DatabendEngineSpec.build_sqlalchemy_uri(_parameters(encryption=encryption))

    assert make_url(uri).query["sslmode"] == expected_sslmode


def test_build_sqlalchemy_uri_preserves_other_query_params() -> None:
    from superset.db_engine_specs.databend import DatabendEngineSpec

    uri = DatabendEngineSpec.build_sqlalchemy_uri(
        _parameters(query={"warehouse": "wh1"})
    )

    query = make_url(uri).query
    assert query["warehouse"] == "wh1"
    assert query["sslmode"] == "require"


def test_build_sqlalchemy_uri_substitutes_default_database() -> None:
    from superset.db_engine_specs.databend import DatabendEngineSpec

    uri = DatabendEngineSpec.build_sqlalchemy_uri(_parameters(database=""))

    assert make_url(uri).database == "__default__"


@pytest.mark.parametrize(
    "uri,expected_encryption",
    [
        ("databend://user:pwd@localhost:443/db?sslmode=require", True),
        ("databend://user:pwd@localhost:8000/db?sslmode=disable", False),
        # the driver resolves both spellings to an https scheme
        ("databend://user:pwd@localhost:443/db?sslmode=enable", True),
        ("databend://user:pwd@localhost:443/db?sslmode=REQUIRE", True),
        # legacy form, stored by Superset before the move to ``sslmode``
        ("databend://user:pwd@localhost:443/db?secure=true", True),
        ("databend://user:pwd@localhost:8000/db?secure=false", False),
        # databend-py parsed the legacy value as a boolean, so casing is moot
        ("databend://user:pwd@localhost:443/db?secure=True", True),
        # the current spelling wins, and neither may survive into the form
        ("databend://user:pwd@localhost:443/db?sslmode=require&secure=false", True),
        ("databend://user:pwd@localhost:8000/db?sslmode=disable&secure=true", False),
        ("databend://user:pwd@localhost:8000/db", False),
    ],
)
def test_get_parameters_from_uri_encryption(
    uri: str, expected_encryption: bool
) -> None:
    from superset.db_engine_specs.databend import DatabendEngineSpec

    parameters = DatabendEngineSpec.get_parameters_from_uri(uri)

    assert parameters["encryption"] is expected_encryption
    assert "sslmode" not in parameters["query"]
    assert "secure" not in parameters["query"]


def test_get_parameters_from_uri_accepts_encrypted_extra_keyword() -> None:
    """
    ``Database.parameters`` passes ``encrypted_extra`` by keyword, and swallows
    any exception into an empty dict, so a signature mismatch silently empties
    the connection form.
    """
    from superset.db_engine_specs.databend import DatabendEngineSpec

    parameters = DatabendEngineSpec.get_parameters_from_uri(
        "databend://user:pwd@localhost:443/db?sslmode=require",
        encrypted_extra={},
    )

    assert parameters["encryption"] is True


def test_get_parameters_from_uri_restores_empty_database() -> None:
    from superset.db_engine_specs.databend import DatabendEngineSpec

    parameters = DatabendEngineSpec.get_parameters_from_uri(
        "databend://user:pwd@localhost:443/__default__?sslmode=require"
    )

    assert parameters["database"] == ""


@pytest.mark.parametrize("encryption", [True, False])
def test_parameters_round_trip(encryption: bool) -> None:
    from superset.db_engine_specs.databend import DatabendEngineSpec

    uri = DatabendEngineSpec.build_sqlalchemy_uri(
        _parameters(encryption=encryption, query={"warehouse": "wh1"})
    )
    parameters = DatabendEngineSpec.get_parameters_from_uri(uri)

    assert parameters["encryption"] is encryption
    assert parameters["database"] == "testdb"
    assert parameters["host"] == "localhost"
    assert parameters["port"] == 443
    assert parameters["query"] == {"warehouse": "wh1"}
