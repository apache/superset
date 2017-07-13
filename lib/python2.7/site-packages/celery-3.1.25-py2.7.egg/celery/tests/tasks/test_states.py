from __future__ import absolute_import

from celery.states import state
from celery import states
from celery.tests.case import Case


class test_state_precedence(Case):

    def test_gt(self):
        self.assertGreater(state(states.SUCCESS),
                           state(states.PENDING))
        self.assertGreater(state(states.FAILURE),
                           state(states.RECEIVED))
        self.assertGreater(state(states.REVOKED),
                           state(states.STARTED))
        self.assertGreater(state(states.SUCCESS),
                           state('CRASHED'))
        self.assertGreater(state(states.FAILURE),
                           state('CRASHED'))
        self.assertFalse(state(states.REVOKED) > state('CRASHED'))

    def test_lt(self):
        self.assertLess(state(states.PENDING), state(states.SUCCESS))
        self.assertLess(state(states.RECEIVED), state(states.FAILURE))
        self.assertLess(state(states.STARTED), state(states.REVOKED))
        self.assertLess(state('CRASHED'), state(states.SUCCESS))
        self.assertLess(state('CRASHED'), state(states.FAILURE))
        self.assertTrue(state(states.REVOKED) < state('CRASHED'))
        self.assertTrue(state(states.REVOKED) <= state('CRASHED'))
        self.assertTrue(state('CRASHED') >= state(states.REVOKED))
