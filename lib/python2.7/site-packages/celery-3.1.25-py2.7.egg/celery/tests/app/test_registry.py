from __future__ import absolute_import

from celery.app.registry import _unpickle_task, _unpickle_task_v2
from celery.tests.case import AppCase, depends_on_current_app


def returns():
    return 1


class test_unpickle_task(AppCase):

    @depends_on_current_app
    def test_unpickle_v1(self):
        self.app.tasks['txfoo'] = 'bar'
        self.assertEqual(_unpickle_task('txfoo'), 'bar')

    @depends_on_current_app
    def test_unpickle_v2(self):
        self.app.tasks['txfoo1'] = 'bar1'
        self.assertEqual(_unpickle_task_v2('txfoo1'), 'bar1')
        self.assertEqual(_unpickle_task_v2('txfoo1', module='celery'), 'bar1')


class test_TaskRegistry(AppCase):

    def setup(self):
        self.mytask = self.app.task(name='A', shared=False)(returns)
        self.myperiodic = self.app.task(
            name='B', shared=False, type='periodic',
        )(returns)

    def test_NotRegistered_str(self):
        self.assertTrue(repr(self.app.tasks.NotRegistered('tasks.add')))

    def assertRegisterUnregisterCls(self, r, task):
        r.unregister(task)
        with self.assertRaises(r.NotRegistered):
            r.unregister(task)
        r.register(task)
        self.assertIn(task.name, r)

    def assertRegisterUnregisterFunc(self, r, task, task_name):
        with self.assertRaises(r.NotRegistered):
            r.unregister(task_name)
        r.register(task, task_name)
        self.assertIn(task_name, r)

    def test_task_registry(self):
        r = self.app._tasks
        self.assertIsInstance(r, dict, 'TaskRegistry is mapping')

        self.assertRegisterUnregisterCls(r, self.mytask)
        self.assertRegisterUnregisterCls(r, self.myperiodic)

        r.register(self.myperiodic)
        r.unregister(self.myperiodic.name)
        self.assertNotIn(self.myperiodic, r)
        r.register(self.myperiodic)

        tasks = dict(r)
        self.assertIs(tasks.get(self.mytask.name), self.mytask)
        self.assertIs(tasks.get(self.myperiodic.name), self.myperiodic)

        self.assertIs(r[self.mytask.name], self.mytask)
        self.assertIs(r[self.myperiodic.name], self.myperiodic)

        r.unregister(self.mytask)
        self.assertNotIn(self.mytask.name, r)
        r.unregister(self.myperiodic)
        self.assertNotIn(self.myperiodic.name, r)

        self.assertTrue(self.mytask.run())
        self.assertTrue(self.myperiodic.run())

    def test_compat(self):
        self.assertTrue(self.app.tasks.regular())
        self.assertTrue(self.app.tasks.periodic())
