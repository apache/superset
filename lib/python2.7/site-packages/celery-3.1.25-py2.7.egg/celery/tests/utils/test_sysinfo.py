from __future__ import absolute_import

import os

from celery.utils.sysinfo import load_average, df

from celery.tests.case import Case, SkipTest, patch


class test_load_average(Case):

    def test_avg(self):
        if not hasattr(os, 'getloadavg'):
            raise SkipTest('getloadavg not available')
        with patch('os.getloadavg') as getloadavg:
            getloadavg.return_value = 0.54736328125, 0.6357421875, 0.69921875
            l = load_average()
            self.assertTrue(l)
            self.assertEqual(l, (0.55, 0.64, 0.7))


class test_df(Case):

    def test_df(self):
        try:
            from posix import statvfs_result  # noqa
        except ImportError:
            raise SkipTest('statvfs not available')
        x = df('/')
        self.assertTrue(x.total_blocks)
        self.assertTrue(x.available)
        self.assertTrue(x.capacity)
        self.assertTrue(x.stat)
