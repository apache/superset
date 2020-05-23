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
"""a collection of Annotation-related models"""
from typing import Any, Dict

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable


class AnnotationLayer(Model, AuditMixinNullable):

    """A logical namespace for a set of annotations"""

    __tablename__ = "annotation_layer"
    id = Column(Integer, primary_key=True)
    name = Column(String(250))
    descr = Column(Text)

    def __repr__(self) -> str:
        return self.name


class Annotation(Model, AuditMixinNullable):

    """Time-related annotation"""

    __tablename__ = "annotation"
    id = Column(Integer, primary_key=True)
    start_dttm = Column(DateTime)
    end_dttm = Column(DateTime)
    layer_id = Column(Integer, ForeignKey("annotation_layer.id"), nullable=False)
    short_descr = Column(String(500))
    long_descr = Column(Text)
    layer = relationship(AnnotationLayer, backref="annotation")
    json_metadata = Column(Text)

    __table_args__ = (Index("ti_dag_state", layer_id, start_dttm, end_dttm),)

    @property
    def data(self) -> Dict[str, Any]:
        return {
            "layer_id": self.layer_id,
            "start_dttm": self.start_dttm,
            "end_dttm": self.end_dttm,
            "short_descr": self.short_descr,
            "long_descr": self.long_descr,
            "layer": self.layer.name if self.layer else None,
        }
