# -*- coding: utf-8 -*-
"""
celery.states
=============

Built-in task states.

.. _states:

States
------

See :ref:`task-states`.

.. _statesets:

Sets
----

.. state:: READY_STATES

READY_STATES
~~~~~~~~~~~~

Set of states meaning the task result is ready (has been executed).

.. state:: UNREADY_STATES

UNREADY_STATES
~~~~~~~~~~~~~~

Set of states meaning the task result is not ready (has not been executed).

.. state:: EXCEPTION_STATES

EXCEPTION_STATES
~~~~~~~~~~~~~~~~

Set of states meaning the task returned an exception.

.. state:: PROPAGATE_STATES

PROPAGATE_STATES
~~~~~~~~~~~~~~~~

Set of exception states that should propagate exceptions to the user.

.. state:: ALL_STATES

ALL_STATES
~~~~~~~~~~

Set of all possible states.


Misc.
-----

"""
from __future__ import absolute_import

__all__ = ['PENDING', 'RECEIVED', 'STARTED', 'SUCCESS', 'FAILURE',
           'REVOKED', 'RETRY', 'IGNORED', 'READY_STATES', 'UNREADY_STATES',
           'EXCEPTION_STATES', 'PROPAGATE_STATES', 'precedence', 'state']

#: State precedence.
#: None represents the precedence of an unknown state.
#: Lower index means higher precedence.
PRECEDENCE = ['SUCCESS',
              'FAILURE',
              None,
              'REVOKED',
              'STARTED',
              'RECEIVED',
              'RETRY',
              'PENDING']

#: Hash lookup of PRECEDENCE to index
PRECEDENCE_LOOKUP = dict(zip(PRECEDENCE, range(0, len(PRECEDENCE))))
NONE_PRECEDENCE = PRECEDENCE_LOOKUP[None]


def precedence(state):
    """Get the precedence index for state.

    Lower index means higher precedence.

    """
    try:
        return PRECEDENCE_LOOKUP[state]
    except KeyError:
        return NONE_PRECEDENCE


class state(str):
    """State is a subclass of :class:`str`, implementing comparison
    methods adhering to state precedence rules::

        >>> from celery.states import state, PENDING, SUCCESS

        >>> state(PENDING) < state(SUCCESS)
        True

    Any custom state is considered to be lower than :state:`FAILURE` and
    :state:`SUCCESS`, but higher than any of the other built-in states::

        >>> state('PROGRESS') > state(STARTED)
        True

        >>> state('PROGRESS') > state('SUCCESS')
        False

    """

    def compare(self, other, fun):
        return fun(precedence(self), precedence(other))

    def __gt__(self, other):
        return precedence(self) < precedence(other)

    def __ge__(self, other):
        return precedence(self) <= precedence(other)

    def __lt__(self, other):
        return precedence(self) > precedence(other)

    def __le__(self, other):
        return precedence(self) >= precedence(other)

#: Task state is unknown (assumed pending since you know the id).
PENDING = 'PENDING'
#: Task was received by a worker.
RECEIVED = 'RECEIVED'
#: Task was started by a worker (:setting:`CELERY_TRACK_STARTED`).
STARTED = 'STARTED'
#: Task succeeded
SUCCESS = 'SUCCESS'
#: Task failed
FAILURE = 'FAILURE'
#: Task was revoked.
REVOKED = 'REVOKED'
#: Task is waiting for retry.
RETRY = 'RETRY'
IGNORED = 'IGNORED'
REJECTED = 'REJECTED'

READY_STATES = frozenset([SUCCESS, FAILURE, REVOKED])
UNREADY_STATES = frozenset([PENDING, RECEIVED, STARTED, RETRY])
EXCEPTION_STATES = frozenset([RETRY, FAILURE, REVOKED])
PROPAGATE_STATES = frozenset([FAILURE, REVOKED])

ALL_STATES = frozenset([PENDING, RECEIVED, STARTED,
                        SUCCESS, FAILURE, RETRY, REVOKED])
