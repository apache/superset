import logging
from typing import Any, Dict, Optional

from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.dao.exceptions import DAOCreateFailedError
from superset.extensions import appbuilder, db, security_manager
from superset.row_level_security.commands.exceptions import RLSRuleNotFoundError
from superset.row_level_security.dao import RLSDAO

logger = logging.getLogger(__name__)


class UpdateRLSRuleCommand(BaseCommand):
    def __init__(self, model_id: int, data: Dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[RowLevelSecurityFilter] = None

    def run(self) -> Any:
        self.validate()
        try:
            rule = RLSDAO.update(self._model, self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise DAOCreateFailedError

        return rule

    def validate(self) -> None:
        # check rule exists
        # self._model = db.session.query(RowLevelSecurityFilter).filter(RowLevelSecurityFilter.id == self._model_id).one_or_none()
        self._model = RLSDAO.find_by_id(self._model_id)
        if not self._model:
            raise RLSRuleNotFoundError()

        roles = security_manager.find_roles_by_id(self._properties.get("roles", []))

        tables = []
        for table_id in self._properties.get("tables", []):
            table = (
                db.session.query(SqlaTable)
                .filter(SqlaTable.id == table_id)
                .one_or_none()
            )
            if table:
                tables.append(table)

        self._properties["roles"] = roles
        self._properties["tables"] = tables
