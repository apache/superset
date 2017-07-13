from __future__ import absolute_import

from kombu.async.semaphore import LaxBoundedSemaphore

from kombu.tests.case import Case


class test_LaxBoundedSemaphore(Case):

    def test_over_release(self):
        x = LaxBoundedSemaphore(2)
        calls = []
        for i in range(1, 21):
            x.acquire(calls.append, i)
        x.release()
        x.acquire(calls.append, 'x')
        x.release()
        x.acquire(calls.append, 'y')

        self.assertEqual(calls, [1, 2, 3, 4])

        for i in range(30):
            x.release()
        self.assertEqual(calls, list(range(1, 21)) + ['x', 'y'])
        self.assertEqual(x.value, x.initial_value)

        calls[:] = []
        for i in range(1, 11):
            x.acquire(calls.append, i)
        for i in range(1, 11):
            x.release()
        self.assertEqual(calls, list(range(1, 11)))

        calls[:] = []
        self.assertEqual(x.value, x.initial_value)
        x.acquire(calls.append, 'x')
        self.assertEqual(x.value, 1)
        x.acquire(calls.append, 'y')
        self.assertEqual(x.value, 0)
        x.release()
        self.assertEqual(x.value, 1)
        x.release()
        self.assertEqual(x.value, 2)
        x.release()
        self.assertEqual(x.value, 2)
