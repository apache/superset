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
from unittest import mock

import pandas as pd
import pytest
from sqlalchemy import column
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.base import BaseEngineSpec
from superset.result_set import SupersetResultSet
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST(TIME_PARSE('2019-01-02') AS DATE)"),
        ("DateTime", "TIME_PARSE('2019-01-02T03:04:05')"),
        ("TimeStamp", "TIME_PARSE('2019-01-02T03:04:05')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "TIME_FLOOR(CAST(col AS TIMESTAMP), 'PT1S')"),
        ("PT5M", "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT5M')"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST(col AS TIMESTAMP), 'P1D', 1), 'P1W'), 'P1D', 5)",  # noqa: E501
        ),
        (
            "1969-12-28T00:00:00Z/P1W",
            "TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST(col AS TIMESTAMP), 'P1D', 1), 'P1W'), 'P1D', -1)",  # noqa: E501
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    """
    DB Eng Specs (druid): Test time grain expressions
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    assert str(
        DruidEngineSpec.get_timestamp_expr(
            col=column("col"), pdf=None, time_grain=time_grain
        )
    )


def test_extras_without_ssl() -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec
    from tests.integration_tests.fixtures.database import default_db_extra

    database = mock.Mock()
    database.extra = default_db_extra
    database.server_cert = None
    extras = DruidEngineSpec.get_extra_params(database)
    assert "connect_args" not in extras["engine_params"]


def test_extras_with_ssl() -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec
    from tests.integration_tests.fixtures.certificates import ssl_certificate
    from tests.integration_tests.fixtures.database import default_db_extra

    database = mock.Mock()
    database.extra = default_db_extra
    database.server_cert = ssl_certificate
    extras = DruidEngineSpec.get_extra_params(database)
    connect_args = extras["engine_params"]["connect_args"]
    assert connect_args["scheme"] == "https"
    assert "ssl_verify_cert" in connect_args


# ---------------------------------------------------------------------------
# DruidEngineSpec column normalization tests
#
# pydruid infers column types from the first row value, which causes two
# related problems:
#
#   Case 1 – Mixed IEEE special-float strings and numbers:
#     Druid cannot represent NaN/Infinity in JSON, so pydruid emits them as
#     the strings "NaN", "Infinity", or "-Infinity".  When these appear in a
#     numeric column, pa.array() raises ArrowInvalid on the mixed str/float
#     list and the column falls back to string serialisation.
#
#   Case 2 – None as the first value:
#     pydruid's get_type(None) returns Type.STRING, so any nullable numeric
#     column whose first row is null gets labelled STRING in the cursor
#     description.  pa.array() succeeds (producing float64) but
#     data_type() used to return STRING because the cursor description won.
#
# DruidEngineSpec overrides normalize_column_values and resolve_column_type
# to handle both cases.  BaseEngineSpec preserves the original behaviour.
# ---------------------------------------------------------------------------


def test_druid_ieee_special_floats_preserved_as_numeric() -> None:
    """
    Case 1, DruidEngineSpec: columns that mix IEEE special-float strings with
    real numbers must keep their numeric type (specials become null).
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [("NaN",), (1.5,), ("Infinity",), (2.3,), ("-Infinity",), (None,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "FLOAT"

    df = result_set.to_pandas_df()
    assert pd.isna(df["metric"].iloc[0])  # "NaN" → null
    assert df["metric"].iloc[1] == 1.5
    assert pd.isna(df["metric"].iloc[2])  # "Infinity" → null
    assert df["metric"].iloc[3] == 2.3
    assert pd.isna(df["metric"].iloc[4])  # "-Infinity" → null
    assert pd.isna(df["metric"].iloc[5])  # None → null


def test_base_spec_ieee_special_floats_stringified() -> None:
    """
    Case 1, BaseEngineSpec: without Druid's override, columns with mixed
    special-float strings and numbers fall through to string serialisation.
    """
    data = [("NaN",), (1.5,), ("Infinity",)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "STRING"

    df = result_set.to_pandas_df()
    assert df["metric"].iloc[0] == "NaN"
    assert df["metric"].iloc[1] == "1.5"
    assert df["metric"].iloc[2] == "Infinity"


def test_druid_none_first_value_reports_numeric_type() -> None:
    """
    Case 2, DruidEngineSpec: when the cursor description says STRING (pydruid's
    first-row None inference) but PyArrow correctly infers float64, the column
    must be reported as FLOAT, not STRING.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [(None,), (1.5,), (2.3,), (None,), (4.7,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "FLOAT"

    df = result_set.to_pandas_df()
    assert pd.isna(df["metric"].iloc[0])
    assert df["metric"].iloc[1] == 1.5
    assert df["metric"].iloc[4] == 4.7


def test_base_spec_none_first_value_reports_string_type() -> None:
    """
    Case 2, BaseEngineSpec: the cursor-description STRING type must continue
    to win over PyArrow's float64 inference for non-Druid engines.
    """
    data = [(None,), (1.5,), (2.3,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "STRING"


def test_non_string_cursor_type_unaffected_by_druid_spec() -> None:
    """
    Columns with a non-STRING cursor description type must not be affected by
    DruidEngineSpec's resolve_column_type override.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [(1,), (2,), (3,)]
    description = [("count", "INT", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "INT"


def test_mask_encrypted_extra() -> None:
    """
    Only the credentials inside `connect_args` should be masked, not the whole object.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec
    from superset.utils import json

    config = json.dumps(
        {
            "connect_args": {
                "scheme": "https",
                "jwt": "my-secret-token",
                "password": "my-password",
            },
        }
    )

    assert DruidEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "connect_args": {
                "scheme": "https",
                "jwt": "XXXXXXXXXX",
                "password": "XXXXXXXXXX",
            },
        }
    )


def test_unmask_encrypted_extra() -> None:
    """
    Masked credentials are reused from the previous value; edited ones are kept.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec
    from superset.utils import json

    old = json.dumps(
        {"connect_args": {"scheme": "https", "jwt": "old-token", "password": "old"}}
    )
    new = json.dumps(
        {"connect_args": {"scheme": "http", "jwt": "XXXXXXXXXX", "password": "new"}}
    )

    assert DruidEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {"connect_args": {"scheme": "http", "jwt": "old-token", "password": "new"}}
    )


# ---------------------------------------------------------------------------
# Dynamic connection form (BasicParametersMixin)
#
# Druid connects over a fixed SQL endpoint (`/druid/v2/sql/`) and toggles TLS by
# switching between pydruid's `druid` (http) and `druid+https` dialects, so the
# form omits the database field and encodes encryption in the driver name rather
# than a query parameter.
# ---------------------------------------------------------------------------


def _parameters(**overrides: Any) -> Any:
    from superset.db_engine_specs.base import BasicParametersType

    parameters: dict[str, Any] = {
        "username": "user",
        "password": "pwd",
        "host": "localhost",
        "port": 9088,
        "query": {},
    }
    parameters.update(overrides)
    return cast(BasicParametersType, parameters)


def test_get_engine_spec_supports_parameters() -> None:
    """
    Druid must resolve to a spec that supports the dynamic connection form so
    the ``/available`` endpoint returns individual parameters.
    """
    from superset.db_engine_specs import get_engine_spec
    from superset.db_engine_specs.druid import DruidEngineSpec

    spec = cast("type[DruidEngineSpec]", get_engine_spec("druid"))
    assert spec is DruidEngineSpec
    assert spec.parameters_schema is not None
    assert hasattr(spec, "build_sqlalchemy_uri")


@pytest.mark.parametrize(
    "encryption,expected_driver",
    [
        (False, "druid"),
        (True, "druid+https"),
    ],
)
def test_build_sqlalchemy_uri_toggles_scheme(
    encryption: bool, expected_driver: str
) -> None:
    """
    The encryption toggle selects the http vs. https pydruid dialect and always
    injects the fixed SQL endpoint path.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    uri = make_url(
        DruidEngineSpec.build_sqlalchemy_uri(_parameters(encryption=encryption))
    )

    assert uri.drivername == expected_driver
    assert uri.database == "druid/v2/sql/"
    assert uri.host == "localhost"
    assert uri.port == 9088


def test_build_sqlalchemy_uri_preserves_query_params() -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec

    uri = make_url(
        DruidEngineSpec.build_sqlalchemy_uri(_parameters(query={"header": "true"}))
    )

    assert uri.query["header"] == "true"


def test_build_sqlalchemy_uri_renders_password() -> None:
    """The stored URI is used to connect, so the password must not be masked."""
    from superset.db_engine_specs.druid import DruidEngineSpec

    uri = DruidEngineSpec.build_sqlalchemy_uri(_parameters(password="s3cret"))  # noqa: S106

    assert "s3cret" in uri


@pytest.mark.parametrize(
    "uri,expected_encryption",
    [
        ("druid://user:pwd@localhost:9088/druid/v2/sql/", False),
        ("druid+http://user:pwd@localhost:9088/druid/v2/sql/", False),
        ("druid+https://user:pwd@localhost:9088/druid/v2/sql/", True),
    ],
)
def test_get_parameters_from_uri_encryption(
    uri: str, expected_encryption: bool
) -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec

    parameters = DruidEngineSpec.get_parameters_from_uri(uri)

    assert parameters["encryption"] is expected_encryption
    assert parameters["host"] == "localhost"
    assert parameters["port"] == 9088
    assert parameters["database"] == "druid/v2/sql/"


def test_get_parameters_from_uri_accepts_encrypted_extra_keyword() -> None:
    """
    ``Database.parameters`` passes ``encrypted_extra`` by keyword; a signature
    mismatch would silently empty the connection form.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    parameters = DruidEngineSpec.get_parameters_from_uri(
        "druid+https://user:pwd@localhost:9088/druid/v2/sql/",
        encrypted_extra={},
    )

    assert parameters["encryption"] is True


@pytest.mark.parametrize("encryption", [True, False])
def test_parameters_round_trip(encryption: bool) -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec

    uri = DruidEngineSpec.build_sqlalchemy_uri(
        _parameters(encryption=encryption, query={"header": "true"})
    )
    parameters = DruidEngineSpec.get_parameters_from_uri(uri)

    assert parameters["encryption"] is encryption
    assert parameters["host"] == "localhost"
    assert parameters["port"] == 9088
    assert parameters["username"] == "user"
    assert parameters["query"] == {"header": "true"}


def test_parameters_json_schema_omits_database() -> None:
    """
    The SQL endpoint path is fixed, so ``database`` must not appear as a form
    field; the encryption toggle must be present instead.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    schema = DruidEngineSpec.parameters_json_schema()

    assert "database" not in schema["properties"]
    assert "encryption" in schema["properties"]
    assert set(schema["required"]) == {"host", "port"}


def test_parameters_schema_reloads_emitted_parameters() -> None:
    """
    ``get_parameters_from_uri`` emits the fixed ``database`` path, which is not a
    form field. Re-loading that dict through the schema (the create/update path)
    must not raise on the unknown ``database`` key.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    parameters = DruidEngineSpec.get_parameters_from_uri(
        "druid+https://user:pwd@localhost:9088/druid/v2/sql/"
    )
    assert parameters["database"] == "druid/v2/sql/"

    loaded = DruidEngineSpec.parameters_schema.load(parameters)

    assert "database" not in loaded
    assert loaded["host"] == "localhost"
    assert loaded["encryption"] is True
