from flask_appbuilder import Model
from sqlalchemy import Column, Integer, Text

from superset.models.helpers import AuditMixinNullable


class DynamicPlugin(Model, AuditMixinNullable):
    id = Column(Integer, primary_key=True)
    name = Column(Text, unique=True, nullable=False)
    key = Column(Text, unique=True, nullable=False)
    bundle_url = Column(Text, unique=True, nullable=False)

    def __repr__(self):
        return self.name
