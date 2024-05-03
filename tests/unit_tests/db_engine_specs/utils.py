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
from __future__ import annotations

from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import types

from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec


def assert_convert_dttm(
    db_engine_spec: type[BaseEngineSpec],
    target_type: str,
    expected_result: str | None,
    dttm: datetime,
    db_extra: dict[str, Any] | None = None,
) -> None:
    for target in (
        target_type,
        target_type.upper(),
        target_type.lower(),
        target_type.capitalize(),
    ):
        assert (
            result := db_engine_spec.convert_dttm(
                target_type=target,
                dttm=dttm,
                db_extra=db_extra,
            )
        ) == expected_result, result


def assert_column_spec(
    db_engine_spec: type[BaseEngineSpec],
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: dict[str, Any] | None,
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    assert (column_spec := db_engine_spec.get_column_spec(native_type)) is not None
    assert isinstance(column_spec.sqla_type, sqla_type)

    for key, value in (attrs or {}).items():
        assert getattr(column_spec.sqla_type, key) == value

    assert column_spec.generic_type == generic_type
    assert column_spec.is_dttm == is_dttm
