from __future__ import absolute_import

import pickle

from heapq import heappush
from time import time

from kombu.clocks import LamportClock, timetuple

from .case import Mock, Case


class test_LamportClock(Case):

    def test_clocks(self):
        c1 = LamportClock()
        c2 = LamportClock()

        c1.forward()
        c2.forward()
        c1.forward()
        c1.forward()
        c2.adjust(c1.value)
        self.assertEqual(c2.value, c1.value + 1)
        self.assertTrue(repr(c1))

        c2_val = c2.value
        c2.forward()
        c2.forward()
        c2.adjust(c1.value)
        self.assertEqual(c2.value, c2_val + 2 + 1)

        c1.adjust(c2.value)
        self.assertEqual(c1.value, c2.value + 1)

    def test_sort(self):
        c = LamportClock()
        pid1 = 'a.example.com:312'
        pid2 = 'b.example.com:311'

        events = []

        m1 = (c.forward(), pid1)
        heappush(events, m1)
        m2 = (c.forward(), pid2)
        heappush(events, m2)
        m3 = (c.forward(), pid1)
        heappush(events, m3)
        m4 = (30, pid1)
        heappush(events, m4)
        m5 = (30, pid2)
        heappush(events, m5)

        self.assertEqual(str(c), str(c.value))

        self.assertEqual(c.sort_heap(events), m1)
        self.assertEqual(c.sort_heap([m4, m5]), m4)
        self.assertEqual(c.sort_heap([m4, m5, m1]), m4)


class test_timetuple(Case):

    def test_repr(self):
        x = timetuple(133, time(), 'id', Mock())
        self.assertTrue(repr(x))

    def test_pickleable(self):
        x = timetuple(133, time(), 'id', 'obj')
        self.assertEqual(pickle.loads(pickle.dumps(x)), tuple(x))

    def test_order(self):
        t1 = time()
        t2 = time() + 300  # windows clock not reliable
        a = timetuple(133, t1, 'A', 'obj')
        b = timetuple(140, t1, 'A', 'obj')
        self.assertTrue(a.__getnewargs__())
        self.assertEqual(a.clock, 133)
        self.assertEqual(a.timestamp, t1)
        self.assertEqual(a.id, 'A')
        self.assertEqual(a.obj, 'obj')
        self.assertTrue(
            a <= b,
        )
        self.assertTrue(
            b >= a,
        )

        self.assertEqual(
            timetuple(134, time(), 'A', 'obj').__lt__(tuple()),
            NotImplemented,
        )
        self.assertGreater(
            timetuple(134, t2, 'A', 'obj'),
            timetuple(133, t1, 'A', 'obj'),
        )
        self.assertGreater(
            timetuple(134, t1, 'B', 'obj'),
            timetuple(134, t1, 'A', 'obj'),
        )

        self.assertGreater(
            timetuple(None, t2, 'B', 'obj'),
            timetuple(None, t1, 'A', 'obj'),
        )
