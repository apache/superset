from __future__ import absolute_import

from datetime import timedelta

import sys
sys.modules.pop('celery.task', None)

from celery.schedules import schedule  # noqa
from celery.task import (  # noqa
    periodic_task,
    PeriodicTask
)
from celery.utils.timeutils import timedelta_seconds  # noqa

from celery.tests.case import AppCase, depends_on_current_app  # noqa


class test_Task(AppCase):

    def test_base_task_inherits_magic_kwargs_from_app(self):
        from celery.task import Task as OldTask

        class timkX(OldTask):
            abstract = True

        with self.Celery(set_as_current=False,
                         accept_magic_kwargs=True) as app:
            timkX.bind(app)
            # see #918
            self.assertFalse(timkX.accept_magic_kwargs)

            from celery import Task as NewTask

            class timkY(NewTask):
                abstract = True

            timkY.bind(app)
            self.assertFalse(timkY.accept_magic_kwargs)


@depends_on_current_app
class test_periodic_tasks(AppCase):

    def setup(self):
        @periodic_task(app=self.app, shared=False,
                       run_every=schedule(timedelta(hours=1), app=self.app))
        def my_periodic():
            pass
        self.my_periodic = my_periodic

    def now(self):
        return self.app.now()

    def test_must_have_run_every(self):
        with self.assertRaises(NotImplementedError):
            type('Foo', (PeriodicTask, ), {'__module__': __name__})

    def test_remaining_estimate(self):
        s = self.my_periodic.run_every
        self.assertIsInstance(
            s.remaining_estimate(s.maybe_make_aware(self.now())),
            timedelta)

    def test_is_due_not_due(self):
        due, remaining = self.my_periodic.run_every.is_due(self.now())
        self.assertFalse(due)
        # This assertion may fail if executed in the
        # first minute of an hour, thus 59 instead of 60
        self.assertGreater(remaining, 59)

    def test_is_due(self):
        p = self.my_periodic
        due, remaining = p.run_every.is_due(
            self.now() - p.run_every.run_every,
        )
        self.assertTrue(due)
        self.assertEqual(remaining,
                         timedelta_seconds(p.run_every.run_every))

    def test_schedule_repr(self):
        p = self.my_periodic
        self.assertTrue(repr(p.run_every))
