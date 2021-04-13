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
import dataclasses
import json
import logging
import re
from collections import defaultdict, OrderedDict
from contextlib import closing
from dataclasses import dataclass, field  # pylint: disable=wrong-import-order
from datetime import datetime, timedelta
from typing import Any, Dict, Hashable, List, NamedTuple, Optional, Tuple, Union

import pandas as pd
import sqlalchemy as sa
import sqlparse
from flask import escape, Markup
from flask_appbuilder import Model
from flask_babel import lazy_gettext as _
from jinja2.exceptions import TemplateError
from sqlalchemy import (
    and_,
    asc,
    Boolean,
    Column,
    DateTime,
    desc,
    Enum,
    ForeignKey,
    Integer,
    or_,
    select,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import backref, Query, relationship, RelationshipProperty, Session
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import column, ColumnElement, literal_column, table, text
from sqlalchemy.sql.elements import ColumnClause
from sqlalchemy.sql.expression import Label, Select, TextAsFrom, TextClause
from sqlalchemy.sql.selectable import Alias, TableClause
from sqlalchemy.types import TypeEngine

from superset import app, db, is_feature_enabled, security_manager
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.db_engine_specs.base import TimestampExpression
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.jinja_context import (
    BaseTemplateProcessor,
    ExtraCache,
    get_template_processor,
)
from superset.models.annotations import Annotation
from superset.models.core import Database
from superset.models.helpers import AuditMixinNullable, QueryResult
from superset.result_set import SupersetResultSet
from superset.sql_parse import ParsedQuery
from superset.typing import AdhocMetric, Metric, OrderBy, QueryObjectDict
from superset.utils import core as utils
from superset.utils.core import GenericDataType, remove_duplicates

config = app.config
metadata = Model.metadata  # pylint: disable=no-member
logger = logging.getLogger(__name__)

VIRTUAL_TABLE_ALIAS = "virtual_table"


class SqlaQuery(NamedTuple):
    extra_cache_keys: List[Any]
    labels_expected: List[str]
    prequeries: List[str]
    sqla_query: Select


class QueryStringExtended(NamedTuple):
    labels_expected: List[str]
    prequeries: List[str]
    sql: str


@dataclass
class MetadataResult:
    added: List[str] = field(default_factory=list)
    removed: List[str] = field(default_factory=list)
    modified: List[str] = field(default_factory=list)


class AnnotationDatasource(BaseDatasource):
    """Dummy object so we can query annotations using 'Viz' objects just like
    regular datasources.
    """

    cache_timeout = 0
    changed_on = None
    type = "annotation"
    column_names = [
        "created_on",
        "changed_on",
        "id",
        "start_dttm",
        "end_dttm",
        "layer_id",
        "short_descr",
        "long_descr",
        "json_metadata",
        "created_by_fk",
        "changed_by_fk",
    ]

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        error_message = None
        qry = db.session.query(Annotation)
        qry = qry.filter(Annotation.layer_id == query_obj["filter"][0]["val"])
        if query_obj["from_dttm"]:
            qry = qry.filter(Annotation.start_dttm >= query_obj["from_dttm"])
        if query_obj["to_dttm"]:
            qry = qry.filter(Annotation.end_dttm <= query_obj["to_dttm"])
        status = utils.QueryStatus.SUCCESS
        try:
            df = pd.read_sql_query(qry.statement, db.engine)
        except Exception as ex:  # pylint: disable=broad-except
            df = pd.DataFrame()
            status = utils.QueryStatus.FAILED
            logger.exception(ex)
            error_message = utils.error_msg_from_exception(ex)
        return QueryResult(
            status=status,
            df=df,
            duration=timedelta(0),
            query="",
            error_message=error_message,
        )

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        raise NotImplementedError()

    def values_for_column(self, column_name: str, limit: int = 10000) -> List[Any]:
        raise NotImplementedError()


class TableColumn(Model, BaseColumn):

    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = "table_columns"
    __table_args__ = (UniqueConstraint("table_id", "column_name"),)
    table_id = Column(Integer, ForeignKey("tables.id"))
    table = relationship(
        "SqlaTable",
        backref=backref("columns", cascade="all, delete-orphan"),
        foreign_keys=[table_id],
    )
    is_dttm = Column(Boolean, default=False)
    expression = Column(Text)
    python_date_format = Column(String(255))

    export_fields = [
        "table_id",
        "column_name",
        "verbose_name",
        "is_dttm",
        "is_active",
        "type",
        "groupby",
        "filterable",
        "expression",
        "description",
        "python_date_format",
    ]

    update_from_object_fields = [s for s in export_fields if s not in ("table_id",)]
    export_parent = "table"

    @property
    def is_numeric(self) -> bool:
        """
        Check if the column has a numeric datatype.
        """
        column_spec = self.table.database.db_engine_spec.get_column_spec(self.type)
        if column_spec is None:
            return False
        return column_spec.generic_type == GenericDataType.NUMERIC

    @property
    def is_string(self) -> bool:
        """
        Check if the column has a string datatype.
        """
        column_spec = self.table.database.db_engine_spec.get_column_spec(self.type)
        if column_spec is None:
            return False
        return column_spec.generic_type == GenericDataType.STRING

    @property
    def is_temporal(self) -> bool:
        """
        Check if the column has a temporal datatype. If column has been set as
        temporal/non-temporal (`is_dttm` is True or False respectively), return that
        value. This usually happens during initial metadata fetching or when a column
        is manually set as temporal (for this `python_date_format` needs to be set).
        """
        if self.is_dttm is not None:
            return self.is_dttm
        column_spec = self.table.database.db_engine_spec.get_column_spec(self.type)
        if column_spec is None:
            return False
        return column_spec.is_dttm

    def get_sqla_col(self, label: Optional[str] = None) -> Column:
        label = label or self.column_name
        db_engine_spec = self.table.database.db_engine_spec
        column_spec = db_engine_spec.get_column_spec(self.type)
        type_ = column_spec.sqla_type if column_spec else None
        if self.expression:
            col = literal_column(self.expression, type_=type_)
        else:
            col = column(self.column_name, type_=type_)
        col = self.table.make_sqla_column_compatible(col, label)
        return col

    @property
    def datasource(self) -> RelationshipProperty:
        return self.table

    def get_time_filter(
        self,
        start_dttm: DateTime,
        end_dttm: DateTime,
        time_range_endpoints: Optional[
            Tuple[utils.TimeRangeEndpoint, utils.TimeRangeEndpoint]
        ],
    ) -> ColumnElement:
        col = self.get_sqla_col(label="__time")
        l = []
        if start_dttm:
            l.append(
                col >= text(self.dttm_sql_literal(start_dttm, time_range_endpoints))
            )
        if end_dttm:
            if (
                time_range_endpoints
                and time_range_endpoints[1] == utils.TimeRangeEndpoint.EXCLUSIVE
            ):
                l.append(
                    col < text(self.dttm_sql_literal(end_dttm, time_range_endpoints))
                )
            else:
                l.append(col <= text(self.dttm_sql_literal(end_dttm, None)))
        return and_(*l)

    def get_timestamp_expression(
        self, time_grain: Optional[str], label: Optional[str] = None
    ) -> Union[TimestampExpression, Label]:
        """
        Return a SQLAlchemy Core element representation of self to be used in a query.

        :param time_grain: Optional time grain, e.g. P1Y
        :param label: alias/label that column is expected to have
        :return: A TimeExpression object wrapped in a Label if supported by db
        """
        label = label or utils.DTTM_ALIAS

        db_ = self.table.database
        pdf = self.python_date_format
        is_epoch = pdf in ("epoch_s", "epoch_ms")
        if not self.expression and not time_grain and not is_epoch:
            sqla_col = column(self.column_name, type_=DateTime)
            return self.table.make_sqla_column_compatible(sqla_col, label)
        if self.expression:
            col = literal_column(self.expression)
        else:
            col = column(self.column_name)
        time_expr = db_.db_engine_spec.get_timestamp_expr(
            col, pdf, time_grain, self.type
        )
        return self.table.make_sqla_column_compatible(time_expr, label)

    def dttm_sql_literal(
        self,
        dttm: DateTime,
        time_range_endpoints: Optional[
            Tuple[utils.TimeRangeEndpoint, utils.TimeRangeEndpoint]
        ],
    ) -> str:
        """Convert datetime object to a SQL expression string"""
        sql = (
            self.table.database.db_engine_spec.convert_dttm(self.type, dttm)
            if self.type
            else None
        )

        if sql:
            return sql

        tf = self.python_date_format

        # Fallback to the default format (if defined) only if the SIP-15 time range
        # endpoints, i.e., [start, end) are enabled.
        if not tf and time_range_endpoints == (
            utils.TimeRangeEndpoint.INCLUSIVE,
            utils.TimeRangeEndpoint.EXCLUSIVE,
        ):
            tf = (
                self.table.database.get_extra()
                .get("python_date_format_by_column_name", {})
                .get(self.column_name)
            )

        if tf:
            if tf in ["epoch_ms", "epoch_s"]:
                seconds_since_epoch = int(dttm.timestamp())
                if tf == "epoch_s":
                    return str(seconds_since_epoch)
                return str(seconds_since_epoch * 1000)
            return f"'{dttm.strftime(tf)}'"

        # TODO(john-bodley): SIP-15 will explicitly require a type conversion.
        return f"""'{dttm.strftime("%Y-%m-%d %H:%M:%S.%f")}'"""

    @property
    def data(self) -> Dict[str, Any]:
        attrs = (
            "id",
            "column_name",
            "verbose_name",
            "description",
            "expression",
            "filterable",
            "groupby",
            "is_dttm",
            "type",
            "python_date_format",
        )
        return {s: getattr(self, s) for s in attrs if hasattr(self, s)}


class SqlMetric(Model, BaseMetric):

    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = "sql_metrics"
    __table_args__ = (UniqueConstraint("table_id", "metric_name"),)
    table_id = Column(Integer, ForeignKey("tables.id"))
    table = relationship(
        "SqlaTable",
        backref=backref("metrics", cascade="all, delete-orphan"),
        foreign_keys=[table_id],
    )
    expression = Column(Text, nullable=False)
    extra = Column(Text)

    export_fields = [
        "metric_name",
        "verbose_name",
        "metric_type",
        "table_id",
        "expression",
        "description",
        "d3format",
        "extra",
        "warning_text",
    ]
    update_from_object_fields = list(
        [s for s in export_fields if s not in ("table_id",)]
    )
    export_parent = "table"

    def get_sqla_col(self, label: Optional[str] = None) -> Column:
        label = label or self.metric_name
        sqla_col: ColumnClause = literal_column(self.expression)
        return self.table.make_sqla_column_compatible(sqla_col, label)

    @property
    def perm(self) -> Optional[str]:
        return (
            ("{parent_name}.[{obj.metric_name}](id:{obj.id})").format(
                obj=self, parent_name=self.table.full_name
            )
            if self.table
            else None
        )

    def get_perm(self) -> Optional[str]:
        return self.perm

    def get_extra_dict(self) -> Dict[str, Any]:
        try:
            return json.loads(self.extra)
        except (TypeError, json.JSONDecodeError):
            return {}

    @property
    def is_certified(self) -> bool:
        return bool(self.get_extra_dict().get("certification"))

    @property
    def certified_by(self) -> Optional[str]:
        return self.get_extra_dict().get("certification", {}).get("certified_by")

    @property
    def certification_details(self) -> Optional[str]:
        return self.get_extra_dict().get("certification", {}).get("details")

    @property
    def warning_markdown(self) -> Optional[str]:
        return self.get_extra_dict().get("warning_markdown")

    @property
    def data(self) -> Dict[str, Any]:
        attrs = (
            "is_certified",
            "certified_by",
            "certification_details",
            "warning_markdown",
        )
        attr_dict = {s: getattr(self, s) for s in attrs}

        attr_dict.update(super().data)
        return attr_dict


sqlatable_user = Table(
    "sqlatable_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("table_id", Integer, ForeignKey("tables.id")),
)


class SqlaTable(  # pylint: disable=too-many-public-methods,too-many-instance-attributes
    Model, BaseDatasource
):

    """An ORM object for SqlAlchemy table references"""

    type = "table"
    query_language = "sql"
    is_rls_supported = True
    columns: List[TableColumn] = []
    metrics: List[SqlMetric] = []
    metric_class = SqlMetric
    column_class = TableColumn
    owner_class = security_manager.user_model

    __tablename__ = "tables"
    __table_args__ = (UniqueConstraint("database_id", "table_name"),)

    table_name = Column(String(250), nullable=False)
    main_dttm_col = Column(String(250))
    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=False)
    fetch_values_predicate = Column(String(1000))
    owners = relationship(owner_class, secondary=sqlatable_user, backref="tables")
    database: Database = relationship(
        "Database",
        backref=backref("tables", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )
    schema = Column(String(255))
    sql = Column(Text)
    is_sqllab_view = Column(Boolean, default=False)
    template_params = Column(Text)
    extra = Column(Text)

    baselink = "tablemodelview"

    export_fields = [
        "table_name",
        "main_dttm_col",
        "description",
        "default_endpoint",
        "database_id",
        "offset",
        "cache_timeout",
        "schema",
        "sql",
        "params",
        "template_params",
        "filter_select_enabled",
        "fetch_values_predicate",
        "extra",
    ]
    update_from_object_fields = [f for f in export_fields if f != "database_id"]
    export_parent = "database"
    export_children = ["metrics", "columns"]

    sqla_aggregations = {
        "COUNT_DISTINCT": lambda column_name: sa.func.COUNT(sa.distinct(column_name)),
        "COUNT": sa.func.COUNT,
        "SUM": sa.func.SUM,
        "AVG": sa.func.AVG,
        "MIN": sa.func.MIN,
        "MAX": sa.func.MAX,
    }

    def __repr__(self) -> str:
        return self.name

    @property
    def changed_by_name(self) -> str:
        if not self.changed_by:
            return ""
        return str(self.changed_by)

    @property
    def changed_by_url(self) -> str:
        if not self.changed_by:
            return ""
        return f"/superset/profile/{self.changed_by.username}"

    @property
    def connection(self) -> str:
        return str(self.database)

    @property
    def description_markeddown(self) -> str:
        return utils.markdown(self.description)

    @property
    def datasource_name(self) -> str:
        return self.table_name

    @property
    def datasource_type(self) -> str:
        return self.type

    @property
    def database_name(self) -> str:
        return self.database.name

    @classmethod
    def get_datasource_by_name(
        cls,
        session: Session,
        datasource_name: str,
        schema: Optional[str],
        database_name: str,
    ) -> Optional["SqlaTable"]:
        schema = schema or None
        query = (
            session.query(cls)
            .join(Database)
            .filter(cls.table_name == datasource_name)
            .filter(Database.database_name == database_name)
        )
        # Handling schema being '' or None, which is easier to handle
        # in python than in the SQLA query in a multi-dialect way
        for tbl in query.all():
            if schema == (tbl.schema or None):
                return tbl
        return None

    @property
    def link(self) -> Markup:
        name = escape(self.name)
        anchor = f'<a target="_blank" href="{self.explore_url}">{name}</a>'
        return Markup(anchor)

    def get_schema_perm(self) -> Optional[str]:
        """Returns schema permission if present, database one otherwise."""
        return security_manager.get_schema_perm(self.database, self.schema)

    def get_perm(self) -> str:
        return f"[{self.database}].[{self.table_name}](id:{self.id})"

    @property
    def name(self) -> str:
        if not self.schema:
            return self.table_name
        return "{}.{}".format(self.schema, self.table_name)

    @property
    def full_name(self) -> str:
        return utils.get_datasource_full_name(
            self.database, self.table_name, schema=self.schema
        )

    @property
    def dttm_cols(self) -> List[str]:
        l = [c.column_name for c in self.columns if c.is_dttm]
        if self.main_dttm_col and self.main_dttm_col not in l:
            l.append(self.main_dttm_col)
        return l

    @property
    def num_cols(self) -> List[str]:
        return [c.column_name for c in self.columns if c.is_numeric]

    @property
    def any_dttm_col(self) -> Optional[str]:
        cols = self.dttm_cols
        return cols[0] if cols else None

    @property
    def html(self) -> str:
        df = pd.DataFrame((c.column_name, c.type) for c in self.columns)
        df.columns = ["field", "type"]
        return df.to_html(
            index=False,
            classes=("dataframe table table-striped table-bordered " "table-condensed"),
        )

    @property
    def sql_url(self) -> str:
        return self.database.sql_url + "?table_name=" + str(self.table_name)

    def external_metadata(self) -> List[Dict[str, str]]:
        db_engine_spec = self.database.db_engine_spec
        if self.sql:
            engine = self.database.get_sqla_engine(schema=self.schema)
            sql = self.get_template_processor().process_template(self.sql)
            parsed_query = ParsedQuery(sql)
            if not db_engine_spec.is_readonly_query(parsed_query):
                raise SupersetSecurityException(
                    SupersetError(
                        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                        message=_("Only `SELECT` statements are allowed"),
                        level=ErrorLevel.ERROR,
                    )
                )
            statements = parsed_query.get_statements()
            if len(statements) > 1:
                raise SupersetSecurityException(
                    SupersetError(
                        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                        message=_("Only single queries supported"),
                        level=ErrorLevel.ERROR,
                    )
                )
            # TODO(villebro): refactor to use same code that's used by
            #  sql_lab.py:execute_sql_statements
            try:
                with closing(engine.raw_connection()) as conn:
                    cursor = conn.cursor()
                    query = self.database.apply_limit_to_sql(statements[0])
                    db_engine_spec.execute(cursor, query)
                    result = db_engine_spec.fetch_data(cursor, limit=1)
                    result_set = SupersetResultSet(
                        result, cursor.description, db_engine_spec
                    )
                    cols = result_set.columns
            except Exception as exc:
                raise SupersetGenericDBErrorException(message=str(exc))
        else:
            db_dialect = self.database.get_dialect()
            cols = self.database.get_columns(
                self.table_name, schema=self.schema or None
            )
            for col in cols:
                try:
                    if isinstance(col["type"], TypeEngine):
                        col["type"] = db_engine_spec.column_datatype_to_string(
                            col["type"], db_dialect
                        )
                # Broad exception catch, because there are multiple possible exceptions
                # from different drivers that fall outside CompileError
                except Exception:  # pylint: disable=broad-except
                    col["type"] = "UNKNOWN"
        return cols

    @property
    def time_column_grains(self) -> Dict[str, Any]:
        return {
            "time_columns": self.dttm_cols,
            "time_grains": [grain.name for grain in self.database.grains()],
        }

    @property
    def select_star(self) -> Optional[str]:
        # show_cols and latest_partition set to false to avoid
        # the expensive cost of inspecting the DB
        return self.database.select_star(
            self.table_name, schema=self.schema, show_cols=False, latest_partition=False
        )

    @property  # type: ignore
    def health_check_message(self) -> Optional[str]:
        check = config["DATASET_HEALTH_CHECK"]
        return check(self) if check else None

    @property
    def data(self) -> Dict[str, Any]:
        data_ = super().data
        if self.type == "table":
            data_["granularity_sqla"] = utils.choicify(self.dttm_cols)
            data_["time_grain_sqla"] = [
                (g.duration, g.name) for g in self.database.grains() or []
            ]
            data_["main_dttm_col"] = self.main_dttm_col
            data_["fetch_values_predicate"] = self.fetch_values_predicate
            data_["template_params"] = self.template_params
            data_["is_sqllab_view"] = self.is_sqllab_view
            data_["health_check_message"] = self.health_check_message
            data_["extra"] = self.extra
        return data_

    @property
    def extra_dict(self) -> Dict[str, Any]:
        try:
            return json.loads(self.extra)
        except (TypeError, json.JSONDecodeError):
            return {}

    def get_fetch_values_predicate(self) -> TextClause:
        tp = self.get_template_processor()
        try:
            return text(tp.process_template(self.fetch_values_predicate))
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _(
                    "Error in jinja expression in fetch values predicate: %(msg)s",
                    msg=ex.message,
                )
            )

    def values_for_column(self, column_name: str, limit: int = 10000) -> List[Any]:
        """Runs query against sqla to retrieve some
        sample values for the given column.
        """
        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name]
        tp = self.get_template_processor()

        qry = (
            select([target_col.get_sqla_col()])
            .select_from(self.get_from_clause(tp))
            .distinct()
        )
        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            qry = qry.where(self.get_fetch_values_predicate())

        engine = self.database.get_sqla_engine()
        sql = "{}".format(qry.compile(engine, compile_kwargs={"literal_binds": True}))
        sql = self.mutate_query_from_config(sql)

        df = pd.read_sql_query(sql=sql, con=engine)
        return df[column_name].to_list()

    def mutate_query_from_config(self, sql: str) -> str:
        """Apply config's SQL_QUERY_MUTATOR

        Typically adds comments to the query with context"""
        sql_query_mutator = config["SQL_QUERY_MUTATOR"]
        if sql_query_mutator:
            username = utils.get_username()
            sql = sql_query_mutator(sql, username, security_manager, self.database)
        return sql

    def get_template_processor(self, **kwargs: Any) -> BaseTemplateProcessor:
        return get_template_processor(table=self, database=self.database, **kwargs)

    def get_query_str_extended(self, query_obj: QueryObjectDict) -> QueryStringExtended:
        sqlaq = self.get_sqla_query(**query_obj)
        sql = self.database.compile_sqla_query(sqlaq.sqla_query)
        sql = sqlparse.format(sql, reindent=True)
        sql = self.mutate_query_from_config(sql)
        return QueryStringExtended(
            labels_expected=sqlaq.labels_expected, sql=sql, prequeries=sqlaq.prequeries
        )

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        query_str_ext = self.get_query_str_extended(query_obj)
        all_queries = query_str_ext.prequeries + [query_str_ext.sql]
        return ";\n\n".join(all_queries) + ";"

    def get_sqla_table(self) -> TableClause:
        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema
        return tbl

    def get_from_clause(
        self, template_processor: Optional[BaseTemplateProcessor] = None
    ) -> Union[TableClause, Alias]:
        """
        Return where to select the columns and metrics from. Either a physical table
        or a virtual table with it's own subquery.
        """
        if not self.is_virtual:
            return self.get_sqla_table()

        from_sql = self.get_rendered_sql(template_processor)
        parsed_query = ParsedQuery(from_sql)
        db_engine_spec = self.database.db_engine_spec
        if not (
            parsed_query.is_unknown() or db_engine_spec.is_readonly_query(parsed_query)
        ):
            raise QueryObjectValidationError(
                _("Virtual dataset query must be read-only")
            )
        return TextAsFrom(sa.text(from_sql), []).alias(VIRTUAL_TABLE_ALIAS)

    def get_rendered_sql(
        self, template_processor: Optional[BaseTemplateProcessor] = None
    ) -> str:
        """
        Render sql with template engine (Jinja).
        """

        sql = self.sql
        if template_processor:
            try:
                sql = template_processor.process_template(sql)
            except TemplateError as ex:
                raise QueryObjectValidationError(
                    _(
                        "Error while rendering virtual dataset query: %(msg)s",
                        msg=ex.message,
                    )
                )
        sql = sqlparse.format(sql.strip("\t\r\n; "), strip_comments=True)
        if not sql:
            raise QueryObjectValidationError(_("Virtual dataset query cannot be empty"))
        if len(sqlparse.split(sql)) > 1:
            raise QueryObjectValidationError(
                _("Virtual dataset query cannot consist of multiple statements")
            )
        return sql

    def adhoc_metric_to_sqla(
        self, metric: AdhocMetric, columns_by_name: Dict[str, TableColumn]
    ) -> Column:
        """
        Turn an adhoc metric into a sqlalchemy column.

        :param dict metric: Adhoc metric definition
        :param dict columns_by_name: Columns for the current table
        :returns: The metric defined as a sqlalchemy column
        :rtype: sqlalchemy.sql.column
        """
        expression_type = metric.get("expressionType")
        label = utils.get_metric_name(metric)

        if expression_type == utils.AdhocMetricExpressionType.SIMPLE:
            column_name = metric["column"].get("column_name")
            table_column: Optional[TableColumn] = columns_by_name.get(column_name)
            if table_column:
                sqla_column = table_column.get_sqla_col()
            else:
                sqla_column = column(column_name)
            sqla_metric = self.sqla_aggregations[metric["aggregate"]](sqla_column)
        elif expression_type == utils.AdhocMetricExpressionType.SQL:
            sqla_metric = literal_column(metric.get("sqlExpression"))
        else:
            raise QueryObjectValidationError("Adhoc metric expressionType is invalid")

        return self.make_sqla_column_compatible(sqla_metric, label)

    def make_sqla_column_compatible(
        self, sqla_col: Column, label: Optional[str] = None
    ) -> Column:
        """Takes a sqlalchemy column object and adds label info if supported by engine.
        :param sqla_col: sqlalchemy column instance
        :param label: alias/label that column is expected to have
        :return: either a sql alchemy column or label instance if supported by engine
        """
        label_expected = label or sqla_col.name
        db_engine_spec = self.database.db_engine_spec
        # add quotes to tables
        if db_engine_spec.allows_alias_in_select:
            label = db_engine_spec.make_label_compatible(label_expected)
            sqla_col = sqla_col.label(label)
        sqla_col.key = label_expected
        return sqla_col

    def make_orderby_compatible(
        self, select_exprs: List[ColumnElement], orderby_exprs: List[ColumnElement]
    ) -> None:
        """
        If needed, make sure aliases for selected columns are not used in
        `ORDER BY`.

        In some databases (e.g. Presto), `ORDER BY` clause is not able to
        automatically pick the source column if a `SELECT` clause alias is named
        the same as a source column. In this case, we update the SELECT alias to
        another name to avoid the conflict.
        """
        if self.database.db_engine_spec.allows_alias_to_source_column:
            return

        def is_alias_used_in_orderby(col: ColumnElement) -> bool:
            if not isinstance(col, Label):
                return False
            regexp = re.compile(f"\\(.*\\b{re.escape(col.name)}\\b.*\\)", re.IGNORECASE)
            return any(regexp.search(str(x)) for x in orderby_exprs)

        # Iterate through selected columns, if column alias appears in orderby
        # use another `alias`. The final output columns will still use the
        # original names, because they are updated by `labels_expected` after
        # querying.
        for col in select_exprs:
            if is_alias_used_in_orderby(col):
                col.name = f"{col.name}__"

    def _get_sqla_row_level_filters(
        self, template_processor: BaseTemplateProcessor
    ) -> List[str]:
        """
        Return the appropriate row level security filters for
        this table and the current user.

        :param BaseTemplateProcessor template_processor: The template
        processor to apply to the filters.
        :returns: A list of SQL clauses to be ANDed together.
        :rtype: List[str]
        """
        filters_grouped: Dict[Union[int, str], List[str]] = defaultdict(list)
        try:
            for filter_ in security_manager.get_rls_filters(self):
                clause = text(
                    f"({template_processor.process_template(filter_.clause)})"
                )
                filters_grouped[filter_.group_key or filter_.id].append(clause)
            return [or_(*clauses) for clauses in filters_grouped.values()]
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _("Error in jinja expression in RLS filters: %(msg)s", msg=ex.message,)
            )

    def get_sqla_query(  # pylint: disable=too-many-arguments,too-many-locals,too-many-branches,too-many-statements
        self,
        metrics: Optional[List[Metric]] = None,
        granularity: Optional[str] = None,
        from_dttm: Optional[datetime] = None,
        to_dttm: Optional[datetime] = None,
        columns: Optional[List[str]] = None,
        groupby: Optional[List[str]] = None,
        filter: Optional[  # pylint: disable=redefined-builtin
            List[Dict[str, Any]]
        ] = None,
        is_timeseries: bool = True,
        timeseries_limit: int = 15,
        timeseries_limit_metric: Optional[Metric] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        inner_from_dttm: Optional[datetime] = None,
        inner_to_dttm: Optional[datetime] = None,
        orderby: Optional[List[OrderBy]] = None,
        extras: Optional[Dict[str, Any]] = None,
        order_desc: bool = True,
        is_rowcount: bool = False,
        apply_fetch_values_predicate: bool = False,
    ) -> SqlaQuery:
        """Querying any sqla table from this common interface"""
        template_kwargs = {
            "from_dttm": from_dttm.isoformat() if from_dttm else None,
            "groupby": groupby,
            "metrics": metrics,
            "row_limit": row_limit,
            "row_offset": row_offset,
            "to_dttm": to_dttm.isoformat() if to_dttm else None,
            "filter": filter,
            "columns": [col.column_name for col in self.columns],
        }
        template_kwargs.update(self.template_params_dict)
        extra_cache_keys: List[Any] = []
        template_kwargs["extra_cache_keys"] = extra_cache_keys
        template_processor = self.get_template_processor(**template_kwargs)
        db_engine_spec = self.database.db_engine_spec
        prequeries: List[str] = []
        orderby = orderby or []
        extras = extras or {}
        need_groupby = bool(metrics is not None or groupby)
        metrics = metrics or []

        # For backward compatibility
        if granularity not in self.dttm_cols:
            granularity = self.main_dttm_col

        # Database spec supports join-free timeslot grouping
        time_groupby_inline = db_engine_spec.time_groupby_inline

        columns_by_name: Dict[str, TableColumn] = {
            col.column_name: col for col in self.columns
        }
        metrics_by_name: Dict[str, SqlMetric] = {m.metric_name: m for m in self.metrics}

        if not granularity and is_timeseries:
            raise QueryObjectValidationError(
                _(
                    "Datetime column not provided as part table configuration "
                    "and is required by this type of chart"
                )
            )
        if not metrics and not columns and not groupby:
            raise QueryObjectValidationError(_("Empty query?"))

        metrics_exprs: List[ColumnElement] = []
        for metric in metrics:
            if utils.is_adhoc_metric(metric):
                assert isinstance(metric, dict)
                metrics_exprs.append(self.adhoc_metric_to_sqla(metric, columns_by_name))
            elif isinstance(metric, str) and metric in metrics_by_name:
                metrics_exprs.append(metrics_by_name[metric].get_sqla_col())
            else:
                raise QueryObjectValidationError(
                    _("Metric '%(metric)s' does not exist", metric=metric)
                )

        if metrics_exprs:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr, label = literal_column("COUNT(*)"), "ccount"
            main_metric_expr = self.make_sqla_column_compatible(main_metric_expr, label)

        # To ensure correct handling of the ORDER BY labeling we need to reference the
        # metric instance if defined in the SELECT clause.
        metrics_exprs_by_label = {m.name: m for m in metrics_exprs}
        metrics_exprs_by_expr = {str(m): m for m in metrics_exprs}

        # Since orderby may use adhoc metrics, too; we need to process them first
        orderby_exprs: List[ColumnElement] = []
        for orig_col, ascending in orderby:
            col: Union[Metric, ColumnElement] = orig_col
            if isinstance(col, dict):
                if utils.is_adhoc_metric(col):
                    # add adhoc sort by column to columns_by_name if not exists
                    col = self.adhoc_metric_to_sqla(col, columns_by_name)
                    # if the adhoc metric has been defined before
                    # use the existing instance.
                    col = metrics_exprs_by_expr.get(str(col), col)
                    need_groupby = True
            elif col in columns_by_name:
                col = columns_by_name[col].get_sqla_col()
            elif col in metrics_exprs_by_label:
                col = metrics_exprs_by_label[col]
                need_groupby = True
            elif col in metrics_by_name:
                col = metrics_by_name[col].get_sqla_col()
                need_groupby = True

            if isinstance(col, ColumnElement):
                orderby_exprs.append(col)
            else:
                # Could not convert a column reference to valid ColumnElement
                raise QueryObjectValidationError(
                    _("Unknown column used in orderby: %(col)s", col=orig_col)
                )

        select_exprs: List[Union[Column, Label]] = []
        groupby_exprs_sans_timestamp = OrderedDict()

        # filter out the pseudo column  __timestamp from columns
        columns = columns or []
        columns = [col for col in columns if col != utils.DTTM_ALIAS]

        if need_groupby:
            # dedup columns while preserving order
            columns = groupby or columns
            for selected in columns:
                # if groupby field/expr equals granularity field/expr
                if selected == granularity:
                    time_grain = extras.get("time_grain_sqla")
                    sqla_col = columns_by_name[selected]
                    outer = sqla_col.get_timestamp_expression(time_grain, selected)
                # if groupby field equals a selected column
                elif selected in columns_by_name:
                    outer = columns_by_name[selected].get_sqla_col()
                else:
                    outer = literal_column(f"({selected})")
                    outer = self.make_sqla_column_compatible(outer, selected)
                groupby_exprs_sans_timestamp[outer.name] = outer
                select_exprs.append(outer)
        elif columns:
            for selected in columns:
                select_exprs.append(
                    columns_by_name[selected].get_sqla_col()
                    if selected in columns_by_name
                    else self.make_sqla_column_compatible(literal_column(selected))
                )
            metrics_exprs = []

        time_range_endpoints = extras.get("time_range_endpoints")
        groupby_exprs_with_timestamp = OrderedDict(groupby_exprs_sans_timestamp.items())

        if granularity:
            if granularity not in columns_by_name:
                raise QueryObjectValidationError(
                    _(
                        'Time column "%(col)s" does not exist in dataset',
                        col=granularity,
                    )
                )
            dttm_col = columns_by_name[granularity]
            time_grain = extras.get("time_grain_sqla")
            time_filters = []

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(time_grain)
                # always put timestamp as the first column
                select_exprs.insert(0, timestamp)
                groupby_exprs_with_timestamp[timestamp.name] = timestamp

            # Use main dttm column to support index with secondary dttm columns.
            if (
                db_engine_spec.time_secondary_columns
                and self.main_dttm_col in self.dttm_cols
                and self.main_dttm_col != dttm_col.column_name
            ):
                time_filters.append(
                    columns_by_name[self.main_dttm_col].get_time_filter(
                        from_dttm, to_dttm, time_range_endpoints
                    )
                )
            time_filters.append(
                dttm_col.get_time_filter(from_dttm, to_dttm, time_range_endpoints)
            )

        # Always remove duplicates by column name, as sometimes `metrics_exprs`
        # can have the same name as a groupby column (e.g. when users use
        # raw columns as custom SQL adhoc metric).
        select_exprs = remove_duplicates(
            select_exprs + metrics_exprs, key=lambda x: x.name
        )

        # Expected output columns
        labels_expected = [c.key for c in select_exprs]

        # Order by columns are "hidden" columns, some databases require them
        # always be present in SELECT if an aggregation function is used
        if not db_engine_spec.allows_hidden_ordeby_agg:
            select_exprs = remove_duplicates(select_exprs + orderby_exprs)

        qry = sa.select(select_exprs)

        tbl = self.get_from_clause(template_processor)

        if groupby_exprs_with_timestamp:
            qry = qry.group_by(*groupby_exprs_with_timestamp.values())

        where_clause_and = []
        having_clause_and = []

        for flt in filter:  # type: ignore
            if not all([flt.get(s) for s in ["col", "op"]]):
                continue
            col = flt["col"]
            val = flt.get("val")
            op = flt["op"].upper()
            col_obj = columns_by_name.get(col)
            if col_obj:
                col_spec = db_engine_spec.get_column_spec(col_obj.type)
                is_list_target = op in (
                    utils.FilterOperator.IN.value,
                    utils.FilterOperator.NOT_IN.value,
                )
                if col_spec:
                    target_type = col_spec.generic_type
                else:
                    target_type = GenericDataType.STRING
                eq = self.filter_values_handler(
                    values=val,
                    target_column_type=target_type,
                    is_list_target=is_list_target,
                )
                if is_list_target:
                    assert isinstance(eq, (tuple, list))
                    if len(eq) == 0:
                        raise QueryObjectValidationError(
                            _("Filter value list cannot be empty")
                        )
                    if None in eq:
                        eq = [x for x in eq if x is not None]
                        is_null_cond = col_obj.get_sqla_col().is_(None)
                        if eq:
                            cond = or_(is_null_cond, col_obj.get_sqla_col().in_(eq))
                        else:
                            cond = is_null_cond
                    else:
                        cond = col_obj.get_sqla_col().in_(eq)
                    if op == utils.FilterOperator.NOT_IN.value:
                        cond = ~cond
                    where_clause_and.append(cond)
                elif op == utils.FilterOperator.IS_NULL.value:
                    where_clause_and.append(col_obj.get_sqla_col().is_(None))
                elif op == utils.FilterOperator.IS_NOT_NULL.value:
                    where_clause_and.append(col_obj.get_sqla_col().isnot(None))
                else:
                    if eq is None:
                        raise QueryObjectValidationError(
                            _(
                                "Must specify a value for filters "
                                "with comparison operators"
                            )
                        )
                    if op == utils.FilterOperator.EQUALS.value:
                        where_clause_and.append(col_obj.get_sqla_col() == eq)
                    elif op == utils.FilterOperator.NOT_EQUALS.value:
                        where_clause_and.append(col_obj.get_sqla_col() != eq)
                    elif op == utils.FilterOperator.GREATER_THAN.value:
                        where_clause_and.append(col_obj.get_sqla_col() > eq)
                    elif op == utils.FilterOperator.LESS_THAN.value:
                        where_clause_and.append(col_obj.get_sqla_col() < eq)
                    elif op == utils.FilterOperator.GREATER_THAN_OR_EQUALS.value:
                        where_clause_and.append(col_obj.get_sqla_col() >= eq)
                    elif op == utils.FilterOperator.LESS_THAN_OR_EQUALS.value:
                        where_clause_and.append(col_obj.get_sqla_col() <= eq)
                    elif op == utils.FilterOperator.LIKE.value:
                        where_clause_and.append(col_obj.get_sqla_col().like(eq))
                    else:
                        raise QueryObjectValidationError(
                            _("Invalid filter operation type: %(op)s", op=op)
                        )
        if is_feature_enabled("ROW_LEVEL_SECURITY"):
            where_clause_and += self._get_sqla_row_level_filters(template_processor)
        if extras:
            where = extras.get("where")
            if where:
                try:
                    where = template_processor.process_template(where)
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in WHERE clause: %(msg)s",
                            msg=ex.message,
                        )
                    )
                where_clause_and += [sa.text("({})".format(where))]
            having = extras.get("having")
            if having:
                try:
                    having = template_processor.process_template(having)
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in HAVING clause: %(msg)s",
                            msg=ex.message,
                        )
                    )
                having_clause_and += [sa.text("({})".format(having))]
        if apply_fetch_values_predicate and self.fetch_values_predicate:
            qry = qry.where(self.get_fetch_values_predicate())
        if granularity:
            qry = qry.where(and_(*(time_filters + where_clause_and)))
        else:
            qry = qry.where(and_(*where_clause_and))
        qry = qry.having(and_(*having_clause_and))

        self.make_orderby_compatible(select_exprs, orderby_exprs)

        for col, (orig_col, ascending) in zip(orderby_exprs, orderby):
            if not db_engine_spec.allows_alias_in_orderby and isinstance(col, Label):
                # if engine does not allow using SELECT alias in ORDER BY
                # revert to the underlying column
                col = col.element
            direction = asc if ascending else desc
            qry = qry.order_by(direction(col))

        if row_limit:
            qry = qry.limit(row_limit)
        if row_offset:
            qry = qry.offset(row_offset)

        if (
            is_timeseries  # pylint: disable=too-many-boolean-expressions
            and timeseries_limit
            and not time_groupby_inline
            and groupby
        ):
            if db_engine_spec.allows_joins:
                # some sql dialects require for order by expressions
                # to also be in the select clause -- others, e.g. vertica,
                # require a unique inner alias
                inner_main_metric_expr = self.make_sqla_column_compatible(
                    main_metric_expr, "mme_inner__"
                )
                inner_groupby_exprs = []
                inner_select_exprs = []
                for gby_name, gby_obj in groupby_exprs_sans_timestamp.items():
                    inner = self.make_sqla_column_compatible(gby_obj, gby_name + "__")
                    inner_groupby_exprs.append(inner)
                    inner_select_exprs.append(inner)

                inner_select_exprs += [inner_main_metric_expr]
                subq = select(inner_select_exprs).select_from(tbl)
                inner_time_filter = dttm_col.get_time_filter(
                    inner_from_dttm or from_dttm,
                    inner_to_dttm or to_dttm,
                    time_range_endpoints,
                )
                subq = subq.where(and_(*(where_clause_and + [inner_time_filter])))
                subq = subq.group_by(*inner_groupby_exprs)

                ob = inner_main_metric_expr
                if timeseries_limit_metric:
                    ob = self._get_timeseries_orderby(
                        timeseries_limit_metric, metrics_by_name, columns_by_name
                    )
                direction = desc if order_desc else asc
                subq = subq.order_by(direction(ob))
                subq = subq.limit(timeseries_limit)

                on_clause = []
                for gby_name, gby_obj in groupby_exprs_sans_timestamp.items():
                    # in this case the column name, not the alias, needs to be
                    # conditionally mutated, as it refers to the column alias in
                    # the inner query
                    col_name = db_engine_spec.make_label_compatible(gby_name + "__")
                    on_clause.append(gby_obj == column(col_name))

                tbl = tbl.join(subq.alias(), and_(*on_clause))
            else:
                if timeseries_limit_metric:
                    orderby = [
                        (
                            self._get_timeseries_orderby(
                                timeseries_limit_metric,
                                metrics_by_name,
                                columns_by_name,
                            ),
                            False,
                        )
                    ]

                # run prequery to get top groups
                prequery_obj = {
                    "is_timeseries": False,
                    "row_limit": timeseries_limit,
                    "metrics": metrics,
                    "granularity": granularity,
                    "groupby": groupby,
                    "from_dttm": inner_from_dttm or from_dttm,
                    "to_dttm": inner_to_dttm or to_dttm,
                    "filter": filter,
                    "orderby": orderby,
                    "extras": extras,
                    "columns": columns,
                    "order_desc": True,
                }

                result = self.query(prequery_obj)
                prequeries.append(result.query)
                dimensions = [
                    c
                    for c in result.df.columns
                    if c not in metrics and c in groupby_exprs_sans_timestamp
                ]
                top_groups = self._get_top_groups(
                    result.df, dimensions, groupby_exprs_sans_timestamp
                )
                qry = qry.where(top_groups)

        qry = qry.select_from(tbl)

        if is_rowcount:
            if not db_engine_spec.allows_subqueries:
                raise QueryObjectValidationError(
                    _("Database does not support subqueries")
                )
            label = "rowcount"
            col = self.make_sqla_column_compatible(literal_column("COUNT(*)"), label)
            qry = select([col]).select_from(qry.alias("rowcount_qry"))
            labels_expected = [label]

        return SqlaQuery(
            extra_cache_keys=extra_cache_keys,
            labels_expected=labels_expected,
            sqla_query=qry,
            prequeries=prequeries,
        )

    def _get_timeseries_orderby(
        self,
        timeseries_limit_metric: Metric,
        metrics_by_name: Dict[str, SqlMetric],
        columns_by_name: Dict[str, TableColumn],
    ) -> Column:
        if utils.is_adhoc_metric(timeseries_limit_metric):
            assert isinstance(timeseries_limit_metric, dict)
            ob = self.adhoc_metric_to_sqla(timeseries_limit_metric, columns_by_name)
        elif (
            isinstance(timeseries_limit_metric, str)
            and timeseries_limit_metric in metrics_by_name
        ):
            ob = metrics_by_name[timeseries_limit_metric].get_sqla_col()
        else:
            raise QueryObjectValidationError(
                _("Metric '%(metric)s' does not exist", metric=timeseries_limit_metric)
            )
        return ob

    def _get_top_groups(  # pylint: disable=no-self-use
        self,
        df: pd.DataFrame,
        dimensions: List[str],
        groupby_exprs: "OrderedDict[str, Any]",
    ) -> ColumnElement:
        groups = []
        for _unused, row in df.iterrows():
            group = []
            for dimension in dimensions:
                group.append(groupby_exprs[dimension] == row[dimension])
            groups.append(and_(*group))

        return or_(*groups)

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        qry_start_dttm = datetime.now()
        query_str_ext = self.get_query_str_extended(query_obj)
        sql = query_str_ext.sql
        status = utils.QueryStatus.SUCCESS
        errors = None
        error_message = None

        def assign_column_label(df: pd.DataFrame) -> Optional[pd.DataFrame]:
            """
            Some engines change the case or generate bespoke column names, either by
            default or due to lack of support for aliasing. This function ensures that
            the column names in the DataFrame correspond to what is expected by
            the viz components.

            Sometimes a query may also contain only order by columns that are not used
            as metrics or groupby columns, but need to present in the SQL `select`,
            filtering by `labels_expected` make sure we only return columns users want.

            :param df: Original DataFrame returned by the engine
            :return: Mutated DataFrame
            """
            labels_expected = query_str_ext.labels_expected
            if df is not None and not df.empty:
                if len(df.columns) < len(labels_expected):
                    raise QueryObjectValidationError(
                        _("Db engine did not return all queried columns")
                    )
                if len(df.columns) > len(labels_expected):
                    df = df.iloc[:, 0 : len(labels_expected)]
                df.columns = labels_expected
            return df

        try:
            df = self.database.get_df(sql, self.schema, mutator=assign_column_label)
        except Exception as ex:  # pylint: disable=broad-except
            df = pd.DataFrame()
            status = utils.QueryStatus.FAILED
            logger.warning(
                "Query %s on schema %s failed", sql, self.schema, exc_info=True
            )
            db_engine_spec = self.database.db_engine_spec
            errors = [
                dataclasses.asdict(error) for error in db_engine_spec.extract_errors(ex)
            ]
            error_message = utils.error_msg_from_exception(ex)

        return QueryResult(
            status=status,
            df=df,
            duration=datetime.now() - qry_start_dttm,
            query=sql,
            errors=errors,
            error_message=error_message,
        )

    def get_sqla_table_object(self) -> Table:
        return self.database.get_table(self.table_name, schema=self.schema)

    def fetch_metadata(self, commit: bool = True) -> MetadataResult:
        """
        Fetches the metadata for the table and merges it in

        :param commit: should the changes be committed or not.
        :return: Tuple with lists of added, removed and modified column names.
        """
        new_columns = self.external_metadata()
        metrics = []
        any_date_col = None
        db_engine_spec = self.database.db_engine_spec
        old_columns = db.session.query(TableColumn).filter(TableColumn.table == self)

        old_columns_by_name: Dict[str, TableColumn] = {
            col.column_name: col for col in old_columns
        }
        results = MetadataResult(
            removed=[
                col
                for col in old_columns_by_name
                if col not in {col["name"] for col in new_columns}
            ]
        )

        # clear old columns before adding modified columns back
        self.columns = []
        for col in new_columns:
            old_column = old_columns_by_name.pop(col["name"], None)
            if not old_column:
                results.added.append(col["name"])
                new_column = TableColumn(
                    column_name=col["name"], type=col["type"], table=self
                )
                new_column.is_dttm = new_column.is_temporal
                db_engine_spec.alter_new_orm_column(new_column)
            else:
                new_column = old_column
                if new_column.type != col["type"]:
                    results.modified.append(col["name"])
                new_column.type = col["type"]
                new_column.expression = ""
            new_column.groupby = True
            new_column.filterable = True
            self.columns.append(new_column)
            if not any_date_col and new_column.is_temporal:
                any_date_col = col["name"]
        self.columns.extend(
            [col for col in old_columns_by_name.values() if col.expression]
        )
        metrics.append(
            SqlMetric(
                metric_name="count",
                verbose_name="COUNT(*)",
                metric_type="count",
                expression="COUNT(*)",
            )
        )
        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col
        self.add_missing_metrics(metrics)

        # Apply config supplied mutations.
        config["SQLA_TABLE_MUTATOR"](self)

        db.session.merge(self)
        if commit:
            db.session.commit()
        return results

    @classmethod
    def query_datasources_by_name(
        cls,
        session: Session,
        database: Database,
        datasource_name: str,
        schema: Optional[str] = None,
    ) -> List["SqlaTable"]:
        query = (
            session.query(cls)
            .filter_by(database_id=database.id)
            .filter_by(table_name=datasource_name)
        )
        if schema:
            query = query.filter_by(schema=schema)
        return query.all()

    @staticmethod
    def default_query(qry: Query) -> Query:
        return qry.filter_by(is_sqllab_view=False)

    def has_extra_cache_key_calls(self, query_obj: QueryObjectDict) -> bool:
        """
        Detects the presence of calls to `ExtraCache` methods in items in query_obj that
        can be templated. If any are present, the query must be evaluated to extract
        additional keys for the cache key. This method is needed to avoid executing the
        template code unnecessarily, as it may contain expensive calls, e.g. to extract
        the latest partition of a database.

        :param query_obj: query object to analyze
        :return: True if there are call(s) to an `ExtraCache` method, False otherwise
        """
        templatable_statements: List[str] = []
        if self.sql:
            templatable_statements.append(self.sql)
        if self.fetch_values_predicate:
            templatable_statements.append(self.fetch_values_predicate)
        extras = query_obj.get("extras", {})
        if "where" in extras:
            templatable_statements.append(extras["where"])
        if "having" in extras:
            templatable_statements.append(extras["having"])
        if is_feature_enabled("ROW_LEVEL_SECURITY") and self.is_rls_supported:
            templatable_statements += [
                f.clause for f in security_manager.get_rls_filters(self)
            ]
        for statement in templatable_statements:
            if ExtraCache.regex.search(statement):
                return True
        return False

    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> List[Hashable]:
        """
        The cache key of a SqlaTable needs to consider any keys added by the parent
        class and any keys added via `ExtraCache`.

        :param query_obj: query object to analyze
        :return: The extra cache keys
        """
        extra_cache_keys = super().get_extra_cache_keys(query_obj)
        if self.has_extra_cache_key_calls(query_obj):
            sqla_query = self.get_sqla_query(**query_obj)
            extra_cache_keys += sqla_query.extra_cache_keys
        return extra_cache_keys


sa.event.listen(SqlaTable, "after_insert", security_manager.set_perm)
sa.event.listen(SqlaTable, "after_update", security_manager.set_perm)


RLSFilterRoles = Table(
    "rls_filter_roles",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("role_id", Integer, ForeignKey("ab_role.id"), nullable=False),
    Column("rls_filter_id", Integer, ForeignKey("row_level_security_filters.id")),
)

RLSFilterTables = Table(
    "rls_filter_tables",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("table_id", Integer, ForeignKey("tables.id")),
    Column("rls_filter_id", Integer, ForeignKey("row_level_security_filters.id")),
)


class RowLevelSecurityFilter(Model, AuditMixinNullable):
    """
    Custom where clauses attached to Tables and Roles.
    """

    __tablename__ = "row_level_security_filters"
    id = Column(Integer, primary_key=True)
    filter_type = Column(
        Enum(*[filter_type.value for filter_type in utils.RowLevelSecurityFilterType])
    )
    group_key = Column(String(255), nullable=True)
    roles = relationship(
        security_manager.role_model,
        secondary=RLSFilterRoles,
        backref="row_level_security_filters",
    )
    tables = relationship(
        SqlaTable, secondary=RLSFilterTables, backref="row_level_security_filters"
    )

    clause = Column(Text, nullable=False)
