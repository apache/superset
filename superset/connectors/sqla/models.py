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

import builtins
import dataclasses
import logging
import re
from collections.abc import Hashable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, cast

import dateutil.parser
import numpy as np
import pandas as pd
import sqlalchemy as sa
from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import User
from flask_babel import gettext as __, lazy_gettext as _
from jinja2.exceptions import TemplateError
from markupsafe import escape, Markup
from sqlalchemy import (
    and_,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    inspect,
    Integer,
    or_,
    String,
    Table as DBTable,
    Text,
    update,
)
from sqlalchemy.engine.base import Connection
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    backref,
    foreign,
    Mapped,
    Query,
    reconstructor,
    relationship,
    RelationshipProperty,
)
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import column, ColumnElement, literal_column, table
from sqlalchemy.sql.elements import ColumnClause, TextClause
from sqlalchemy.sql.expression import Label, TextAsFrom
from sqlalchemy.sql.selectable import Alias, TableClause

from superset import app, db, security_manager
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.common.db_query_status import QueryStatus
from superset.connectors.sqla.utils import (
    get_columns_description,
    get_physical_table_metadata,
    get_virtual_table_metadata,
)
from superset.constants import EMPTY_STRING, NULL_STRING
from superset.db_engine_specs.base import BaseEngineSpec, TimestampExpression
from superset.exceptions import (
    ColumnNotFoundException,
    DatasetInvalidPermissionEvaluationException,
    QueryClauseValidationException,
    QueryObjectValidationError,
    SupersetErrorException,
    SupersetErrorsException,
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
from superset.models.helpers import (
    AuditMixinNullable,
    CertificationMixin,
    ExploreMixin,
    ImportExportMixin,
    QueryResult,
    validate_adhoc_subquery,
)
from superset.models.slice import Slice
from superset.sql_parse import ParsedQuery, sanitize_clause, Table
from superset.superset_typing import (
    AdhocColumn,
    AdhocMetric,
    FilterValue,
    FilterValues,
    Metric,
    QueryObjectDict,
    ResultSetColumnType,
)
from superset.utils import core as utils, json
from superset.utils.backports import StrEnum
from superset.utils.core import GenericDataType, MediumText

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


@dataclass
class MetadataResult:
    added: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)


logger = logging.getLogger(__name__)

METRIC_FORM_DATA_PARAMS = [
    "metric",
    "metric_2",
    "metrics",
    "metrics_b",
    "percent_metrics",
    "secondary_metric",
    "size",
    "timeseries_limit_metric",
    "x",
    "y",
]

COLUMN_FORM_DATA_PARAMS = [
    "all_columns",
    "all_columns_x",
    "columns",
    "entity",
    "groupby",
    "order_by_cols",
    "series",
]


class DatasourceKind(StrEnum):
    VIRTUAL = "virtual"
    PHYSICAL = "physical"


class BaseDatasource(AuditMixinNullable, ImportExportMixin):  # pylint: disable=too-many-public-methods
    """A common interface to objects that are queryable
    (tables and datasources)"""

    # ---------------------------------------------------------------
    # class attributes to define when deriving BaseDatasource
    # ---------------------------------------------------------------
    __tablename__: str | None = None  # {connector_name}_datasource
    baselink: str | None = None  # url portion pointing to ModelView endpoint

    owner_class: User | None = None

    # Used to do code highlighting when displaying the query in the UI
    query_language: str | None = None

    # Only some datasources support Row Level Security
    is_rls_supported: bool = False

    @property
    def name(self) -> str:
        # can be a Column or a property pointing to one
        raise NotImplementedError()

    # ---------------------------------------------------------------

    # Columns
    id = Column(Integer, primary_key=True)
    description = Column(Text)
    default_endpoint = Column(Text)
    is_featured = Column(Boolean, default=False)  # TODO deprecating
    filter_select_enabled = Column(Boolean, default=True)
    offset = Column(Integer, default=0)
    cache_timeout = Column(Integer)
    params = Column(String(1000))
    perm = Column(String(1000))
    schema_perm = Column(String(1000))
    catalog_perm = Column(String(1000), nullable=True, default=None)
    is_managed_externally = Column(Boolean, nullable=False, default=False)
    external_url = Column(Text, nullable=True)

    sql: str | None = None
    owners: list[User]
    update_from_object_fields: list[str]

    extra_import_fields = ["is_managed_externally", "external_url"]

    @property
    def kind(self) -> DatasourceKind:
        return DatasourceKind.VIRTUAL if self.sql else DatasourceKind.PHYSICAL

    @property
    def owners_data(self) -> list[dict[str, Any]]:
        return [
            {
                "first_name": o.first_name,
                "last_name": o.last_name,
                "username": o.username,
                "id": o.id,
            }
            for o in self.owners
        ]

    @property
    def is_virtual(self) -> bool:
        return self.kind == DatasourceKind.VIRTUAL

    @declared_attr
    def slices(self) -> RelationshipProperty:
        return relationship(
            "Slice",
            overlaps="table",
            primaryjoin=lambda: and_(
                foreign(Slice.datasource_id) == self.id,
                foreign(Slice.datasource_type) == self.type,
            ),
        )

    columns: list[TableColumn] = []
    metrics: list[SqlMetric] = []

    @property
    def type(self) -> str:
        raise NotImplementedError()

    @property
    def uid(self) -> str:
        """Unique id across datasource types"""
        return f"{self.id}__{self.type}"

    @property
    def column_names(self) -> list[str]:
        return sorted([c.column_name for c in self.columns], key=lambda x: x or "")

    @property
    def columns_types(self) -> dict[str, str]:
        return {c.column_name: c.type for c in self.columns}

    @property
    def main_dttm_col(self) -> str:
        return "timestamp"

    @property
    def datasource_name(self) -> str:
        raise NotImplementedError()

    @property
    def connection(self) -> str | None:
        """String representing the context of the Datasource"""
        return None

    @property
    def catalog(self) -> str | None:
        """String representing the catalog of the Datasource (if it applies)"""
        return None

    @property
    def schema(self) -> str | None:
        """String representing the schema of the Datasource (if it applies)"""
        return None

    @property
    def filterable_column_names(self) -> list[str]:
        return sorted([c.column_name for c in self.columns if c.filterable])

    @property
    def dttm_cols(self) -> list[str]:
        return []

    @property
    def url(self) -> str:
        return f"/{self.baselink}/edit/{self.id}"

    @property
    def explore_url(self) -> str:
        if self.default_endpoint:
            return self.default_endpoint
        return f"/explore/?datasource_type={self.type}&datasource_id={self.id}"

    @property
    def column_formats(self) -> dict[str, str | None]:
        return {m.metric_name: m.d3format for m in self.metrics if m.d3format}

    @property
    def currency_formats(self) -> dict[str, dict[str, str | None] | None]:
        return {m.metric_name: m.currency_json for m in self.metrics if m.currency_json}

    def add_missing_metrics(self, metrics: list[SqlMetric]) -> None:
        existing_metrics = {m.metric_name for m in self.metrics}
        for metric in metrics:
            if metric.metric_name not in existing_metrics:
                metric.table_id = self.id
                self.metrics.append(metric)

    @property
    def short_data(self) -> dict[str, Any]:
        """Data representation of the datasource sent to the frontend"""
        return {
            "edit_url": self.url,
            "id": self.id,
            "uid": self.uid,
            "catalog": self.catalog,
            "schema": self.schema or None,
            "name": self.name,
            "type": self.type,
            "connection": self.connection,
            "creator": str(self.created_by),
        }

    @property
    def select_star(self) -> str | None:
        pass

    @property
    def order_by_choices(self) -> list[tuple[str, str]]:
        choices = []
        # self.column_names return sorted column_names
        for column_name in self.column_names:
            column_name = str(column_name or "")
            choices.append(
                (json.dumps([column_name, True]), f"{column_name} " + __("[asc]"))
            )
            choices.append(
                (json.dumps([column_name, False]), f"{column_name} " + __("[desc]"))
            )
        return choices

    @property
    def verbose_map(self) -> dict[str, str]:
        verb_map = {"__timestamp": "Time"}
        verb_map.update(
            {o.metric_name: o.verbose_name or o.metric_name for o in self.metrics}
        )
        verb_map.update(
            {o.column_name: o.verbose_name or o.column_name for o in self.columns}
        )
        return verb_map

    @property
    def data(self) -> dict[str, Any]:
        """Data representation of the datasource sent to the frontend"""
        return {
            # simple fields
            "id": self.id,
            "uid": self.uid,
            "column_formats": self.column_formats,
            "currency_formats": self.currency_formats,
            "description": self.description,
            "database": self.database.data,  # pylint: disable=no-member
            "default_endpoint": self.default_endpoint,
            "filter_select": self.filter_select_enabled,  # TODO deprecate
            "filter_select_enabled": self.filter_select_enabled,
            "name": self.name,
            "datasource_name": self.datasource_name,
            "table_name": self.datasource_name,
            "type": self.type,
            "catalog": self.catalog,
            "schema": self.schema or None,
            "offset": self.offset,
            "cache_timeout": self.cache_timeout,
            "params": self.params,
            "perm": self.perm,
            "edit_url": self.url,
            # sqla-specific
            "sql": self.sql,
            # one to many
            "columns": [o.data for o in self.columns],
            "metrics": [o.data for o in self.metrics],
            # TODO deprecate, move logic to JS
            "order_by_choices": self.order_by_choices,
            "owners": [owner.id for owner in self.owners],
            "verbose_map": self.verbose_map,
            "select_star": self.select_star,
        }

    def data_for_slices(  # pylint: disable=too-many-locals
        self, slices: list[Slice]
    ) -> dict[str, Any]:
        """
        The representation of the datasource containing only the required data
        to render the provided slices.

        Used to reduce the payload when loading a dashboard.
        """
        data = self.data
        metric_names = set()
        column_names = set()
        for slc in slices:
            form_data = slc.form_data
            # pull out all required metrics from the form_data
            for metric_param in METRIC_FORM_DATA_PARAMS:
                for metric in utils.as_list(form_data.get(metric_param) or []):
                    metric_names.add(utils.get_metric_name(metric))
                    if utils.is_adhoc_metric(metric):
                        column_ = metric.get("column") or {}
                        if column_name := column_.get("column_name"):
                            column_names.add(column_name)

            # Columns used in query filters
            column_names.update(
                filter_["subject"]
                for filter_ in form_data.get("adhoc_filters") or []
                if filter_.get("clause") == "WHERE" and filter_.get("subject")
            )

            # columns used by Filter Box
            column_names.update(
                filter_config["column"]
                for filter_config in form_data.get("filter_configs") or []
                if "column" in filter_config
            )

            # for legacy dashboard imports which have the wrong query_context in them
            try:
                query_context = slc.get_query_context()
            except DatasetNotFoundError:
                query_context = None

            # legacy charts don't have query_context charts
            if query_context:
                column_names.update(
                    [
                        utils.get_column_name(column_)
                        for query in query_context.queries
                        for column_ in query.columns
                    ]
                    or []
                )
            else:
                _columns = [
                    utils.get_column_name(column_)
                    if utils.is_adhoc_column(column_)
                    else column_
                    for column_param in COLUMN_FORM_DATA_PARAMS
                    for column_ in utils.as_list(form_data.get(column_param) or [])
                ]
                column_names.update(_columns)

        filtered_metrics = [
            metric
            for metric in data["metrics"]
            if metric["metric_name"] in metric_names
        ]

        filtered_columns: list[Column] = []
        column_types: set[GenericDataType] = set()
        for column_ in data["columns"]:
            generic_type = column_.get("type_generic")
            if generic_type is not None:
                column_types.add(generic_type)
            if column_["column_name"] in column_names:
                filtered_columns.append(column_)

        data["column_types"] = list(column_types)
        del data["description"]
        data.update({"metrics": filtered_metrics})
        data.update({"columns": filtered_columns})
        verbose_map = {"__timestamp": "Time"}
        verbose_map.update(
            {
                metric["metric_name"]: metric["verbose_name"] or metric["metric_name"]
                for metric in filtered_metrics
            }
        )
        verbose_map.update(
            {
                column_["column_name"]: column_["verbose_name"]
                or column_["column_name"]
                for column_ in filtered_columns
            }
        )
        data["verbose_map"] = verbose_map

        return data

    @staticmethod
    def filter_values_handler(  # pylint: disable=too-many-arguments
        values: FilterValues | None,
        operator: str,
        target_generic_type: GenericDataType,
        target_native_type: str | None = None,
        is_list_target: bool = False,
        db_engine_spec: builtins.type[BaseEngineSpec] | None = None,
        db_extra: dict[str, Any] | None = None,
    ) -> FilterValues | None:
        if values is None:
            return None

        def handle_single_value(value: FilterValue | None) -> FilterValue | None:
            if operator == utils.FilterOperator.TEMPORAL_RANGE:
                return value
            if (
                isinstance(value, (float, int))
                and target_generic_type == utils.GenericDataType.TEMPORAL
                and target_native_type is not None
                and db_engine_spec is not None
            ):
                value = db_engine_spec.convert_dttm(
                    target_type=target_native_type,
                    dttm=datetime.utcfromtimestamp(value / 1000),
                    db_extra=db_extra,
                )
                value = literal_column(value)
            if isinstance(value, str):
                value = value.strip("\t\n")

                if (
                    target_generic_type == utils.GenericDataType.NUMERIC
                    and operator
                    not in {
                        utils.FilterOperator.ILIKE,
                        utils.FilterOperator.LIKE,
                    }
                ):
                    # For backwards compatibility and edge cases
                    # where a column data type might have changed
                    return utils.cast_to_num(value)
                if value == NULL_STRING:
                    return None
                if value == EMPTY_STRING:
                    return ""
            if target_generic_type == utils.GenericDataType.BOOLEAN:
                return utils.cast_to_boolean(value)
            return value

        if isinstance(values, (list, tuple)):
            values = [handle_single_value(v) for v in values]  # type: ignore
        else:
            values = handle_single_value(values)
        if is_list_target and not isinstance(values, (tuple, list)):
            values = [values]  # type: ignore
        elif not is_list_target and isinstance(values, (tuple, list)):
            values = values[0] if values else None
        return values

    def external_metadata(self) -> list[ResultSetColumnType]:
        """Returns column information from the external system"""
        raise NotImplementedError()

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        """Returns a query as a string

        This is used to be displayed to the user so that they can
        understand what is taking place behind the scene"""
        raise NotImplementedError()

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        """Executes the query and returns a dataframe

        query_obj is a dictionary representing Superset's query interface.
        Should return a ``superset.models.helpers.QueryResult``
        """
        raise NotImplementedError()

    @staticmethod
    def default_query(qry: Query) -> Query:
        return qry

    def get_column(self, column_name: str | None) -> TableColumn | None:
        if not column_name:
            return None
        for col in self.columns:
            if col.column_name == column_name:
                return col
        return None

    @staticmethod
    def get_fk_many_from_list(
        object_list: list[Any],
        fkmany: list[Column],
        fkmany_class: builtins.type[TableColumn | SqlMetric],
        key_attr: str,
    ) -> list[Column]:
        """Update ORM one-to-many list from object list

        Used for syncing metrics and columns using the same code"""

        object_dict = {o.get(key_attr): o for o in object_list}

        # delete fks that have been removed
        fkmany = [o for o in fkmany if getattr(o, key_attr) in object_dict]

        # sync existing fks
        for fk in fkmany:
            obj = object_dict.get(getattr(fk, key_attr))
            if obj:
                for attr in fkmany_class.update_from_object_fields:
                    setattr(fk, attr, obj.get(attr))

        # create new fks
        new_fks = []
        orm_keys = [getattr(o, key_attr) for o in fkmany]
        for obj in object_list:
            key = obj.get(key_attr)
            if key not in orm_keys:
                del obj["id"]
                orm_kwargs = {}
                for k in obj:
                    if k in fkmany_class.update_from_object_fields and k in obj:
                        orm_kwargs[k] = obj[k]
                new_obj = fkmany_class(**orm_kwargs)
                new_fks.append(new_obj)
        fkmany += new_fks
        return fkmany

    def update_from_object(self, obj: dict[str, Any]) -> None:
        """Update datasource from a data structure

        The UI's table editor crafts a complex data structure that
        contains most of the datasource's properties as well as
        an array of metrics and columns objects. This method
        receives the object from the UI and syncs the datasource to
        match it. Since the fields are different for the different
        connectors, the implementation uses ``update_from_object_fields``
        which can be defined for each connector and
        defines which fields should be synced"""
        for attr in self.update_from_object_fields:
            setattr(self, attr, obj.get(attr))

        self.owners = obj.get("owners", [])

        # Syncing metrics
        metrics = (
            self.get_fk_many_from_list(
                obj["metrics"], self.metrics, SqlMetric, "metric_name"
            )
            if "metrics" in obj
            else []
        )
        self.metrics = metrics

        # Syncing columns
        self.columns = (
            self.get_fk_many_from_list(
                obj["columns"], self.columns, TableColumn, "column_name"
            )
            if "columns" in obj
            else []
        )

    def get_extra_cache_keys(
        self,
        query_obj: QueryObjectDict,  # pylint: disable=unused-argument
    ) -> list[Hashable]:
        """If a datasource needs to provide additional keys for calculation of
        cache keys, those can be provided via this method

        :param query_obj: The dict representation of a query object
        :return: list of keys
        """
        return []

    def __hash__(self) -> int:
        return hash(self.uid)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BaseDatasource):
            return NotImplemented
        return self.uid == other.uid

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """

        security_manager.raise_for_access(datasource=self)

    @classmethod
    def get_datasource_by_name(
        cls,
        datasource_name: str,
        catalog: str | None,
        schema: str,
        database_name: str,
    ) -> BaseDatasource | None:
        raise NotImplementedError()


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

    def values_for_column(self, column_name: str, limit: int = 10000) -> list[Any]:
        raise NotImplementedError()


class TableColumn(AuditMixinNullable, ImportExportMixin, CertificationMixin, Model):
    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = "table_columns"
    __table_args__ = (UniqueConstraint("table_id", "column_name"),)

    id = Column(Integer, primary_key=True)
    column_name = Column(String(255), nullable=False)
    verbose_name = Column(String(1024))
    is_active = Column(Boolean, default=True)
    type = Column(Text)
    advanced_data_type = Column(String(255))
    groupby = Column(Boolean, default=True)
    filterable = Column(Boolean, default=True)
    description = Column(MediumText())
    table_id = Column(Integer, ForeignKey("tables.id", ondelete="CASCADE"))
    is_dttm = Column(Boolean, default=False)
    expression = Column(MediumText())
    python_date_format = Column(String(255))
    extra = Column(Text)

    table: Mapped[SqlaTable] = relationship(
        "SqlaTable",
        back_populates="columns",
    )

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

    def __init__(self, **kwargs: Any) -> None:
        """
        Construct a TableColumn object.

        Historically a TableColumn object (from an ORM perspective) was tightly bound to
        a SqlaTable object, however with the introduction of the Query datasource this
        is no longer true, i.e., the SqlaTable relationship is optional.

        Now the TableColumn is either directly associated with the Database object (
        which is unknown to the ORM) or indirectly via the SqlaTable object (courtesy of
        the ORM) depending on the context.
        """

        self._database: Database | None = kwargs.pop("database", None)
        super().__init__(**kwargs)

    @reconstructor
    def init_on_load(self) -> None:
        """
        Construct a TableColumn object when invoked via the SQLAlchemy ORM.
        """

        self._database = None

    def __repr__(self) -> str:
        return str(self.column_name)

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
    def database(self) -> Database:
        return self.table.database if self.table else self._database

    @property
    def db_engine_spec(self) -> builtins.type[BaseEngineSpec]:
        return self.database.db_engine_spec

    @property
    def db_extra(self) -> dict[str, Any]:
        return self.database.get_extra()

    @property
    def type_generic(self) -> utils.GenericDataType | None:
        if self.is_dttm:
            return GenericDataType.TEMPORAL

        return (
            column_spec.generic_type
            if (
                column_spec := self.db_engine_spec.get_column_spec(
                    self.type,
                    db_extra=self.db_extra,
                )
            )
            else None
        )

    def get_sqla_col(
        self,
        label: str | None = None,
        template_processor: BaseTemplateProcessor | None = None,
    ) -> Column:
        label = label or self.column_name
        db_engine_spec = self.db_engine_spec
        column_spec = db_engine_spec.get_column_spec(self.type, db_extra=self.db_extra)
        type_ = column_spec.sqla_type if column_spec else None
        if expression := self.expression:
            if template_processor:
                expression = template_processor.process_template(expression)
            col = literal_column(expression, type_=type_)
        else:
            col = column(self.column_name, type_=type_)
        col = self.database.make_sqla_column_compatible(col, label)
        return col

    @property
    def datasource(self) -> RelationshipProperty:
        return self.table

    def get_timestamp_expression(
        self,
        time_grain: str | None,
        label: str | None = None,
        template_processor: BaseTemplateProcessor | None = None,
    ) -> TimestampExpression | Label:
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
            return self.database.make_sqla_column_compatible(sqla_col, label)
        if expression := self.expression:
            if template_processor:
                expression = template_processor.process_template(expression)
            col = literal_column(expression, type_=type_)
        else:
            col = column(self.column_name, type_=type_)
        time_expr = self.db_engine_spec.get_timestamp_expr(col, pdf, time_grain)
        return self.database.make_sqla_column_compatible(time_expr, label)

    @property
    def data(self) -> dict[str, Any]:
        attrs = (
            "advanced_data_type",
            "certification_details",
            "certified_by",
            "column_name",
            "description",
            "expression",
            "filterable",
            "groupby",
            "id",
            "is_certified",
            "is_dttm",
            "python_date_format",
            "type",
            "type_generic",
            "verbose_name",
            "warning_markdown",
        )

        return {s: getattr(self, s) for s in attrs if hasattr(self, s)}


class SqlMetric(AuditMixinNullable, ImportExportMixin, CertificationMixin, Model):
    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = "sql_metrics"
    __table_args__ = (UniqueConstraint("table_id", "metric_name"),)

    id = Column(Integer, primary_key=True)
    metric_name = Column(String(255), nullable=False)
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    description = Column(MediumText())
    d3format = Column(String(128))
    currency = Column(String(128))
    warning_text = Column(Text)
    table_id = Column(Integer, ForeignKey("tables.id", ondelete="CASCADE"))
    expression = Column(MediumText(), nullable=False)
    extra = Column(Text)

    table: Mapped[SqlaTable] = relationship(
        "SqlaTable",
        back_populates="metrics",
    )

    export_fields = [
        "metric_name",
        "verbose_name",
        "metric_type",
        "table_id",
        "expression",
        "description",
        "d3format",
        "currency",
        "extra",
        "warning_text",
    ]
    update_from_object_fields = list(s for s in export_fields if s != "table_id")
    export_parent = "table"

    def __repr__(self) -> str:
        return str(self.metric_name)

    def get_sqla_col(
        self,
        label: str | None = None,
        template_processor: BaseTemplateProcessor | None = None,
    ) -> Column:
        label = label or self.metric_name
        expression = self.expression
        if template_processor:
            expression = template_processor.process_template(expression)

        sqla_col: ColumnClause = literal_column(expression)
        return self.table.database.make_sqla_column_compatible(sqla_col, label)

    @property
    def perm(self) -> str | None:
        return (
            ("{parent_name}.[{obj.metric_name}](id:{obj.id})").format(
                obj=self, parent_name=self.table.full_name
            )
            if self.table
            else None
        )

    def get_perm(self) -> str | None:
        return self.perm

    @property
    def currency_json(self) -> dict[str, str | None] | None:
        try:
            return json.loads(self.currency or "{}") or None
        except (TypeError, json.JSONDecodeError) as exc:
            logger.error(
                "Unable to load currency json: %r. Leaving empty.", exc, exc_info=True
            )
            return None

    @property
    def data(self) -> dict[str, Any]:
        attrs = (
            "certification_details",
            "certified_by",
            "currency",
            "d3format",
            "description",
            "expression",
            "id",
            "is_certified",
            "metric_name",
            "warning_markdown",
            "warning_text",
            "verbose_name",
        )

        return {s: getattr(self, s) for s in attrs}


sqlatable_user = DBTable(
    "sqlatable_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id", ondelete="CASCADE")),
    Column("table_id", Integer, ForeignKey("tables.id", ondelete="CASCADE")),
)


def _process_sql_expression(
    expression: str | None,
    database_id: int,
    schema: str,
    template_processor: BaseTemplateProcessor | None = None,
) -> str | None:
    if template_processor and expression:
        expression = template_processor.process_template(expression)
    if expression:
        try:
            expression = validate_adhoc_subquery(
                expression,
                database_id,
                schema,
            )
            expression = sanitize_clause(expression)
        except (QueryClauseValidationException, SupersetSecurityException) as ex:
            raise QueryObjectValidationError(ex.message) from ex
    return expression


class SqlaTable(
    Model,
    BaseDatasource,
    ExploreMixin,
):  # pylint: disable=too-many-public-methods
    """An ORM object for SqlAlchemy table references"""

    type = "table"
    query_language = "sql"
    is_rls_supported = True
    columns: Mapped[list[TableColumn]] = relationship(
        TableColumn,
        back_populates="table",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    metrics: Mapped[list[SqlMetric]] = relationship(
        SqlMetric,
        back_populates="table",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
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
    __table_args__ = (
        UniqueConstraint("database_id", "catalog", "schema", "table_name"),
    )

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
    catalog = Column(String(256), nullable=True, default=None)
    sql = Column(MediumText())
    is_sqllab_view = Column(Boolean, default=False)
    template_params = Column(Text)
    extra = Column(Text)
    normalize_columns = Column(Boolean, default=False)
    always_filter_main_dttm = Column(Boolean, default=False)

    baselink = "tablemodelview"

    export_fields = [
        "table_name",
        "main_dttm_col",
        "description",
        "default_endpoint",
        "database_id",
        "offset",
        "cache_timeout",
        "catalog",
        "schema",
        "sql",
        "params",
        "template_params",
        "filter_select_enabled",
        "fetch_values_predicate",
        "extra",
        "normalize_columns",
        "always_filter_main_dttm",
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

    def __repr__(self) -> str:  # pylint: disable=invalid-repr-returned
        return self.name

    @property
    def db_extra(self) -> dict[str, Any]:
        return self.database.get_extra()

    @staticmethod
    def _apply_cte(sql: str, cte: str | None) -> str:
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
    def db_engine_spec(self) -> __builtins__.type[BaseEngineSpec]:
        return self.database.db_engine_spec

    @property
    def changed_by_name(self) -> str:
        if not self.changed_by:
            return ""
        return str(self.changed_by)

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
        datasource_name: str,
        catalog: str | None,
        schema: str | None,
        database_name: str,
    ) -> SqlaTable | None:
        schema = schema or None
        query = (
            db.session.query(cls)
            .join(Database)
            .filter(cls.table_name == datasource_name)
            .filter(Database.database_name == database_name)
            .filter(cls.catalog == catalog)
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

    def get_catalog_perm(self) -> str | None:
        """Returns catalog permission if present, database one otherwise."""
        return security_manager.get_catalog_perm(
            self.database.database_name,
            self.catalog,
        )

    def get_schema_perm(self) -> str | None:
        """Returns schema permission if present, database one otherwise."""
        return security_manager.get_schema_perm(
            self.database.database_name,
            self.catalog,
            self.schema or None,
        )

    def get_perm(self) -> str:
        """
        Return this dataset permission name
        :return: dataset permission name
        :raises DatasetInvalidPermissionEvaluationException: When database is missing
        """
        if self.database is None:
            raise DatasetInvalidPermissionEvaluationException()
        return f"[{self.database}].[{self.table_name}](id:{self.id})"

    @hybrid_property
    def name(self) -> str:  # pylint: disable=invalid-overridden-method
        return self.schema + "." + self.table_name if self.schema else self.table_name

    @property
    def full_name(self) -> str:
        return utils.get_datasource_full_name(
            self.database,
            self.table_name,
            catalog=self.catalog,
            schema=self.schema,
        )

    @property
    def dttm_cols(self) -> list[str]:
        l = [c.column_name for c in self.columns if c.is_dttm]  # noqa: E741
        if self.main_dttm_col and self.main_dttm_col not in l:
            l.append(self.main_dttm_col)
        return l

    @property
    def num_cols(self) -> list[str]:
        return [c.column_name for c in self.columns if c.is_numeric]

    @property
    def any_dttm_col(self) -> str | None:
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

    def external_metadata(self) -> list[ResultSetColumnType]:
        # todo(yongjie): create a physical table column type in a separate PR
        if self.sql:
            return get_virtual_table_metadata(dataset=self)
        return get_physical_table_metadata(
            database=self.database,
            table=Table(self.table_name, self.schema or None, self.catalog),
            normalize_columns=self.normalize_columns,
        )

    @property
    def time_column_grains(self) -> dict[str, Any]:
        return {
            "time_columns": self.dttm_cols,
            "time_grains": [grain.name for grain in self.database.grains()],
        }

    @property
    def select_star(self) -> str | None:
        # show_cols and latest_partition set to false to avoid
        # the expensive cost of inspecting the DB
        return self.database.select_star(
            Table(self.table_name, self.schema or None, self.catalog),
            show_cols=False,
            latest_partition=False,
        )

    @property
    def health_check_message(self) -> str | None:
        check = config["DATASET_HEALTH_CHECK"]
        return check(self) if check else None

    @property
    def granularity_sqla(self) -> list[tuple[Any, Any]]:
        return utils.choicify(self.dttm_cols)

    @property
    def time_grain_sqla(self) -> list[tuple[Any, Any]]:
        return [(g.duration, g.name) for g in self.database.grains() or []]

    @property
    def data(self) -> dict[str, Any]:
        data_ = super().data
        if self.type == "table":
            data_["granularity_sqla"] = self.granularity_sqla
            data_["time_grain_sqla"] = self.time_grain_sqla
            data_["main_dttm_col"] = self.main_dttm_col
            data_["fetch_values_predicate"] = self.fetch_values_predicate
            data_["template_params"] = self.template_params
            data_["is_sqllab_view"] = self.is_sqllab_view
            data_["health_check_message"] = self.health_check_message
            data_["extra"] = self.extra
            data_["owners"] = self.owners_data
            data_["always_filter_main_dttm"] = self.always_filter_main_dttm
            data_["normalize_columns"] = self.normalize_columns
        return data_

    @property
    def extra_dict(self) -> dict[str, Any]:
        try:
            return json.loads(self.extra)
        except (TypeError, json.JSONDecodeError):
            return {}

    def get_fetch_values_predicate(
        self,
        template_processor: BaseTemplateProcessor | None = None,
    ) -> TextClause:
        fetch_values_predicate = self.fetch_values_predicate
        if template_processor:
            fetch_values_predicate = template_processor.process_template(
                fetch_values_predicate
            )
        try:
            return self.text(fetch_values_predicate)
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _(
                    "Error in jinja expression in fetch values predicate: %(msg)s",
                    msg=ex.message,
                )
            ) from ex

    def get_template_processor(self, **kwargs: Any) -> BaseTemplateProcessor:
        return get_template_processor(table=self, database=self.database, **kwargs)

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
        self, template_processor: BaseTemplateProcessor | None = None
    ) -> tuple[TableClause | Alias, str | None]:
        """
        Return where to select the columns and metrics from. Either a physical table
        or a virtual table with it's own subquery. If the FROM is referencing a
        CTE, the CTE is returned as the second value in the return tuple.
        """
        if not self.is_virtual:
            return self.get_sqla_table(), None

        from_sql = self.get_rendered_sql(template_processor) + "\n"
        parsed_query = ParsedQuery(from_sql, engine=self.db_engine_spec.engine)
        if not (
            parsed_query.is_unknown()
            or self.db_engine_spec.is_readonly_query(parsed_query)
        ):
            raise QueryObjectValidationError(
                _("Virtual dataset query must be read-only")
            )

        cte = self.db_engine_spec.get_cte_query(from_sql)
        from_clause = (
            table(self.db_engine_spec.cte_alias)
            if cte
            else TextAsFrom(self.text(from_sql), []).alias(VIRTUAL_TABLE_ALIAS)
        )

        return from_clause, cte

    def adhoc_metric_to_sqla(
        self,
        metric: AdhocMetric,
        columns_by_name: dict[str, TableColumn],
        template_processor: BaseTemplateProcessor | None = None,
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
            table_column: TableColumn | None = columns_by_name.get(column_name)
            if table_column:
                sqla_column = table_column.get_sqla_col(
                    template_processor=template_processor
                )
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

    def adhoc_column_to_sqla(  # pylint: disable=too-many-locals
        self,
        col: AdhocColumn,
        force_type_check: bool = False,
        template_processor: BaseTemplateProcessor | None = None,
    ) -> ColumnElement:
        """
        Turn an adhoc column into a sqlalchemy column.

        :param col: Adhoc column definition
        :param force_type_check: Should the column type be checked in the db.
               This is needed to validate if a filter with an adhoc column
               is applicable.
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
        time_grain = col.get("timeGrain")
        has_timegrain = col.get("columnType") == "BASE_AXIS" and time_grain
        is_dttm = False
        pdf = None
        if col_in_metadata := self.get_column(expression):
            sqla_column = col_in_metadata.get_sqla_col(
                template_processor=template_processor
            )
            is_dttm = col_in_metadata.is_temporal
            pdf = col_in_metadata.python_date_format
        else:
            sqla_column = literal_column(expression)
            if has_timegrain or force_type_check:
                try:
                    # probe adhoc column type
                    tbl, _ = self.get_from_clause(template_processor)
                    qry = sa.select([sqla_column]).limit(1).select_from(tbl)
                    sql = self.database.compile_sqla_query(qry)
                    col_desc = get_columns_description(
                        self.database,
                        self.catalog,
                        self.schema or None,
                        sql,
                    )
                    if not col_desc:
                        raise SupersetGenericDBErrorException("Column not found")
                    is_dttm = col_desc[0]["is_dttm"]  # type: ignore
                except SupersetGenericDBErrorException as ex:
                    raise ColumnNotFoundException(message=str(ex)) from ex

        if is_dttm and has_timegrain:
            sqla_column = self.db_engine_spec.get_timestamp_expr(
                col=sqla_column,
                pdf=pdf,
                time_grain=time_grain,
            )
        return self.make_sqla_column_compatible(sqla_column, label)

    def make_orderby_compatible(
        self, select_exprs: list[ColumnElement], orderby_exprs: list[ColumnElement]
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

    def text(self, clause: str) -> TextClause:
        return self.db_engine_spec.get_text_clause(clause)

    def _get_series_orderby(
        self,
        series_limit_metric: Metric,
        metrics_by_name: dict[str, SqlMetric],
        columns_by_name: dict[str, TableColumn],
        template_processor: BaseTemplateProcessor | None = None,
    ) -> Column:
        if utils.is_adhoc_metric(series_limit_metric):
            assert isinstance(series_limit_metric, dict)
            ob = self.adhoc_metric_to_sqla(series_limit_metric, columns_by_name)
        elif (
            isinstance(series_limit_metric, str)
            and series_limit_metric in metrics_by_name
        ):
            ob = metrics_by_name[series_limit_metric].get_sqla_col(
                template_processor=template_processor
            )
        else:
            raise QueryObjectValidationError(
                _("Metric '%(metric)s' does not exist", metric=series_limit_metric)
            )
        return ob

    def _normalize_prequery_result_type(
        self,
        row: pd.Series,
        dimension: str,
        columns_by_name: dict[str, TableColumn],
    ) -> str | int | float | bool | Text:
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
        db_extra: dict[str, Any] = self.database.get_extra()

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
        dimensions: list[str],
        groupby_exprs: dict[str, Any],
        columns_by_name: dict[str, TableColumn],
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

        def assign_column_label(df: pd.DataFrame) -> pd.DataFrame | None:
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
            df = self.database.get_df(
                sql,
                self.catalog,
                self.schema or None,
                mutator=assign_column_label,
            )
        except (SupersetErrorException, SupersetErrorsException):
            # SupersetError(s) exception should not be captured; instead, they should
            # bubble up to the Flask error handler so they are returned as proper SIP-40
            # errors. This is particularly important for database OAuth2, see SIP-85.
            raise
        except Exception as ex:  # pylint: disable=broad-except
            # TODO (betodealmeida): review exception handling while querying the external
            # database. Ideally we'd expect and handle external database error, but
            # everything else / the default should be to let things bubble up.
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
            applied_filter_columns=query_str_ext.applied_filter_columns,
            rejected_filter_columns=query_str_ext.rejected_filter_columns,
            status=status,
            df=df,
            duration=datetime.now() - qry_start_dttm,
            query=sql,
            errors=errors,
            error_message=error_message,
        )

    def get_sqla_table_object(self) -> Table:
        return self.database.get_table(
            Table(
                self.table_name,
                self.schema or None,
                self.catalog,
            )
        )

    def fetch_metadata(self) -> MetadataResult:
        """
        Fetches the metadata for the table and merges it in

        :return: Tuple with lists of added, removed and modified column names.
        """
        new_columns = self.external_metadata()
        metrics = [
            SqlMetric(**metric)
            for metric in self.database.get_metrics(
                Table(
                    self.table_name,
                    self.schema or None,
                    self.catalog,
                )
            )
        ]
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

        old_columns_by_name: dict[str, TableColumn] = {
            col.column_name: col for col in old_columns
        }
        results = MetadataResult(
            removed=[
                col
                for col in old_columns_by_name
                if col not in {col["column_name"] for col in new_columns}
            ]
        )

        # clear old columns before adding modified columns back
        columns = []
        for col in new_columns:
            old_column = old_columns_by_name.pop(col["column_name"], None)
            if not old_column:
                results.added.append(col["column_name"])
                new_column = TableColumn(
                    column_name=col["column_name"],
                    type=col["type"],
                    table=self,
                )
                new_column.is_dttm = new_column.is_temporal
                db_engine_spec.alter_new_orm_column(new_column)
            else:
                new_column = old_column
                if new_column.type != col["type"]:
                    results.modified.append(col["column_name"])
                new_column.type = col["type"]
                new_column.expression = ""
            new_column.groupby = True
            new_column.filterable = True
            columns.append(new_column)
            if not any_date_col and new_column.is_temporal:
                any_date_col = col["column_name"]

        # add back calculated (virtual) columns
        columns.extend([col for col in old_columns if col.expression])
        self.columns = columns

        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col
        self.add_missing_metrics(metrics)

        # Apply config supplied mutations.
        config["SQLA_TABLE_MUTATOR"](self)

        db.session.merge(self)
        return results

    @classmethod
    def query_datasources_by_name(
        cls,
        database: Database,
        datasource_name: str,
        catalog: str | None = None,
        schema: str | None = None,
    ) -> list[SqlaTable]:
        filters = {
            "database_id": database.id,
            "table_name": datasource_name,
        }
        if catalog:
            filters["catalog"] = catalog
        if schema:
            filters["schema"] = schema

        return db.session.query(cls).filter_by(**filters).all()

    @classmethod
    def query_datasources_by_permissions(  # pylint: disable=invalid-name
        cls,
        database: Database,
        permissions: set[str],
        catalog_perms: set[str],
        schema_perms: set[str],
    ) -> list[SqlaTable]:
        # remove empty sets from the query, since SQLAlchemy produces horrible SQL for
        # Model.column._in({}):
        #
        #   table.column IN (SELECT 1 FROM (SELECT 1) WHERE 1!=1)
        filters = [
            method.in_(perms)
            for method, perms in zip(
                (SqlaTable.perm, SqlaTable.schema_perm, SqlaTable.catalog_perm),
                (permissions, schema_perms, catalog_perms),
            )
            if perms
        ]

        return (
            db.session.query(cls)
            .filter_by(database_id=database.id)
            .filter(or_(*filters))
            .all()
        )

    @classmethod
    def get_eager_sqlatable_datasource(cls, datasource_id: int) -> SqlaTable:
        """Returns SqlaTable with columns and metrics."""
        return (
            db.session.query(cls)
            .options(
                sa.orm.subqueryload(cls.columns),
                sa.orm.subqueryload(cls.metrics),
            )
            .filter_by(id=datasource_id)
            .one()
        )

    @classmethod
    def get_all_datasources(cls) -> list[SqlaTable]:
        qry = db.session.query(cls)
        qry = cls.default_query(qry)
        return qry.all()

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
        templatable_statements: list[str] = []
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

    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> list[Hashable]:
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
        mapper: Mapper,
        connection: Connection,
        target: SqlaTable,
    ) -> None:
        """
        Note this listener is called when any fields are being updated

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        :raises Exception: If the target table is not unique
        """
        target.load_database()
        security_manager.dataset_before_update(mapper, connection, target)

    @staticmethod
    def update_column(  # pylint: disable=unused-argument
        mapper: Mapper, connection: Connection, target: SqlMetric | TableColumn
    ) -> None:
        """
        :param mapper: Unused.
        :param connection: Unused.
        :param target: The metric or column that was updated.
        """
        session = inspect(target).session  # pylint: disable=disallowed-name

        # Forces an update to the table's changed_on value when a metric or column on the
        # table is updated. This busts the cache key for all charts that use the table.
        session.execute(update(SqlaTable).where(SqlaTable.id == target.table.id))

    @staticmethod
    def after_insert(
        mapper: Mapper,
        connection: Connection,
        target: SqlaTable,
    ) -> None:
        """
        Update dataset permissions after insert
        """
        target.load_database()
        security_manager.dataset_after_insert(mapper, connection, target)

    @staticmethod
    def after_delete(
        mapper: Mapper,
        connection: Connection,
        sqla_table: SqlaTable,
    ) -> None:
        """
        Update dataset permissions after delete
        """
        security_manager.dataset_after_delete(mapper, connection, sqla_table)

    def load_database(self: SqlaTable) -> None:
        # somehow the database attribute is not loaded on access
        if self.database_id and (
            not self.database or self.database.id != self.database_id
        ):
            session = inspect(self).session  # pylint: disable=disallowed-name
            self.database = session.query(Database).filter_by(id=self.database_id).one()


sa.event.listen(SqlaTable, "before_update", SqlaTable.before_update)
sa.event.listen(SqlaTable, "after_insert", SqlaTable.after_insert)
sa.event.listen(SqlaTable, "after_delete", SqlaTable.after_delete)
sa.event.listen(SqlMetric, "after_update", SqlaTable.update_column)
sa.event.listen(TableColumn, "after_update", SqlaTable.update_column)

RLSFilterRoles = DBTable(
    "rls_filter_roles",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("role_id", Integer, ForeignKey("ab_role.id"), nullable=False),
    Column("rls_filter_id", Integer, ForeignKey("row_level_security_filters.id")),
)

RLSFilterTables = DBTable(
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
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    filter_type = Column(
        Enum(
            *[filter_type.value for filter_type in utils.RowLevelSecurityFilterType],
            name="filter_type_enum",
        ),
    )
    group_key = Column(String(255), nullable=True)
    roles = relationship(
        security_manager.role_model,
        secondary=RLSFilterRoles,
        backref="row_level_security_filters",
    )
    tables = relationship(
        SqlaTable,
        overlaps="table",
        secondary=RLSFilterTables,
        backref="row_level_security_filters",
    )
    clause = Column(MediumText(), nullable=False)
