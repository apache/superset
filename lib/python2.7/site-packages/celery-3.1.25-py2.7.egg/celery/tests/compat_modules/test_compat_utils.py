from __future__ import absolute_import

import celery

from celery.app.task import Task as ModernTask
from celery.task.base import Task as CompatTask

from celery.tests.case import AppCase, depends_on_current_app


@depends_on_current_app
class test_MagicModule(AppCase):

    def test_class_property_set_without_type(self):
        self.assertTrue(ModernTask.__dict__['app'].__get__(CompatTask()))

    def test_class_property_set_on_class(self):
        self.assertIs(ModernTask.__dict__['app'].__set__(None, None),
                      ModernTask.__dict__['app'])

    def test_class_property_set(self):

        class X(CompatTask):
            pass
        ModernTask.__dict__['app'].__set__(X(), self.app)
        self.assertIs(X.app, self.app)

    def test_dir(self):
        self.assertTrue(dir(celery.messaging))

    def test_direct(self):
        self.assertTrue(celery.task)

    def test_app_attrs(self):
        self.assertEqual(celery.task.control.broadcast,
                         celery.current_app.control.broadcast)

    def test_decorators_task(self):
        @celery.decorators.task
        def _test_decorators_task():
            pass

        self.assertTrue(_test_decorators_task.accept_magic_kwargs)

    def test_decorators_periodic_task(self):
        @celery.decorators.periodic_task(run_every=3600)
        def _test_decorators_ptask():
            pass

        self.assertTrue(_test_decorators_ptask.accept_magic_kwargs)
