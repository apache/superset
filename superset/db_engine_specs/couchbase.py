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
# pylint: disable=too-many-lines
from __future__ import annotations

from sqlalchemy.engine.url import URL
from flask_babel import gettext as __
from superset.superset_typing import ResultSetColumnType
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy import column
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, BasicParametersMixin
from superset.constants import TimeGrain
import os
import datetime
from typing import (
    Any,
    TypedDict
)
class BasicParametersType(TypedDict, total=False):
    username: str | None
    password: str | None
    host: str
    port: int
    database: str
    query: dict[str, Any]
    encryption: bool

class CouchbaseParametersSchema(Schema):
    username = fields.String(allow_none=True, metadata={"description": __("Username")})
    password = fields.String(allow_none=True, metadata={"description": __("Password")})
    host = fields.String(required=True, metadata={"description": __("Hostname or IP address")})
    port = fields.Integer(allow_none=True, metadata={"description": __("Database port")}, validate=Range(min=0, max=65535))
    database = fields.String(allow_none=True, metadata={"description": __("Database name")})
    encryption = fields.Boolean(dump_default=False, metadata={"description": __("Use an encrypted connection to the database")})
    query = fields.Dict(keys=fields.Str(), values=fields.Raw(), metadata={"description": __("Additional parameters")})

class CouchbaseEngineSpec(BasicParametersMixin,BaseEngineSpec):
    engine = 'couchbase'
    engine_name = 'Couchbase Columnar'
    allows_joins = False
    allows_subqueries = False
    default_driver = 'couchbase'
    sqlalchemy_uri_placeholder = ("columnar+couchbase://user:password@host[:port][/dbname][?ssl=value&=value...]")
    parameters_schema = CouchbaseParametersSchema()
    encryption_parameters = {"sslmode": "require"}

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC_STR(TOSTRING({col}),'second')",
        TimeGrain.MINUTE: "DATE_TRUNC_STR(TOSTRING({col}),'minute')",
        TimeGrain.HOUR: "DATE_TRUNC_STR(TOSTRING({col}),'hour')",
        TimeGrain.DAY: "DATE_TRUNC_STR(TOSTRING({col}),'day')",
        TimeGrain.MONTH: "DATE_TRUNC_STR(TOSTRING({col}),'month')",
        TimeGrain.YEAR: "DATE_TRUNC_STR(TOSTRING({col}),'year')",
        TimeGrain.QUARTER: "DATE_TRUNC_STR(TOSTRING({col}),'quarter')"
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "MILLIS_TO_STR({col} * 1000, '111')"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "MILLIS_TO_STR({col}, '111')"
    
    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)
        return f"DATETIME(DATE_FORMAT_STR(STR_TO_UTC('{dttm.date().isoformat()}'), 'iso8601'))"
    
    @classmethod
    def build_sqlalchemy_uri(cls, parameters: dict, encrypted_extra=None):
        query_params = parameters.get("query", {}).copy()
        if parameters.get("encryption", False):
            query_params.update(cls.encryption_parameters)
        
        uri = URL.create(
            f"{cls.engine}+{cls.default_driver}",
            username=parameters.get("username"),
            password=parameters.get("password"),
            host=parameters["host"],
            port=parameters.get("port", 18091),  # Default SSL port for Couchbase
            database=parameters.get("database", "default"),
            query=query_params
        )
        return str(uri)
    

    @classmethod
    def get_parameters_from_uri(  # pylint: disable=unused-argument
        cls, uri: str, encrypted_extra: dict[str, Any] | None = None
    ) -> BasicParametersType:
        url = make_url_safe(uri)
        query = {
            key: value
            for (key, value) in url.query.items()
            if (key, value) not in cls.encryption_parameters.items()
        }
        encryption = all(
            item in url.query.items() for item in cls.encryption_parameters.items()
        )
        return {
            "username": url.username,
            "password": url.password,
            "host": url.host,
            "port": url.port,
            "database": url.database,
            "query": query,
            "encryption": encryption,
        }