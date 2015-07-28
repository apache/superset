from flask.ext.appbuilder import Model
from datetime import datetime, timedelta
from flask.ext.appbuilder.models.mixins import AuditMixin, FileColumn, ImageColumn
from flask.ext.appbuilder.security.sqla.models import User
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app import db, utils
from dateutil.parser import parse
import json


client = utils.get_pydruid_client()

class Datasource(Model, AuditMixin):
    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(String(256), unique=True)
    is_featured = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    description = Column(Text)
    default_endpoint = Column(Text)
    user_id = Column(Integer,
        ForeignKey('ab_user.id'))
    owner = relationship('User', backref='datasources', foreign_keys=[user_id])

    @property
    def metrics_combo(self):
        return sorted(
            [(m.metric_name, m.verbose_name) for m in self.metrics],
            key=lambda x: x[1])

    def __repr__(self):
        return self.datasource_name

    @property
    def datasource_link(self):
        url = "/panoramix/datasource/{}/".format(self.datasource_name)
        return '<a href="{url}">{self.datasource_name}</a>'.format(**locals())

    def get_metric_obj(self, metric_name):
        return [
            m.json_obj for m in self.metrics
            if m.metric_name == metric_name
        ][0]

    @classmethod
    def latest_metadata(cls, name):
        results = client.time_boundary(datasource=name)
        max_time = results[0]['result']['minTime']
        max_time = parse(max_time)
        intervals = (max_time - timedelta(seconds=1)).isoformat() + '/'
        intervals += (max_time + timedelta(seconds=1)).isoformat()
        segment_metadata = client.segment_metadata(
            datasource=name,
            intervals=intervals)
        if segment_metadata:
            return segment_metadata[-1]['columns']

    def generate_metrics(self):
        for col in self.columns:
            col.generate_metrics()

    @classmethod
    def sync_to_db(cls, name):
        datasource = db.session.query(cls).filter_by(datasource_name=name).first()
        if not datasource:
            db.session.add(cls(datasource_name=name))
        cols = cls.latest_metadata(name)
        if not cols:
            return
        for col in cols:
            col_obj = (
                db.session
                .query(Column)
                .filter_by(datasource_name=name, column_name=col)
                .first()
            )
            datatype = cols[col]['type']
            if not col_obj:
                col_obj = Column(datasource_name=name, column_name=col)
                db.session.add(col_obj)
            if datatype == "STRING":
                col_obj.groupby = True
                col_obj.filterable = True
            if col_obj:
                col_obj.type = cols[col]['type']
            col_obj.generate_metrics()
        db.session.commit()

    @property
    def column_names(self):
        return sorted([c.column_name for c in self.columns])

    @property
    def groupby_column_names(self):
        return sorted([c.column_name for c in self.columns if c.groupby])

    @property
    def filterable_column_names(self):
        return sorted([c.column_name for c in self.columns if c.filterable])


class Metric(Model):
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
    verbose_name = Column(String(1024))
    metric_type = Column(String(32))
    datasource_name = Column(
        String(256),
        ForeignKey('datasources.datasource_name'))
    datasource = relationship('Datasource', backref='metrics')
    json = Column(Text)
    description = Column(Text)

    @property
    def json_obj(self):
        try:
            obj = json.loads(self.json)
        except Exception as e:
            obj = {}
        return obj


class Column(Model, AuditMixin):
    __tablename__ = 'columns'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(
        String(256),
        ForeignKey('datasources.datasource_name'))
    datasource = relationship('Datasource', backref='columns')
    column_name = Column(String(256))
    is_active = Column(Boolean, default=True)
    type = Column(String(32))
    groupby = Column(Boolean, default=False)
    count_distinct = Column(Boolean, default=False)
    sum = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)
    description = Column(Text)

    def __repr__(self):
        return self.column_name

    @property
    def isnum(self):
        return self.type in ('LONG', 'DOUBLE')

    def generate_metrics(self):
        M = Metric
        metrics = []
        metrics.append(Metric(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            json=json.dumps({
                'type': 'count', 'name': 'count'})
        ))

        if self.sum and self.isnum:
            mt = self.type.lower() + 'Sum'
            name='sum__' + self.column_name
            metrics.append(Metric(
                metric_name=name,
                metric_type='sum',
                verbose_name='SUM({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.min and self.isnum:
            mt = self.type.lower() + 'Min'
            name='min__' + self.column_name
            metrics.append(Metric(
                metric_name=name,
                metric_type='min',
                verbose_name='MIN({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.max and self.isnum:
            mt = self.type.lower() + 'Max'
            name='max__' + self.column_name
            metrics.append(Metric(
                metric_name=name,
                metric_type='max',
                verbose_name='MAX({})'.format(self.column_name),
                json=json.dumps({
                    'type': mt, 'name': name, 'fieldName': self.column_name})
            ))
        if self.count_distinct:
            mt = 'count_distinct'
            name='count_distinct__' + self.column_name
            metrics.append(Metric(
                metric_name=name,
                verbose_name='COUNT(DISTINCT {})'.format(self.column_name),
                metric_type='count_distinct',
                json=json.dumps({
                    'type': 'cardinality',
                    'name': name,
                    'fieldNames': [self.column_name]})
            ))
        for metric in metrics:
            m = (
                db.session.query(M)
                .filter(M.datasource_name==self.datasource_name)
                .filter(M.metric_name==metric.metric_name)
                .first()
            )
            metric.datasource_name = self.datasource_name
            if not m:
                db.session.add(metric)
                db.session.commit()
