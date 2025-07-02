from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable
from superset.connectors.sqla.models import SqlaTable


class ReportTemplate(Model, AuditMixinNullable):
    """Template for generating reports based on datasets."""

    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(250), nullable=False)
    description = Column(Text)
    dataset_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    template_path = Column(String(1024), nullable=False)

    dataset = relationship(SqlaTable, foreign_keys=[dataset_id])

    def __repr__(self) -> str:
        return f"ReportTemplate<{self.id} {self.name}>"
