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
from typing import Any, Callable, Type, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy import types
from sqlalchemy.engine.interfaces import Dialect

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec


def literal_dttm_type_factory(
    sqla_type: types.TypeEngine, db_engine_spec: Type["BaseEngineSpec"], col_type: str,
) -> types.TypeEngine:
    """
    Create a custom SQLAlchemy type that supports datetime literal binds.

    :param sqla_type: Base type to extend
    :param db_engine_spec: Database engine spec which supports `convert_dttm` method
    :param col_type: native column type as defined in table metadata
    :return: SQLAlchemy type that supports using datetima as literal bind
    """
    # pylint: disable=too-few-public-methods
    class TemporalWrapperType(type(sqla_type)):  # type: ignore
        # pylint: disable=unused-argument
        def literal_processor(self, dialect: Dialect) -> Callable[[Any], Any]:
            def process(value: Any) -> Any:
                if isinstance(value, datetime):
                    ts_expression = db_engine_spec.convert_dttm(col_type, value)
                    if ts_expression is None:
                        raise NotImplementedError(
                            __(
                                "Temporal expression not supported for type: "
                                "%(col_type)s",
                                col_type=col_type,
                            )
                        )
                    return ts_expression
                return super().process(value)

            return process

    return TemporalWrapperType()
