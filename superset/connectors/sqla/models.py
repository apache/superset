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
# pylint: disable=too-many-lines, redefined-outer-name
import dataclasses
import json
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import (
    Any,
    Callable,
    cast,
    Dict,
    Hashable,
    List,
    NamedTuple,
    Optional,
    Tuple,
    Type,
    Union,
)
from uuid import uuid4

import dateutil.parser
import numpy as np
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
    inspect,
    Integer,
    or_,
    select,
    String,
    Table,
    Text,
    update,
)
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import backref, Query, relationship, RelationshipProperty, Session
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import column, ColumnElement, literal_column, table
from sqlalchemy.sql.elements import ColumnClause, TextClause
from sqlalchemy.sql.expression import Label, Select, TextAsFrom
from sqlalchemy.sql.selectable import Alias, TableClause

from superset import app, db, is_feature_enabled, security_manager
from superset.advanced_data_type.types import AdvancedDataTypeResponse
from superset.columns.models import Column as NewColumn, UNKOWN_TYPE
from superset.common.db_query_status import QueryStatus
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.connectors.sqla.utils import (
    find_cached_objects_in_session,
    get_physical_table_metadata,
    get_virtual_table_metadata,
    validate_adhoc_subquery,
)
from superset.datasets.models import Dataset as NewDataset
from superset.db_engine_specs.base import BaseEngineSpec, CTE_ALIAS, TimestampExpression
from superset.exceptions import (
    AdvancedDataTypeResponseError,
    DatasetInvalidPermissionEvaluationException,
    QueryClauseValidationException,
    QueryObjectValidationError,
)
from superset.extensions import feature_flag_manager
from superset.jinja_context import (
    BaseTemplateProcessor,
    ExtraCache,
    get_template_processor,
)
from superset.models.annotations import Annotation
from superset.models.core import Database
from superset.models.helpers import (
    AuditMixinNullable,
    CertificationMixin,
    clone_model,
    QueryResult,
)
from superset.sql_parse import (
    extract_table_references,
    ParsedQuery,
    sanitize_clause,
    Table as TableName,
)
from superset.superset_typing import (
    AdhocColumn,
    AdhocMetric,
    Metric,
    OrderBy,
    QueryObjectDict,
)
from superset.tables.models import Table as NewTable
from superset.utils import core as utils
from superset.utils.core import (
    GenericDataType,
    get_column_name,
    get_username,
    is_adhoc_column,
    MediumText,
    QueryObjectFilterClause,
    remove_duplicates,
)

config = app.config
metadata = Model.metadata  # pylint: disable=no-member
logger = logging.getLogger(__name__)
ADVANCED_DATA_TYPES = config["ADVANCED_DATA_TYPES"]
VIRTUAL_TABLE_ALIAS = "virtual_table"

# a non-exhaustive set of additive metrics
ADDITIVE_METRIC_TYPES = {
    "count",
    "sum",
    "doubleSum",
}
ADDITIVE_METRIC_TYPES_LOWER = {op.lower() for op in ADDITIVE_METRIC_TYPES}


class SqlaQuery(NamedTuple):
    applied_template_filters: List[str]
    cte: Optional[str]
    extra_cache_keys: List[Any]
    labels_expected: List[str]
    prequeries: List[str]
    sqla_query: Select


class QueryStringExtended(NamedTuple):
    applied_template_filters: Optional[List[str]]
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
        status = QueryStatus.SUCCESS
        try:
            df = pd.read_sql_query(qry.statement, db.engine)
        except Exception as ex:  # pylint: disable=broad-except
            df = pd.DataFrame()
            status = QueryStatus.FAILED
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


class TableColumn(Model, BaseColumn, CertificationMixin):

    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = "table_columns"
    __table_args__ = (UniqueConstraint("table_id", "column_name"),)
    table_id = Column(Integer, ForeignKey("tables.id"))
    table: "SqlaTable" = relationship(
        "SqlaTable",
        backref=backref("columns", cascade="all, delete-orphan"),
        foreign_keys=[table_id],
    )
    is_dttm = Column(Boolean, default=False)
    expression = Column(MediumText())
    python_date_format = Column(String(255))
    extra = Column(Text)

    export_fields = [
        "table_id",
        "column_name",
        "verbose_name",
        "is_dttm",
        "is_active",
        "type",
        "advanced_data_type",
        "groupby",
        "filterable",
        "expression",
        "description",
        "python_date_format",
        "extra",
    ]

    update_from_object_fields = [s for s in export_fields if s not in ("table_id",)]
    export_parent = "table"

    @property
    def is_boolean(self) -> bool:
        """
        Check if the column has a boolean datatype.
        """
        return self.type_generic == GenericDataType.BOOLEAN

    @property
    def is_numeric(self) -> bool:
        """
        Check if the column has a numeric datatype.
        """
        return self.type_generic == GenericDataType.NUMERIC

    @property
    def is_string(self) -> bool:
        """
        Check if the column has a string datatype.
        """
        return self.type_generic == GenericDataType.STRING

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
        return self.type_generic == GenericDataType.TEMPORAL

    @property
    def db_engine_spec(self) -> Type[BaseEngineSpec]:
        return self.table.db_engine_spec

    @property
    def db_extra(self) -> Dict[str, Any]:
        return self.table.database.get_extra()

    @property
    def type_generic(self) -> Optional[utils.GenericDataType]:
        if self.is_dttm:
            return GenericDataType.TEMPORAL
        column_spec = self.db_engine_spec.get_column_spec(
            self.type, db_extra=self.db_extra
        )
        return column_spec.generic_type if column_spec else None

    def get_sqla_col(self, label: Optional[str] = None) -> Column:
        label = label or self.column_name
        db_engine_spec = self.db_engine_spec
        column_spec = db_engine_spec.get_column_spec(self.type, db_extra=self.db_extra)
        type_ = column_spec.sqla_type if column_spec else None
        if self.expression:
            tp = self.table.get_template_processor()
            expression = tp.process_template(self.expression)
            col = literal_column(expression, type_=type_)
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
    ) -> ColumnElement:
        col = self.get_sqla_col(label="__time")
        l = []
        if start_dttm:
            l.append(col >= self.table.text(self.dttm_sql_literal(start_dttm)))
        if end_dttm:
            l.append(col < self.table.text(self.dttm_sql_literal(end_dttm)))
        return and_(*l)

    def get_timestamp_expression(
        self,
        time_grain: Optional[str],
        label: Optional[str] = None,
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> Union[TimestampExpression, Label]:
        """
        Return a SQLAlchemy Core element representation of self to be used in a query.

        :param time_grain: Optional time grain, e.g. P1Y
        :param label: alias/label that column is expected to have
        :param template_processor: template processor
        :return: A TimeExpression object wrapped in a Label if supported by db
        """
        label = label or utils.DTTM_ALIAS

        pdf = self.python_date_format
        is_epoch = pdf in ("epoch_s", "epoch_ms")
        column_spec = self.db_engine_spec.get_column_spec(
            self.type, db_extra=self.db_extra
        )
        type_ = column_spec.sqla_type if column_spec else DateTime
        if not self.expression and not time_grain and not is_epoch:
            sqla_col = column(self.column_name, type_=type_)
            return self.table.make_sqla_column_compatible(sqla_col, label)
        if self.expression:
            expression = self.expression
            if template_processor:
                expression = template_processor.process_template(self.expression)
            col = literal_column(expression, type_=type_)
        else:
            col = column(self.column_name, type_=type_)
        time_expr = self.db_engine_spec.get_timestamp_expr(
            col, pdf, time_grain, self.type
        )
        return self.table.make_sqla_column_compatible(time_expr, label)

    def dttm_sql_literal(self, dttm: DateTime) -> str:
        """Convert datetime object to a SQL expression string"""
        sql = (
            self.db_engine_spec.convert_dttm(self.type, dttm, db_extra=self.db_extra)
            if self.type
            else None
        )

        if sql:
            return sql

        tf = self.python_date_format

        # Fallback to the default format (if defined).
        if not tf:
            tf = self.db_extra.get("python_date_format_by_column_name", {}).get(
                self.column_name
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
            "type_generic",
            "advanced_data_type",
            "python_date_format",
            "is_certified",
            "certified_by",
            "certification_details",
            "warning_markdown",
        )

        attr_dict = {s: getattr(self, s) for s in attrs if hasattr(self, s)}

        attr_dict.update(super().data)

        return attr_dict

    def to_sl_column(
        self, known_columns: Optional[Dict[str, NewColumn]] = None
    ) -> NewColumn:
        """Convert a TableColumn to NewColumn"""
        session: Session = inspect(self).session
        column = known_columns.get(self.uuid) if known_columns else None
        if not column:
            column = NewColumn()

        extra_json = self.get_extra_dict()
        for attr in {
            "verbose_name",
            "python_date_format",
        }:
            value = getattr(self, attr)
            if value:
                extra_json[attr] = value

        if not column.id:
            with session.no_autoflush:
                saved_column = (
                    session.query(NewColumn).filter_by(uuid=self.uuid).one_or_none()
                )
                if saved_column:
                    logger.warning(
                        "sl_column already exists. Assigning existing id %s", self
                    )

                    # uuid isn't a primary key, so add the id of the existing column to
                    # ensure that the column is modified instead of created
                    # in order to avoid a uuid collision
                    column.id = saved_column.id

        column.uuid = self.uuid
        column.created_on = self.created_on
        column.changed_on = self.changed_on
        column.created_by = self.created_by
        column.changed_by = self.changed_by
        column.name = self.column_name
        column.type = self.type or UNKOWN_TYPE
        column.expression = self.expression or self.table.quote_identifier(
            self.column_name
        )
        column.description = self.description
        column.is_aggregation = False
        column.is_dimensional = self.groupby
        column.is_filterable = self.filterable
        column.is_increase_desired = True
        column.is_managed_externally = self.table.is_managed_externally
        column.is_partition = False
        column.is_physical = not self.expression
        column.is_spatial = False
        column.is_temporal = self.is_dttm
        column.extra_json = json.dumps(extra_json) if extra_json else None
        column.external_url = self.table.external_url

        return column

    @staticmethod
    def after_delete(  # pylint: disable=unused-argument
        mapper: Mapper,
        connection: Connection,
        target: "TableColumn",
    ) -> None:
        session = inspect(target).session
        column = session.query(NewColumn).filter_by(uuid=target.uuid).one_or_none()
        if column:
            session.delete(column)


class SqlMetric(Model, BaseMetric, CertificationMixin):

    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = "sql_metrics"
    __table_args__ = (UniqueConstraint("table_id", "metric_name"),)
    table_id = Column(Integer, ForeignKey("tables.id"))
    table = relationship(
        "SqlaTable",
        backref=backref("metrics", cascade="all, delete-orphan"),
        foreign_keys=[table_id],
    )
    expression = Column(MediumText(), nullable=False)
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
    update_from_object_fields = list(s for s in export_fields if s != "table_id")
    export_parent = "table"

    def get_sqla_col(self, label: Optional[str] = None) -> Column:
        label = label or self.metric_name
        tp = self.table.get_template_processor()
        sqla_col: ColumnClause = literal_column(tp.process_template(self.expression))
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

    def to_sl_column(
        self, known_columns: Optional[Dict[str, NewColumn]] = None
    ) -> NewColumn:
        """Convert a SqlMetric to NewColumn. Find and update existing or
        create a new one."""
        session: Session = inspect(self).session
        column = known_columns.get(self.uuid) if known_columns else None
        if not column:
            column = NewColumn()

        extra_json = self.get_extra_dict()
        for attr in {"verbose_name", "metric_type", "d3format"}:
            value = getattr(self, attr)
            if value is not None:
                extra_json[attr] = value
        is_additive = (
            self.metric_type and self.metric_type.lower() in ADDITIVE_METRIC_TYPES_LOWER
        )

        if not column.id:
            with session.no_autoflush:
                saved_column = (
                    session.query(NewColumn).filter_by(uuid=self.uuid).one_or_none()
                )
                if saved_column:
                    logger.warning(
                        "sl_column already exists. Assigning existing id %s", self
                    )
                    # uuid isn't a primary key, so add the id of the existing column to
                    # ensure that the column is modified instead of created
                    # in order to avoid a uuid collision
                    column.id = saved_column.id

        column.uuid = self.uuid
        column.name = self.metric_name
        column.created_on = self.created_on
        column.changed_on = self.changed_on
        column.created_by = self.created_by
        column.changed_by = self.changed_by
        column.type = UNKOWN_TYPE
        column.expression = self.expression
        column.warning_text = self.warning_text
        column.description = self.description
        column.is_aggregation = True
        column.is_additive = is_additive
        column.is_filterable = False
        column.is_increase_desired = True
        column.is_managed_externally = self.table.is_managed_externally
        column.is_partition = False
        column.is_physical = False
        column.is_spatial = False
        column.extra_json = json.dumps(extra_json) if extra_json else None
        column.external_url = self.table.external_url

        return column

    @staticmethod
    def after_delete(  # pylint: disable=unused-argument
        mapper: Mapper,
        connection: Connection,
        target: "SqlMetric",
    ) -> None:
        session = inspect(target).session
        column = session.query(NewColumn).filter_by(uuid=target.uuid).one_or_none()
        if column:
            session.delete(column)


sqlatable_user = Table(
    "sqlatable_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("table_id", Integer, ForeignKey("tables.id")),
)


def _process_sql_expression(
    expression: Optional[str],
    database_id: int,
    schema: str,
    template_processor: Optional[BaseTemplateProcessor],
) -> Optional[str]:
    if template_processor and expression:
        expression = template_processor.process_template(expression)
    if expression:
        expression = validate_adhoc_subquery(
            expression,
            database_id,
            schema,
        )
        try:
            expression = sanitize_clause(expression)
        except QueryClauseValidationException as ex:
            raise QueryObjectValidationError(ex.message) from ex
    return expression


class SqlaTable(Model, BaseDatasource):  # pylint: disable=too-many-public-methods
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

    # Note this uniqueness constraint is not part of the physical schema, i.e., it does
    # not exist in the migrations, but is required by `import_from_dict` to ensure the
    # correct filters are applied in order to identify uniqueness.
    #
    # The reason it does not physically exist is MySQL, PostgreSQL, etc. have a
    # different interpretation of uniqueness when it comes to NULL which is problematic
    # given the schema is optional.
    __table_args__ = (UniqueConstraint("database_id", "schema", "table_name"),)

    table_name = Column(String(250), nullable=False)
    main_dttm_col = Column(String(250))
    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=False)
    fetch_values_predicate = Column(Text)
    owners = relationship(owner_class, secondary=sqlatable_user, backref="tables")
    database: Database = relationship(
        "Database",
        backref=backref("tables", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )
    schema = Column(String(255))
    sql = Column(MediumText())
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

    @staticmethod
    def _apply_cte(sql: str, cte: Optional[str]) -> str:
        """
        Append a CTE before the SELECT statement if defined

        :param sql: SELECT statement
        :param cte: CTE statement
        :return:
        """
        if cte:
            sql = f"{cte}\n{sql}"
        return sql

    @property
    def db_engine_spec(self) -> Type[BaseEngineSpec]:
        return self.database.db_engine_spec

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
        """
        Return this dataset permission name
        :return: dataset permission name
        :raises DatasetInvalidPermissionEvaluationException: When database is missing
        """
        if self.database is None:
            raise DatasetInvalidPermissionEvaluationException()
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
        # todo(yongjie): create a pysical table column type in seprated PR
        if self.sql:
            return get_virtual_table_metadata(dataset=self)  # type: ignore
        return get_physical_table_metadata(
            database=self.database,
            table_name=self.table_name,
            schema_name=self.schema,
        )

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

    @property
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
            return self.text(tp.process_template(self.fetch_values_predicate))
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _(
                    "Error in jinja expression in fetch values predicate: %(msg)s",
                    msg=ex.message,
                )
            ) from ex

    def values_for_column(self, column_name: str, limit: int = 10000) -> List[Any]:
        """Runs query against sqla to retrieve some
        sample values for the given column.
        """
        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name]
        tp = self.get_template_processor()
        tbl, cte = self.get_from_clause(tp)

        qry = select([target_col.get_sqla_col()]).select_from(tbl).distinct()
        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            qry = qry.where(self.get_fetch_values_predicate())

        engine = self.database.get_sqla_engine()
        sql = qry.compile(engine, compile_kwargs={"literal_binds": True})
        sql = self._apply_cte(sql, cte)
        sql = self.mutate_query_from_config(sql)

        df = pd.read_sql_query(sql=sql, con=engine)
        return df[column_name].to_list()

    def mutate_query_from_config(self, sql: str) -> str:
        """Apply config's SQL_QUERY_MUTATOR

        Typically adds comments to the query with context"""
        sql_query_mutator = config["SQL_QUERY_MUTATOR"]
        if sql_query_mutator:
            sql = sql_query_mutator(
                sql,
                # TODO(john-bodley): Deprecate in 3.0.
                user_name=get_username(),
                security_manager=security_manager,
                database=self.database,
            )
        return sql

    def get_template_processor(self, **kwargs: Any) -> BaseTemplateProcessor:
        return get_template_processor(table=self, database=self.database, **kwargs)

    def get_query_str_extended(self, query_obj: QueryObjectDict) -> QueryStringExtended:
        sqlaq = self.get_sqla_query(**query_obj)
        sql = self.database.compile_sqla_query(sqlaq.sqla_query)
        sql = self._apply_cte(sql, sqlaq.cte)
        sql = sqlparse.format(sql, reindent=True)
        sql = self.mutate_query_from_config(sql)
        return QueryStringExtended(
            applied_template_filters=sqlaq.applied_template_filters,
            labels_expected=sqlaq.labels_expected,
            prequeries=sqlaq.prequeries,
            sql=sql,
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
    ) -> Tuple[Union[TableClause, Alias], Optional[str]]:
        """
        Return where to select the columns and metrics from. Either a physical table
        or a virtual table with it's own subquery. If the FROM is referencing a
        CTE, the CTE is returned as the second value in the return tuple.
        """
        if not self.is_virtual:
            return self.get_sqla_table(), None

        from_sql = self.get_rendered_sql(template_processor)
        parsed_query = ParsedQuery(from_sql)
        if not (
            parsed_query.is_unknown()
            or self.db_engine_spec.is_readonly_query(parsed_query)
        ):
            raise QueryObjectValidationError(
                _("Virtual dataset query must be read-only")
            )

        cte = self.db_engine_spec.get_cte_query(from_sql)
        from_clause = (
            table(CTE_ALIAS)
            if cte
            else TextAsFrom(self.text(from_sql), []).alias(VIRTUAL_TABLE_ALIAS)
        )

        return from_clause, cte

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
                ) from ex
        sql = sqlparse.format(sql.strip("\t\r\n; "), strip_comments=True)
        if not sql:
            raise QueryObjectValidationError(_("Virtual dataset query cannot be empty"))
        if len(sqlparse.split(sql)) > 1:
            raise QueryObjectValidationError(
                _("Virtual dataset query cannot consist of multiple statements")
            )
        return sql

    def adhoc_metric_to_sqla(
        self,
        metric: AdhocMetric,
        columns_by_name: Dict[str, TableColumn],
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> ColumnElement:
        """
        Turn an adhoc metric into a sqlalchemy column.

        :param dict metric: Adhoc metric definition
        :param dict columns_by_name: Columns for the current table
        :param template_processor: template_processor instance
        :returns: The metric defined as a sqlalchemy column
        :rtype: sqlalchemy.sql.column
        """
        expression_type = metric.get("expressionType")
        label = utils.get_metric_name(metric)

        if expression_type == utils.AdhocMetricExpressionType.SIMPLE:
            metric_column = metric.get("column") or {}
            column_name = cast(str, metric_column.get("column_name"))
            table_column: Optional[TableColumn] = columns_by_name.get(column_name)
            if table_column:
                sqla_column = table_column.get_sqla_col()
            else:
                sqla_column = column(column_name)
            sqla_metric = self.sqla_aggregations[metric["aggregate"]](sqla_column)
        elif expression_type == utils.AdhocMetricExpressionType.SQL:
            expression = _process_sql_expression(
                expression=metric["sqlExpression"],
                database_id=self.database_id,
                schema=self.schema,
                template_processor=template_processor,
            )
            sqla_metric = literal_column(expression)
        else:
            raise QueryObjectValidationError("Adhoc metric expressionType is invalid")

        return self.make_sqla_column_compatible(sqla_metric, label)

    def adhoc_column_to_sqla(
        self,
        col: AdhocColumn,
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> ColumnElement:
        """
        Turn an adhoc column into a sqlalchemy column.

        :param col: Adhoc column definition
        :param template_processor: template_processor instance
        :returns: The metric defined as a sqlalchemy column
        :rtype: sqlalchemy.sql.column
        """
        label = utils.get_column_name(col)
        expression = _process_sql_expression(
            expression=col["sqlExpression"],
            database_id=self.database_id,
            schema=self.schema,
            template_processor=template_processor,
        )
        sqla_column = literal_column(expression)
        return self.make_sqla_column_compatible(sqla_column, label)

    def make_sqla_column_compatible(
        self, sqla_col: ColumnElement, label: Optional[str] = None
    ) -> ColumnElement:
        """Takes a sqlalchemy column object and adds label info if supported by engine.
        :param sqla_col: sqlalchemy column instance
        :param label: alias/label that column is expected to have
        :return: either a sql alchemy column or label instance if supported by engine
        """
        label_expected = label or sqla_col.name
        db_engine_spec = self.db_engine_spec
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
        if self.db_engine_spec.allows_alias_to_source_column:
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

    def get_sqla_row_level_filters(
        self,
        template_processor: BaseTemplateProcessor,
        username: Optional[str] = None,
    ) -> List[TextClause]:
        """
        Return the appropriate row level security filters for this table and the
        current user. A custom username can be passed when the user is not present in the
        Flask global namespace.

        :param template_processor: The template processor to apply to the filters.
        :param username: Optional username if there's no user in the Flask global
        namespace.
        :returns: A list of SQL clauses to be ANDed together.
        """
        all_filters: List[TextClause] = []
        filter_groups: Dict[Union[int, str], List[TextClause]] = defaultdict(list)
        try:
            for filter_ in security_manager.get_rls_filters(self, username):
                clause = self.text(
                    f"({template_processor.process_template(filter_.clause)})"
                )
                if filter_.group_key:
                    filter_groups[filter_.group_key].append(clause)
                else:
                    all_filters.append(clause)

            if is_feature_enabled("EMBEDDED_SUPERSET"):
                for rule in security_manager.get_guest_rls_filters(self):
                    clause = self.text(
                        f"({template_processor.process_template(rule['clause'])})"
                    )
                    all_filters.append(clause)

            grouped_filters = [or_(*clauses) for clauses in filter_groups.values()]
            all_filters.extend(grouped_filters)
            return all_filters
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _(
                    "Error in jinja expression in RLS filters: %(msg)s",
                    msg=ex.message,
                )
            ) from ex

    def text(self, clause: str) -> TextClause:
        return self.db_engine_spec.get_text_clause(clause)

    def get_sqla_query(  # pylint: disable=too-many-arguments,too-many-locals,too-many-branches,too-many-statements
        self,
        apply_fetch_values_predicate: bool = False,
        columns: Optional[List[Column]] = None,
        extras: Optional[Dict[str, Any]] = None,
        filter: Optional[  # pylint: disable=redefined-builtin
            List[QueryObjectFilterClause]
        ] = None,
        from_dttm: Optional[datetime] = None,
        granularity: Optional[str] = None,
        groupby: Optional[List[Column]] = None,
        inner_from_dttm: Optional[datetime] = None,
        inner_to_dttm: Optional[datetime] = None,
        is_rowcount: bool = False,
        is_timeseries: bool = True,
        metrics: Optional[List[Metric]] = None,
        orderby: Optional[List[OrderBy]] = None,
        order_desc: bool = True,
        to_dttm: Optional[datetime] = None,
        series_columns: Optional[List[Column]] = None,
        series_limit: Optional[int] = None,
        series_limit_metric: Optional[Metric] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        timeseries_limit: Optional[int] = None,
        timeseries_limit_metric: Optional[Metric] = None,
    ) -> SqlaQuery:
        """Querying any sqla table from this common interface"""
        if granularity not in self.dttm_cols and granularity is not None:
            granularity = self.main_dttm_col

        extras = extras or {}
        time_grain = extras.get("time_grain_sqla")

        template_kwargs = {
            "columns": columns,
            "from_dttm": from_dttm.isoformat() if from_dttm else None,
            "groupby": groupby,
            "metrics": metrics,
            "row_limit": row_limit,
            "row_offset": row_offset,
            "time_column": granularity,
            "time_grain": time_grain,
            "to_dttm": to_dttm.isoformat() if to_dttm else None,
            "table_columns": [col.column_name for col in self.columns],
            "filter": filter,
        }
        columns = columns or []
        groupby = groupby or []
        series_column_names = utils.get_column_names(series_columns or [])
        # deprecated, to be removed in 2.0
        if is_timeseries and timeseries_limit:
            series_limit = timeseries_limit
        series_limit_metric = series_limit_metric or timeseries_limit_metric
        template_kwargs.update(self.template_params_dict)
        extra_cache_keys: List[Any] = []
        template_kwargs["extra_cache_keys"] = extra_cache_keys
        removed_filters: List[str] = []
        applied_template_filters: List[str] = []
        template_kwargs["removed_filters"] = removed_filters
        template_kwargs["applied_filters"] = applied_template_filters
        template_processor = self.get_template_processor(**template_kwargs)
        db_engine_spec = self.db_engine_spec
        prequeries: List[str] = []
        orderby = orderby or []
        need_groupby = bool(metrics is not None or groupby)
        metrics = metrics or []

        # For backward compatibility
        if granularity not in self.dttm_cols and granularity is not None:
            granularity = self.main_dttm_col

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
                metrics_exprs.append(
                    self.adhoc_metric_to_sqla(
                        metric=metric,
                        columns_by_name=columns_by_name,
                        template_processor=template_processor,
                    )
                )
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
        # use the key of the ColumnClause for the expected label
        metrics_exprs_by_label = {m.key: m for m in metrics_exprs}
        metrics_exprs_by_expr = {str(m): m for m in metrics_exprs}

        # Since orderby may use adhoc metrics, too; we need to process them first
        orderby_exprs: List[ColumnElement] = []
        for orig_col, ascending in orderby:
            col: Union[AdhocMetric, ColumnElement] = orig_col
            if isinstance(col, dict):
                col = cast(AdhocMetric, col)
                if col.get("sqlExpression"):
                    col["sqlExpression"] = _process_sql_expression(
                        expression=col["sqlExpression"],
                        database_id=self.database_id,
                        schema=self.schema,
                        template_processor=template_processor,
                    )
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
        groupby_all_columns = {}
        groupby_series_columns = {}

        # filter out the pseudo column  __timestamp from columns
        columns = [col for col in columns if col != utils.DTTM_ALIAS]
        dttm_col = columns_by_name.get(granularity) if granularity else None

        if need_groupby:
            # dedup columns while preserving order
            columns = groupby or columns
            for selected in columns:
                if isinstance(selected, str):
                    # if groupby field/expr equals granularity field/expr
                    if selected == granularity:
                        table_col = columns_by_name[selected]
                        outer = table_col.get_timestamp_expression(
                            time_grain=time_grain,
                            label=selected,
                            template_processor=template_processor,
                        )
                    # if groupby field equals a selected column
                    elif selected in columns_by_name:
                        outer = columns_by_name[selected].get_sqla_col()
                    else:
                        selected = validate_adhoc_subquery(
                            selected,
                            self.database_id,
                            self.schema,
                        )
                        outer = literal_column(f"({selected})")
                        outer = self.make_sqla_column_compatible(outer, selected)
                else:
                    outer = self.adhoc_column_to_sqla(
                        col=selected, template_processor=template_processor
                    )
                groupby_all_columns[outer.name] = outer
                if not series_column_names or outer.name in series_column_names:
                    groupby_series_columns[outer.name] = outer
                select_exprs.append(outer)
        elif columns:
            for selected in columns:
                selected = validate_adhoc_subquery(
                    selected,
                    self.database_id,
                    self.schema,
                )
                select_exprs.append(
                    columns_by_name[selected].get_sqla_col()
                    if selected in columns_by_name
                    else self.make_sqla_column_compatible(literal_column(selected))
                )
            metrics_exprs = []

        if granularity:
            if granularity not in columns_by_name or not dttm_col:
                raise QueryObjectValidationError(
                    _(
                        'Time column "%(col)s" does not exist in dataset',
                        col=granularity,
                    )
                )
            time_filters = []

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(
                    time_grain=time_grain, template_processor=template_processor
                )
                # always put timestamp as the first column
                select_exprs.insert(0, timestamp)
                groupby_all_columns[timestamp.name] = timestamp

            # Use main dttm column to support index with secondary dttm columns.
            if (
                db_engine_spec.time_secondary_columns
                and self.main_dttm_col in self.dttm_cols
                and self.main_dttm_col != dttm_col.column_name
            ):
                time_filters.append(
                    columns_by_name[self.main_dttm_col].get_time_filter(
                        from_dttm,
                        to_dttm,
                    )
                )
            time_filters.append(dttm_col.get_time_filter(from_dttm, to_dttm))

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

        tbl, cte = self.get_from_clause(template_processor)

        if groupby_all_columns:
            qry = qry.group_by(*groupby_all_columns.values())

        where_clause_and = []
        having_clause_and = []

        for flt in filter:  # type: ignore
            if not all(flt.get(s) for s in ["col", "op"]):
                continue
            flt_col = flt["col"]
            val = flt.get("val")
            op = flt["op"].upper()
            col_obj: Optional[TableColumn] = None
            sqla_col: Optional[Column] = None
            if flt_col == utils.DTTM_ALIAS and is_timeseries and dttm_col:
                col_obj = dttm_col
            elif is_adhoc_column(flt_col):
                sqla_col = self.adhoc_column_to_sqla(flt_col)
            else:
                col_obj = columns_by_name.get(flt_col)
            filter_grain = flt.get("grain")

            if is_feature_enabled("ENABLE_TEMPLATE_REMOVE_FILTERS"):
                if get_column_name(flt_col) in removed_filters:
                    # Skip generating SQLA filter when the jinja template handles it.
                    continue

            if col_obj or sqla_col is not None:
                if sqla_col is not None:
                    pass
                elif col_obj and filter_grain:
                    sqla_col = col_obj.get_timestamp_expression(
                        time_grain=filter_grain, template_processor=template_processor
                    )
                elif col_obj:
                    sqla_col = col_obj.get_sqla_col()
                col_type = col_obj.type if col_obj else None
                col_spec = db_engine_spec.get_column_spec(
                    native_type=col_type,
                    db_extra=self.database.get_extra(),
                )
                is_list_target = op in (
                    utils.FilterOperator.IN.value,
                    utils.FilterOperator.NOT_IN.value,
                )

                col_advanced_data_type = col_obj.advanced_data_type if col_obj else ""

                if col_spec and not col_advanced_data_type:
                    target_generic_type = col_spec.generic_type
                else:
                    target_generic_type = GenericDataType.STRING
                eq = self.filter_values_handler(
                    values=val,
                    target_generic_type=target_generic_type,
                    target_native_type=col_type,
                    is_list_target=is_list_target,
                    db_engine_spec=db_engine_spec,
                    db_extra=self.database.get_extra(),
                )
                if (
                    col_advanced_data_type != ""
                    and feature_flag_manager.is_feature_enabled(
                        "ENABLE_ADVANCED_DATA_TYPES"
                    )
                    and col_advanced_data_type in ADVANCED_DATA_TYPES
                ):
                    values = eq if is_list_target else [eq]  # type: ignore
                    bus_resp: AdvancedDataTypeResponse = ADVANCED_DATA_TYPES[
                        col_advanced_data_type
                    ].translate_type(
                        {
                            "type": col_advanced_data_type,
                            "values": values,
                        }
                    )
                    if bus_resp["error_message"]:
                        raise AdvancedDataTypeResponseError(
                            _(bus_resp["error_message"])
                        )

                    where_clause_and.append(
                        ADVANCED_DATA_TYPES[col_advanced_data_type].translate_filter(
                            sqla_col, op, bus_resp["values"]
                        )
                    )
                elif is_list_target:
                    assert isinstance(eq, (tuple, list))
                    if len(eq) == 0:
                        raise QueryObjectValidationError(
                            _("Filter value list cannot be empty")
                        )
                    if len(eq) > len(
                        eq_without_none := [x for x in eq if x is not None]
                    ):
                        is_null_cond = sqla_col.is_(None)
                        if eq:
                            cond = or_(is_null_cond, sqla_col.in_(eq_without_none))
                        else:
                            cond = is_null_cond
                    else:
                        cond = sqla_col.in_(eq)
                    if op == utils.FilterOperator.NOT_IN.value:
                        cond = ~cond
                    where_clause_and.append(cond)
                elif op == utils.FilterOperator.IS_NULL.value:
                    where_clause_and.append(sqla_col.is_(None))
                elif op == utils.FilterOperator.IS_NOT_NULL.value:
                    where_clause_and.append(sqla_col.isnot(None))
                elif op == utils.FilterOperator.IS_TRUE.value:
                    where_clause_and.append(sqla_col.is_(True))
                elif op == utils.FilterOperator.IS_FALSE.value:
                    where_clause_and.append(sqla_col.is_(False))
                else:
                    if eq is None:
                        raise QueryObjectValidationError(
                            _(
                                "Must specify a value for filters "
                                "with comparison operators"
                            )
                        )
                    if op == utils.FilterOperator.EQUALS.value:
                        where_clause_and.append(sqla_col == eq)
                    elif op == utils.FilterOperator.NOT_EQUALS.value:
                        where_clause_and.append(sqla_col != eq)
                    elif op == utils.FilterOperator.GREATER_THAN.value:
                        where_clause_and.append(sqla_col > eq)
                    elif op == utils.FilterOperator.LESS_THAN.value:
                        where_clause_and.append(sqla_col < eq)
                    elif op == utils.FilterOperator.GREATER_THAN_OR_EQUALS.value:
                        where_clause_and.append(sqla_col >= eq)
                    elif op == utils.FilterOperator.LESS_THAN_OR_EQUALS.value:
                        where_clause_and.append(sqla_col <= eq)
                    elif op == utils.FilterOperator.LIKE.value:
                        where_clause_and.append(sqla_col.like(eq))
                    elif op == utils.FilterOperator.ILIKE.value:
                        where_clause_and.append(sqla_col.ilike(eq))
                    else:
                        raise QueryObjectValidationError(
                            _("Invalid filter operation type: %(op)s", op=op)
                        )
        where_clause_and += self.get_sqla_row_level_filters(template_processor)
        if extras:
            where = extras.get("where")
            if where:
                try:
                    where = template_processor.process_template(f"({where})")
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in WHERE clause: %(msg)s",
                            msg=ex.message,
                        )
                    ) from ex
                where_clause_and += [self.text(where)]
            having = extras.get("having")
            if having:
                try:
                    having = template_processor.process_template(f"({having})")
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in HAVING clause: %(msg)s",
                            msg=ex.message,
                        )
                    ) from ex
                having_clause_and += [self.text(having)]
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

            if (
                db_engine_spec.allows_alias_in_select
                and db_engine_spec.allows_hidden_cc_in_orderby
                and col.name in [select_col.name for select_col in select_exprs]
            ):
                col = literal_column(col.name)
            direction = asc if ascending else desc
            qry = qry.order_by(direction(col))

        if row_limit:
            qry = qry.limit(row_limit)
        if row_offset:
            qry = qry.offset(row_offset)

        if series_limit and groupby_series_columns:
            if db_engine_spec.allows_joins and db_engine_spec.allows_subqueries:
                # some sql dialects require for order by expressions
                # to also be in the select clause -- others, e.g. vertica,
                # require a unique inner alias
                inner_main_metric_expr = self.make_sqla_column_compatible(
                    main_metric_expr, "mme_inner__"
                )
                inner_groupby_exprs = []
                inner_select_exprs = []
                for gby_name, gby_obj in groupby_series_columns.items():
                    label = get_column_name(gby_name)
                    inner = self.make_sqla_column_compatible(gby_obj, gby_name + "__")
                    inner_groupby_exprs.append(inner)
                    inner_select_exprs.append(inner)

                inner_select_exprs += [inner_main_metric_expr]
                subq = select(inner_select_exprs).select_from(tbl)
                inner_time_filter = []

                if dttm_col and not db_engine_spec.time_groupby_inline:
                    inner_time_filter = [
                        dttm_col.get_time_filter(
                            inner_from_dttm or from_dttm,
                            inner_to_dttm or to_dttm,
                        )
                    ]
                subq = subq.where(and_(*(where_clause_and + inner_time_filter)))
                subq = subq.group_by(*inner_groupby_exprs)

                ob = inner_main_metric_expr
                if series_limit_metric:
                    ob = self._get_series_orderby(
                        series_limit_metric, metrics_by_name, columns_by_name
                    )
                direction = desc if order_desc else asc
                subq = subq.order_by(direction(ob))
                subq = subq.limit(series_limit)

                on_clause = []
                for gby_name, gby_obj in groupby_series_columns.items():
                    # in this case the column name, not the alias, needs to be
                    # conditionally mutated, as it refers to the column alias in
                    # the inner query
                    col_name = db_engine_spec.make_label_compatible(gby_name + "__")
                    on_clause.append(gby_obj == column(col_name))

                tbl = tbl.join(subq.alias(), and_(*on_clause))
            else:
                if series_limit_metric:
                    orderby = [
                        (
                            self._get_series_orderby(
                                series_limit_metric,
                                metrics_by_name,
                                columns_by_name,
                            ),
                            not order_desc,
                        )
                    ]

                # run prequery to get top groups
                prequery_obj = {
                    "is_timeseries": False,
                    "row_limit": series_limit,
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
                    if c not in metrics and c in groupby_series_columns
                ]
                top_groups = self._get_top_groups(
                    result.df, dimensions, groupby_series_columns, columns_by_name
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
            applied_template_filters=applied_template_filters,
            cte=cte,
            extra_cache_keys=extra_cache_keys,
            labels_expected=labels_expected,
            sqla_query=qry,
            prequeries=prequeries,
        )

    def _get_series_orderby(
        self,
        series_limit_metric: Metric,
        metrics_by_name: Dict[str, SqlMetric],
        columns_by_name: Dict[str, TableColumn],
    ) -> Column:
        if utils.is_adhoc_metric(series_limit_metric):
            assert isinstance(series_limit_metric, dict)
            ob = self.adhoc_metric_to_sqla(series_limit_metric, columns_by_name)
        elif (
            isinstance(series_limit_metric, str)
            and series_limit_metric in metrics_by_name
        ):
            ob = metrics_by_name[series_limit_metric].get_sqla_col()
        else:
            raise QueryObjectValidationError(
                _("Metric '%(metric)s' does not exist", metric=series_limit_metric)
            )
        return ob

    def _normalize_prequery_result_type(
        self,
        row: pd.Series,
        dimension: str,
        columns_by_name: Dict[str, TableColumn],
    ) -> Union[str, int, float, bool, Text]:
        """
        Convert a prequery result type to its equivalent Python type.

        Some databases like Druid will return timestamps as strings, but do not perform
        automatic casting when comparing these strings to a timestamp. For cases like
        this we convert the value via the appropriate SQL transform.

        :param row: A prequery record
        :param dimension: The dimension name
        :param columns_by_name: The mapping of columns by name
        :return: equivalent primitive python type
        """

        value = row[dimension]

        if isinstance(value, np.generic):
            value = value.item()

        column_ = columns_by_name[dimension]
        db_extra: Dict[str, Any] = self.database.get_extra()

        if column_.type and column_.is_temporal and isinstance(value, str):
            sql = self.db_engine_spec.convert_dttm(
                column_.type, dateutil.parser.parse(value), db_extra=db_extra
            )

            if sql:
                value = self.text(sql)

        return value

    def _get_top_groups(
        self,
        df: pd.DataFrame,
        dimensions: List[str],
        groupby_exprs: Dict[str, Any],
        columns_by_name: Dict[str, TableColumn],
    ) -> ColumnElement:
        groups = []
        for _unused, row in df.iterrows():
            group = []
            for dimension in dimensions:
                value = self._normalize_prequery_result_type(
                    row,
                    dimension,
                    columns_by_name,
                )

                group.append(groupby_exprs[dimension] == value)
            groups.append(and_(*group))

        return or_(*groups)

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        qry_start_dttm = datetime.now()
        query_str_ext = self.get_query_str_extended(query_obj)
        sql = query_str_ext.sql
        status = QueryStatus.SUCCESS
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
            status = QueryStatus.FAILED
            logger.warning(
                "Query %s on schema %s failed", sql, self.schema, exc_info=True
            )
            db_engine_spec = self.db_engine_spec
            errors = [
                dataclasses.asdict(error) for error in db_engine_spec.extract_errors(ex)
            ]
            error_message = utils.error_msg_from_exception(ex)

        return QueryResult(
            applied_template_filters=query_str_ext.applied_template_filters,
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
        db_engine_spec = self.db_engine_spec

        # If no `self.id`, then this is a new table, no need to fetch columns
        # from db.  Passing in `self.id` to query will actually automatically
        # generate a new id, which can be tricky during certain transactions.
        old_columns = (
            (
                db.session.query(TableColumn)
                .filter(TableColumn.table_id == self.id)
                .all()
            )
            if self.id
            else self.columns
        )

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
        columns = []
        for col in new_columns:
            old_column = old_columns_by_name.pop(col["name"], None)
            if not old_column:
                results.added.append(col["name"])
                new_column = TableColumn(
                    column_name=col["name"],
                    type=col["type"],
                    table=self,
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
            columns.append(new_column)
            if not any_date_col and new_column.is_temporal:
                any_date_col = col["name"]

        # add back calculated (virtual) columns
        columns.extend([col for col in old_columns if col.expression])
        self.columns = columns

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
        if self.is_rls_supported:
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

    @property
    def quote_identifier(self) -> Callable[[str], str]:
        return self.database.quote_identifier

    @staticmethod
    def before_update(
        mapper: Mapper,  # pylint: disable=unused-argument
        connection: Connection,  # pylint: disable=unused-argument
        target: "SqlaTable",
    ) -> None:
        """
        Check before update if the target table already exists.

        Note this listener is called when any fields are being updated and thus it is
        necessary to first check whether the reference table is being updated.

        Note this logic is temporary, given uniqueness is handled via the dataset DAO,
        but is necessary until both the legacy datasource editor and datasource/save
        endpoints are deprecated.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        :raises Exception: If the target table is not unique
        """

        # pylint: disable=import-outside-toplevel
        from superset.datasets.commands.exceptions import get_dataset_exist_error_msg
        from superset.datasets.dao import DatasetDAO

        # Check whether the relevant attributes have changed.
        state = db.inspect(target)  # pylint: disable=no-member

        for attr in ["database_id", "schema", "table_name"]:
            history = state.get_history(attr, True)
            if history.has_changes():
                break
        else:
            return None

        if not DatasetDAO.validate_uniqueness(
            target.database_id, target.schema, target.table_name, target.id
        ):
            raise Exception(get_dataset_exist_error_msg(target.full_name))

    def get_sl_columns(self) -> List[NewColumn]:
        """
        Convert `SqlaTable.columns` and `SqlaTable.metrics` to the new Column model
        """
        session: Session = inspect(self).session

        uuids = set()
        for column_or_metric in self.columns + self.metrics:
            # pre-assign uuid after new columns or metrics are inserted so
            # the related `NewColumn` can have a deterministic uuid, too
            if not column_or_metric.uuid:
                column_or_metric.uuid = uuid4()
            else:
                uuids.add(column_or_metric.uuid)

        # load existing columns from cached session states first
        existing_columns = set(
            find_cached_objects_in_session(session, NewColumn, uuids=uuids)
        )
        for column in existing_columns:
            uuids.remove(column.uuid)

        if uuids:
            with session.no_autoflush:
                # load those not found from db
                existing_columns |= set(
                    session.query(NewColumn).filter(NewColumn.uuid.in_(uuids))
                )

        known_columns = {column.uuid: column for column in existing_columns}
        return [
            item.to_sl_column(known_columns) for item in self.columns + self.metrics
        ]

    @staticmethod
    def update_column(  # pylint: disable=unused-argument
        mapper: Mapper, connection: Connection, target: Union[SqlMetric, TableColumn]
    ) -> None:
        """
        :param mapper: Unused.
        :param connection: Unused.
        :param target: The metric or column that was updated.
        """
        inspector = inspect(target)
        session = inspector.session

        # Forces an update to the table's changed_on value when a metric or column on the
        # table is updated. This busts the cache key for all charts that use the table.
        session.execute(update(SqlaTable).where(SqlaTable.id == target.table.id))

        # if table itself has changed, shadow-writing will happen in `after_update` anyway
        if target.table not in session.dirty:
            dataset: NewDataset = (
                session.query(NewDataset)
                .filter_by(uuid=target.table.uuid)
                .one_or_none()
            )
            # Update shadow dataset and columns
            # did we find the dataset?
            if not dataset:
                # if dataset is not found create a new copy
                target.table.write_shadow_dataset()
                return

            # update changed_on timestamp
            session.execute(update(NewDataset).where(NewDataset.id == dataset.id))
            try:
                with session.no_autoflush:
                    column = session.query(NewColumn).filter_by(uuid=target.uuid).one()
                    # update `Column` model as well
                    session.merge(target.to_sl_column({target.uuid: column}))
            except NoResultFound:
                logger.warning("No column was found for %s", target)
                # see if the column is in cache
                column = next(
                    find_cached_objects_in_session(
                        session, NewColumn, uuids=[target.uuid]
                    ),
                    None,
                )
                if column:
                    logger.warning("New column was found in cache: %s", column)

                else:
                    # to be safe, use a different uuid and create a new column
                    uuid = uuid4()
                    target.uuid = uuid

                session.add(target.to_sl_column())

    @staticmethod
    def after_insert(
        mapper: Mapper,
        connection: Connection,
        sqla_table: "SqlaTable",
    ) -> None:
        """
        Shadow write the dataset to new models.

        The ``SqlaTable`` model is currently being migrated to two new models, ``Table``
        and ``Dataset``. In the first phase of the migration the new models are populated
        whenever ``SqlaTable`` is modified (created, updated, or deleted).

        In the second phase of the migration reads will be done from the new models.
        Finally, in the third phase of the migration the old models will be removed.

        For more context: https://github.com/apache/superset/issues/14909
        """
        security_manager.set_perm(mapper, connection, sqla_table)
        sqla_table.write_shadow_dataset()

    @staticmethod
    def after_delete(  # pylint: disable=unused-argument
        mapper: Mapper,
        connection: Connection,
        sqla_table: "SqlaTable",
    ) -> None:
        """
        Shadow write the dataset to new models.

        The ``SqlaTable`` model is currently being migrated to two new models, ``Table``
        and ``Dataset``. In the first phase of the migration the new models are populated
        whenever ``SqlaTable`` is modified (created, updated, or deleted).

        In the second phase of the migration reads will be done from the new models.
        Finally, in the third phase of the migration the old models will be removed.

        For more context: https://github.com/apache/superset/issues/14909
        """
        session = inspect(sqla_table).session
        dataset = (
            session.query(NewDataset).filter_by(uuid=sqla_table.uuid).one_or_none()
        )
        if dataset:
            session.delete(dataset)

    @staticmethod
    def after_update(
        mapper: Mapper,
        connection: Connection,
        sqla_table: "SqlaTable",
    ) -> None:
        """
        Shadow write the dataset to new models.

        The ``SqlaTable`` model is currently being migrated to two new models, ``Table``
        and ``Dataset``. In the first phase of the migration the new models are populated
        whenever ``SqlaTable`` is modified (created, updated, or deleted).

        In the second phase of the migration reads will be done from the new models.
        Finally, in the third phase of the migration the old models will be removed.

        For more context: https://github.com/apache/superset/issues/14909
        """
        # set permissions
        security_manager.set_perm(mapper, connection, sqla_table)

        inspector = inspect(sqla_table)
        session = inspector.session

        # double-check that ``UPDATE``s are actually pending (this method is called even
        # for instances that have no net changes to their column-based attributes)
        if not session.is_modified(sqla_table, include_collections=True):
            return

        # find the dataset from the known instance list first
        # (it could be either from a previous query or newly created)
        dataset = next(
            find_cached_objects_in_session(
                session, NewDataset, uuids=[sqla_table.uuid]
            ),
            None,
        )
        # if not found, pull from database
        if not dataset:
            dataset = (
                session.query(NewDataset).filter_by(uuid=sqla_table.uuid).one_or_none()
            )
        if not dataset:
            sqla_table.write_shadow_dataset()
            return

        # sync column list and delete removed columns
        if (
            inspector.attrs.columns.history.has_changes()
            or inspector.attrs.metrics.history.has_changes()
        ):
            # add pending new columns to known columns list, too, so if calling
            # `after_update` twice before changes are persisted will not create
            # two duplicate columns with the same uuids.
            dataset.columns = sqla_table.get_sl_columns()

        # physical dataset
        if not sqla_table.sql:
            # if the table name changed we should relink the dataset to another table
            # (and create one if necessary)
            if (
                inspector.attrs.table_name.history.has_changes()
                or inspector.attrs.schema.history.has_changes()
                or inspector.attrs.database.history.has_changes()
            ):
                tables = NewTable.bulk_load_or_create(
                    sqla_table.database,
                    [TableName(schema=sqla_table.schema, table=sqla_table.table_name)],
                    sync_columns=False,
                    default_props=dict(
                        changed_by=sqla_table.changed_by,
                        created_by=sqla_table.created_by,
                        is_managed_externally=sqla_table.is_managed_externally,
                        external_url=sqla_table.external_url,
                    ),
                )
                if not tables[0].id:
                    # dataset columns will only be assigned to newly created tables
                    # existing tables should manage column syncing in another process
                    physical_columns = [
                        clone_model(
                            column, ignore=["uuid"], keep_relations=["changed_by"]
                        )
                        for column in dataset.columns
                        if column.is_physical
                    ]
                    tables[0].columns = physical_columns
                dataset.tables = tables

        # virtual dataset
        else:
            # mark all columns as virtual (not physical)
            for column in dataset.columns:
                column.is_physical = False

            # update referenced tables if SQL changed
            if sqla_table.sql and inspector.attrs.sql.history.has_changes():
                referenced_tables = extract_table_references(
                    sqla_table.sql, sqla_table.database.get_dialect().name
                )
                dataset.tables = NewTable.bulk_load_or_create(
                    sqla_table.database,
                    referenced_tables,
                    default_schema=sqla_table.schema,
                    # sync metadata is expensive, we'll do it in another process
                    # e.g. when users open a Table page
                    sync_columns=False,
                    default_props=dict(
                        changed_by=sqla_table.changed_by,
                        created_by=sqla_table.created_by,
                        is_managed_externally=sqla_table.is_managed_externally,
                        external_url=sqla_table.external_url,
                    ),
                )

        # update other attributes
        dataset.name = sqla_table.table_name
        dataset.expression = sqla_table.sql or sqla_table.quote_identifier(
            sqla_table.table_name
        )
        dataset.is_physical = not sqla_table.sql

    def write_shadow_dataset(
        self: "SqlaTable",
    ) -> None:
        """
        Shadow write the dataset to new models.

        The ``SqlaTable`` model is currently being migrated to two new models, ``Table``
        and ``Dataset``. In the first phase of the migration the new models are populated
        whenever ``SqlaTable`` is modified (created, updated, or deleted).

        In the second phase of the migration reads will be done from the new models.
        Finally, in the third phase of the migration the old models will be removed.

        For more context: https://github.com/apache/superset/issues/14909
        """
        session = inspect(self).session
        # make sure database points to the right instance, in case only
        # `table.database_id` is updated and the changes haven't been
        # consolidated by SQLA
        if self.database_id and (
            not self.database or self.database.id != self.database_id
        ):
            self.database = session.query(Database).filter_by(id=self.database_id).one()

        # create columns
        columns = []
        for item in self.columns + self.metrics:
            item.created_by = self.created_by
            item.changed_by = self.changed_by
            # on `SqlaTable.after_insert`` event, although the table itself
            # already has a `uuid`, the associated columns will not.
            # Here we pre-assign a uuid so they can still be matched to the new
            # Column after creation.
            if not item.uuid:
                item.uuid = uuid4()
            columns.append(item.to_sl_column())

        # physical dataset
        if not self.sql:
            # always create separate column entries for Dataset and Table
            # so updating a dataset would not update columns in the related table
            physical_columns = [
                clone_model(
                    column,
                    ignore=["uuid"],
                    # `created_by` will always be left empty because it'd always
                    # be created via some sort of automated system.
                    # But keep `changed_by` in case someone manually changes
                    # column attributes such as `is_dttm`.
                    keep_relations=["changed_by"],
                )
                for column in columns
                if column.is_physical
            ]
            tables = NewTable.bulk_load_or_create(
                self.database,
                [TableName(schema=self.schema, table=self.table_name)],
                sync_columns=False,
                default_props=dict(
                    created_by=self.created_by,
                    changed_by=self.changed_by,
                    is_managed_externally=self.is_managed_externally,
                    external_url=self.external_url,
                ),
            )
            tables[0].columns = physical_columns

        # virtual dataset
        else:
            # mark all columns as virtual (not physical)
            for column in columns:
                column.is_physical = False

            # find referenced tables
            referenced_tables = extract_table_references(
                self.sql, self.database.get_dialect().name
            )
            tables = NewTable.bulk_load_or_create(
                self.database,
                referenced_tables,
                default_schema=self.schema,
                # syncing table columns can be slow so we are not doing it here
                sync_columns=False,
                default_props=dict(
                    created_by=self.created_by,
                    changed_by=self.changed_by,
                    is_managed_externally=self.is_managed_externally,
                    external_url=self.external_url,
                ),
            )

        # create the new dataset
        new_dataset = NewDataset(
            uuid=self.uuid,
            database_id=self.database_id,
            created_on=self.created_on,
            created_by=self.created_by,
            changed_by=self.changed_by,
            changed_on=self.changed_on,
            owners=self.owners,
            name=self.table_name,
            expression=self.sql or self.quote_identifier(self.table_name),
            tables=tables,
            columns=columns,
            is_physical=not self.sql,
            is_managed_externally=self.is_managed_externally,
            external_url=self.external_url,
        )
        session.add(new_dataset)


sa.event.listen(SqlaTable, "before_update", SqlaTable.before_update)
sa.event.listen(SqlaTable, "after_insert", SqlaTable.after_insert)
sa.event.listen(SqlaTable, "after_delete", SqlaTable.after_delete)
sa.event.listen(SqlaTable, "after_update", SqlaTable.after_update)
sa.event.listen(SqlMetric, "after_update", SqlaTable.update_column)
sa.event.listen(SqlMetric, "after_delete", SqlMetric.after_delete)
sa.event.listen(TableColumn, "after_update", SqlaTable.update_column)
sa.event.listen(TableColumn, "after_delete", TableColumn.after_delete)

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
