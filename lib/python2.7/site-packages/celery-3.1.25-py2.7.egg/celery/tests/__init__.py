from __future__ import absolute_import

import logging
import os
import sys
import warnings

from importlib import import_module

try:
    WindowsError = WindowsError  # noqa
except NameError:

    class WindowsError(Exception):
        pass


def setup():
    os.environ.update(
        # warn if config module not found
        C_WNOCONF='yes',
        KOMBU_DISABLE_LIMIT_PROTECTION='yes',
    )

    if os.environ.get('COVER_ALL_MODULES') or '--with-coverage' in sys.argv:
        from warnings import catch_warnings
        with catch_warnings(record=True):
            import_all_modules()
        warnings.resetwarnings()
    from celery.tests.case import Trap
    from celery._state import set_default_app
    set_default_app(Trap())


def teardown():
    # Don't want SUBDEBUG log messages at finalization.
    try:
        from multiprocessing.util import get_logger
    except ImportError:
        pass
    else:
        get_logger().setLevel(logging.WARNING)

    # Make sure test database is removed.
    import os
    if os.path.exists('test.db'):
        try:
            os.remove('test.db')
        except WindowsError:
            pass

    # Make sure there are no remaining threads at shutdown.
    import threading
    remaining_threads = [thread for thread in threading.enumerate()
                         if thread.getName() != 'MainThread']
    if remaining_threads:
        sys.stderr.write(
            '\n\n**WARNING**: Remaining threads at teardown: %r...\n' % (
                remaining_threads))


def find_distribution_modules(name=__name__, file=__file__):
    current_dist_depth = len(name.split('.')) - 1
    current_dist = os.path.join(os.path.dirname(file),
                                *([os.pardir] * current_dist_depth))
    abs = os.path.abspath(current_dist)
    dist_name = os.path.basename(abs)

    for dirpath, dirnames, filenames in os.walk(abs):
        package = (dist_name + dirpath[len(abs):]).replace('/', '.')
        if '__init__.py' in filenames:
            yield package
            for filename in filenames:
                if filename.endswith('.py') and filename != '__init__.py':
                    yield '.'.join([package, filename])[:-3]


def import_all_modules(name=__name__, file=__file__,
                       skip=('celery.decorators',
                             'celery.contrib.batches',
                             'celery.task')):
    for module in find_distribution_modules(name, file):
        if not module.startswith(skip):
            try:
                import_module(module)
            except ImportError:
                pass
