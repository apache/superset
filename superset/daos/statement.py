# DODO added #32839641
from __future__ import annotations

import logging

from superset.commands.statement.exceptions import (
    StatementNotFoundError,
)
from superset.daos.base import BaseDAO
from superset.extensions import db, security_manager
from superset.models.statement import Statement
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class StatementDAO(BaseDAO[Statement]):
    @classmethod
    def get_by_id(cls, pk: int) -> Statement:
        try:
            query = db.session.query(Statement).filter(Statement.id == pk)
            statement = query.one_or_none()

            if not statement:
                raise StatementNotFoundError()
        except AttributeError as ex:
            raise StatementNotFoundError() from ex
        return statement

    @staticmethod
    def get_statements_by_user_id() -> (
        list[Statement]
    ):  # получаем все заявки пользователя по его id
        user_id = get_user_id()
        try:
            user = (
                db.session.query(security_manager.user_model)
                .filter(security_manager.user_model.id == user_id)
                .one_or_none()
            )
            return user.statements
        except Exception:  # pylint: disable=broad-except
            return []
