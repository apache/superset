from __future__ import absolute_import

import sys

from ..api import BaseWebSocketHandler


class EventsApiHandler(BaseWebSocketHandler):
    def open(self, task_id=None):
        BaseWebSocketHandler.open(self)
        self.task_id = task_id

    @classmethod
    def send_message(cls, event):
        for l in cls.listeners:
            if not l.task_id or l.task_id == event['uuid']:
                l.write_message(event)


EVENTS = ('task-sent', 'task-received', 'task-started', 'task-succeeded',
          'task-failed', 'task-revoked', 'task-retried', 'task-custom')


def getClassName(eventname):
    return ''.join(map(lambda x: x[0].upper() + x[1:], eventname.split('-')))


# Dynamically generates handler classes
thismodule = sys.modules[__name__]
for event in EVENTS:
    classname = getClassName(event)
    setattr(thismodule, classname,
            type(classname, (EventsApiHandler, ), {'listeners': []}))


__all__ = list(map(getClassName, EVENTS))
__all__.append(getClassName)
