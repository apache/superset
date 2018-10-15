from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable


class UserAttribute(Model, AuditMixinNullable):

    """
    Custom attributes attached to the user.

    Extending the user attribute is tricky due to its dependency on the
    authentication typew an circular dependencies in Superset. Instead, we use
    a custom model for adding attributes.

    """

    __tablename__ = 'user_attribute'
    id = Column(Integer, primary_key=True)  # pylint: disable=invalid-name
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    user = relationship(
        security_manager.user_model,
        backref='extra_attributes',
        foreign_keys=[user_id],
    )

    welcome_dashboard_id = Column(Integer, ForeignKey('dashboards.id'))
    welcome_dashboard = relationship('Dashboard')
