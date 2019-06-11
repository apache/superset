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
# pylint: disable=C,R,W
import json

from sqlalchemy import (
    and_, Boolean, Column, Integer, String, Text,
)
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import foreign, relationship

from superset.models.core import Slice
from superset.models.helpers import AuditMixinNullable, ImportMixin
from superset.utils import core as utils


class BaseDatasource(AuditMixinNullable, ImportMixin):
    """A common interface to objects that are queryable
    (tables and datasources)"""

    # ---------------------------------------------------------------
    # class attributes to define when deriving BaseDatasource
    # ---------------------------------------------------------------
    __tablename__ = None  # {connector_name}_datasource
    type = None  # datasoure type, str to be defined when deriving this class
    baselink = None  # url portion pointing to ModelView endpoint
    column_class = None  # link to derivative of BaseColumn
    metric_class = None  # link to derivative of BaseMetric
    owner_class = None

    # Used to do code highlighting when displaying the query in the UI
    query_language = None

    name = None  # can be a Column or a property pointing to one

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

    sql = None
    owners = None
    update_from_object_fields = None

    @declared_attr
    def slices(self):
        return relationship(
            'Slice',
            primaryjoin=lambda: and_(
                foreign(Slice.datasource_id) == self.id,
                foreign(Slice.datasource_type) == self.type,
            ),
        )

    # placeholder for a relationship to a derivative of BaseColumn
    columns = []
    # placeholder for a relationship to a derivative of BaseMetric
    metrics = []

    @property
    def uid(self):
        """Unique id across datasource types"""
        return f'{self.id}__{self.type}'

    @property
    def column_names(self):
        return sorted([c.column_name for c in self.columns], key=lambda x: x or '')

    @property
    def columns_types(self):
        return {c.column_name: c.type for c in self.columns}

    @property
    def main_dttm_col(self):
        return 'timestamp'

    @property
    def datasource_name(self):
        raise NotImplementedError()

    @property
    def connection(self):
        """String representing the context of the Datasource"""
        return None

    @property
    def schema(self):
        """String representing the schema of the Datasource (if it applies)"""
        return None

    @property
    def filterable_column_names(self):
        return sorted([c.column_name for c in self.columns if c.filterable])

    @property
    def dttm_cols(self):
        return []

    @property
    def url(self):
        return '/{}/edit/{}'.format(self.baselink, self.id)

    @property
    def explore_url(self):
        if self.default_endpoint:
            return self.default_endpoint
        else:
            return '/superset/explore/{obj.type}/{obj.id}/'.format(obj=self)

    @property
    def column_formats(self):
        return {
            m.metric_name: m.d3format
            for m in self.metrics
            if m.d3format
        }

    def add_missing_metrics(self, metrics):
        exisiting_metrics = {m.metric_name for m in self.metrics}
        for metric in metrics:
            if metric.metric_name not in exisiting_metrics:
                metric.table_id = self.id
                self.metrics += [metric]

    @property
    def short_data(self):
        """Data representation of the datasource sent to the frontend"""
        return {
            'edit_url': self.url,
            'id': self.id,
            'uid': self.uid,
            'schema': self.schema,
            'name': self.name,
            'type': self.type,
            'connection': self.connection,
            'creator': str(self.created_by),
        }

    @property
    def select_star(self):
        pass

    @property
    def data(self):
        """Data representation of the datasource sent to the frontend"""
        order_by_choices = []
        # self.column_names return sorted column_names
        for s in self.column_names:
            s = str(s or '')
            order_by_choices.append((json.dumps([s, True]), s + ' [asc]'))
            order_by_choices.append((json.dumps([s, False]), s + ' [desc]'))

        verbose_map = {'__timestamp': 'Time'}
        verbose_map.update({
            o.metric_name: o.verbose_name or o.metric_name
            for o in self.metrics
        })
        verbose_map.update({
            o.column_name: o.verbose_name or o.column_name
            for o in self.columns
        })
        return {
            # simple fields
            'id': self.id,
            'column_formats': self.column_formats,
            'description': self.description,
            'database': self.database.data,  # pylint: disable=no-member
            'default_endpoint': self.default_endpoint,
            'filter_select': self.filter_select_enabled,  # TODO deprecate
            'filter_select_enabled': self.filter_select_enabled,
            'name': self.name,
            'datasource_name': self.datasource_name,
            'type': self.type,
            'schema': self.schema,
            'offset': self.offset,
            'cache_timeout': self.cache_timeout,
            'params': self.params,
            'perm': self.perm,
            'edit_url': self.url,

            # sqla-specific
            'sql': self.sql,

            # one to many
            'columns': [o.data for o in self.columns],
            'metrics': [o.data for o in self.metrics],

            # TODO deprecate, move logic to JS
            'order_by_choices': order_by_choices,
            'owners': [owner.id for owner in self.owners],
            'verbose_map': verbose_map,
            'select_star': self.select_star,
        }

    @staticmethod
    def filter_values_handler(
            values, target_column_is_numeric=False, is_list_target=False):
        def handle_single_value(v):
            # backward compatibility with previous <select> components
            if isinstance(v, str):
                v = v.strip('\t\n\'"')
                if target_column_is_numeric:
                    # For backwards compatibility and edge cases
                    # where a column data type might have changed
                    v = utils.string_to_num(v)
                if v == '<NULL>':
                    return None
                elif v == '<empty string>':
                    return ''
            return v
        if isinstance(values, (list, tuple)):
            values = [handle_single_value(v) for v in values]
        else:
            values = handle_single_value(values)
        if is_list_target and not isinstance(values, (tuple, list)):
            values = [values]
        elif not is_list_target and isinstance(values, (tuple, list)):
            if len(values) > 0:
                values = values[0]
            else:
                values = None
        return values

    def external_metadata(self):
        """Returns column information from the external system"""
        raise NotImplementedError()

    def get_query_str(self, query_obj):
        """Returns a query as a string

        This is used to be displayed to the user so that she/he can
        understand what is taking place behind the scene"""
        raise NotImplementedError()

    def query(self, query_obj):
        """Executes the query and returns a dataframe

        query_obj is a dictionary representing Superset's query interface.
        Should return a ``superset.models.helpers.QueryResult``
        """
        raise NotImplementedError()

    def values_for_column(self, column_name, limit=10000):
        """Given a column, returns an iterable of distinct values

        This is used to populate the dropdown showing a list of
        values in filters in the explore view"""
        raise NotImplementedError()

    @staticmethod
    def default_query(qry):
        return qry

    def get_column(self, column_name):
        for col in self.columns:
            if col.column_name == column_name:
                return col

    def get_fk_many_from_list(
            self, object_list, fkmany, fkmany_class, key_attr):
        """Update ORM one-to-many list from object list

        Used for syncing metrics and columns using the same code"""

        object_dict = {o.get(key_attr): o for o in object_list}
        object_keys = [o.get(key_attr) for o in object_list]

        # delete fks that have been removed
        fkmany = [o for o in fkmany if getattr(o, key_attr) in object_keys]

        # sync existing fks
        for fk in fkmany:
            obj = object_dict.get(getattr(fk, key_attr))
            for attr in fkmany_class.update_from_object_fields:
                setattr(fk, attr, obj.get(attr))

        # create new fks
        new_fks = []
        orm_keys = [getattr(o, key_attr) for o in fkmany]
        for obj in object_list:
            key = obj.get(key_attr)
            if key not in orm_keys:
                del obj['id']
                orm_kwargs = {}
                for k in obj:
                    if (
                        k in fkmany_class.update_from_object_fields and
                        k in obj
                    ):
                        orm_kwargs[k] = obj[k]
                new_obj = fkmany_class(**orm_kwargs)
                new_fks.append(new_obj)
        fkmany += new_fks
        return fkmany

    def update_from_object(self, obj):
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

        self.owners = obj.get('owners', [])

        # Syncing metrics
        metrics = self.get_fk_many_from_list(
            obj.get('metrics'), self.metrics, self.metric_class, 'metric_name')
        self.metrics = metrics

        # Syncing columns
        self.columns = self.get_fk_many_from_list(
            obj.get('columns'), self.columns, self.column_class, 'column_name')


class BaseColumn(AuditMixinNullable, ImportMixin):
    """Interface for column"""

    __tablename__ = None  # {connector_name}_column

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
    export_fields = []

    def __repr__(self):
        return self.column_name

    num_types = (
        'DOUBLE', 'FLOAT', 'INT', 'BIGINT', 'NUMBER',
        'LONG', 'REAL', 'NUMERIC', 'DECIMAL', 'MONEY',
    )
    date_types = ('DATE', 'TIME', 'DATETIME')
    str_types = ('VARCHAR', 'STRING', 'CHAR')

    @property
    def is_num(self):
        return (
            self.type and
            any([t in self.type.upper() for t in self.num_types])
        )

    @property
    def is_time(self):
        return (
            self.type and
            any([t in self.type.upper() for t in self.date_types])
        )

    @property
    def is_string(self):
        return (
            self.type and
            any([t in self.type.upper() for t in self.str_types])
        )

    @property
    def expression(self):
        raise NotImplementedError()

    @property
    def data(self):
        attrs = (
            'id', 'column_name', 'verbose_name', 'description', 'expression',
            'filterable', 'groupby', 'is_dttm', 'type',
            'database_expression', 'python_date_format',
        )
        return {s: getattr(self, s) for s in attrs if hasattr(self, s)}


class BaseMetric(AuditMixinNullable, ImportMixin):

    """Interface for Metrics"""

    __tablename__ = None  # {connector_name}_metric

    id = Column(Integer, primary_key=True)
    metric_name = Column(String(255), nullable=False)
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    description = Column(Text)
    is_restricted = Column(Boolean, default=False, nullable=True)
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
    def perm(self):
        raise NotImplementedError()

    @property
    def expression(self):
        raise NotImplementedError()

    @property
    def data(self):
        attrs = (
            'id', 'metric_name', 'verbose_name', 'description', 'expression',
            'warning_text', 'd3format')
        return {s: getattr(self, s) for s in attrs}
