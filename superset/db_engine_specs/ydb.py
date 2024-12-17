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

import logging
from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import json

if TYPE_CHECKING:
    from superset.models.core import Database


logger = logging.getLogger(__name__)


class YDBEngineSpec(BaseEngineSpec):
    engine = "yql"
    engine_aliases = {"ydb", "yql+ydb"}
    engine_name = "YDB"

    default_driver = "ydb"

    sqlalchemy_uri_placeholder = "ydb://{host}:{port}/{database_name}"

    # pylint: disable=invalid-name
    encrypted_extra_sensitive_fields = {"$.connect_args.credentials", "$.credentials"}

    disable_ssh_tunneling = False

    supports_file_upload = False

    allows_alias_in_orderby = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT1S')))",
        TimeGrain.THIRTY_SECONDS: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT30S')))",
        TimeGrain.MINUTE: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT1M')))",
        TimeGrain.FIVE_MINUTES: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT5M')))",
        TimeGrain.TEN_MINUTES: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT10M')))",
        TimeGrain.FIFTEEN_MINUTES: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT15M')))",
        TimeGrain.THIRTY_MINUTES: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT30M')))",
        TimeGrain.HOUR: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('PT1H')))",
        TimeGrain.DAY: "DateTime::MakeDatetime(DateTime::StartOf({col}, Interval('P1D')))",
        TimeGrain.WEEK: "DateTime::MakeDatetime(DateTime::StartOfWeek({col}))",
        TimeGrain.MONTH: "DateTime::MakeDatetime(DateTime::StartOfMonth({col}))",
        TimeGrain.QUARTER: "DateTime::MakeDatetime(DateTime::StartOfQuarter({col}))",
        TimeGrain.YEAR: "DateTime::MakeDatetime(DateTime::StartOfYear({col}))",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "DateTime::MakeDatetime({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"DateTime::MakeDate(DateTime::ParseIso8601('{dttm.date().isoformat()}'))"
        if isinstance(sqla_type, types.DateTime):
            return f"""DateTime::MakeDatetime(DateTime::ParseIso8601('{dttm.isoformat(sep="T", timespec="seconds")}'))"""
        return None

    @staticmethod
    def update_params_from_encrypted_extra(
        database: Database,
        params: dict[str, Any],
    ) -> None:
        if not database.encrypted_extra:
            return

        try:
            encrypted_extra = json.loads(database.encrypted_extra)
            connect_args = params.setdefault("connect_args", {})

            if "protocol" in encrypted_extra:
                connect_args["protocol"] = encrypted_extra["protocol"]

            if "credentials" in encrypted_extra:
                credentials_info = encrypted_extra["credentials"]
                connect_args["credentials"] = credentials_info

        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise
