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
from collections.abc import Callable
from typing import Any

import pytest

from superset.constants import TimeGrain
from superset.db_engine_specs.ocient import (
    _point_list_to_wkt,
    _sanitized_ocient_type_codes,
    ocient_is_installed,
    OcientEngineSpec,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType


def test_ocient_properties() -> None:
    assert OcientEngineSpec.engine == "ocient"
    assert OcientEngineSpec.engine_name == "Ocient"
    assert OcientEngineSpec.force_column_alias_quotes is True
    assert OcientEngineSpec.max_column_name_length == 30
    assert OcientEngineSpec.cte_alias == "cte__"


def test_ocient_metadata() -> None:
    metadata = OcientEngineSpec.metadata
    assert metadata["description"] == "Ocient is a hyperscale data analytics database."
    assert metadata["logo"] == "ocient.png"
    assert "sqlalchemy-ocient" in metadata["pypi_packages"]
    assert metadata["default_port"] == 4050


def test_ocient_epoch_to_dttm() -> None:
    assert (
        OcientEngineSpec.epoch_to_dttm().format(col="ts")
        == "DATEADD(S, ts, '1970-01-01')"
    )
    assert (
        OcientEngineSpec.epoch_ms_to_dttm().format(col="ts")
        == "DATEADD(MS, ts, '1970-01-01')"
    )


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "ROUND(ts, 'SECOND')"),
        (TimeGrain.MINUTE, "ROUND(ts, 'MINUTE')"),
        (TimeGrain.HOUR, "ROUND(ts, 'HOUR')"),
        (TimeGrain.DAY, "ROUND(ts, 'DAY')"),
        (TimeGrain.WEEK, "ROUND(ts, 'WEEK')"),
        (TimeGrain.MONTH, "ROUND(ts, 'MONTH')"),
        (TimeGrain.QUARTER_YEAR, "ROUND(ts, 'QUARTER')"),
        (TimeGrain.YEAR, "ROUND(ts, 'YEAR')"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        OcientEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )


MARSHALED_OCIENT_ERRORS: list[tuple[str, SupersetError]] = [
    (
        "The referenced user does not exist (User 'mj' not found)",
        SupersetError(
            message='The username "mj" does not exist.',
            error_type=SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1012,
                        "message": "Issue 1012 - The username provided when connecting to a database is not valid.",  # noqa: E501
                    }
                ],
            },
        ),
    ),
    (
        "The userid/password combination was not valid (Incorrect password for user)",
        SupersetError(
            message="The user/password combination is not valid (Incorrect password for user).",  # noqa: E501
            error_type=SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1013,
                        "message": "Issue 1013 - The password provided when connecting to a database is not valid.",  # noqa: E501
                    }
                ],
            },
        ),
    ),
    (
        "No database named 'bulls' exists",
        SupersetError(
            message='Could not connect to database: "bulls"',
            error_type=SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1015,
                        "message": "Issue 1015 - Either the database is spelled incorrectly or does not exist.",  # noqa: E501
                    }
                ],
            },
        ),
    ),
    (
        "Unable to connect to unitedcenter.com:4050",
        SupersetError(
            message='Could not resolve hostname: "unitedcenter.com".',
            error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1007,
                        "message": "Issue 1007 - The hostname provided can't be resolved.",  # noqa: E501
                    }
                ],
            },
        ),
    ),
    (
        "Port out of range 0-65535",
        SupersetError(
            message="Port out of range 0-65535",
            error_type=SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1034,
                        "message": "Issue 1034 - The port number is invalid.",
                    }
                ],
            },
        ),
    ),
    (
        "An invalid connection string attribute was specified (failed to decrypt cipher text)",  # noqa: E501
        SupersetError(
            message="Invalid Connection String: Expecting String of the form 'ocient://user:pass@host:port/database'.",
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1002,
                        "message": "Issue 1002 - The database returned an unexpected error.",  # noqa: E501
                    }
                ],
            },
        ),
    ),
    (
        "There is a syntax error in your statement (extraneous input 'foo bar baz' expecting {<EOF>, 'trace', 'using'})",  # noqa: E501
        SupersetError(
            message="Syntax Error: extraneous input \"foo bar baz\" expecting \"{<EOF>, 'trace', 'using'}",  # noqa: E501
            error_type=SupersetErrorType.SYNTAX_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1030,
                        "message": "Issue 1030 - The query has a syntax error.",
                    }
                ],
            },
        ),
    ),
    (
        "There is a syntax error in your statement (mismatched input 'to' expecting {<EOF>, 'trace', 'using'})",  # noqa: E501
        SupersetError(
            message="Syntax Error: mismatched input \"to\" expecting \"{<EOF>, 'trace', 'using'}",  # noqa: E501
            error_type=SupersetErrorType.SYNTAX_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1030,
                        "message": "Issue 1030 - The query has a syntax error.",
                    }
                ],
            },
        ),
    ),
    (
        "The referenced table or view 'goats' does not exist",
        SupersetError(
            message='Table or View "goats" does not exist.',
            error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1003,
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",  # noqa: E501
                    },
                ],
            },
        ),
    ),
    (
        "The reference to column 'goats' is not valid",
        SupersetError(
            message='Invalid reference to column: "goats"',
            error_type=SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Ocient",
                "issue_codes": [
                    {
                        "code": 1003,
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                    },
                    {
                        "code": 1004,
                        "message": "Issue 1004 - The column was deleted or renamed in the database.",  # noqa: E501
                    },
                ],
            },
        ),
    ),
]


@pytest.mark.parametrize("msg,expected", MARSHALED_OCIENT_ERRORS)
def test_connection_errors(msg: str, expected: SupersetError) -> None:
    from superset.db_engine_specs.ocient import OcientEngineSpec

    result = OcientEngineSpec.extract_errors(Exception(msg))
    assert result == [expected]


def _generate_gis_type_sanitization_test_cases() -> list[
    tuple[str, int, Any, dict[str, Any]]
]:
    if not ocient_is_installed():
        return []

    from pyocient import TypeCodes
    from pyocient.api import (
        STLinestring as _STLinestring,
        STPoint as _STPoint,
        STPolygon as _STPolygon,
    )

    return [
        (
            "empty_point",
            TypeCodes.ST_POINT,
            _STPoint(long=float("inf"), lat=float("inf")),
            {
                "geometry": None,
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "valid_point",
            TypeCodes.ST_POINT,
            _STPoint(long=float(33), lat=float(45)),
            {
                "geometry": {
                    "coordinates": [33.0, 45.0],
                    "type": "Point",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "empty_line",
            TypeCodes.ST_LINESTRING,
            _STLinestring([]),
            {
                "geometry": None,
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "valid_line",
            TypeCodes.ST_LINESTRING,
            _STLinestring(
                [_STPoint(long=t[0], lat=t[1]) for t in [(1, 0), (1, 1), (1, 2)]]
            ),
            {
                "geometry": {
                    "coordinates": [[1, 0], [1, 1], [1, 2]],
                    "type": "LineString",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "downcast_line_to_point",
            TypeCodes.ST_LINESTRING,
            _STLinestring([_STPoint(long=t[0], lat=t[1]) for t in [(1, 0)]]),
            {
                "geometry": {
                    "coordinates": [1, 0],
                    "type": "Point",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "empty_polygon",
            TypeCodes.ST_POLYGON,
            _STPolygon(exterior=[], holes=[], fullFlag=False),
            {
                "geometry": None,
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "valid_polygon_no_holes",
            TypeCodes.ST_POLYGON,
            _STPolygon(
                exterior=[
                    _STPoint(long=t[0], lat=t[1]) for t in [(1, 0), (1, 1), (1, 0)]
                ],
                holes=[],
                fullFlag=False,
            ),
            {
                "geometry": {
                    "coordinates": [[[1, 0], [1, 1], [1, 0]]],
                    "type": "Polygon",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "valid_polygon_with_holes",
            TypeCodes.ST_POLYGON,
            _STPolygon(
                exterior=[
                    _STPoint(long=t[0], lat=t[1]) for t in [(1, 0), (1, 1), (1, 0)]
                ],
                holes=[
                    [_STPoint(long=t[0], lat=t[1]) for t in [(2, 0), (2, 1), (2, 0)]],
                    [_STPoint(long=t[0], lat=t[1]) for t in [(3, 0), (3, 1), (3, 0)]],
                ],
                fullFlag=False,
            ),
            {
                "geometry": {
                    "coordinates": [
                        [[1, 0], [1, 1], [1, 0]],
                        [[2, 0], [2, 1], [2, 0]],
                        [[3, 0], [3, 1], [3, 0]],
                    ],
                    "type": "Polygon",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "downcast_poly_to_point",
            TypeCodes.ST_POLYGON,
            _STPolygon(
                exterior=[_STPoint(long=t[0], lat=t[1]) for t in [(1, 0)]],
                holes=[],
                fullFlag=False,
            ),
            {
                "geometry": {
                    "coordinates": [1, 0],
                    "type": "Point",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
        (
            "downcast_poly_to_line",
            TypeCodes.ST_POLYGON,
            _STPolygon(
                exterior=[_STPoint(long=t[0], lat=t[1]) for t in [(1, 0), (0, 1)]],
                holes=[],
                fullFlag=False,
            ),
            {
                "geometry": {
                    "coordinates": [[1, 0], [0, 1]],
                    "type": "LineString",
                },
                "properties": {},
                "type": "Feature",
            },
        ),
    ]


@pytest.mark.skipif(not ocient_is_installed(), reason="requires ocient dependencies")
@pytest.mark.parametrize(
    "name,type_code,geo,expected", _generate_gis_type_sanitization_test_cases()
)
def test_gis_type_sanitization(
    name: str, type_code: int, geo: Any, expected: Any
) -> None:
    # Hack to silence erroneous mypy errors
    def die(any: Any) -> Callable[[Any], Any]:
        pytest.fail(f"no sanitizer for type code {type_code}")
        raise AssertionError()

    type_sanitizer = _sanitized_ocient_type_codes.get(type_code, die)
    actual = type_sanitizer(geo)
    assert expected == actual


@pytest.mark.skipif(not ocient_is_installed(), reason="requires ocient dependencies")
def test_point_list_to_wkt() -> None:
    from pyocient.api import STPoint as _STPoint

    wkt = _point_list_to_wkt(
        [_STPoint(long=t[0], lat=t[1]) for t in [(2, 0), (2, 1), (2, 0)]]
    )
    assert wkt == "LINESTRING(2 0, 2 1, 2 0)"
