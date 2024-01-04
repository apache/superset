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
# pylint: disable=line-too-long,too-many-lines
"""A collection of ORM sqlalchemy models for Superset"""

from __future__ import annotations

import builtins
import json
import logging
import textwrap
from ast import literal_eval
from contextlib import closing, contextmanager, nullcontext, suppress
from copy import deepcopy
from datetime import datetime
from functools import lru_cache
from typing import Any, Callable, TYPE_CHECKING

import numpy
import pandas as pd
import sqlalchemy as sqla
import sshtunnel
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
from sqlalchemy.engine import Connection, Dialect, Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.exc import NoSuchModuleError
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import ColumnElement, expression, Select

from superset import app, db_engine_specs
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.constants import LRU_CACHE_MAX_SIZE, PASSWORD_MASK
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import MetricType, TimeGrain
from superset.extensions import (
    cache_manager,
    encrypted_field_factory,
    security_manager,
    ssh_manager_factory,
)
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.result_set import SupersetResultSet
from superset.superset_typing import ResultSetColumnType
from superset.utils import cache as cache_util, core as utils
from superset.utils.backports import StrEnum
from superset.utils.core import get_username

config = app.config
custom_password_store = config["SQLALCHEMY_CUSTOM_PASSWORD_STORE"]
stats_logger = config["STATS_LOGGER"]
log_query = config["QUERY_LOGGER"]
metadata = Model.metadata  # pylint: disable=no-member
logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.sql_lab import Query

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


class ConfigurationMethod(StrEnum):
    SQLALCHEMY_FORM = "sqlalchemy_form"
    DYNAMIC_FORM = "dynamic_form"


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
    password = Column(encrypted_field_factory.create(String(1024)))
    cache_timeout = Column(Integer)
    select_as_create_table_as = Column(Boolean, default=False)
    expose_in_sqllab = Column(Boolean, default=True)
    configuration_method = Column(
        String(255), server_default=ConfigurationMethod.SQLALCHEMY_FORM.value
    )
    allow_run_async = Column(Boolean, default=False)
    allow_file_upload = Column(Boolean, default=False)
    allow_ctas = Column(Boolean, default=False)
    allow_cvas = Column(Boolean, default=False)
    allow_dml = Column(Boolean, default=False)
    force_ctas_schema = Column(String(250))
    extra = Column(
        Text,
        default=textwrap.dedent(
            """\
    {
        "metadata_params": {},
        "engine_params": {},
        "metadata_cache_timeout": {},
        "schemas_allowed_for_file_upload": []
    }
    """
        ),
    )
    encrypted_extra = Column(encrypted_field_factory.create(Text), nullable=True)
    impersonate_user = Column(Boolean, default=False)
    server_cert = Column(encrypted_field_factory.create(Text), nullable=True)
    is_managed_externally = Column(Boolean, nullable=False, default=False)
    external_url = Column(Text, nullable=True)

    export_fields = [
        "database_name",
        "sqlalchemy_uri",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_ctas",
        "allow_cvas",
        "allow_dml",
        "allow_file_upload",
        "extra",
    ]
    extra_import_fields = [
        "password",
        "is_managed_externally",
        "external_url",
        "encrypted_extra",
        "impersonate_user",
    ]
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
    def function_names(self) -> list[str]:
        try:
            return self.db_engine_spec.get_function_names(self)
        except Exception as ex:  # pylint: disable=broad-except
            # function_names property is used in bulk APIs and should not hard crash
            # more info in: https://github.com/apache/superset/issues/9678
            logger.error(
                "Failed to fetch database function names with error: %s",
                str(ex),
                exc_info=True,
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
    def disable_data_preview(self) -> bool:
        # this will prevent any 'trash value' strings from going through
        return self.get_extra().get("disable_data_preview", False) is True

    @property
    def schema_options(self) -> dict[str, Any]:
        """Additional schema display config for engines with complex schemas"""
        return self.get_extra().get("schema_options", {})

    @property
    def data(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.database_name,
            "backend": self.backend,
            "configuration_method": self.configuration_method,
            "allows_subquery": self.allows_subquery,
            "allows_cost_estimate": self.allows_cost_estimate,
            "allows_virtual_table_explore": self.allows_virtual_table_explore,
            "explore_database_id": self.explore_database_id,
            "schema_options": self.schema_options,
            "parameters": self.parameters,
            "disable_data_preview": self.disable_data_preview,
            "parameters_schema": self.parameters_schema,
            "engine_information": self.engine_information,
        }

    @property
    def unique_name(self) -> str:
        return self.database_name

    @property
    def url_object(self) -> URL:
        return make_url_safe(self.sqlalchemy_uri_decrypted)

    @property
    def backend(self) -> str:
        return self.url_object.get_backend_name()

    @property
    def driver(self) -> str:
        return self.url_object.get_driver_name()

    @property
    def masked_encrypted_extra(self) -> str | None:
        return self.db_engine_spec.mask_encrypted_extra(self.encrypted_extra)

    @property
    def parameters(self) -> dict[str, Any]:
        # Database parameters are a dictionary of values that are used to make up
        # the sqlalchemy_uri
        # When returning the parameters we should use the masked SQLAlchemy URI and the
        # masked ``encrypted_extra`` to prevent exposing sensitive credentials.
        masked_uri = make_url_safe(self.sqlalchemy_uri)
        encrypted_config = {}
        if (masked_encrypted_extra := self.masked_encrypted_extra) is not None:
            with suppress(TypeError, json.JSONDecodeError):
                encrypted_config = json.loads(masked_encrypted_extra)
        try:
            # pylint: disable=useless-suppression
            parameters = self.db_engine_spec.get_parameters_from_uri(  # type: ignore
                masked_uri,
                encrypted_extra=encrypted_config,
            )
        except Exception:  # pylint: disable=broad-except
            parameters = {}

        return parameters

    @property
    def parameters_schema(self) -> dict[str, Any]:
        try:
            parameters_schema = self.db_engine_spec.parameters_json_schema()  # type: ignore
        except Exception:  # pylint: disable=broad-except
            parameters_schema = {}
        return parameters_schema

    @property
    def metadata_cache_timeout(self) -> dict[str, Any]:
        return self.get_extra().get("metadata_cache_timeout", {})

    @property
    def schema_cache_enabled(self) -> bool:
        return "schema_cache_timeout" in self.metadata_cache_timeout

    @property
    def schema_cache_timeout(self) -> int | None:
        return self.metadata_cache_timeout.get("schema_cache_timeout")

    @property
    def table_cache_enabled(self) -> bool:
        return "table_cache_timeout" in self.metadata_cache_timeout

    @property
    def table_cache_timeout(self) -> int | None:
        return self.metadata_cache_timeout.get("table_cache_timeout")

    @property
    def default_schemas(self) -> list[str]:
        return self.get_extra().get("default_schemas", [])

    @property
    def connect_args(self) -> dict[str, Any]:
        return self.get_extra().get("engine_params", {}).get("connect_args", {})

    @property
    def engine_information(self) -> dict[str, Any]:
        try:
            engine_information = self.db_engine_spec.get_public_information()
        except Exception:  # pylint: disable=broad-except
            engine_information = {}
        return engine_information

    @classmethod
    def get_password_masked_url_from_uri(  # pylint: disable=invalid-name
        cls, uri: str
    ) -> URL:
        sqlalchemy_url = make_url_safe(uri)
        return cls.get_password_masked_url(sqlalchemy_url)

    @classmethod
    def get_password_masked_url(cls, masked_url: URL) -> URL:
        url_copy = deepcopy(masked_url)
        if url_copy.password is not None:
            url_copy = url_copy.set(password=PASSWORD_MASK)
        return url_copy

    def set_sqlalchemy_uri(self, uri: str) -> None:
        conn = make_url_safe(uri.strip())
        if conn.password != PASSWORD_MASK and not custom_password_store:
            # do not over-write the password with the password mask
            self.password = conn.password
        conn = conn.set(password=PASSWORD_MASK if conn.password else None)
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_effective_user(self, object_url: URL) -> str | None:
        """
        Get the effective user, especially during impersonation.

        :param object_url: SQL Alchemy URL object
        :return: The effective username
        """

        return (
            username
            if (username := get_username())
            else object_url.username
            if self.impersonate_user
            else None
        )

    @contextmanager
    def get_sqla_engine_with_context(
        self,
        schema: str | None = None,
        nullpool: bool = True,
        source: utils.QuerySource | None = None,
        override_ssh_tunnel: SSHTunnel | None = None,
    ) -> Engine:
        from superset.daos.database import (  # pylint: disable=import-outside-toplevel
            DatabaseDAO,
        )

        sqlalchemy_uri = self.sqlalchemy_uri_decrypted
        engine_context = nullcontext()
        ssh_tunnel = override_ssh_tunnel or DatabaseDAO.get_ssh_tunnel(
            database_id=self.id
        )

        if ssh_tunnel:
            # if ssh_tunnel is available build engine with information
            engine_context = ssh_manager_factory.instance.create_tunnel(
                ssh_tunnel=ssh_tunnel,
                sqlalchemy_database_uri=self.sqlalchemy_uri_decrypted,
            )

        with engine_context as server_context:
            if ssh_tunnel and server_context:
                logger.info(
                    "[SSH] Successfully created tunnel w/ %s tunnel_timeout + %s ssh_timeout at %s",
                    sshtunnel.TUNNEL_TIMEOUT,
                    sshtunnel.SSH_TIMEOUT,
                    server_context.local_bind_address,
                )
                sqlalchemy_uri = ssh_manager_factory.instance.build_sqla_url(
                    sqlalchemy_uri, server_context
                )
            yield self._get_sqla_engine(
                schema=schema,
                nullpool=nullpool,
                source=source,
                sqlalchemy_uri=sqlalchemy_uri,
            )

    def _get_sqla_engine(
        self,
        schema: str | None = None,
        nullpool: bool = True,
        source: utils.QuerySource | None = None,
        sqlalchemy_uri: str | None = None,
    ) -> Engine:
        sqlalchemy_url = make_url_safe(
            sqlalchemy_uri if sqlalchemy_uri else self.sqlalchemy_uri_decrypted
        )
        self.db_engine_spec.validate_database_uri(sqlalchemy_url)

        extra = self.get_extra()
        params = extra.get("engine_params", {})
        if nullpool:
            params["poolclass"] = NullPool
        connect_args = params.get("connect_args", {})

        # The ``adjust_database_uri`` method was renamed to ``adjust_engine_params`` and
        # had its signature changed in order to support more DB engine specs. Since DB
        # engine specs can be released as 3rd party modules we want to make sure the old
        # method is still supported so we don't introduce a breaking change.
        if hasattr(self.db_engine_spec, "adjust_database_uri"):
            sqlalchemy_url = self.db_engine_spec.adjust_database_uri(
                sqlalchemy_url,
                schema,
            )
            logger.warning(
                "DB engine spec %s implements the method `adjust_database_uri`, which is "
                "deprecated and will be removed in version 3.0. Please update it to "
                "implement `adjust_engine_params` instead.",
                self.db_engine_spec,
            )

        sqlalchemy_url, connect_args = self.db_engine_spec.adjust_engine_params(
            uri=sqlalchemy_url,
            connect_args=connect_args,
            catalog=None,
            schema=schema,
        )

        effective_username = self.get_effective_user(sqlalchemy_url)
        # If using MySQL or Presto for example, will set url.username
        # If using Hive, will not do anything yet since that relies on a
        # configuration parameter instead.
        sqlalchemy_url = self.db_engine_spec.get_url_for_impersonation(
            sqlalchemy_url,
            self.impersonate_user,
            effective_username,
        )

        masked_url = self.get_password_masked_url(sqlalchemy_url)
        logger.debug("Database._get_sqla_engine(). Masked URL: %s", str(masked_url))

        if self.impersonate_user:
            self.db_engine_spec.update_impersonation_config(
                connect_args,
                str(sqlalchemy_url),
                effective_username,
            )

        if connect_args:
            params["connect_args"] = connect_args

        self.update_params_from_encrypted_extra(params)

        if DB_CONNECTION_MUTATOR:
            if not source and request and request.referrer:
                if "/superset/dashboard/" in request.referrer:
                    source = utils.QuerySource.DASHBOARD
                elif "/explore/" in request.referrer:
                    source = utils.QuerySource.CHART
                elif "/sqllab/" in request.referrer:
                    source = utils.QuerySource.SQL_LAB

            sqlalchemy_url, params = DB_CONNECTION_MUTATOR(
                sqlalchemy_url,
                params,
                effective_username,
                security_manager,
                source,
            )
        try:
            return create_engine(sqlalchemy_url, **params)
        except Exception as ex:
            raise self.db_engine_spec.get_dbapi_mapped_exception(ex)

    @contextmanager
    def get_raw_connection(
        self,
        schema: str | None = None,
        nullpool: bool = True,
        source: utils.QuerySource | None = None,
    ) -> Connection:
        with self.get_sqla_engine_with_context(
            schema=schema, nullpool=nullpool, source=source
        ) as engine:
            with closing(engine.raw_connection()) as conn:
                # pre-session queries are used to set the selected schema and, in the
                # future, the selected catalog
                for prequery in self.db_engine_spec.get_prequeries(schema=schema):
                    cursor = conn.cursor()
                    cursor.execute(prequery)

                yield conn

    def get_default_schema_for_query(self, query: Query) -> str | None:
        """
        Return the default schema for a given query.

        This is used to determine if the user has access to a query that reads from table
        names without a specific schema, eg:

            SELECT * FROM `foo`

        The schema of the `foo` table depends on the DB engine spec. Some DB engine specs
        can change the default schema on a per-query basis; in other DB engine specs the
        default schema is defined in the SQLAlchemy URI; and in others the default schema
        might be determined by the database itself (like `public` for Postgres).
        """
        return self.db_engine_spec.get_default_schema_for_query(self, query)

    @property
    def quote_identifier(self) -> Callable[[str], str]:
        """Add quotes to potential identifier expressions if needed"""
        return self.get_dialect().identifier_preparer.quote

    def get_reserved_words(self) -> set[str]:
        return self.get_dialect().preparer.reserved_words

    def get_df(  # pylint: disable=too-many-locals
        self,
        sql: str,
        schema: str | None = None,
        mutator: Callable[[pd.DataFrame], None] | None = None,
    ) -> pd.DataFrame:
        sqls = self.db_engine_spec.parse_sql(sql)
        with self.get_sqla_engine_with_context(schema) as engine:
            engine_url = engine.url
        mutate_after_split = config["MUTATE_AFTER_SPLIT"]
        sql_query_mutator = config["SQL_QUERY_MUTATOR"]

        def needs_conversion(df_series: pd.Series) -> bool:
            return (
                not df_series.empty
                and isinstance(df_series, pd.Series)
                and isinstance(df_series[0], (list, dict))
            )

        def _log_query(sql: str) -> None:
            if log_query:
                log_query(
                    engine_url,
                    sql,
                    schema,
                    __name__,
                    security_manager,
                )

        with self.get_raw_connection(schema=schema) as conn:
            cursor = conn.cursor()
            for sql_ in sqls[:-1]:
                if mutate_after_split:
                    sql_ = sql_query_mutator(
                        sql_,
                        security_manager=security_manager,
                        database=None,
                    )
                _log_query(sql_)
                self.db_engine_spec.execute(cursor, sql_)
                cursor.fetchall()

            if mutate_after_split:
                last_sql = sql_query_mutator(
                    sqls[-1],
                    security_manager=security_manager,
                    database=None,
                )
                _log_query(last_sql)
                self.db_engine_spec.execute(cursor, last_sql)
            else:
                _log_query(sqls[-1])
                self.db_engine_spec.execute(cursor, sqls[-1])

            data = self.db_engine_spec.fetch_data(cursor)
            result_set = SupersetResultSet(
                data, cursor.description, self.db_engine_spec
            )
            df = result_set.to_pandas_df()
            if mutator:
                df = mutator(df)

            for col, coltype in df.dtypes.to_dict().items():
                if coltype == numpy.object_ and needs_conversion(df[col]):
                    df[col] = df[col].apply(utils.json_dumps_w_dates)

            return df

    def compile_sqla_query(self, qry: Select, schema: str | None = None) -> str:
        with self.get_sqla_engine_with_context(schema) as engine:
            sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))

            # pylint: disable=protected-access
            if engine.dialect.identifier_preparer._double_percents:  # noqa
                sql = sql.replace("%%", "%")

        return sql

    def select_star(  # pylint: disable=too-many-arguments
        self,
        table_name: str,
        schema: str | None = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = False,
        cols: list[ResultSetColumnType] | None = None,
    ) -> str:
        """Generates a ``select *`` statement in the proper dialect"""
        with self.get_sqla_engine_with_context(schema) as engine:
            return self.db_engine_spec.select_star(
                self,
                table_name,
                schema=schema,
                engine=engine,
                limit=limit,
                show_cols=show_cols,
                indent=indent,
                latest_partition=latest_partition,
                cols=cols,
            )

    def apply_limit_to_sql(
        self, sql: str, limit: int = 1000, force: bool = False
    ) -> str:
        if self.db_engine_spec.allow_limit_clause:
            return self.db_engine_spec.apply_limit_to_sql(sql, limit, self, force=force)
        return self.db_engine_spec.apply_top_to_sql(sql, limit)

    def safe_sqlalchemy_uri(self) -> str:
        return self.sqlalchemy_uri

    @cache_util.memoized_func(
        key="db:{self.id}:schema:{schema}:table_list",
        cache=cache_manager.cache,
    )
    def get_all_table_names_in_schema(  # pylint: disable=unused-argument
        self,
        schema: str,
        cache: bool = False,
        cache_timeout: int | None = None,
        force: bool = False,
    ) -> set[tuple[str, str]]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param schema: schema name
        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: The table/schema pairs
        """
        try:
            with self.get_inspector_with_context() as inspector:
                return {
                    (table, schema)
                    for table in self.db_engine_spec.get_table_names(
                        database=self,
                        inspector=inspector,
                        schema=schema,
                    )
                }
        except Exception as ex:
            raise self.db_engine_spec.get_dbapi_mapped_exception(ex)

    @cache_util.memoized_func(
        key="db:{self.id}:schema:{schema}:view_list",
        cache=cache_manager.cache,
    )
    def get_all_view_names_in_schema(  # pylint: disable=unused-argument
        self,
        schema: str,
        cache: bool = False,
        cache_timeout: int | None = None,
        force: bool = False,
    ) -> set[tuple[str, str]]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param schema: schema name
        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: set of views
        """
        try:
            with self.get_inspector_with_context() as inspector:
                return {
                    (view, schema)
                    for view in self.db_engine_spec.get_view_names(
                        database=self,
                        inspector=inspector,
                        schema=schema,
                    )
                }
        except Exception as ex:
            raise self.db_engine_spec.get_dbapi_mapped_exception(ex)

    @contextmanager
    def get_inspector_with_context(
        self, ssh_tunnel: SSHTunnel | None = None
    ) -> Inspector:
        with self.get_sqla_engine_with_context(
            override_ssh_tunnel=ssh_tunnel
        ) as engine:
            yield sqla.inspect(engine)

    @cache_util.memoized_func(
        key="db:{self.id}:schema_list",
        cache=cache_manager.cache,
    )
    def get_all_schema_names(  # pylint: disable=unused-argument
        self,
        cache: bool = False,
        cache_timeout: int | None = None,
        force: bool = False,
        ssh_tunnel: SSHTunnel | None = None,
    ) -> list[str]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: schema list
        """
        try:
            with self.get_inspector_with_context(ssh_tunnel=ssh_tunnel) as inspector:
                return self.db_engine_spec.get_schema_names(inspector)
        except Exception as ex:
            raise self.db_engine_spec.get_dbapi_mapped_exception(ex) from ex

    @property
    def db_engine_spec(self) -> builtins.type[db_engine_specs.BaseEngineSpec]:
        url = make_url_safe(self.sqlalchemy_uri_decrypted)
        return self.get_db_engine_spec(url)

    @classmethod
    @lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
    def get_db_engine_spec(
        cls, url: URL
    ) -> builtins.type[db_engine_specs.BaseEngineSpec]:
        backend = url.get_backend_name()
        try:
            driver = url.get_driver_name()
        except NoSuchModuleError:
            # can't load the driver, fallback for backwards compatibility
            driver = None

        return db_engine_specs.get_engine_spec(backend, driver)

    def grains(self) -> tuple[TimeGrain, ...]:
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        from a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        return self.db_engine_spec.get_time_grains()

    def get_extra(self) -> dict[str, Any]:
        return self.db_engine_spec.get_extra_params(self)

    def get_encrypted_extra(self) -> dict[str, Any]:
        encrypted_extra = {}
        if self.encrypted_extra:
            try:
                encrypted_extra = json.loads(self.encrypted_extra)
            except json.JSONDecodeError as ex:
                logger.error(ex, exc_info=True)
                raise ex
        return encrypted_extra

    # pylint: disable=invalid-name
    def update_params_from_encrypted_extra(self, params: dict[str, Any]) -> None:
        self.db_engine_spec.update_params_from_encrypted_extra(self, params)

    def get_table(self, table_name: str, schema: str | None = None) -> Table:
        extra = self.get_extra()
        meta = MetaData(**extra.get("metadata_params", {}))
        with self.get_sqla_engine_with_context() as engine:
            return Table(
                table_name,
                meta,
                schema=schema or None,
                autoload=True,
                autoload_with=engine,
            )

    def get_table_comment(
        self, table_name: str, schema: str | None = None
    ) -> str | None:
        with self.get_inspector_with_context() as inspector:
            return self.db_engine_spec.get_table_comment(inspector, table_name, schema)

    def get_columns(
        self, table_name: str, schema: str | None = None
    ) -> list[ResultSetColumnType]:
        with self.get_inspector_with_context() as inspector:
            return self.db_engine_spec.get_columns(
                inspector, table_name, schema, self.schema_options
            )

    def get_metrics(
        self,
        table_name: str,
        schema: str | None = None,
    ) -> list[MetricType]:
        with self.get_inspector_with_context() as inspector:
            return self.db_engine_spec.get_metrics(self, inspector, table_name, schema)

    def get_indexes(
        self, table_name: str, schema: str | None = None
    ) -> list[dict[str, Any]]:
        with self.get_inspector_with_context() as inspector:
            return self.db_engine_spec.get_indexes(self, inspector, table_name, schema)

    def get_pk_constraint(
        self, table_name: str, schema: str | None = None
    ) -> dict[str, Any]:
        with self.get_inspector_with_context() as inspector:
            pk_constraint = inspector.get_pk_constraint(table_name, schema) or {}

            def _convert(value: Any) -> Any:
                try:
                    return utils.base_json_conv(value)
                except TypeError:
                    return None

            return {key: _convert(value) for key, value in pk_constraint.items()}

    def get_foreign_keys(
        self, table_name: str, schema: str | None = None
    ) -> list[dict[str, Any]]:
        with self.get_inspector_with_context() as inspector:
            return inspector.get_foreign_keys(table_name, schema)

    def get_schema_access_for_file_upload(  # pylint: disable=invalid-name
        self,
    ) -> list[str]:
        allowed_databases = self.get_extra().get("schemas_allowed_for_file_upload", [])

        if isinstance(allowed_databases, str):
            allowed_databases = literal_eval(allowed_databases)

        if hasattr(g, "user"):
            extra_allowed_databases = config["ALLOWED_USER_CSV_SCHEMA_FUNC"](
                self, g.user
            )
            allowed_databases += extra_allowed_databases
        return sorted(set(allowed_databases))

    @property
    def sqlalchemy_uri_decrypted(self) -> str:
        try:
            conn = make_url_safe(self.sqlalchemy_uri)
        except DatabaseInvalidError:
            # if the URI is invalid, ignore and return a placeholder url
            # (so users see 500 less often)
            return "dialect://invalid_uri"
        if custom_password_store:
            conn = conn.set(password=custom_password_store(conn))
        else:
            conn = conn.set(password=self.password)
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
        with self.get_sqla_engine_with_context() as engine:
            return engine.has_table(table.table_name, table.schema or None)

    def has_table_by_name(self, table_name: str, schema: str | None = None) -> bool:
        with self.get_sqla_engine_with_context() as engine:
            return engine.has_table(table_name, schema)

    @classmethod
    def _has_view(
        cls,
        conn: Connection,
        dialect: Dialect,
        view_name: str,
        schema: str | None = None,
    ) -> bool:
        view_names: list[str] = []
        try:
            view_names = dialect.get_view_names(connection=conn, schema=schema)
        except Exception:  # pylint: disable=broad-except
            logger.warning("Has view failed", exc_info=True)
        return view_name in view_names

    def has_view(self, view_name: str, schema: str | None = None) -> bool:
        with self.get_sqla_engine_with_context(schema) as engine:
            return engine.run_callable(
                self._has_view, engine.dialect, view_name, schema
            )

    def has_view_by_name(self, view_name: str, schema: str | None = None) -> bool:
        return self.has_view(view_name=view_name, schema=schema)

    def get_dialect(self) -> Dialect:
        sqla_url = make_url_safe(self.sqlalchemy_uri_decrypted)
        return sqla_url.get_dialect()()

    def make_sqla_column_compatible(
        self, sqla_col: ColumnElement, label: str | None = None
    ) -> ColumnElement:
        """Takes a sqlalchemy column object and adds label info if supported by engine.
        :param sqla_col: sqlalchemy column instance
        :param label: alias/label that column is expected to have
        :return: either a sql alchemy column or label instance if supported by engine
        """
        label_expected = label or sqla_col.name
        # add quotes to tables
        if self.db_engine_spec.get_allows_alias_in_select(self):
            label = self.db_engine_spec.make_label_compatible(label_expected)
            sqla_col = sqla_col.label(label)
        sqla_col.key = label_expected
        return sqla_col


sqla.event.listen(Database, "after_insert", security_manager.database_after_insert)
sqla.event.listen(Database, "after_update", security_manager.database_after_update)
sqla.event.listen(Database, "after_delete", security_manager.database_after_delete)


class Log(Model):  # pylint: disable=too-few-public-methods
    """ORM object used to log Superset actions to the database"""

    __tablename__ = "logs"

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    json = Column(utils.MediumText())
    user = relationship(
        security_manager.user_model, backref="logs", foreign_keys=[user_id]
    )
    dttm = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer)
    referrer = Column(String(1024))


class FavStarClassName(StrEnum):
    CHART = "slice"
    DASHBOARD = "Dashboard"


class FavStar(Model):  # pylint: disable=too-few-public-methods
    __tablename__ = "favstar"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=datetime.utcnow)
