from flask.ext.appbuilder import Model
from datetime import datetime, timedelta
from flask.ext.appbuilder.models.mixins import AuditMixin, FileColumn, ImageColumn
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app import db, utils
from dateutil.parser import parse
"""

You can use the extra Flask-AppBuilder fields and Mixin's

AuditMixin will add automatic timestamp of created and modified by who


"""
client = utils.get_pydruid_client()

class Datasource(Model, AuditMixin):
    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(String(256), unique=True)
    is_featured = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    description = Column(Text)
    columns = relationship('Column', backref='datasource')
    udfs = relationship('JavascriptUdf', backref='datasource')

    @property
    def metrics(self):
        return [col.column_name for col in self.columns if not col.groupby]

    def __repr__(self):
        return self.datasource_name

    @property
    def datasource_link(self):
        url = "/panoramix/datasource/{}/".format(self.datasource_name)
        return '<a href="{url}">{self.datasource_name}</a>'.format(**locals())

    @classmethod
    def latest_metadata(cls, name):
        results = client.time_boundary(datasource=name)
        max_time = results[0]['result']['maxTime']
        max_time = parse(max_time)
        intervals = (max_time - timedelta(seconds=1)).isoformat() + '/'
        intervals += (max_time + timedelta(seconds=1)).isoformat()
        segment_metadata = client.segment_metadata(
            datasource=name,
            intervals=intervals)
        return segment_metadata[-1]['columns']

    @classmethod
    def sync_to_db(cls, name):
        datasource = db.session.query(cls).filter_by(datasource_name=name).first()
        if not datasource:
            db.session.add(cls(datasource_name=name))
        cols = cls.latest_metadata(name)
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


class JavascriptUdf(Model, AuditMixin):
    __tablename__ = 'udfs'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(
        String(256),
        ForeignKey('datasources.datasource_name'))
    udf_name = Column(String(256))
    column_list = Column(String(1024))
    code = Column(Text)

    def __repr__(self):
        return self.udf_name


class Column(Model, AuditMixin):
    __tablename__ = 'columns'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(
        String(256),
        ForeignKey('datasources.datasource_name'))
    column_name = Column(String(256))
    is_active = Column(Boolean, default=True)
    type = Column(String(32))
    groupby = Column(Boolean, default=False)
    count_distinct = Column(Boolean, default=False)
    sum = Column(Boolean, default=False)
    max = Column(Boolean, default=False)
    min = Column(Boolean, default=False)
    filterable = Column(Boolean, default=False)

    def __repr__(self):
        return self.column_name

