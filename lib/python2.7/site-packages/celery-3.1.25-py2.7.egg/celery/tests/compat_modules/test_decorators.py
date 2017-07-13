from __future__ import absolute_import

import warnings

from celery.task import base

from celery.tests.case import AppCase, depends_on_current_app


def add(x, y):
    return x + y


@depends_on_current_app
class test_decorators(AppCase):

    def test_task_alias(self):
        from celery import task
        self.assertTrue(task.__file__)
        self.assertTrue(task(add))

    def setup(self):
        with warnings.catch_warnings(record=True):
            from celery import decorators
            self.decorators = decorators

    def assertCompatDecorator(self, decorator, type, **opts):
        task = decorator(**opts)(add)
        self.assertEqual(task(8, 8), 16)
        self.assertTrue(task.accept_magic_kwargs)
        self.assertIsInstance(task, type)

    def test_task(self):
        self.assertCompatDecorator(self.decorators.task, base.BaseTask)

    def test_periodic_task(self):
        self.assertCompatDecorator(self.decorators.periodic_task,
                                   base.BaseTask,
                                   run_every=1)
