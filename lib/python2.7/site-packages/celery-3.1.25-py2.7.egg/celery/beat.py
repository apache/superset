# -*- coding: utf-8 -*-
"""
    celery.beat
    ~~~~~~~~~~~

    The periodic task scheduler.

"""
from __future__ import absolute_import

import errno
import os
import time
import shelve
import sys
import traceback

from threading import Event, Thread

from billiard import ensure_multiprocessing
from billiard.process import Process
from billiard.common import reset_signals
from kombu.utils import cached_property, reprcall
from kombu.utils.functional import maybe_evaluate

from . import __version__
from . import platforms
from . import signals
from .five import items, reraise, values, monotonic
from .schedules import maybe_schedule, crontab
from .utils.imports import instantiate
from .utils.timeutils import humanize_seconds
from .utils.log import get_logger, iter_open_logger_fds

__all__ = ['SchedulingError', 'ScheduleEntry', 'Scheduler',
           'PersistentScheduler', 'Service', 'EmbeddedService']

logger = get_logger(__name__)
debug, info, error, warning = (logger.debug, logger.info,
                               logger.error, logger.warning)

DEFAULT_MAX_INTERVAL = 300  # 5 minutes


class SchedulingError(Exception):
    """An error occured while scheduling a task."""


class ScheduleEntry(object):
    """An entry in the scheduler.

    :keyword name: see :attr:`name`.
    :keyword schedule: see :attr:`schedule`.
    :keyword args: see :attr:`args`.
    :keyword kwargs: see :attr:`kwargs`.
    :keyword options: see :attr:`options`.
    :keyword last_run_at: see :attr:`last_run_at`.
    :keyword total_run_count: see :attr:`total_run_count`.
    :keyword relative: Is the time relative to when the server starts?

    """

    #: The task name
    name = None

    #: The schedule (run_every/crontab)
    schedule = None

    #: Positional arguments to apply.
    args = None

    #: Keyword arguments to apply.
    kwargs = None

    #: Task execution options.
    options = None

    #: The time and date of when this task was last scheduled.
    last_run_at = None

    #: Total number of times this task has been scheduled.
    total_run_count = 0

    def __init__(self, name=None, task=None, last_run_at=None,
                 total_run_count=None, schedule=None, args=(), kwargs={},
                 options={}, relative=False, app=None):
        self.app = app
        self.name = name
        self.task = task
        self.args = args
        self.kwargs = kwargs
        self.options = options
        self.schedule = maybe_schedule(schedule, relative, app=self.app)
        self.last_run_at = last_run_at or self._default_now()
        self.total_run_count = total_run_count or 0

    def _default_now(self):
        return self.schedule.now() if self.schedule else self.app.now()

    def _next_instance(self, last_run_at=None):
        """Return a new instance of the same class, but with
        its date and count fields updated."""
        return self.__class__(**dict(
            self,
            last_run_at=last_run_at or self._default_now(),
            total_run_count=self.total_run_count + 1,
        ))
    __next__ = next = _next_instance  # for 2to3

    def __reduce__(self):
        return self.__class__, (
            self.name, self.task, self.last_run_at, self.total_run_count,
            self.schedule, self.args, self.kwargs, self.options,
        )

    def update(self, other):
        """Update values from another entry.

        Does only update "editable" fields (task, schedule, args, kwargs,
        options).

        """
        self.__dict__.update({'task': other.task, 'schedule': other.schedule,
                              'args': other.args, 'kwargs': other.kwargs,
                              'options': other.options})

    def is_due(self):
        """See :meth:`~celery.schedule.schedule.is_due`."""
        return self.schedule.is_due(self.last_run_at)

    def __iter__(self):
        return iter(items(vars(self)))

    def __repr__(self):
        return '<Entry: {0.name} {call} {0.schedule}'.format(
            self,
            call=reprcall(self.task, self.args or (), self.kwargs or {}),
        )


class Scheduler(object):
    """Scheduler for periodic tasks.

    The :program:`celery beat` program may instantiate this class
    multiple times for introspection purposes, but then with the
    ``lazy`` argument set.  It is important for subclasses to
    be idempotent when this argument is set.

    :keyword schedule: see :attr:`schedule`.
    :keyword max_interval: see :attr:`max_interval`.
    :keyword lazy: Do not set up the schedule.

    """
    Entry = ScheduleEntry

    #: The schedule dict/shelve.
    schedule = None

    #: Maximum time to sleep between re-checking the schedule.
    max_interval = DEFAULT_MAX_INTERVAL

    #: How often to sync the schedule (3 minutes by default)
    sync_every = 3 * 60

    #: How many tasks can be called before a sync is forced.
    sync_every_tasks = None

    _last_sync = None
    _tasks_since_sync = 0

    logger = logger  # compat

    def __init__(self, app, schedule=None, max_interval=None,
                 Publisher=None, lazy=False, sync_every_tasks=None, **kwargs):
        self.app = app
        self.data = maybe_evaluate({} if schedule is None else schedule)
        self.max_interval = (max_interval or
                             app.conf.CELERYBEAT_MAX_LOOP_INTERVAL or
                             self.max_interval)
        self.sync_every_tasks = (
            app.conf.CELERYBEAT_SYNC_EVERY if sync_every_tasks is None
            else sync_every_tasks)
        self.Publisher = Publisher or app.amqp.TaskProducer
        if not lazy:
            self.setup_schedule()

    def install_default_entries(self, data):
        entries = {}
        if self.app.conf.CELERY_TASK_RESULT_EXPIRES and \
                not self.app.backend.supports_autoexpire:
            if 'celery.backend_cleanup' not in data:
                entries['celery.backend_cleanup'] = {
                    'task': 'celery.backend_cleanup',
                    'schedule': crontab('0', '4', '*'),
                    'options': {'expires': 12 * 3600}}
        self.update_from_dict(entries)

    def maybe_due(self, entry, publisher=None):
        is_due, next_time_to_run = entry.is_due()

        if is_due:
            info('Scheduler: Sending due task %s (%s)', entry.name, entry.task)
            try:
                result = self.apply_async(entry, publisher=publisher)
            except Exception as exc:
                error('Message Error: %s\n%s',
                      exc, traceback.format_stack(), exc_info=True)
            else:
                debug('%s sent. id->%s', entry.task, result.id)
        return next_time_to_run

    def tick(self):
        """Run a tick, that is one iteration of the scheduler.

        Executes all due tasks.

        """
        remaining_times = []
        try:
            for entry in values(self.schedule):
                next_time_to_run = self.maybe_due(entry, self.publisher)
                if next_time_to_run:
                    remaining_times.append(next_time_to_run)
        except RuntimeError:
            pass

        return min(remaining_times + [self.max_interval])

    def should_sync(self):
        return (
            (not self._last_sync or
               (monotonic() - self._last_sync) > self.sync_every) or
            (self.sync_every_tasks and
                self._tasks_since_sync >= self.sync_every_tasks)
        )

    def reserve(self, entry):
        new_entry = self.schedule[entry.name] = next(entry)
        return new_entry

    def apply_async(self, entry, publisher=None, **kwargs):
        # Update timestamps and run counts before we actually execute,
        # so we have that done if an exception is raised (doesn't schedule
        # forever.)
        entry = self.reserve(entry)
        task = self.app.tasks.get(entry.task)

        try:
            if task:
                result = task.apply_async(entry.args, entry.kwargs,
                                          publisher=publisher,
                                          **entry.options)
            else:
                result = self.send_task(entry.task, entry.args, entry.kwargs,
                                        publisher=publisher,
                                        **entry.options)
        except Exception as exc:
            reraise(SchedulingError, SchedulingError(
                "Couldn't apply scheduled task {0.name}: {exc}".format(
                    entry, exc=exc)), sys.exc_info()[2])
        finally:
            self._tasks_since_sync += 1
            if self.should_sync():
                self._do_sync()
        return result

    def send_task(self, *args, **kwargs):
        return self.app.send_task(*args, **kwargs)

    def setup_schedule(self):
        self.install_default_entries(self.data)

    def _do_sync(self):
        try:
            debug('beat: Synchronizing schedule...')
            self.sync()
        finally:
            self._last_sync = monotonic()
            self._tasks_since_sync = 0

    def sync(self):
        pass

    def close(self):
        self.sync()

    def add(self, **kwargs):
        entry = self.Entry(app=self.app, **kwargs)
        self.schedule[entry.name] = entry
        return entry

    def _maybe_entry(self, name, entry):
        if isinstance(entry, self.Entry):
            entry.app = self.app
            return entry
        return self.Entry(**dict(entry, name=name, app=self.app))

    def update_from_dict(self, dict_):
        self.schedule.update(dict(
            (name, self._maybe_entry(name, entry))
            for name, entry in items(dict_)))

    def merge_inplace(self, b):
        schedule = self.schedule
        A, B = set(schedule), set(b)

        # Remove items from disk not in the schedule anymore.
        for key in A ^ B:
            schedule.pop(key, None)

        # Update and add new items in the schedule
        for key in B:
            entry = self.Entry(**dict(b[key], name=key, app=self.app))
            if schedule.get(key):
                schedule[key].update(entry)
            else:
                schedule[key] = entry

    def _ensure_connected(self):
        # callback called for each retry while the connection
        # can't be established.
        def _error_handler(exc, interval):
            error('beat: Connection error: %s. '
                  'Trying again in %s seconds...', exc, interval)

        return self.connection.ensure_connection(
            _error_handler, self.app.conf.BROKER_CONNECTION_MAX_RETRIES
        )

    def get_schedule(self):
        return self.data

    def set_schedule(self, schedule):
        self.data = schedule
    schedule = property(get_schedule, set_schedule)

    @cached_property
    def connection(self):
        return self.app.connection()

    @cached_property
    def publisher(self):
        return self.Publisher(self._ensure_connected())

    @property
    def info(self):
        return ''


class PersistentScheduler(Scheduler):
    persistence = shelve
    known_suffixes = ('', '.db', '.dat', '.bak', '.dir')

    _store = None

    def __init__(self, *args, **kwargs):
        self.schedule_filename = kwargs.get('schedule_filename')
        Scheduler.__init__(self, *args, **kwargs)

    def _remove_db(self):
        for suffix in self.known_suffixes:
            with platforms.ignore_errno(errno.ENOENT):
                os.remove(self.schedule_filename + suffix)

    def _open_schedule(self):
        return self.persistence.open(self.schedule_filename, writeback=True)

    def _destroy_open_corrupted_schedule(self, exc):
        error('Removing corrupted schedule file %r: %r',
              self.schedule_filename, exc, exc_info=True)
        self._remove_db()
        return self._open_schedule()

    def setup_schedule(self):
        try:
            self._store = self._open_schedule()
            # In some cases there may be different errors from a storage
            # backend for corrupted files. Example - DBPageNotFoundError
            # exception from bsddb. In such case the file will be
            # successfully opened but the error will be raised on first key
            # retrieving.
            self._store.keys()
        except Exception as exc:
            self._store = self._destroy_open_corrupted_schedule(exc)

        for _ in (1, 2):
            try:
                self._store['entries']
            except KeyError:
                # new schedule db
                try:
                    self._store['entries'] = {}
                except KeyError as exc:
                    self._store = self._destroy_open_corrupted_schedule(exc)
                    continue
            else:
                if '__version__' not in self._store:
                    warning('DB Reset: Account for new __version__ field')
                    self._store.clear()   # remove schedule at 2.2.2 upgrade.
                elif 'tz' not in self._store:
                    warning('DB Reset: Account for new tz field')
                    self._store.clear()   # remove schedule at 3.0.8 upgrade
                elif 'utc_enabled' not in self._store:
                    warning('DB Reset: Account for new utc_enabled field')
                    self._store.clear()   # remove schedule at 3.0.9 upgrade
            break

        tz = self.app.conf.CELERY_TIMEZONE
        stored_tz = self._store.get('tz')
        if stored_tz is not None and stored_tz != tz:
            warning('Reset: Timezone changed from %r to %r', stored_tz, tz)
            self._store.clear()   # Timezone changed, reset db!
        utc = self.app.conf.CELERY_ENABLE_UTC
        stored_utc = self._store.get('utc_enabled')
        if stored_utc is not None and stored_utc != utc:
            choices = {True: 'enabled', False: 'disabled'}
            warning('Reset: UTC changed from %s to %s',
                    choices[stored_utc], choices[utc])
            self._store.clear()   # UTC setting changed, reset db!
        entries = self._store.setdefault('entries', {})
        self.merge_inplace(self.app.conf.CELERYBEAT_SCHEDULE)
        self.install_default_entries(self.schedule)
        self._store.update(__version__=__version__, tz=tz, utc_enabled=utc)
        self.sync()
        debug('Current schedule:\n' + '\n'.join(
            repr(entry) for entry in values(entries)))

    def get_schedule(self):
        return self._store['entries']

    def set_schedule(self, schedule):
        self._store['entries'] = schedule
    schedule = property(get_schedule, set_schedule)

    def sync(self):
        if self._store is not None:
            self._store.sync()

    def close(self):
        self.sync()
        self._store.close()

    @property
    def info(self):
        return '    . db -> {self.schedule_filename}'.format(self=self)


class Service(object):
    scheduler_cls = PersistentScheduler

    def __init__(self, app, max_interval=None, schedule_filename=None,
                 scheduler_cls=None):
        self.app = app
        self.max_interval = (max_interval or
                             app.conf.CELERYBEAT_MAX_LOOP_INTERVAL)
        self.scheduler_cls = scheduler_cls or self.scheduler_cls
        self.schedule_filename = (
            schedule_filename or app.conf.CELERYBEAT_SCHEDULE_FILENAME)

        self._is_shutdown = Event()
        self._is_stopped = Event()

    def __reduce__(self):
        return self.__class__, (self.max_interval, self.schedule_filename,
                                self.scheduler_cls, self.app)

    def start(self, embedded_process=False, drift=-0.010):
        info('beat: Starting...')
        debug('beat: Ticking with max interval->%s',
              humanize_seconds(self.scheduler.max_interval))

        signals.beat_init.send(sender=self)
        if embedded_process:
            signals.beat_embedded_init.send(sender=self)
            platforms.set_process_title('celery beat')

        try:
            while not self._is_shutdown.is_set():
                interval = self.scheduler.tick()
                interval = interval + drift if interval else interval
                if interval and interval > 0:
                    debug('beat: Waking up %s.',
                          humanize_seconds(interval, prefix='in '))
                    time.sleep(interval)
                    if self.scheduler.should_sync():
                        self.scheduler._do_sync()
        except (KeyboardInterrupt, SystemExit):
            self._is_shutdown.set()
        finally:
            self.sync()

    def sync(self):
        self.scheduler.close()
        self._is_stopped.set()

    def stop(self, wait=False):
        info('beat: Shutting down...')
        self._is_shutdown.set()
        wait and self._is_stopped.wait()  # block until shutdown done.

    def get_scheduler(self, lazy=False):
        filename = self.schedule_filename
        scheduler = instantiate(self.scheduler_cls,
                                app=self.app,
                                schedule_filename=filename,
                                max_interval=self.max_interval,
                                lazy=lazy)
        return scheduler

    @cached_property
    def scheduler(self):
        return self.get_scheduler()


class _Threaded(Thread):
    """Embedded task scheduler using threading."""

    def __init__(self, app, **kwargs):
        super(_Threaded, self).__init__()
        self.app = app
        self.service = Service(app, **kwargs)
        self.daemon = True
        self.name = 'Beat'

    def run(self):
        self.app.set_current()
        self.service.start()

    def stop(self):
        self.service.stop(wait=True)


try:
    ensure_multiprocessing()
except NotImplementedError:     # pragma: no cover
    _Process = None
else:
    class _Process(Process):    # noqa

        def __init__(self, app, **kwargs):
            super(_Process, self).__init__()
            self.app = app
            self.service = Service(app, **kwargs)
            self.name = 'Beat'

        def run(self):
            reset_signals(full=False)
            platforms.close_open_fds([
                sys.__stdin__, sys.__stdout__, sys.__stderr__,
            ] + list(iter_open_logger_fds()))
            self.app.set_default()
            self.app.set_current()
            self.service.start(embedded_process=True)

        def stop(self):
            self.service.stop()
            self.terminate()


def EmbeddedService(app, max_interval=None, **kwargs):
    """Return embedded clock service.

    :keyword thread: Run threaded instead of as a separate process.
        Uses :mod:`multiprocessing` by default, if available.

    """
    if kwargs.pop('thread', False) or _Process is None:
        # Need short max interval to be able to stop thread
        # in reasonable time.
        return _Threaded(app, max_interval=1, **kwargs)
    return _Process(app, max_interval=max_interval, **kwargs)
