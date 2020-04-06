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
import json
import logging
from typing import Any, Dict, TYPE_CHECKING

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.connectors.sqla.models import (  # pylint: disable=unused-import
        TableColumn,
    )
    from superset.models.core import Database  # pylint: disable=unused-import

logger = logging.getLogger()


class DruidEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Engine spec for Druid.io"""

    engine = "druid"
    allows_joins = False
    allows_subqueries = True

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "FLOOR({col} TO SECOND)",
        "PT1M": "FLOOR({col} TO MINUTE)",
        "PT1H": "FLOOR({col} TO HOUR)",
        "P1D": "FLOOR({col} TO DAY)",
        "P1W": "FLOOR({col} TO WEEK)",
        "P1M": "FLOOR({col} TO MONTH)",
        "P0.25Y": "FLOOR({col} TO QUARTER)",
        "P1Y": "FLOOR({col} TO YEAR)",
    }

    @classmethod
    def alter_new_orm_column(cls, orm_col: "TableColumn") -> None:
        if orm_col.column_name == "__time":
            orm_col.is_dttm = True

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        For Druid, the path to a SSL certificate is placed in `connect_args`.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        """
        try:
            extra = json.loads(database.extra or "{}")
        except json.JSONDecodeError as e:
            logger.error(e)
            raise e

        if database.server_cert:
            engine_params = extra.get("engine_params", {})
            connect_args = engine_params.get("connect_args", {})
            connect_args["scheme"] = "https"
            path = utils.create_ssl_cert_file(database.server_cert)
            connect_args["ssl_verify_cert"] = path
            engine_params["connect_args"] = connect_args
            extra["engine_params"] = engine_params
        return extra
