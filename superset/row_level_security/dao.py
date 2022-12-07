from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.dao.base import BaseDAO


class RLSDAO(BaseDAO):
    model_cls = RowLevelSecurityFilter
