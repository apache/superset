"""a collection of Annotation-related models"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_appbuilder import Model
from sqlalchemy import (
    Column, DateTime, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable


class AnnotationLayer(Model, AuditMixinNullable):

    """A logical namespace for a set of annotations"""

    __tablename__ = 'annotation_layer'
    id = Column(Integer, primary_key=True)
    name = Column(String(250))
    descr = Column(Text)

    def __repr__(self):
        return self.name


class Annotation(Model, AuditMixinNullable):

    """Time-related annotation"""

    __tablename__ = 'annotation'
    id = Column(Integer, primary_key=True)
    start_dttm = Column(DateTime)
    end_dttm = Column(DateTime)
    layer_id = Column(Integer, ForeignKey('annotation_layer.id'))
    short_descr = Column(String(500))
    long_descr = Column(Text)
    layer = relationship(
        AnnotationLayer,
        backref='annotation')

    __table_args__ = (
        Index('ti_dag_state', layer_id, start_dttm, end_dttm),
    )

    @property
    def data(self):
        return {
            'layer_id': self.layer_id,
            'start_dttm': self.start_dttm,
            'end_dttm': self.end_dttm,
            'short_descr': self.short_descr,
            'long_descr': self.long_descr,
            'layer': self.layer.name if self.layer else None,
        }
