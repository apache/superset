# DODO added #32839641
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from superset.daos.base import BaseDAO
from superset.extensions import db, security_manager
from superset.models.user_info import UserInfo
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class UserInfoDAO(BaseDAO[UserInfo]):
    # base_filter = DashboardAccessFilter
    @staticmethod
    def get_onboarding() -> dict[str, Any]:
        user_id = get_user_id()
        try:
            user_info = (
                db.session.query(UserInfo)
                .filter(UserInfo.user_id == user_id)
                .one_or_none()
            )
            return user_info.__dict__
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "User id = %s dont have onboarding info in database", user_id
            )
            return {"onboarding_started_time": None, "is_onboarding_finished": False}

    @classmethod
    def get_by_user_id(cls, user_id: int) -> UserInfo:
        try:
            query = db.session.query(UserInfo).filter(UserInfo.user_id == user_id)
            user_info = query.one_or_none()
            if not user_info:
                UserInfoDAO.create_userinfo("ru")
                cls.get_by_user_id(user_id)
        except AttributeError:
            UserInfoDAO.create_userinfo("ru")
            cls.get_by_user_id(user_id)
        return user_info

    @staticmethod
    def create_onboarding(
        dodo_role: str, started_time: datetime
    ) -> bool:  # DODO changed #33835937
        """Create onboarding record for user.

        Args:
            dodo_role (str): User's role in Dodo
            started_time (datetime.datetime): Onboarding start time

        Returns:
            bool: True if successful, False otherwise
        """
        user_id = get_user_id()
        if not user_id:
            logger.warning("Cannot create onboarding - user ID not found")
            return False

        try:
            user_info = UserInfo(
                user_id=user_id,
                dodo_role=dodo_role,
                onboarding_started_time=started_time,
            )
            db.session.add(user_info)
            db.session.commit()  # pylint: disable=consider-using-transaction
            return True

        except SQLAlchemyError as ex:
            logger.error("Database error creating onboarding: %s", str(ex))
            db.session.rollback()  # pylint: disable=consider-using-transaction
            return False
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Failed to create onboarding: %s", str(ex))
            return False

    @staticmethod
    def update_onboarding(dodo_role: str, started_time: datetime) -> dict[str, Any]:
        user_id = get_user_id()
        try:
            user_info = (
                db.session.query(UserInfo)
                .filter(UserInfo.user_id == user_id)
                .one_or_none()
            )
            user_info.dodo_role = dodo_role
            user_info.onboarding_started_time = started_time
            db.session.commit()  # pylint: disable=consider-using-transaction
        except AttributeError:
            UserInfoDAO.create_onboarding(dodo_role, started_time)

        return {"dodo_role": dodo_role, "onboarding_started_time": started_time}

    @staticmethod
    def finish_onboarding() -> bool:
        """Mark user's onboarding as finished.

        Returns:
            bool: Status of onboarding completion
        """
        user_id = get_user_id()
        if not user_id:
            logger.warning("Cannot finish onboarding - user ID not found")
            return False

        try:
            user_info = (
                db.session.query(UserInfo)
                .filter(UserInfo.user_id == user_id)
                .one_or_none()
            )
            if not user_info:
                logger.warning("User info not found for user %s", user_id)
                return False

            user_info.is_onboarding_finished = True
            db.session.merge(user_info)
            return True
        except SQLAlchemyError as ex:
            logger.error("Database error finishing onboarding: %s", str(ex))
            db.session.rollback()  # pylint: disable=consider-using-transaction
            return False

    @staticmethod
    def create_userinfo(lang: str) -> bool:  # DODO changed #33835937
        """Create user info record.

        Args:
            lang (str): User's language preference

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            user_id = get_user_id()
            if not user_id:
                logger.warning("Cannot create user info - user ID not found")
                return False

            model = UserInfo()
            model.language = lang
            model.user_id = user_id
            try:
                db.session.add(model)
                db.session.commit()  # pylint: disable=consider-using-transaction
                return True
            except SQLAlchemyError as ex:
                logger.error("Database error creating user info: %s", str(ex))
                db.session.rollback()  # pylint: disable=consider-using-transaction
                return False
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Failed to create user info: %s", str(ex))
            return False

    @staticmethod
    def update_language(lang: str) -> None:  # DODO changed #33835937
        try:
            user_id = get_user_id()
            user_info = (
                db.session.query(UserInfo)
                .filter(UserInfo.user_id == user_id)
                .one_or_none()
            )
            user_info.language = lang
        except AttributeError:
            UserInfoDAO.create_userinfo(lang)

    @staticmethod
    def get_country_by_user_id() -> list[UserInfo]:
        user_id = get_user_id()
        try:
            user = (
                db.session.query(security_manager.user_model)
                .filter(security_manager.user_model.id == user_id)
                .one_or_none()
            )
            return user.user_info
        except Exception:  # pylint: disable=broad-except
            return []

    @staticmethod
    def get_dodo_role(user_id: int) -> str:  # DODO changed #33835937
        """Get dodo role for a user by their ID.

        Args:
            user_id: The ID of the user

        Returns:
            str: The dodo role of the user or empty string if not found/error
        """
        dodo_role = ""
        try:
            user_info = (
                db.session.query(UserInfo)
                .filter(UserInfo.user_id == user_id)
                .one_or_none()
            )
            if user_info and user_info.dodo_role:
                dodo_role = user_info.dodo_role
        except SQLAlchemyError:
            logger.warning("Exception when select dodo_role from db")
        except AttributeError:
            logger.warning("User id = %s dont have dodo_role in database", user_id)
        except Exception:  # pylint: disable=broad-except
            logger.exception("Error get dodo_role")

        return dodo_role
