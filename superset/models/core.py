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
# pylint: disable=line-too-long,unused-argument,ungrouped-imports
"""A collection of ORM sqlalchemy models for Superset"""
import json
import logging
import textwrap
from contextlib import closing
from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Type

import numpy
import pandas as pd
import sqlalchemy as sqla
import sqlparse
from flask import g, request
from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    create_engine,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)
from sqlalchemy.engine import Dialect, Engine, url
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.exc import ArgumentError
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import expression, Select
from sqlalchemy_utils import EncryptedType

from superset import app, db_engine_specs, is_feature_enabled
from superset.db_engine_specs.base import TimeGrain
from superset.extensions import cache_manager, security_manager
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.models.tags import FavStarUpdater
from superset.result_set import SupersetResultSet
from superset.utils import cache as cache_util, core as utils

config = app.config
custom_password_store = config["SQLALCHEMY_CUSTOM_PASSWORD_STORE"]
stats_logger = config["STATS_LOGGER"]
log_query = config["QUERY_LOGGER"]
metadata = Model.metadata  # pylint: disable=no-member
logger = logging.getLogger(__name__)

PASSWORD_MASK = "X" * 10
DB_CONNECTION_MUTATOR = config["DB_CONNECTION_MUTATOR"]


class Url(Model, AuditMixinNullable):
    """Used for the short url feature"""

    __tablename__ = "url"
    id = Column(Integer, primary_key=True)
    url = Column(Text)


class KeyValue(Model):  # pylint: disable=too-few-public-methods

    """Used for any type of key-value store"""

    __tablename__ = "keyvalue"
    id = Column(Integer, primary_key=True)
    value = Column(Text, nullable=False)


class CssTemplate(Model, AuditMixinNullable):

    """CSS templates for dashboards"""

    __tablename__ = "css_templates"
    id = Column(Integer, primary_key=True)
    template_name = Column(String(250))
    css = Column(Text, default="")


class Database(
    Model, AuditMixinNullable, ImportExportMixin
):  # pylint: disable=too-many-public-methods

    """An ORM object that stores Database related information"""

    __tablename__ = "dbs"
    type = "table"
    __table_args__ = (UniqueConstraint("database_name"),)

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    database_name = Column(String(250), unique=True, nullable=False)
    sqlalchemy_uri = Column(String(1024), nullable=False)
    password = Column(EncryptedType(String(1024), config["SECRET_KEY"]))
    cache_timeout = Column(Integer)
    select_as_create_table_as = Column(Boolean, default=False)
    expose_in_sqllab = Column(Boolean, default=True)
    allow_run_async = Column(Boolean, default=False)
    allow_csv_upload = Column(Boolean, default=False)
    allow_ctas = Column(Boolean, default=False)
    allow_cvas = Column(Boolean, default=False)
    allow_dml = Column(Boolean, default=False)
    force_ctas_schema = Column(String(250))
    allow_multi_schema_metadata_fetch = Column(  # pylint: disable=invalid-name
        Boolean, default=False
    )
    extra = Column(
        Text,
        default=textwrap.dedent(
            """\
    {
        "metadata_params": {},
        "engine_params": {},
        "metadata_cache_timeout": {},
        "schemas_allowed_for_csv_upload": []
    }
    """
        ),
    )
    encrypted_extra = Column(EncryptedType(Text, config["SECRET_KEY"]), nullable=True)
    impersonate_user = Column(Boolean, default=False)
    server_cert = Column(EncryptedType(Text, config["SECRET_KEY"]), nullable=True)
    export_fields = [
        "database_name",
        "sqlalchemy_uri",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_ctas",
        "allow_cvas",
        "allow_csv_upload",
        "extra",
    ]
    extra_import_fields = ["password"]
    export_children = ["tables"]

    def __repr__(self) -> str:
        return self.name

    @property
    def name(self) -> str:
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def allows_subquery(self) -> bool:
        return self.db_engine_spec.allows_subqueries

    @property
    def function_names(self) -> List[str]:
        try:
            return self.db_engine_spec.get_function_names(self)
        except Exception as ex:  # pylint: disable=broad-except
            # function_names property is used in bulk APIs and should not hard crash
            # more info in: https://github.com/apache/superset/issues/9678
            logger.error(
                "Failed to fetch database function names with error: %s", str(ex)
            )
        return []

    @property
    def allows_cost_estimate(self) -> bool:
        extra = self.get_extra() or {}
        cost_estimate_enabled: bool = extra.get("cost_estimate_enabled")  # type: ignore

        return (
            self.db_engine_spec.get_allow_cost_estimate(extra) and cost_estimate_enabled
        )

    @property
    def allows_virtual_table_explore(self) -> bool:
        extra = self.get_extra()

        return bool(extra.get("allows_virtual_table_explore", True))

    @property
    def explore_database_id(self) -> int:
        return self.get_extra().get("explore_database_id", self.id)

    @property
    def data(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.database_name,
            "backend": self.backend,
            "allow_multi_schema_metadata_fetch": self.allow_multi_schema_metadata_fetch,
            "allows_subquery": self.allows_subquery,
            "allows_cost_estimate": self.allows_cost_estimate,
            "allows_virtual_table_explore": self.allows_virtual_table_explore,
            "explore_database_id": self.explore_database_id,
        }

    @property
    def unique_name(self) -> str:
        return self.database_name

    @property
    def url_object(self) -> URL:
        return make_url(self.sqlalchemy_uri_decrypted)

    @property
    def backend(self) -> str:
        sqlalchemy_url = make_url(self.sqlalchemy_uri_decrypted)
        return sqlalchemy_url.get_backend_name()  # pylint: disable=no-member

    @property
    def metadata_cache_timeout(self) -> Dict[str, Any]:
        return self.get_extra().get("metadata_cache_timeout", {})

    @property
    def schema_cache_enabled(self) -> bool:
        return "schema_cache_timeout" in self.metadata_cache_timeout

    @property
    def schema_cache_timeout(self) -> Optional[int]:
        return self.metadata_cache_timeout.get("schema_cache_timeout")

    @property
    def table_cache_enabled(self) -> bool:
        return "table_cache_timeout" in self.metadata_cache_timeout

    @property
    def table_cache_timeout(self) -> Optional[int]:
        return self.metadata_cache_timeout.get("table_cache_timeout")

    @property
    def default_schemas(self) -> List[str]:
        return self.get_extra().get("default_schemas", [])

    @property
    def connect_args(self) -> Dict[str, Any]:
        return self.get_extra().get("engine_params", {}).get("connect_args", {})

    @classmethod
    def get_password_masked_url_from_uri(  # pylint: disable=invalid-name
        cls, uri: str
    ) -> URL:
        sqlalchemy_url = make_url(uri)
        return cls.get_password_masked_url(sqlalchemy_url)

    @classmethod
    def get_password_masked_url(cls, masked_url: URL) -> URL:
        url_copy = deepcopy(masked_url)
        if url_copy.password is not None:
            url_copy.password = PASSWORD_MASK
        return url_copy

    def set_sqlalchemy_uri(self, uri: str) -> None:
        conn = sqla.engine.url.make_url(uri.strip())
        if conn.password != PASSWORD_MASK and not custom_password_store:
            # do not over-write the password with the password mask
            self.password = conn.password
        conn.password = PASSWORD_MASK if conn.password else None
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_effective_user(
        self, object_url: URL, user_name: Optional[str] = None,
    ) -> Optional[str]:
        """
        Get the effective user, especially during impersonation.
        :param object_url: SQL Alchemy URL object
        :param user_name: Default username
        :return: The effective username
        """
        effective_username = None
        if self.impersonate_user:
            effective_username = object_url.username
            if user_name:
                effective_username = user_name
            elif (
                hasattr(g, "user")
                and hasattr(g.user, "username")
                and g.user.username is not None
            ):
                effective_username = g.user.username
        return effective_username

    @utils.memoized(watch=("impersonate_user", "sqlalchemy_uri_decrypted", "extra"))
    def get_sqla_engine(
        self,
        schema: Optional[str] = None,
        nullpool: bool = True,
        user_name: Optional[str] = None,
        source: Optional[utils.QuerySource] = None,
    ) -> Engine:
        extra = self.get_extra()
        sqlalchemy_url = make_url(self.sqlalchemy_uri_decrypted)
        self.db_engine_spec.adjust_database_uri(sqlalchemy_url, schema)
        effective_username = self.get_effective_user(sqlalchemy_url, user_name)
        # If using MySQL or Presto for example, will set url.username
        # If using Hive, will not do anything yet since that relies on a
        # configuration parameter instead.
        self.db_engine_spec.modify_url_for_impersonation(
            sqlalchemy_url, self.impersonate_user, effective_username
        )

        masked_url = self.get_password_masked_url(sqlalchemy_url)
        logger.debug("Database.get_sqla_engine(). Masked URL: %s", str(masked_url))

        params = extra.get("engine_params", {})
        if nullpool:
            params["poolclass"] = NullPool

        connect_args = params.get("connect_args", {})
        configuration = connect_args.get("configuration", {})

        # If using Hive, this will set hive.server2.proxy.user=$effective_username
        configuration.update(
            self.db_engine_spec.get_configuration_for_impersonation(
                str(sqlalchemy_url), self.impersonate_user, effective_username
            )
        )
        if configuration:
            connect_args["configuration"] = configuration
        if connect_args:
            params["connect_args"] = connect_args

        params.update(self.get_encrypted_extra())

        if DB_CONNECTION_MUTATOR:
            if not source and request and request.referrer:
                if "/superset/dashboard/" in request.referrer:
                    source = utils.QuerySource.DASHBOARD
                elif "/superset/explore/" in request.referrer:
                    source = utils.QuerySource.CHART
                elif "/superset/sqllab/" in request.referrer:
                    source = utils.QuerySource.SQL_LAB

            sqlalchemy_url, params = DB_CONNECTION_MUTATOR(
                sqlalchemy_url, params, effective_username, security_manager, source
            )

        return create_engine(sqlalchemy_url, **params)

    def get_reserved_words(self) -> Set[str]:
        return self.get_dialect().preparer.reserved_words

    def get_quoter(self) -> Callable[[str, Any], str]:
        return self.get_dialect().identifier_preparer.quote

    def get_df(  # pylint: disable=too-many-locals
        self,
        sql: str,
        schema: Optional[str] = None,
        mutator: Optional[Callable[[pd.DataFrame], None]] = None,
    ) -> pd.DataFrame:
        sqls = [str(s).strip(" ;") for s in sqlparse.parse(sql)]

        engine = self.get_sqla_engine(schema=schema)
        username = utils.get_username()

        def needs_conversion(df_series: pd.Series) -> bool:
            return (
                not df_series.empty
                and isinstance(df_series, pd.Series)
                and isinstance(df_series[0], (list, dict))
            )

        def _log_query(sql: str) -> None:
            if log_query:
                log_query(engine.url, sql, schema, username, __name__, security_manager)

        with closing(engine.raw_connection()) as conn:
            cursor = conn.cursor()
            for sql_ in sqls[:-1]:
                _log_query(sql_)
                self.db_engine_spec.execute(cursor, sql_)
                cursor.fetchall()

            _log_query(sqls[-1])
            self.db_engine_spec.execute(cursor, sqls[-1])

            data = self.db_engine_spec.fetch_data(cursor)
            result_set = SupersetResultSet(
                data, cursor.description, self.db_engine_spec
            )
            df = result_set.to_pandas_df()
            if mutator:
                mutator(df)

            for col, coltype in df.dtypes.to_dict().items():
                if coltype == numpy.object_ and needs_conversion(df[col]):
                    df[col] = df[col].apply(utils.json_dumps_w_dates)

            return df

    def compile_sqla_query(self, qry: Select, schema: Optional[str] = None) -> str:
        engine = self.get_sqla_engine(schema=schema)

        sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))

        if (
            engine.dialect.identifier_preparer._double_percents  # pylint: disable=protected-access
        ):
            sql = sql.replace("%%", "%")

        return sql

    def select_star(  # pylint: disable=too-many-arguments
        self,
        table_name: str,
        schema: Optional[str] = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = False,
        cols: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Generates a ``select *`` statement in the proper dialect"""
        eng = self.get_sqla_engine(schema=schema, source=utils.QuerySource.SQL_LAB)
        return self.db_engine_spec.select_star(
            self,
            table_name,
            schema=schema,
            engine=eng,
            limit=limit,
            show_cols=show_cols,
            indent=indent,
            latest_partition=latest_partition,
            cols=cols,
        )

    def apply_limit_to_sql(self, sql: str, limit: int = 1000) -> str:
        return self.db_engine_spec.apply_limit_to_sql(sql, limit, self)

    def safe_sqlalchemy_uri(self) -> str:
        return self.sqlalchemy_uri

    @property
    def inspector(self) -> Inspector:
        engine = self.get_sqla_engine()
        return sqla.inspect(engine)

    @cache_util.memoized_func(
        key=lambda self, *args, **kwargs: f"db:{self.id}:schema:None:table_list",
        cache=cache_manager.data_cache,
    )
    def get_all_table_names_in_database(
        self,
        cache: bool = False,
        cache_timeout: Optional[bool] = None,
        force: bool = False,
    ) -> List[utils.DatasourceName]:
        """Parameters need to be passed as keyword arguments."""
        if not self.allow_multi_schema_metadata_fetch:
            return []
        return self.db_engine_spec.get_all_datasource_names(self, "table")

    @cache_util.memoized_func(
        key=lambda self, *args, **kwargs: f"db:{self.id}:schema:None:view_list",
        cache=cache_manager.data_cache,
    )
    def get_all_view_names_in_database(
        self,
        cache: bool = False,
        cache_timeout: Optional[bool] = None,
        force: bool = False,
    ) -> List[utils.DatasourceName]:
        """Parameters need to be passed as keyword arguments."""
        if not self.allow_multi_schema_metadata_fetch:
            return []
        return self.db_engine_spec.get_all_datasource_names(self, "view")

    @cache_util.memoized_func(
        key=lambda self, schema, *args, **kwargs: f"db:{self.id}:schema:{schema}:table_list",  # type: ignore
        cache=cache_manager.data_cache,
    )
    def get_all_table_names_in_schema(
        self,
        schema: str,
        cache: bool = False,
        cache_timeout: Optional[int] = None,
        force: bool = False,
    ) -> List[utils.DatasourceName]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param schema: schema name
        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: list of tables
        """
        try:
            tables = self.db_engine_spec.get_table_names(
                database=self, inspector=self.inspector, schema=schema
            )
            return [
                utils.DatasourceName(table=table, schema=schema) for table in tables
            ]
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning(ex)

    @cache_util.memoized_func(
        key=lambda self, schema, *args, **kwargs: f"db:{self.id}:schema:{schema}:view_list",  # type: ignore
        cache=cache_manager.data_cache,
    )
    def get_all_view_names_in_schema(
        self,
        schema: str,
        cache: bool = False,
        cache_timeout: Optional[int] = None,
        force: bool = False,
    ) -> List[utils.DatasourceName]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param schema: schema name
        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: list of views
        """
        try:
            views = self.db_engine_spec.get_view_names(
                database=self, inspector=self.inspector, schema=schema
            )
            return [utils.DatasourceName(table=view, schema=schema) for view in views]
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning(ex)

    @cache_util.memoized_func(
        key=lambda self, *args, **kwargs: f"db:{self.id}:schema_list",
        cache=cache_manager.data_cache,
    )
    def get_all_schema_names(
        self,
        cache: bool = False,
        cache_timeout: Optional[int] = None,
        force: bool = False,
    ) -> List[str]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: schema list
        """
        return self.db_engine_spec.get_schema_names(self.inspector)

    @property
    def db_engine_spec(self) -> Type[db_engine_specs.BaseEngineSpec]:
        return db_engine_specs.engines.get(self.backend, db_engine_specs.BaseEngineSpec)

    @classmethod
    def get_db_engine_spec_for_backend(
        cls, backend: str
    ) -> Type[db_engine_specs.BaseEngineSpec]:
        return db_engine_specs.engines.get(backend, db_engine_specs.BaseEngineSpec)

    def grains(self) -> Tuple[TimeGrain, ...]:
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        from a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        return self.db_engine_spec.get_time_grains()

    def get_extra(self) -> Dict[str, Any]:
        return self.db_engine_spec.get_extra_params(self)

    def get_encrypted_extra(self) -> Dict[str, Any]:
        encrypted_extra = {}
        if self.encrypted_extra:
            try:
                encrypted_extra = json.loads(self.encrypted_extra)
            except json.JSONDecodeError as ex:
                logger.error(ex)
                raise ex
        return encrypted_extra

    def get_table(self, table_name: str, schema: Optional[str] = None) -> Table:
        extra = self.get_extra()
        meta = MetaData(**extra.get("metadata_params", {}))
        return Table(
            table_name,
            meta,
            schema=schema or None,
            autoload=True,
            autoload_with=self.get_sqla_engine(),
        )

    def get_table_comment(
        self, table_name: str, schema: Optional[str] = None
    ) -> Optional[str]:
        return self.db_engine_spec.get_table_comment(self.inspector, table_name, schema)

    def get_columns(
        self, table_name: str, schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return self.db_engine_spec.get_columns(self.inspector, table_name, schema)

    def get_indexes(
        self, table_name: str, schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        indexes = self.inspector.get_indexes(table_name, schema)
        return self.db_engine_spec.normalize_indexes(indexes)

    def get_pk_constraint(
        self, table_name: str, schema: Optional[str] = None
    ) -> Dict[str, Any]:
        pk_constraint = self.inspector.get_pk_constraint(table_name, schema) or {}
        return {
            key: utils.base_json_conv(value) for key, value in pk_constraint.items()
        }

    def get_foreign_keys(
        self, table_name: str, schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return self.inspector.get_foreign_keys(table_name, schema)

    def get_schema_access_for_csv_upload(  # pylint: disable=invalid-name
        self,
    ) -> List[str]:
        allowed_databases = self.get_extra().get("schemas_allowed_for_csv_upload", [])
        if hasattr(g, "user"):
            extra_allowed_databases = config["ALLOWED_USER_CSV_SCHEMA_FUNC"](
                self, g.user
            )
            allowed_databases += extra_allowed_databases
        return sorted(set(allowed_databases))

    @property
    def sqlalchemy_uri_decrypted(self) -> str:
        try:
            conn = sqla.engine.url.make_url(self.sqlalchemy_uri)
        except (ArgumentError, ValueError):
            # if the URI is invalid, ignore and return a placeholder url
            # (so users see 500 less often)
            return "dialect://invalid_uri"
        if custom_password_store:
            conn.password = custom_password_store(conn)
        else:
            conn.password = self.password
        return str(conn)

    @property
    def sql_url(self) -> str:
        return f"/superset/sql/{self.id}/"

    @hybrid_property
    def perm(self) -> str:
        return f"[{self.database_name}].(id:{self.id})"

    @perm.expression  # type: ignore
    def perm(cls) -> str:  # pylint: disable=no-self-argument
        return (
            "[" + cls.database_name + "].(id:" + expression.cast(cls.id, String) + ")"
        )

    def get_perm(self) -> str:
        return self.perm  # type: ignore

    def has_table(self, table: Table) -> bool:
        engine = self.get_sqla_engine()
        return engine.has_table(table.table_name, table.schema or None)

    def has_table_by_name(self, table_name: str, schema: Optional[str] = None) -> bool:
        engine = self.get_sqla_engine()
        return engine.has_table(table_name, schema)

    @utils.memoized
    def get_dialect(self) -> Dialect:
        sqla_url = url.make_url(self.sqlalchemy_uri_decrypted)
        return sqla_url.get_dialect()()  # pylint: disable=no-member


sqla.event.listen(Database, "after_insert", security_manager.set_perm)
sqla.event.listen(Database, "after_update", security_manager.set_perm)


class Log(Model):  # pylint: disable=too-few-public-methods

    """ORM object used to log Superset actions to the database"""

    __tablename__ = "logs"

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    json = Column(Text)
    user = relationship(
        security_manager.user_model, backref="logs", foreign_keys=[user_id]
    )
    dttm = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer)
    referrer = Column(String(1024))


class FavStarClassName(str, Enum):
    CHART = "slice"
    DASHBOARD = "Dashboard"


class FavStar(Model):  # pylint: disable=too-few-public-methods
    __tablename__ = "favstar"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=datetime.utcnow)


# events for updating tags
if is_feature_enabled("TAGGING_SYSTEM"):
    sqla.event.listen(FavStar, "after_insert", FavStarUpdater.after_insert)
    sqla.event.listen(FavStar, "after_delete", FavStarUpdater.after_delete)
