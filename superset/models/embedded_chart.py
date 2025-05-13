import uuid

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable


class EmbeddedChart(Model, AuditMixinNullable):
    """
    A configuration of embedding for a chart/slice.
    References the chart/slice, and contains a config for embedding that chart.
    """

    __tablename__ = "embedded_charts"

    uuid = Column(UUIDType(binary=True), default=uuid.uuid4, primary_key=True)
    allow_domain_list = Column(Text)
    slice_id = Column(
        Integer,
        ForeignKey("slices.id", ondelete="CASCADE"),
        nullable=False,
    )
    slice = relationship(
        "Slice",
        foreign_keys=[slice_id],
    )

    @property
    def allowed_domains(self) -> list[str]:
        """
        A list of domains which are allowed to embed the chart.
        An empty list means any domain can embed.
        """
        return self.allow_domain_list.split(",") if self.allow_domain_list else []
