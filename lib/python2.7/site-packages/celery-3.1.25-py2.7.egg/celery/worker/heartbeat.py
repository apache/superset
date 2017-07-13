# -*- coding: utf-8 -*-
"""
    celery.worker.heartbeat
    ~~~~~~~~~~~~~~~~~~~~~~~

    This is the internal thread that sends heartbeat events
    at regular intervals.

"""
from __future__ import absolute_import

from celery.utils.sysinfo import load_average

from .state import SOFTWARE_INFO, active_requests, all_total_count

__all__ = ['Heart']


class Heart(object):
    """Timer sending heartbeats at regular intervals.

    :param timer: Timer instance.
    :param eventer: Event dispatcher used to send the event.
    :keyword interval: Time in seconds between heartbeats.
                       Default is 2 seconds.

    """

    def __init__(self, timer, eventer, interval=None):
        self.timer = timer
        self.eventer = eventer
        self.interval = float(interval or 2.0)
        self.tref = None

        # Make event dispatcher start/stop us when enabled/disabled.
        self.eventer.on_enabled.add(self.start)
        self.eventer.on_disabled.add(self.stop)

    def _send(self, event):
        return self.eventer.send(event, freq=self.interval,
                                 active=len(active_requests),
                                 processed=all_total_count[0],
                                 loadavg=load_average(),
                                 **SOFTWARE_INFO)

    def start(self):
        if self.eventer.enabled:
            self._send('worker-online')
            self.tref = self.timer.call_repeatedly(
                self.interval, self._send, ('worker-heartbeat', ),
            )

    def stop(self):
        if self.tref is not None:
            self.timer.cancel(self.tref)
            self.tref = None
        if self.eventer.enabled:
            self._send('worker-offline')
