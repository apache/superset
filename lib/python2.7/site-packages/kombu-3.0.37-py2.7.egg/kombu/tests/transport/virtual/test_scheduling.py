from __future__ import absolute_import

from kombu.transport.virtual.scheduling import FairCycle

from kombu.tests.case import Case


class MyEmpty(Exception):
    pass


def consume(fun, n):
    r = []
    for i in range(n):
        r.append(fun())
    return r


class test_FairCycle(Case):

    def test_cycle(self):
        resources = ['a', 'b', 'c', 'd', 'e']

        def echo(r, timeout=None):
            return r

        # cycle should be ['a', 'b', 'c', 'd', 'e', ... repeat]
        cycle = FairCycle(echo, resources, MyEmpty)
        for i in range(len(resources)):
            self.assertEqual(cycle.get(), (resources[i],
                                           resources[i]))
        for i in range(len(resources)):
            self.assertEqual(cycle.get(), (resources[i],
                                           resources[i]))

    def test_cycle_breaks(self):
        resources = ['a', 'b', 'c', 'd', 'e']

        def echo(r):
            if r == 'c':
                raise MyEmpty(r)
            return r

        cycle = FairCycle(echo, resources, MyEmpty)
        self.assertEqual(
            consume(cycle.get, len(resources)),
            [('a', 'a'), ('b', 'b'), ('d', 'd'),
             ('e', 'e'), ('a', 'a')],
        )
        self.assertEqual(
            consume(cycle.get, len(resources)),
            [('b', 'b'), ('d', 'd'), ('e', 'e'),
             ('a', 'a'), ('b', 'b')],
        )
        cycle2 = FairCycle(echo, ['c', 'c'], MyEmpty)
        with self.assertRaises(MyEmpty):
            consume(cycle2.get, 3)

    def test_cycle_no_resources(self):
        cycle = FairCycle(None, [], MyEmpty)
        cycle.pos = 10

        with self.assertRaises(MyEmpty):
            cycle._next()

    def test__repr__(self):
        self.assertTrue(repr(FairCycle(lambda x: x, [1, 2, 3], MyEmpty)))
