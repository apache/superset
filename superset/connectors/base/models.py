import json

from sqlalchemy import (
    and_, Boolean, Column, Integer, String, Text,
)
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import foreign, relationship

from superset import utils
from superset.models.core import Slice
from superset.models.helpers import AuditMixinNullable, ImportMixin


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
        return '{self.id}__{self.type}'.format(**locals())

    @property
    def column_names(self):
        return sorted([c.column_name for c in self.columns])

    @property
    def columns_types(self):
        return {c.column_name: c.type for c in self.columns}

    @property
    def main_dttm_col(self):
        return 'timestamp'

    @property
    def connection(self):
        """String representing the context of the Datasource"""
        return None

    @property
    def schema(self):
        """String representing the schema of the Datasource (if it applies)"""
        return None

    @property
    def groupby_column_names(self):
        return sorted([c.column_name for c in self.columns if c.groupby])

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
    def metrics_combo(self):
        return sorted(
            [
                (m.metric_name, m.verbose_name or m.metric_name)
                for m in self.metrics],
            key=lambda x: x[1])

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
    def data(self):
        """Data representation of the datasource sent to the frontend"""
        order_by_choices = []
        for s in sorted(self.column_names):
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
            'all_cols': utils.choicify(self.column_names),
            'column_formats': self.column_formats,
            'database': self.database.data,  # pylint: disable=no-member
            'edit_url': self.url,
            'filter_select': self.filter_select_enabled,
            'filterable_cols': utils.choicify(self.filterable_column_names),
            'gb_cols': utils.choicify(self.groupby_column_names),
            'id': self.id,
            'metrics_combo': self.metrics_combo,
            'name': self.name,
            'order_by_choices': order_by_choices,
            'type': self.type,
            'metrics': [o.data for o in self.metrics],
            'columns': [o.data for o in self.columns],
            'verbose_map': verbose_map,
        }

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


class BaseColumn(AuditMixinNullable, ImportMixin):
    """Interface for column"""

    __tablename__ = None  # {connector_name}_column

    id = Column(Integer, primary_key=True)
    column_name = Column(String(255))
    verbose_name = Column(String(1024))
    is_active = Column(Boolean, default=True)
    type = Column(String(32))
    groupby = Column(Boolean, default=False)
    count_distinct = Column(Boolean, default=False)
    sum = Column(Boolean, default=False)
    avg = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    description = Column(Text)
    is_dttm = None

    # [optional] Set this to support import/export functionality
    export_fields = []

    def __repr__(self):
        return self.column_name

    num_types = (
        'DOUBLE', 'FLOAT', 'INT', 'BIGINT',
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
            'column_name', 'verbose_name', 'description', 'expression',
            'filterable', 'groupby', 'is_dttm', 'type')
        return {s: getattr(self, s) for s in attrs}


class BaseMetric(AuditMixinNullable, ImportMixin):

    """Interface for Metrics"""

    __tablename__ = None  # {connector_name}_metric

    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
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
            'metric_name', 'verbose_name', 'description', 'expression',
            'warning_text')
        return {s: getattr(self, s) for s in attrs}
