# DODO added #32839641
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.daos.base import BaseDAO
from superset.extensions import db, security_manager
from superset.models.team import Team
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class TeamDAO(BaseDAO[Team]):
    @staticmethod
    def validate_slug_uniqueness(slug: str) -> bool:
        if not slug:
            return True
        team_query = db.session.query(Team).filter(Team.slug == slug)
        return not db.session.query(team_query.exists()).scalar()

    @staticmethod
    def find_team_by_slug(team_slug: str) -> Team:
        try:
            team = db.session.query(Team).filter(Team.slug == team_slug).one_or_none()
            return team
        except Exception:
            logger.warning("Cant find team by slug")
            raise

    @staticmethod
    def get_team_by_user_id() -> Optional[Team]:
        """Get user's team by user ID.

        Returns:
            Optional[Team]: The user's team or None if not found
        """
        user_id = get_user_id()
        try:
            user = (
                db.session.query(security_manager.user_model)
                .filter(security_manager.user_model.id == user_id)
                .one_or_none()
            )
            if not user or not user.teams:
                return None
            return user.teams[0]
        except SQLAlchemyError as ex:
            logger.error("Failed to get team for user %s: %s", user_id, str(ex))
            return None
