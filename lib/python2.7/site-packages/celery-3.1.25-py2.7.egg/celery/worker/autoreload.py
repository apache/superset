# -*- coding: utf-8 -*-
"""
    celery.worker.autoreload
    ~~~~~~~~~~~~~~~~~~~~~~~~

    This module implements automatic module reloading
"""
from __future__ import absolute_import

import hashlib
import os
import select
import sys
import time

from collections import defaultdict
from threading import Event

from kombu.utils import eventio
from kombu.utils.encoding import ensure_bytes

from celery import bootsteps
from celery.five import items
from celery.platforms import ignore_errno
from celery.utils.imports import module_file
from celery.utils.log import get_logger
from celery.utils.threads import bgThread

from .components import Pool

try:                        # pragma: no cover
    import pyinotify
    _ProcessEvent = pyinotify.ProcessEvent
except ImportError:         # pragma: no cover
    pyinotify = None        # noqa
    _ProcessEvent = object  # noqa

__all__ = [
    'WorkerComponent', 'Autoreloader', 'Monitor', 'BaseMonitor',
    'StatMonitor', 'KQueueMonitor', 'InotifyMonitor', 'file_hash',
]

logger = get_logger(__name__)


class WorkerComponent(bootsteps.StartStopStep):
    label = 'Autoreloader'
    conditional = True
    requires = (Pool, )

    def __init__(self, w, autoreload=None, **kwargs):
        self.enabled = w.autoreload = autoreload
        w.autoreloader = None

    def create(self, w):
        w.autoreloader = self.instantiate(w.autoreloader_cls, w)
        return w.autoreloader if not w.use_eventloop else None

    def register_with_event_loop(self, w, hub):
        w.autoreloader.register_with_event_loop(hub)
        hub.on_close.add(w.autoreloader.on_event_loop_close)


def file_hash(filename, algorithm='md5'):
    hobj = hashlib.new(algorithm)
    with open(filename, 'rb') as f:
        for chunk in iter(lambda: f.read(2 ** 20), ''):
            hobj.update(ensure_bytes(chunk))
    return hobj.digest()


class BaseMonitor(object):

    def __init__(self, files,
                 on_change=None, shutdown_event=None, interval=0.5):
        self.files = files
        self.interval = interval
        self._on_change = on_change
        self.modify_times = defaultdict(int)
        self.shutdown_event = shutdown_event or Event()

    def start(self):
        raise NotImplementedError('Subclass responsibility')

    def stop(self):
        pass

    def on_change(self, modified):
        if self._on_change:
            return self._on_change(modified)

    def on_event_loop_close(self, hub):
        pass


class StatMonitor(BaseMonitor):
    """File change monitor based on the ``stat`` system call."""

    def _mtimes(self):
        return ((f, self._mtime(f)) for f in self.files)

    def _maybe_modified(self, f, mt):
        return mt is not None and self.modify_times[f] != mt

    def register_with_event_loop(self, hub):
        hub.call_repeatedly(2.0, self.find_changes)

    def find_changes(self):
        maybe_modified = self._maybe_modified
        modified = dict((f, mt) for f, mt in self._mtimes()
                        if maybe_modified(f, mt))
        if modified:
            self.on_change(modified)
            self.modify_times.update(modified)

    def start(self):
        while not self.shutdown_event.is_set():
            self.find_changes()
            time.sleep(self.interval)

    @staticmethod
    def _mtime(path):
        try:
            return os.stat(path).st_mtime
        except Exception:
            pass


class KQueueMonitor(BaseMonitor):
    """File change monitor based on BSD kernel event notifications"""

    def __init__(self, *args, **kwargs):
        super(KQueueMonitor, self).__init__(*args, **kwargs)
        self.filemap = dict((f, None) for f in self.files)
        self.fdmap = {}

    def register_with_event_loop(self, hub):
        if eventio.kqueue is not None:
            self._kq = eventio._kqueue()
            self.add_events(self._kq)
            self._kq.on_file_change = self.handle_event
            hub.add_reader(self._kq._kqueue, self._kq.poll, 0)

    def on_event_loop_close(self, hub):
        self.close(self._kq)

    def add_events(self, poller):
        for f in self.filemap:
            self.filemap[f] = fd = os.open(f, os.O_RDONLY)
            self.fdmap[fd] = f
            poller.watch_file(fd)

    def handle_event(self, events):
        self.on_change([self.fdmap[e.ident] for e in events])

    def start(self):
        self.poller = eventio.poll()
        self.add_events(self.poller)
        self.poller.on_file_change = self.handle_event
        while not self.shutdown_event.is_set():
            self.poller.poll(1)

    def close(self, poller):
        for f, fd in items(self.filemap):
            if fd is not None:
                poller.unregister(fd)
                with ignore_errno('EBADF'):  # pragma: no cover
                    os.close(fd)
        self.filemap.clear()
        self.fdmap.clear()

    def stop(self):
        self.close(self.poller)
        self.poller.close()


class InotifyMonitor(_ProcessEvent):
    """File change monitor based on Linux kernel `inotify` subsystem"""

    def __init__(self, modules, on_change=None, **kwargs):
        assert pyinotify
        self._modules = modules
        self._on_change = on_change
        self._wm = None
        self._notifier = None

    def register_with_event_loop(self, hub):
        self.create_notifier()
        hub.add_reader(self._wm.get_fd(), self.on_readable)

    def on_event_loop_close(self, hub):
        pass

    def on_readable(self):
        self._notifier.read_events()
        self._notifier.process_events()

    def create_notifier(self):
        self._wm = pyinotify.WatchManager()
        self._notifier = pyinotify.Notifier(self._wm, self)
        add_watch = self._wm.add_watch
        flags = pyinotify.IN_MODIFY | pyinotify.IN_ATTRIB
        for m in self._modules:
            add_watch(m, flags)

    def start(self):
        try:
            self.create_notifier()
            self._notifier.loop()
        finally:
            if self._wm:
                self._wm.close()
                # Notifier.close is called at the end of Notifier.loop
                self._wm = self._notifier = None

    def stop(self):
        pass

    def process_(self, event):
        self.on_change([event.path])

    process_IN_ATTRIB = process_IN_MODIFY = process_

    def on_change(self, modified):
        if self._on_change:
            return self._on_change(modified)


def default_implementation():
    if hasattr(select, 'kqueue') and eventio.kqueue is not None:
        return 'kqueue'
    elif sys.platform.startswith('linux') and pyinotify:
        return 'inotify'
    else:
        return 'stat'

implementations = {'kqueue': KQueueMonitor,
                   'inotify': InotifyMonitor,
                   'stat': StatMonitor}
Monitor = implementations[
    os.environ.get('CELERYD_FSNOTIFY') or default_implementation()]


class Autoreloader(bgThread):
    """Tracks changes in modules and fires reload commands"""
    Monitor = Monitor

    def __init__(self, controller, modules=None, monitor_cls=None, **options):
        super(Autoreloader, self).__init__()
        self.controller = controller
        app = self.controller.app
        self.modules = app.loader.task_modules if modules is None else modules
        self.options = options
        self._monitor = None
        self._hashes = None
        self.file_to_module = {}

    def on_init(self):
        files = self.file_to_module
        files.update(dict(
            (module_file(sys.modules[m]), m) for m in self.modules))

        self._monitor = self.Monitor(
            files, self.on_change,
            shutdown_event=self._is_shutdown, **self.options)
        self._hashes = dict([(f, file_hash(f)) for f in files])

    def register_with_event_loop(self, hub):
        if self._monitor is None:
            self.on_init()
        self._monitor.register_with_event_loop(hub)

    def on_event_loop_close(self, hub):
        if self._monitor is not None:
            self._monitor.on_event_loop_close(hub)

    def body(self):
        self.on_init()
        with ignore_errno('EINTR', 'EAGAIN'):
            self._monitor.start()

    def _maybe_modified(self, f):
        if os.path.exists(f):
            digest = file_hash(f)
            if digest != self._hashes[f]:
                self._hashes[f] = digest
                return True
        return False

    def on_change(self, files):
        modified = [f for f in files if self._maybe_modified(f)]
        if modified:
            names = [self.file_to_module[module] for module in modified]
            logger.info('Detected modified modules: %r', names)
            self._reload(names)

    def _reload(self, modules):
        self.controller.reload(modules, reload=True)

    def stop(self):
        if self._monitor:
            self._monitor.stop()
