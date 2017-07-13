# -*- coding: utf-8 -*-
"""
    celery.backends.database
    ~~~~~~~~~~~~~~~~~~~~~~~~

    SQLAlchemy result store backend.

"""
from __future__ import absolute_import

import logging
from contextlib import contextmanager
from functools import wraps

from celery import states
from celery.backends.base import BaseBackend
from celery.exceptions import ImproperlyConfigured
from celery.five import range
from celery.utils.timeutils import maybe_timedelta

from .models import Task
from .models import TaskSet
from .session import SessionManager

logger = logging.getLogger(__name__)

__all__ = ['DatabaseBackend']


def _sqlalchemy_installed():
    try:
        import sqlalchemy
    except ImportError:
        raise ImproperlyConfigured(
            'The database result backend requires SQLAlchemy to be installed.'
            'See http://pypi.python.org/pypi/SQLAlchemy')
    return sqlalchemy
_sqlalchemy_installed()

from sqlalchemy.exc import DatabaseError, InvalidRequestError  # noqa
from sqlalchemy.orm.exc import StaleDataError  # noqa


@contextmanager
def session_cleanup(session):
    try:
        yield
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def retry(fun):

    @wraps(fun)
    def _inner(*args, **kwargs):
        max_retries = kwargs.pop('max_retries', 3)

        for retries in range(max_retries):
            try:
                return fun(*args, **kwargs)
            except (DatabaseError, InvalidRequestError, StaleDataError):
                logger.warning(
                    "Failed operation %s. Retrying %s more times.",
                    fun.__name__, max_retries - retries - 1,
                    exc_info=True,
                )
                if retries + 1 >= max_retries:
                    raise

    return _inner


class DatabaseBackend(BaseBackend):
    """The database result backend."""
    # ResultSet.iterate should sleep this much between each pool,
    # to not bombard the database with queries.
    subpolling_interval = 0.5

    def __init__(self, dburi=None, expires=None,
                 engine_options=None, url=None, **kwargs):
        # The `url` argument was added later and is used by
        # the app to set backend by url (celery.backends.get_backend_by_url)
        super(DatabaseBackend, self).__init__(**kwargs)
        conf = self.app.conf
        self.expires = maybe_timedelta(self.prepare_expires(expires))
        self.url = url or dburi or conf.CELERY_RESULT_DBURI
        self.engine_options = dict(
            engine_options or {},
            **conf.CELERY_RESULT_ENGINE_OPTIONS or {})
        self.short_lived_sessions = kwargs.get(
            'short_lived_sessions',
            conf.CELERY_RESULT_DB_SHORT_LIVED_SESSIONS,
        )

        tablenames = conf.CELERY_RESULT_DB_TABLENAMES or {}
        Task.__table__.name = tablenames.get('task', 'celery_taskmeta')
        TaskSet.__table__.name = tablenames.get('group', 'celery_tasksetmeta')

        if not self.url:
            raise ImproperlyConfigured(
                'Missing connection string! Do you have '
                'CELERY_RESULT_DBURI set to a real value?')

    def ResultSession(self, session_manager=SessionManager()):
        return session_manager.session_factory(
            dburi=self.url,
            short_lived_sessions=self.short_lived_sessions,
            **self.engine_options
        )

    @retry
    def _store_result(self, task_id, result, status,
                      traceback=None, max_retries=3, **kwargs):
        """Store return value and status of an executed task."""
        session = self.ResultSession()
        with session_cleanup(session):
            task = list(session.query(Task).filter(Task.task_id == task_id))
            task = task and task[0]
            if not task:
                task = Task(task_id)
                session.add(task)
                session.flush()
            task.result = result
            task.status = status
            task.traceback = traceback
            session.commit()
            return result

    @retry
    def _get_task_meta_for(self, task_id):
        """Get task metadata for a task by id."""
        session = self.ResultSession()
        with session_cleanup(session):
            task = list(session.query(Task).filter(Task.task_id == task_id))
            task = task and task[0]
            if not task:
                task = Task(task_id)
                task.status = states.PENDING
                task.result = None
            return self.meta_from_decoded(task.to_dict())

    @retry
    def _save_group(self, group_id, result):
        """Store the result of an executed group."""
        session = self.ResultSession()
        with session_cleanup(session):
            group = TaskSet(group_id, result)
            session.add(group)
            session.flush()
            session.commit()
            return result

    @retry
    def _restore_group(self, group_id):
        """Get metadata for group by id."""
        session = self.ResultSession()
        with session_cleanup(session):
            group = session.query(TaskSet).filter(
                TaskSet.taskset_id == group_id).first()
            if group:
                return group.to_dict()

    @retry
    def _delete_group(self, group_id):
        """Delete metadata for group by id."""
        session = self.ResultSession()
        with session_cleanup(session):
            session.query(TaskSet).filter(
                TaskSet.taskset_id == group_id).delete()
            session.flush()
            session.commit()

    @retry
    def _forget(self, task_id):
        """Forget about result."""
        session = self.ResultSession()
        with session_cleanup(session):
            session.query(Task).filter(Task.task_id == task_id).delete()
            session.commit()

    def cleanup(self):
        """Delete expired metadata."""
        session = self.ResultSession()
        expires = self.expires
        now = self.app.now()
        with session_cleanup(session):
            session.query(Task).filter(
                Task.date_done < (now - expires)).delete()
            session.query(TaskSet).filter(
                TaskSet.date_done < (now - expires)).delete()
            session.commit()

    def __reduce__(self, args=(), kwargs={}):
        kwargs.update(
            dict(dburi=self.url,
                 expires=self.expires,
                 engine_options=self.engine_options))
        return super(DatabaseBackend, self).__reduce__(args, kwargs)
