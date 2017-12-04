from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import unittest

from mock import Mock
from datetime import datetime, timedelta
from time import mktime, time

from superset import db

from .base_tests import SupersetTestCase

from superset.tasks.manager import (
    TaskManager, ManagedTask,
    TaskThread, _run_task, task_manager
)
from superset.tasks.tasklist import (
    BaseTask, DruidClusterRefreshTask
)
from superset.tasks.processor import (
    validate_config, execute_task_config
)
from superset.tasks.utils import (
    is_valid_crontab_str, round_time, is_valid_task_config
)
from superset.tasks.models import CronTask
from superset.tasks.views import CronTaskModelView
from superset.connectors.druid.models import DruidCluster


class TasksTestCase(unittest.TestCase):
    def test_execute_nonexisting_task(self):
        fake_task_config = {'type': 'does_not_exist'}
        result = execute_task_config(fake_task_config)
        self.assertFalse(result)

    def test_execute_task_and_validate_config(self):
        invalid_config = {'badkey': 'badval'}
        with self.assertRaises(ValueError):
            validate_config(invalid_config)
        invalid_config = {'type': 'badtype'}
        with self.assertRaises(ValueError):
            validate_config(invalid_config)

    def test_druid_refresh_task_validate_config(self):
        invalid_config = {'type': 'druid_cluster_refresh'}
        with self.assertRaises(ValueError):
            validate_config(invalid_config)
        invalid_config['clusters'] = 'somestring'
        with self.assertRaises(TypeError):
            validate_config(invalid_config)
        invalid_config['clusters'] = []
        with self.assertRaises(ValueError):
            validate_config(invalid_config)
        valid_config = {
            'type': 'druid_cluster_refresh',
            'clusters': ['A', 'B'],
        }
        self.assertTrue(validate_config(valid_config))

    def test_base_task(self):
        base_task = BaseTask({'type': 'fake_task'})
        self.assertFalse(base_task.execute())
        self.assertFalse(BaseTask.validate_task_config(base_task.config))

    def test_is_valid_config_json(self):
        invalid_json_str = '{"invalid_key: invalid_va'
        self.assertFalse(is_valid_task_config(invalid_json_str))
        valid_json_str = (
            '{"type": "druid_cluster_refresh", "clusters": ["a", "b"]}'
        )
        self.assertTrue(is_valid_task_config(valid_json_str))

    def test_is_valid_crontab_str(self):
        invalid_crontab_str = '5 * *'
        self.assertFalse(is_valid_crontab_str(invalid_crontab_str))
        valid_crontab_str = '5 10 * * *'
        self.assertTrue(is_valid_crontab_str(valid_crontab_str))

    def test_round_time(self):
        test_datetime = datetime(2000, 1, 1, 5, 25, 20, 624555)
        to_nearest_second = round_time(test_datetime, roundTo=1)
        to_nearest_halfMinute = round_time(test_datetime, roundTo=30)
        to_nearest_minute = round_time(test_datetime, roundTo=60)
        self.assertEqual(to_nearest_second.microsecond, 0)
        self.assertEqual(to_nearest_second.second, 20)
        self.assertEqual(to_nearest_halfMinute.microsecond, 0)
        self.assertEqual(to_nearest_halfMinute.second, 30)
        self.assertEqual(to_nearest_halfMinute.minute, 25)
        self.assertEqual(to_nearest_minute.microsecond, 0)
        self.assertEqual(to_nearest_minute.second, 0)
        self.assertEqual(to_nearest_minute.minute, 25)

    def test_managed_task_class(self):
        test_task = Mock()
        test_task.abs_execution_time = Mock(return_value=10)
        test_task.id = 99999
        test_task.config_json = Mock(return_value={
            'type': 'druid_cluster_refresh',
            'clusters': ['__fake_cluster']
        })
        test_task.is_repeating = Mock(return_value=True)
        managed_task = ManagedTask(test_task)
        self.assertEqual('Task id=99999', managed_task.__repr__())
        self.assertEqual(True, managed_task.is_repeating())
        test_task2 = Mock()
        test_task2.abs_execution_time = Mock(return_value=100)
        managed_task2 = ManagedTask(test_task2)
        self.assertEqual(-1, managed_task.__cmp__(managed_task2))
        self.assertEqual(0, managed_task.__cmp__(managed_task))
        self.assertEqual(1, managed_task2.__cmp__(managed_task))
        self.assertTrue(managed_task.__lt__(managed_task2))
        self.assertTrue(managed_task.__eq__(managed_task))
        self.assertFalse(managed_task.__eq__(managed_task2))
        self.assertTrue(managed_task.run())
        managed_task.invalidate()
        self.assertFalse(_run_task(managed_task))
        self.assertFalse(managed_task.is_repeating())

    def test_task_thread_class(self):
        watcher = {'val': 0}

        def test_target(arg1, arg2):
            watcher['val'] += arg1 * arg2

        test_thread = TaskThread(test_target, 5, 6)
        test_thread.run()
        self.assertEqual(30, watcher['val'])

    def test_task_manager(self):
        watcher = {
            'fake_id': 9990,
            'enqueue': 0
        }

        def get_fake_task(abs_time=0, repeat=False, id=None):
            fake_task = Mock()
            if not id:
                fake_task.id = watcher['fake_id']
                watcher['fake_id'] += 1
            else:
                fake_task.id = id
            fake_task.abs_execution_time = Mock(
                return_value=abs_time
            )
            fake_task.config_json = Mock(
                return_value={'type': 'dummytask'}
            )
            fake_task.is_repeating = Mock(return_value=repeat)
            return fake_task, fake_task.id

        f_task1, fid1 = get_fake_task()
        f_task2, fid2 = get_fake_task()
        f_task3, fid3 = get_fake_task()
        f_existing_tasks = [f_task1, f_task2, f_task3]
        test_tm = TaskManager(f_existing_tasks, tick_delay=0)
        self.assertEqual(3, len(test_tm.task_queue.queue))
        self.assertEqual(3, len(test_tm.managed_tasks))
        for fid in [fid1, fid2, fid3]:
            self.assertIn(fid, test_tm.managed_tasks)
        test_tm.enqueue_task(f_task1, False)
        test_tm.enqueue_task(f_task2, False)
        self.assertEqual(5, len(test_tm.task_queue.queue))
        self.assertEqual(3, len(test_tm.managed_tasks))
        self.assertFalse(test_tm.task_queue.queue[0].valid)
        self.assertFalse(test_tm.task_queue.queue[1].valid)
        self.assertTrue(test_tm.task_queue.queue[3].valid)
        self.assertTrue(test_tm.task_queue.queue[4].valid)
        self.assertFalse(test_tm.cancel_task(-5))
        test_tm.cancel_task(fid1)
        self.assertEqual(2, len(test_tm.managed_tasks))
        self.assertEqual(5, len(test_tm.task_queue.queue))
        self.assertFalse(test_tm.task_queue.queue[3].valid)
        test_tm.is_ticking = True
        test_tm._tick()
        self.assertEqual(0, len(test_tm.managed_tasks))
        self.assertEqual(0, len(test_tm.task_queue.queue))
        self.assertFalse(test_tm.is_ticking)
        test_tm.is_ticking = True
        test_tm._tick()
        self.assertFalse(test_tm.is_ticking)
        test_tm.is_ticking = True
        test_tm.start_ticking()
        self.assertFalse(test_tm.is_ticking)
        for f_task in [f_task1, f_task2, f_task3]:
            test_tm.enqueue_task(f_task, False)
        for fid in [fid1, fid2, fid3]:
            test_tm.cancel_task(fid)
        self.assertEqual(0, len(test_tm.managed_tasks))
        test_tm.is_ticking = True
        test_tm._tick()
        self.assertEqual(0, len(test_tm.task_queue.queue))
        f_task4, fid4 = get_fake_task(repeat=True)
        test_tm.enqueue_task(f_task4, False)

        def enqueue_side_effect(task):
            watcher['enqueue'] += 1

        test_tm.enqueue_task = Mock(
            side_effect=enqueue_side_effect
        )
        test_tm.is_ticking = True
        test_tm._tick()
        self.assertEqual(watcher['enqueue'], 1)
        self.assertEqual(0, len(test_tm.task_queue.queue))
        test_tm = TaskManager(tick_delay=1)
        f_task5, fid5 = get_fake_task(repeat=False)
        datetime_now = datetime.now()
        datetime_run = datetime_now + timedelta(0, 3)
        f_runtime_5 = mktime(datetime_run.timetuple())
        f_task5.abs_execution_time = Mock(return_value=f_runtime_5)
        test_tm.enqueue_task(f_task5)
        test_tm.thread.join()
        self.assertEqual(0, len(test_tm.task_queue.queue))


class DBTaskTestCase(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(DBTaskTestCase, self).__init__(*args, **kwargs)

    def test_cron_task_model(self):
        self.login(username='admin')
        crontask1 = (
            db.session.query(CronTask)
            .filter_by(id=99991)
            .first()
        )
        crontask2 = (
            db.session.query(CronTask)
            .filter_by(id=99992)
            .first()
        )
        if crontask1:
            db.session.delete(crontask1)
        if crontask2:
            db.session.delete(crontask2)
        db.session.commit()
        crontask1 = CronTask(
            id=99991,
            crontab_str='30 * * * *',
            config='{"type": "faketask"}',
            description='fake test for testing',
        )
        crontask2 = CronTask(
            id=99992,
            crontab_str='45 * * * *',
            config='{"type": "faketask"}',
            description='another fake test for testing',
        )
        db.session.add(crontask1)
        db.session.add(crontask2)
        db.session.commit()
        expected = '99991: 30 * * * *'
        self.assertEqual(expected, crontask1.__repr__())
        expected = '99992: 45 * * * *'
        self.assertEqual(expected, crontask2.__repr__())
        self.assertTrue(crontask1.is_repeating())
        expected = '[Task].(id:99991)'
        self.assertEqual(expected, crontask1.get_perm())
        expected = '[Task].(id:99992)'
        self.assertEqual(expected, crontask2.get_perm())
        expected = {'type': 'faketask'}
        self.assertEqual(expected, crontask1.config_json())
        self.assertEqual(expected, crontask2.config_json())
        cronobj1 = crontask1.crontab_obj()
        cronobj2 = crontask2.crontab_obj()
        half_hour = datetime(2000, 1, 1, 1, 30)
        three_quarter_hour = datetime(2000, 1, 1, 1, 45)
        self.assertTrue(cronobj1.test(half_hour))
        self.assertTrue(cronobj2.test(three_quarter_hour))
        quarter_hour = datetime(2000, 1, 1, 1, 15)
        self.assertFalse(cronobj1.test(quarter_hour))
        self.assertFalse(cronobj2.test(quarter_hour))
        self.assertTrue(crontask1.time_to_execution() > 0)
        time_to_exec_sec = crontask1.time_to_execution_nearest_sec()
        self.assertEqual(time_to_exec_sec, round(time_to_exec_sec))
        timestamp_now = time()
        self.assertTrue(crontask1.abs_execution_time() >= round(timestamp_now))
        abs_exec_time = crontask1.abs_execution_time()
        self.assertEqual(round(abs_exec_time), abs_exec_time)
        self.assertTrue(crontask1.next_execution_date() >= datetime.now())
        self.logout()

    def test_crontask_model_view(self):
        f_modelview = CronTaskModelView()
        fake_task = Mock()
        fake_task.crontab_str = '5 * *'
        with self.assertRaises(ValueError):
            f_modelview.pre_update(fake_task)
        fake_task.crontab_str = '* * * * *'
        fake_task.config = '{"invalid"'
        with self.assertRaises(ValueError):
            f_modelview.pre_update(fake_task)
        fake_task.config = '{"type": "faketask"}'
        f_modelview.post_update(fake_task)
        self.assertTrue(task_manager.is_ticking)
        self.assertEqual(1, len(task_manager.task_queue.queue))
        f_modelview.pre_delete(fake_task)
        self.assertEqual(0, len(task_manager.managed_tasks))

    def test_execute_druid_refresh_task(self):
        self.login(username='admin')
        cluster1 = (
            db.session.query(DruidCluster)
            .filter_by(cluster_name='test_cluster1')
            .first()
        )
        if cluster1:
            db.session.delete(cluster1)
        db.session.commit()
        cluster2 = (
            db.session.query(DruidCluster)
            .filter_by(cluster_name='test_cluster2')
            .first()
        )
        if cluster2:
            db.session.delete(cluster2)
        db.session.commit()

        cluster1 = DruidCluster(
            cluster_name='test_cluster1',
            coordinator_host='localhost',
            coordinator_port=7979,
            broker_host='localhost',
            broker_port=7980,
            metadata_last_refreshed=datetime.now()
        )
        cluster2 = DruidCluster(
            cluster_name='test_cluster2',
            coordinator_host='localhost',
            coordinator_port=8080,
            broker_host='localhost',
            broker_port=8880,
            metadata_last_refreshed=datetime.now()
        )
        db.session.add(cluster1)
        db.session.add(cluster2)
        refresh_count = {'val': 0}

        def refresh_side_effect(refreshAll):
            refresh_count['val'] += 1
        cluster1.refresh_datasources = Mock(
            return_value=True,
            side_effect=refresh_side_effect)
        cluster2.refresh_datasources = Mock(
            return_value=True,
            side_effect=refresh_side_effect)
        db.session.commit()
        task_config = {
            'type': 'druid_cluster_refresh',
            'clusters': ['test_cluster1', 'test_cluster2']
        }
        self.assertTrue(execute_task_config(task_config))
        self.assertEqual(refresh_count['val'], 2)
        self.assertEqual('druid_cluster_refresh', DruidClusterRefreshTask({
            'type': 'druid_cluster_refresh'
        }).__repr__())
        self.logout()
