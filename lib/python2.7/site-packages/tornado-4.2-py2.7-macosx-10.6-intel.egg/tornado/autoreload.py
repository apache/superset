#!/usr/bin/env python
#
# Copyright 2009 Facebook
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

"""Automatically restart the server when a source file is modified.

Most applications should not access this module directly.  Instead,
pass the keyword argument ``autoreload=True`` to the
`tornado.web.Application` constructor (or ``debug=True``, which
enables this setting and several others).  This will enable autoreload
mode as well as checking for changes to templates and static
resources.  Note that restarting is a destructive operation and any
requests in progress will be aborted when the process restarts.  (If
you want to disable autoreload while using other debug-mode features,
pass both ``debug=True`` and ``autoreload=False``).

This module can also be used as a command-line wrapper around scripts
such as unit test runners.  See the `main` method for details.

The command-line wrapper and Application debug modes can be used together.
This combination is encouraged as the wrapper catches syntax errors and
other import-time failures, while debug mode catches changes once
the server has started.

This module depends on `.IOLoop`, so it will not work in WSGI applications
and Google App Engine.  It also will not work correctly when `.HTTPServer`'s
multi-process mode is used.

Reloading loses any Python interpreter command-line arguments (e.g. ``-u``)
because it re-executes Python using ``sys.executable`` and ``sys.argv``.
Additionally, modifying these variables will cause reloading to behave
incorrectly.

"""

from __future__ import absolute_import, division, print_function, with_statement

import os
import sys

# sys.path handling
# -----------------
#
# If a module is run with "python -m", the current directory (i.e. "")
# is automatically prepended to sys.path, but not if it is run as
# "path/to/file.py".  The processing for "-m" rewrites the former to
# the latter, so subsequent executions won't have the same path as the
# original.
#
# Conversely, when run as path/to/file.py, the directory containing
# file.py gets added to the path, which can cause confusion as imports
# may become relative in spite of the future import.
#
# We address the former problem by setting the $PYTHONPATH environment
# variable before re-execution so the new process will see the correct
# path.  We attempt to address the latter problem when tornado.autoreload
# is run as __main__, although we can't fix the general case because
# we cannot reliably reconstruct the original command line
# (http://bugs.python.org/issue14208).

if __name__ == "__main__":
    # This sys.path manipulation must come before our imports (as much
    # as possible - if we introduced a tornado.sys or tornado.os
    # module we'd be in trouble), or else our imports would become
    # relative again despite the future import.
    #
    # There is a separate __main__ block at the end of the file to call main().
    if sys.path[0] == os.path.dirname(__file__):
        del sys.path[0]

import functools
import logging
import os
import pkgutil
import sys
import traceback
import types
import subprocess
import weakref

from tornado import ioloop
from tornado.log import gen_log
from tornado import process
from tornado.util import exec_in

try:
    import signal
except ImportError:
    signal = None

# os.execv is broken on Windows and can't properly parse command line
# arguments and executable name if they contain whitespaces. subprocess
# fixes that behavior.
# This distinction is also important because when we use execv, we want to
# close the IOLoop and all its file descriptors, to guard against any
# file descriptors that were not set CLOEXEC. When execv is not available,
# we must not close the IOLoop because we want the process to exit cleanly.
_has_execv = sys.platform != 'win32'

_watched_files = set()
_reload_hooks = []
_reload_attempted = False
_io_loops = weakref.WeakKeyDictionary()


def start(io_loop=None, check_time=500):
    """Begins watching source files for changes.

    .. versionchanged:: 4.1
       The ``io_loop`` argument is deprecated.
    """
    io_loop = io_loop or ioloop.IOLoop.current()
    if io_loop in _io_loops:
        return
    _io_loops[io_loop] = True
    if len(_io_loops) > 1:
        gen_log.warning("tornado.autoreload started more than once in the same process")
    if _has_execv:
        add_reload_hook(functools.partial(io_loop.close, all_fds=True))
    modify_times = {}
    callback = functools.partial(_reload_on_update, modify_times)
    scheduler = ioloop.PeriodicCallback(callback, check_time, io_loop=io_loop)
    scheduler.start()


def wait():
    """Wait for a watched file to change, then restart the process.

    Intended to be used at the end of scripts like unit test runners,
    to run the tests again after any source file changes (but see also
    the command-line interface in `main`)
    """
    io_loop = ioloop.IOLoop()
    start(io_loop)
    io_loop.start()


def watch(filename):
    """Add a file to the watch list.

    All imported modules are watched by default.
    """
    _watched_files.add(filename)


def add_reload_hook(fn):
    """Add a function to be called before reloading the process.

    Note that for open file and socket handles it is generally
    preferable to set the ``FD_CLOEXEC`` flag (using `fcntl` or
    ``tornado.platform.auto.set_close_exec``) instead
    of using a reload hook to close them.
    """
    _reload_hooks.append(fn)


def _reload_on_update(modify_times):
    if _reload_attempted:
        # We already tried to reload and it didn't work, so don't try again.
        return
    if process.task_id() is not None:
        # We're in a child process created by fork_processes.  If child
        # processes restarted themselves, they'd all restart and then
        # all call fork_processes again.
        return
    for module in list(sys.modules.values()):
        # Some modules play games with sys.modules (e.g. email/__init__.py
        # in the standard library), and occasionally this can cause strange
        # failures in getattr.  Just ignore anything that's not an ordinary
        # module.
        if not isinstance(module, types.ModuleType):
            continue
        path = getattr(module, "__file__", None)
        if not path:
            continue
        if path.endswith(".pyc") or path.endswith(".pyo"):
            path = path[:-1]
        _check_file(modify_times, path)
    for path in _watched_files:
        _check_file(modify_times, path)


def _check_file(modify_times, path):
    try:
        modified = os.stat(path).st_mtime
    except Exception:
        return
    if path not in modify_times:
        modify_times[path] = modified
        return
    if modify_times[path] != modified:
        gen_log.info("%s modified; restarting server", path)
        _reload()


def _reload():
    global _reload_attempted
    _reload_attempted = True
    for fn in _reload_hooks:
        fn()
    if hasattr(signal, "setitimer"):
        # Clear the alarm signal set by
        # ioloop.set_blocking_log_threshold so it doesn't fire
        # after the exec.
        signal.setitimer(signal.ITIMER_REAL, 0, 0)
    # sys.path fixes: see comments at top of file.  If sys.path[0] is an empty
    # string, we were (probably) invoked with -m and the effective path
    # is about to change on re-exec.  Add the current directory to $PYTHONPATH
    # to ensure that the new process sees the same path we did.
    path_prefix = '.' + os.pathsep
    if (sys.path[0] == '' and
            not os.environ.get("PYTHONPATH", "").startswith(path_prefix)):
        os.environ["PYTHONPATH"] = (path_prefix +
                                    os.environ.get("PYTHONPATH", ""))
    if not _has_execv:
        subprocess.Popen([sys.executable] + sys.argv)
        sys.exit(0)
    else:
        try:
            os.execv(sys.executable, [sys.executable] + sys.argv)
        except OSError:
            # Mac OS X versions prior to 10.6 do not support execv in
            # a process that contains multiple threads.  Instead of
            # re-executing in the current process, start a new one
            # and cause the current process to exit.  This isn't
            # ideal since the new process is detached from the parent
            # terminal and thus cannot easily be killed with ctrl-C,
            # but it's better than not being able to autoreload at
            # all.
            # Unfortunately the errno returned in this case does not
            # appear to be consistent, so we can't easily check for
            # this error specifically.
            os.spawnv(os.P_NOWAIT, sys.executable,
                      [sys.executable] + sys.argv)
            # At this point the IOLoop has been closed and finally
            # blocks will experience errors if we allow the stack to
            # unwind, so just exit uncleanly.
            os._exit(0)

_USAGE = """\
Usage:
  python -m tornado.autoreload -m module.to.run [args...]
  python -m tornado.autoreload path/to/script.py [args...]
"""


def main():
    """Command-line wrapper to re-run a script whenever its source changes.

    Scripts may be specified by filename or module name::

        python -m tornado.autoreload -m tornado.test.runtests
        python -m tornado.autoreload tornado/test/runtests.py

    Running a script with this wrapper is similar to calling
    `tornado.autoreload.wait` at the end of the script, but this wrapper
    can catch import-time problems like syntax errors that would otherwise
    prevent the script from reaching its call to `wait`.
    """
    original_argv = sys.argv
    sys.argv = sys.argv[:]
    if len(sys.argv) >= 3 and sys.argv[1] == "-m":
        mode = "module"
        module = sys.argv[2]
        del sys.argv[1:3]
    elif len(sys.argv) >= 2:
        mode = "script"
        script = sys.argv[1]
        sys.argv = sys.argv[1:]
    else:
        print(_USAGE, file=sys.stderr)
        sys.exit(1)

    try:
        if mode == "module":
            import runpy
            runpy.run_module(module, run_name="__main__", alter_sys=True)
        elif mode == "script":
            with open(script) as f:
                global __file__
                __file__ = script
                # Use globals as our "locals" dictionary so that
                # something that tries to import __main__ (e.g. the unittest
                # module) will see the right things.
                exec_in(f.read(), globals(), globals())
    except SystemExit as e:
        logging.basicConfig()
        gen_log.info("Script exited with status %s", e.code)
    except Exception as e:
        logging.basicConfig()
        gen_log.warning("Script exited with uncaught exception", exc_info=True)
        # If an exception occurred at import time, the file with the error
        # never made it into sys.modules and so we won't know to watch it.
        # Just to make sure we've covered everything, walk the stack trace
        # from the exception and watch every file.
        for (filename, lineno, name, line) in traceback.extract_tb(sys.exc_info()[2]):
            watch(filename)
        if isinstance(e, SyntaxError):
            # SyntaxErrors are special:  their innermost stack frame is fake
            # so extract_tb won't see it and we have to get the filename
            # from the exception object.
            watch(e.filename)
    else:
        logging.basicConfig()
        gen_log.info("Script exited normally")
    # restore sys.argv so subsequent executions will include autoreload
    sys.argv = original_argv

    if mode == 'module':
        # runpy did a fake import of the module as __main__, but now it's
        # no longer in sys.modules.  Figure out where it is and watch it.
        loader = pkgutil.get_loader(module)
        if loader is not None:
            watch(loader.get_filename())

    wait()


if __name__ == "__main__":
    # See also the other __main__ block at the top of the file, which modifies
    # sys.path before our imports
    main()
