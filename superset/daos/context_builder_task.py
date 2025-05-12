from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import ContextBuilderTask


class ContextBuilderTaskDAO(BaseDAO[ContextBuilderTask]):
    @staticmethod
    def find_by_task_id(task_id: int) -> ContextBuilderTask | None:
        return db.session.query(ContextBuilderTask).filter_by(task_id=task_id).one_or_none()

    @staticmethod
    def get_latest_task_for_database(database_id: int) -> ContextBuilderTask:
        return (
            db.session.query(ContextBuilderTask)
            .filter(ContextBuilderTask.database_id == database_id)
            .order_by(ContextBuilderTask.started_time.desc())
            .first()
        )

    @staticmethod
    def get_last_successful_task_for_database(database_id: int) -> ContextBuilderTask:
        return (
            db.session.query(ContextBuilderTask)
            .filter(
                ContextBuilderTask.database_id == database_id,
                ContextBuilderTask.status == "SUCCESS",
            )
            .order_by(ContextBuilderTask.started_time.desc())
            .first()
        )

    @staticmethod
    def get_last_two_tasks_for_database(database_id: int) -> list[ContextBuilderTask]:
        return (
            db.session.query(ContextBuilderTask)
            .filter(ContextBuilderTask.database_id == database_id)
            .order_by(ContextBuilderTask.started_time.desc())
            .limit(2)
            .all()
        )
