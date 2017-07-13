from __future__ import absolute_import

import operator

from celery.concurrency import solo
from celery.utils.functional import noop
from celery.tests.case import AppCase


class test_solo_TaskPool(AppCase):

    def test_on_start(self):
        x = solo.TaskPool()
        x.on_start()

    def test_on_apply(self):
        x = solo.TaskPool()
        x.on_start()
        x.on_apply(operator.add, (2, 2), {}, noop, noop)

    def test_info(self):
        x = solo.TaskPool()
        x.on_start()
        self.assertTrue(x.info)
