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
from typing import Any, Dict, Hashable, List, Optional, Type

from flask_appbuilder.security.sqla.models import User
from sqlalchemy import and_, Boolean, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import foreign, Query, relationship, RelationshipProperty

from superset.constants import NULL_STRING
from superset.models.helpers import AuditMixinNullable, ImportMixin, QueryResult
from superset.models.slice import Slice
from superset.typing import FilterValue, FilterValues, QueryObjectDict
from superset.utils import core as utils

METRIC_FORM_DATA_PARAMS = [
    "metric",
    "metrics",
    "metric_2",
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


class BaseDatasource(
    AuditMixinNullable, ImportMixin
):  # pylint: disable=too-many-public-methods
    """A common interface to objects that are queryable
    (tables and datasources)"""

    # ---------------------------------------------------------------
    # class attributes to define when deriving BaseDatasource
    # ---------------------------------------------------------------
    __tablename__: Optional[str] = None  # {connector_name}_datasource
    baselink: Optional[str] = None  # url portion pointing to ModelView endpoint

    @property
    def column_class(self) -> Type:
        # link to derivative of BaseColumn
        raise NotImplementedError()

    @property
    def metric_class(self) -> Type:
        # link to derivative of BaseMetric
        raise NotImplementedError()

    owner_class: Optional[User] = None

    # Used to do code highlighting when displaying the query in the UI
    query_language: Optional[str] = None

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
    filter_select_enabled = Column(Boolean, default=False)
    offset = Column(Integer, default=0)
    cache_timeout = Column(Integer)
    params = Column(String(1000))
    perm = Column(String(1000))
    schema_perm = Column(String(1000))

    sql: Optional[str] = None
    owners: List[User]
    update_from_object_fields: List[str]

    @declared_attr
    def slices(self) -> RelationshipProperty:
        return relationship(
            "Slice",
            primaryjoin=lambda: and_(
                foreign(Slice.datasource_id) == self.id,
                foreign(Slice.datasource_type) == self.type,
            ),
        )

    # placeholder for a relationship to a derivative of BaseColumn
    columns: List[Any] = []
    # placeholder for a relationship to a derivative of BaseMetric
    metrics: List[Any] = []

    @property
    def type(self) -> str:
        raise NotImplementedError()

    @property
    def uid(self) -> str:
        """Unique id across datasource types"""
        return f"{self.id}__{self.type}"

    @property
    def column_names(self) -> List[str]:
        return sorted([c.column_name for c in self.columns], key=lambda x: x or "")

    @property
    def columns_types(self) -> Dict[str, str]:
        return {c.column_name: c.type for c in self.columns}

    @property
    def main_dttm_col(self) -> str:
        return "timestamp"

    @property
    def datasource_name(self) -> str:
        raise NotImplementedError()

    @property
    def connection(self) -> Optional[str]:
        """String representing the context of the Datasource"""
        return None

    @property
    def schema(self) -> Optional[str]:
        """String representing the schema of the Datasource (if it applies)"""
        return None

    @property
    def filterable_column_names(self) -> List[str]:
        return sorted([c.column_name for c in self.columns if c.filterable])

    @property
    def dttm_cols(self) -> List[str]:
        return []

    @property
    def url(self) -> str:
        return "/{}/edit/{}".format(self.baselink, self.id)

    @property
    def explore_url(self) -> str:
        if self.default_endpoint:
            return self.default_endpoint
        return f"/superset/explore/{self.type}/{self.id}/"

    @property
    def column_formats(self) -> Dict[str, Optional[str]]:
        return {m.metric_name: m.d3format for m in self.metrics if m.d3format}

    def add_missing_metrics(self, metrics: List["BaseMetric"]) -> None:
        existing_metrics = {m.metric_name for m in self.metrics}
        for metric in metrics:
            if metric.metric_name not in existing_metrics:
                metric.table_id = self.id
                self.metrics.append(metric)

    @property
    def short_data(self) -> Dict[str, Any]:
        """Data representation of the datasource sent to the frontend"""
        return {
            "edit_url": self.url,
            "id": self.id,
            "uid": self.uid,
            "schema": self.schema,
            "name": self.name,
            "type": self.type,
            "connection": self.connection,
            "creator": str(self.created_by),
        }

    @property
    def select_star(self) -> Optional[str]:
        pass

    @property
    def data(self) -> Dict[str, Any]:
        """Data representation of the datasource sent to the frontend"""
        order_by_choices = []
        # self.column_names return sorted column_names
        for column_name in self.column_names:
            column_name = str(column_name or "")
            order_by_choices.append(
                (json.dumps([column_name, True]), column_name + " [asc]")
            )
            order_by_choices.append(
                (json.dumps([column_name, False]), column_name + " [desc]")
            )

        verbose_map = {"__timestamp": "Time"}
        verbose_map.update(
            {o.metric_name: o.verbose_name or o.metric_name for o in self.metrics}
        )
        verbose_map.update(
            {o.column_name: o.verbose_name or o.column_name for o in self.columns}
        )
        return {
            # simple fields
            "id": self.id,
            "column_formats": self.column_formats,
            "description": self.description,
            "database": self.database.data,  # pylint: disable=no-member
            "default_endpoint": self.default_endpoint,
            "filter_select": self.filter_select_enabled,  # TODO deprecate
            "filter_select_enabled": self.filter_select_enabled,
            "name": self.name,
            "datasource_name": self.datasource_name,
            "type": self.type,
            "schema": self.schema,
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
            "order_by_choices": order_by_choices,
            "owners": [owner.id for owner in self.owners],
            "verbose_map": verbose_map,
            "select_star": self.select_star,
        }

    def data_for_slices(self, slices: List[Slice]) -> Dict[str, Any]:
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
            for param in METRIC_FORM_DATA_PARAMS:
                for metric in utils.get_iterable(form_data.get(param) or []):
                    metric_names.add(utils.get_metric_name(metric))

                    if utils.is_adhoc_metric(metric):
                        column_names.add(
                            (metric.get("column") or {}).get("column_name")
                        )

            # pull out all required columns from the form_data
            for filter_ in form_data.get("adhoc_filters") or []:
                if filter_["clause"] == "WHERE" and filter_.get("subject"):
                    column_names.add(filter_.get("subject"))

            for param in COLUMN_FORM_DATA_PARAMS:
                for column in utils.get_iterable(form_data.get(param) or []):
                    column_names.add(column)

        filtered_metrics = [
            metric
            for metric in data["metrics"]
            if metric["metric_name"] in metric_names
        ]

        filtered_columns = [
            column
            for column in data["columns"]
            if column["column_name"] in column_names
        ]

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
                column["column_name"]: column["verbose_name"] or column["column_name"]
                for column in filtered_columns
            }
        )
        data["verbose_map"] = verbose_map

        return data

    @staticmethod
    def filter_values_handler(
        values: Optional[FilterValues],
        target_column_is_numeric: bool = False,
        is_list_target: bool = False,
    ) -> Optional[FilterValues]:
        if values is None:
            return None

        def handle_single_value(value: Optional[FilterValue]) -> Optional[FilterValue]:
            # backward compatibility with previous <select> components
            if isinstance(value, str):
                value = value.strip("\t\n'\"")
                if target_column_is_numeric:
                    # For backwards compatibility and edge cases
                    # where a column data type might have changed
                    value = utils.cast_to_num(value)
                if value == NULL_STRING:
                    return None
                elif value == "<empty string>":
                    return ""
            return value

        if isinstance(values, (list, tuple)):
            values = [handle_single_value(v) for v in values]  # type: ignore
        else:
            values = handle_single_value(values)
        if is_list_target and not isinstance(values, (tuple, list)):
            values = [values]  # type: ignore
        elif not is_list_target and isinstance(values, (tuple, list)):
            if values:
                values = values[0]
            else:
                values = None
        return values

    def external_metadata(self) -> List[Dict[str, str]]:
        """Returns column information from the external system"""
        raise NotImplementedError()

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        """Returns a query as a string

        This is used to be displayed to the user so that she/he can
        understand what is taking place behind the scene"""
        raise NotImplementedError()

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        """Executes the query and returns a dataframe

        query_obj is a dictionary representing Superset's query interface.
        Should return a ``superset.models.helpers.QueryResult``
        """
        raise NotImplementedError()

    def values_for_column(self, column_name: str, limit: int = 10000) -> List:
        """Given a column, returns an iterable of distinct values

        This is used to populate the dropdown showing a list of
        values in filters in the explore view"""
        raise NotImplementedError()

    @staticmethod
    def default_query(qry: Query) -> Query:
        return qry

    def get_column(self, column_name: Optional[str]) -> Optional["BaseColumn"]:
        if not column_name:
            return None
        for col in self.columns:
            if col.column_name == column_name:
                return col
        return None

    @staticmethod
    def get_fk_many_from_list(
        object_list: List[Any], fkmany: List[Column], fkmany_class: Type, key_attr: str,
    ) -> List[Column]:  # pylint: disable=too-many-locals
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

    def update_from_object(self, obj: Dict[str, Any]) -> None:
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
                obj["metrics"], self.metrics, self.metric_class, "metric_name"
            )
            if self.metric_class and "metrics" in obj
            else []
        )
        self.metrics = metrics

        # Syncing columns
        self.columns = (
            self.get_fk_many_from_list(
                obj["columns"], self.columns, self.column_class, "column_name"
            )
            if self.column_class and "columns" in obj
            else []
        )

    def get_extra_cache_keys(  # pylint: disable=no-self-use
        self, query_obj: QueryObjectDict  # pylint: disable=unused-argument
    ) -> List[Hashable]:
        """ If a datasource needs to provide additional keys for calculation of
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


class BaseColumn(AuditMixinNullable, ImportMixin):
    """Interface for column"""

    __tablename__: Optional[str] = None  # {connector_name}_column

    id = Column(Integer, primary_key=True)
    column_name = Column(String(255), nullable=False)
    verbose_name = Column(String(1024))
    is_active = Column(Boolean, default=True)
    type = Column(String(32))
    groupby = Column(Boolean, default=True)
    filterable = Column(Boolean, default=True)
    description = Column(Text)
    is_dttm = None

    # [optional] Set this to support import/export functionality
    export_fields: List[Any] = []

    def __repr__(self) -> str:
        return self.column_name

    num_types = (
        "DOUBLE",
        "FLOAT",
        "INT",
        "BIGINT",
        "NUMBER",
        "LONG",
        "REAL",
        "NUMERIC",
        "DECIMAL",
        "MONEY",
    )
    date_types = ("DATE", "TIME")
    str_types = ("VARCHAR", "STRING", "CHAR")

    @property
    def is_numeric(self) -> bool:
        return self.type and any(map(lambda t: t in self.type.upper(), self.num_types))

    @property
    def is_temporal(self) -> bool:
        return self.type and any(map(lambda t: t in self.type.upper(), self.date_types))

    @property
    def is_string(self) -> bool:
        return self.type and any(map(lambda t: t in self.type.upper(), self.str_types))

    @property
    def expression(self) -> Column:
        raise NotImplementedError()

    @property
    def python_date_format(self) -> Column:
        raise NotImplementedError()

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
        )
        return {s: getattr(self, s) for s in attrs if hasattr(self, s)}


class BaseMetric(AuditMixinNullable, ImportMixin):

    """Interface for Metrics"""

    __tablename__: Optional[str] = None  # {connector_name}_metric

    id = Column(Integer, primary_key=True)
    metric_name = Column(String(255), nullable=False)
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    description = Column(Text)
    d3format = Column(String(128))
    warning_text = Column(Text)

    """
    The interface should also declare a datasource relationship pointing
    to a derivative of BaseDatasource, along with a FK

    datasource_name = Column(
        String(255),
        ForeignKey('datasources.datasource_name'))
    datasource = relationship(
        # needs to be altered to point to {Connector}Datasource
        'BaseDatasource',
        backref=backref('metrics', cascade='all, delete-orphan'),
        enable_typechecks=False)
    """

    @property
    def perm(self) -> Optional[str]:
        raise NotImplementedError()

    @property
    def expression(self) -> Column:
        raise NotImplementedError()

    @property
    def data(self) -> Dict[str, Any]:
        attrs = (
            "id",
            "metric_name",
            "verbose_name",
            "description",
            "expression",
            "warning_text",
            "d3format",
        )
        return {s: getattr(self, s) for s in attrs}
