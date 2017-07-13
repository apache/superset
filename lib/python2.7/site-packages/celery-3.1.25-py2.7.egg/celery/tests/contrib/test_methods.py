from __future__ import absolute_import

from celery.contrib.methods import task_method, task

from celery.tests.case import AppCase, patch


class test_task_method(AppCase):

    def test_task_method(self):

        class X(object):

            def __init__(self):
                self.state = 0

            @self.app.task(shared=False, filter=task_method)
            def add(self, x):
                self.state += x

        x = X()
        x.add(2)
        self.assertEqual(x.state, 2)
        x.add(4)
        self.assertEqual(x.state, 6)

        self.assertTrue(X.add)
        self.assertIs(x.add.__self__, x)

    def test_task(self):
        with patch('celery.contrib.methods.current_app') as curapp:
            fun = object()
            task(fun, x=1)
            curapp.task.assert_called_with(fun, x=1, filter=task_method)
