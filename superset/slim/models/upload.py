import uuid as sys_uuid

from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from flask_appbuilder import Model

from superset.extensions import security_manager

def generate_uuid():
    return sys_uuid.uuid4().hex

class UploadModel(Model):
    __tablename__ = 'slim_upload'

    id = Column(Integer, primary_key=True)
    guid = Column(String(65), default=generate_uuid)
    path = Column(String(255), nullable=False)
    name = Column(String(125), nullable=False)
    type = Column(String(45), nullable=False)
    status = Column(String(45), nullable=False)
    source = Column(String(125), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("ab_user.id"))
    created_by = relationship(
        security_manager.user_model, backref="slim_upload", foreign_keys=[created_by_id]
    )
