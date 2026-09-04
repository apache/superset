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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from unittest.mock import Mock

import pytest

from superset.utils import json
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_epoch_to_dttm() -> None:
    from superset.db_engine_specs.ydb import YDBEngineSpec

    assert YDBEngineSpec.epoch_to_dttm() == "DateTime::MakeDatetime({col})"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "DateTime::MakeDate(DateTime::ParseIso8601('2019-01-02'))"),
        (
            "DateTime",
            "DateTime::MakeDatetime(DateTime::ParseIso8601('2019-01-02T03:04:05'))",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.ydb import YDBEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_specify_protocol() -> None:
    from superset.db_engine_specs.ydb import YDBEngineSpec

    database = Mock()

    extra = {"protocol": "grpcs"}
    database.encrypted_extra = json.dumps(extra)

    params: dict[str, Any] = {}
    YDBEngineSpec.update_params_from_encrypted_extra(database, params)
    connect_args = params.setdefault("connect_args", {})
    assert connect_args.get("protocol") == "grpcs"


def test_specify_credentials() -> None:
    from superset.db_engine_specs.ydb import YDBEngineSpec

    database = Mock()

    auth_params = {"username": "username", "password": "password"}
    database.encrypted_extra = json.dumps({"credentials": auth_params})

    params: dict[str, Any] = {}
    YDBEngineSpec.update_params_from_encrypted_extra(database, params)
    connect_args = params.setdefault("connect_args", {})
    assert connect_args.get("credentials") == auth_params
