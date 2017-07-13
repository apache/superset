from __future__ import absolute_import

from celery.tests.case import AppCase, SkipTest


class MockWindow(object):

    def getmaxyx(self):
        return self.y, self.x


class test_CursesDisplay(AppCase):

    def setup(self):
        try:
            import curses  # noqa
        except ImportError:
            raise SkipTest('curses monitor requires curses')

        from celery.events import cursesmon
        self.monitor = cursesmon.CursesMonitor(object(), app=self.app)
        self.win = MockWindow()
        self.monitor.win = self.win

    def test_format_row_with_default_widths(self):
        self.win.x, self.win.y = 91, 24
        row = self.monitor.format_row(
            '783da208-77d0-40ca-b3d6-37dd6dbb55d3',
            'task.task.task.task.task.task.task.task.task.tas',
            'workerworkerworkerworkerworkerworkerworkerworker',
            '21:13:20',
            'SUCCESS')
        self.assertEqual('783da208-77d0-40ca-b3d6-37dd6dbb55d3 '
                         'workerworker... task.task.[.]tas 21:13:20 SUCCESS ',
                         row)

    def test_format_row_with_truncated_uuid(self):
        self.win.x, self.win.y = 80, 24
        row = self.monitor.format_row(
            '783da208-77d0-40ca-b3d6-37dd6dbb55d3',
            'task.task.task.task.task.task.task.task.task.tas',
            'workerworkerworkerworkerworkerworkerworkerworker',
            '21:13:20',
            'SUCCESS')
        self.assertEqual('783da208-77d0-40ca-b3d... workerworker... '
                         'task.task.[.]tas 21:13:20 SUCCESS ',
                         row)

    def test_format_title_row(self):
        self.win.x, self.win.y = 80, 24
        row = self.monitor.format_row('UUID', 'TASK',
                                      'WORKER', 'TIME', 'STATE')
        self.assertEqual('UUID                      WORKER          '
                         'TASK             TIME     STATE   ',
                         row)

    def test_format_row_for_wide_screen_with_short_uuid(self):
        self.win.x, self.win.y = 140, 24
        row = self.monitor.format_row(
            '783da208-77d0-40ca-b3d6-37dd6dbb55d3',
            'task.task.task.task.task.task.task.task.task.tas',
            'workerworkerworkerworkerworkerworkerworkerworker',
            '21:13:20',
            'SUCCESS')
        self.assertEqual(136, len(row))
        self.assertEqual('783da208-77d0-40ca-b3d6-37dd6dbb55d3 '
                         'workerworkerworkerworkerworkerworker... '
                         'task.task.task.task.task.task.task.[.]tas '
                         '21:13:20 SUCCESS ',
                         row)
