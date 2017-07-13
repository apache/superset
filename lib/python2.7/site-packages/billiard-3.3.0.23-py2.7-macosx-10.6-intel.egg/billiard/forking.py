#
# Module for starting a process object using os.fork() or CreateProcess()
#
# multiprocessing/forking.py
#
# Copyright (c) 2006-2008, R Oudkerk
# Licensed to PSF under a Contributor Agreement.
#

from __future__ import absolute_import

import os
import sys
import signal
import warnings

from pickle import load, HIGHEST_PROTOCOL
from billiard import util
from billiard import process
from billiard.five import int_types
from .reduction import dump
from .compat import _winapi as win32

__all__ = ['Popen', 'assert_spawning', 'exit',
           'duplicate', 'close']

try:
    WindowsError = WindowsError  # noqa
except NameError:
    class WindowsError(Exception):  # noqa
        pass

W_OLD_DJANGO_LAYOUT = """\
Will add directory %r to path! This is necessary to accommodate \
pre-Django 1.4 layouts using setup_environ.
You can skip this warning by adding a DJANGO_SETTINGS_MODULE=settings \
environment variable.
"""

#
# Choose whether to do a fork or spawn (fork+exec) on Unix.
# This affects how some shared resources should be created.
#

_forking_is_enabled = sys.platform != 'win32'

#
# Check that the current thread is spawning a child process
#


def assert_spawning(self):
    if not Popen.thread_is_spawning():
        raise RuntimeError(
            '%s objects should only be shared between processes'
            ' through inheritance' % type(self).__name__
        )


#
# Unix
#

if sys.platform != 'win32':
    try:
        import thread
    except ImportError:
        import _thread as thread  # noqa
    import select

    WINEXE = False
    WINSERVICE = False

    exit = os._exit
    duplicate = os.dup
    close = os.close
    _select = util._eintr_retry(select.select)

    #
    # We define a Popen class similar to the one from subprocess, but
    # whose constructor takes a process object as its argument.
    #

    class Popen(object):

        _tls = thread._local()

        def __init__(self, process_obj):
            # register reducers
            from billiard import connection  # noqa
            _Django_old_layout_hack__save()
            sys.stdout.flush()
            sys.stderr.flush()
            self.returncode = None
            r, w = os.pipe()
            self.sentinel = r

            if _forking_is_enabled:
                self.pid = os.fork()
                if self.pid == 0:
                    os.close(r)
                    if 'random' in sys.modules:
                        import random
                        random.seed()
                    code = process_obj._bootstrap()
                    os._exit(code)
            else:
                from_parent_fd, to_child_fd = os.pipe()
                cmd = get_command_line() + [str(from_parent_fd)]

                self.pid = os.fork()
                if self.pid == 0:
                    os.close(r)
                    os.close(to_child_fd)
                    os.execv(sys.executable, cmd)

                # send information to child
                prep_data = get_preparation_data(process_obj._name)
                os.close(from_parent_fd)
                to_child = os.fdopen(to_child_fd, 'wb')
                Popen._tls.process_handle = self.pid
                try:
                    dump(prep_data, to_child, HIGHEST_PROTOCOL)
                    dump(process_obj, to_child, HIGHEST_PROTOCOL)
                finally:
                    del(Popen._tls.process_handle)
                    to_child.close()

            # `w` will be closed when the child exits, at which point `r`
            # will become ready for reading (using e.g. select()).
            os.close(w)
            util.Finalize(self, os.close, (self.sentinel,))

        def poll(self, flag=os.WNOHANG):
            if self.returncode is None:
                try:
                    pid, sts = os.waitpid(self.pid, flag)
                except os.error:
                    # Child process not yet created. See #1731717
                    # e.errno == errno.ECHILD == 10
                    return None
                if pid == self.pid:
                    if os.WIFSIGNALED(sts):
                        self.returncode = -os.WTERMSIG(sts)
                    else:
                        assert os.WIFEXITED(sts)
                        self.returncode = os.WEXITSTATUS(sts)
            return self.returncode

        def wait(self, timeout=None):
            if self.returncode is None:
                if timeout is not None:
                    r = _select([self.sentinel], [], [], timeout)[0]
                    if not r:
                        return None
                # This shouldn't block if select() returned successfully.
                return self.poll(os.WNOHANG if timeout == 0.0 else 0)
            return self.returncode

        def terminate(self):
            if self.returncode is None:
                try:
                    os.kill(self.pid, signal.SIGTERM)
                except OSError:
                    if self.wait(timeout=0.1) is None:
                        raise

        @staticmethod
        def thread_is_spawning():
            if _forking_is_enabled:
                return False
            else:
                return getattr(Popen._tls, 'process_handle', None) is not None

        @staticmethod
        def duplicate_for_child(handle):
            return handle

#
# Windows
#

else:
    try:
        import thread
    except ImportError:
        import _thread as thread  # noqa
    import msvcrt
    try:
        import _subprocess
    except ImportError:
        import _winapi as _subprocess  # noqa

    #
    #
    #

    TERMINATE = 0x10000
    WINEXE = (sys.platform == 'win32' and getattr(sys, 'frozen', False))
    WINSERVICE = sys.executable.lower().endswith("pythonservice.exe")

    exit = win32.ExitProcess
    close = win32.CloseHandle

    #
    #
    #

    def duplicate(handle, target_process=None, inheritable=False):
        if target_process is None:
            target_process = _subprocess.GetCurrentProcess()
        h = _subprocess.DuplicateHandle(
            _subprocess.GetCurrentProcess(), handle, target_process,
            0, inheritable, _subprocess.DUPLICATE_SAME_ACCESS
        )
        if sys.version_info[0] < 3 or (
                sys.version_info[0] == 3 and sys.version_info[1] < 3):
            h = h.Detach()
        return h

    #
    # We define a Popen class similar to the one from subprocess, but
    # whose constructor takes a process object as its argument.
    #

    class Popen(object):
        '''
        Start a subprocess to run the code of a process object
        '''
        _tls = thread._local()

        def __init__(self, process_obj):
            _Django_old_layout_hack__save()
            # create pipe for communication with child
            rfd, wfd = os.pipe()

            # get handle for read end of the pipe and make it inheritable
            rhandle = duplicate(msvcrt.get_osfhandle(rfd), inheritable=True)
            os.close(rfd)

            # start process
            cmd = get_command_line() + [rhandle]
            cmd = ' '.join('"%s"' % x for x in cmd)
            hp, ht, pid, tid = _subprocess.CreateProcess(
                _python_exe, cmd, None, None, 1, 0, None, None, None
            )
            close(ht) if isinstance(ht, int_types) else ht.Close()
            (close(rhandle) if isinstance(rhandle, int_types)
             else rhandle.Close())

            # set attributes of self
            self.pid = pid
            self.returncode = None
            self._handle = hp
            self.sentinel = int(hp)

            # send information to child
            prep_data = get_preparation_data(process_obj._name)
            to_child = os.fdopen(wfd, 'wb')
            Popen._tls.process_handle = int(hp)
            try:
                dump(prep_data, to_child, HIGHEST_PROTOCOL)
                dump(process_obj, to_child, HIGHEST_PROTOCOL)
            finally:
                del Popen._tls.process_handle
                to_child.close()

        @staticmethod
        def thread_is_spawning():
            return getattr(Popen._tls, 'process_handle', None) is not None

        @staticmethod
        def duplicate_for_child(handle):
            return duplicate(handle, Popen._tls.process_handle)

        def wait(self, timeout=None):
            if self.returncode is None:
                if timeout is None:
                    msecs = _subprocess.INFINITE
                else:
                    msecs = max(0, int(timeout * 1000 + 0.5))

                res = _subprocess.WaitForSingleObject(int(self._handle), msecs)
                if res == _subprocess.WAIT_OBJECT_0:
                    code = _subprocess.GetExitCodeProcess(self._handle)
                    if code == TERMINATE:
                        code = -signal.SIGTERM
                    self.returncode = code

            return self.returncode

        def poll(self):
            return self.wait(timeout=0)

        def terminate(self):
            if self.returncode is None:
                try:
                    _subprocess.TerminateProcess(int(self._handle), TERMINATE)
                except WindowsError:
                    if self.wait(timeout=0.1) is None:
                        raise

    #
    #
    #

if WINSERVICE:
    _python_exe = os.path.join(sys.exec_prefix, 'python.exe')
else:
    _python_exe = sys.executable


def set_executable(exe):
    global _python_exe
    _python_exe = exe


def is_forking(argv):
    '''
    Return whether commandline indicates we are forking
    '''
    if len(argv) >= 2 and argv[1] == '--billiard-fork':
        assert len(argv) == 3
        os.environ["FORKED_BY_MULTIPROCESSING"] = "1"
        return True
    else:
        return False


def freeze_support():
    '''
    Run code for process object if this in not the main process
    '''
    if is_forking(sys.argv):
        main()
        sys.exit()


def get_command_line():
    '''
    Returns prefix of command line used for spawning a child process
    '''
    if process.current_process()._identity == () and is_forking(sys.argv):
        raise RuntimeError('''
        Attempt to start a new process before the current process
        has finished its bootstrapping phase.

        This probably means that have forgotten to use the proper
        idiom in the main module:

            if __name__ == '__main__':
                freeze_support()
                ...

        The "freeze_support()" line can be omitted if the program
        is not going to be frozen to produce a Windows executable.''')

    if getattr(sys, 'frozen', False):
        return [sys.executable, '--billiard-fork']
    else:
        prog = 'from billiard.forking import main; main()'
        return [_python_exe, '-c', prog, '--billiard-fork']


def _Django_old_layout_hack__save():
    if 'DJANGO_PROJECT_DIR' not in os.environ:
        try:
            settings_name = os.environ['DJANGO_SETTINGS_MODULE']
        except KeyError:
            return  # not using Django.

        conf_settings = sys.modules.get('django.conf.settings')
        configured = conf_settings and conf_settings.configured
        try:
            project_name, _ = settings_name.split('.', 1)
        except ValueError:
            return  # not modified by setup_environ

        project = __import__(project_name)
        try:
            project_dir = os.path.normpath(_module_parent_dir(project))
        except AttributeError:
            return  # dynamically generated module (no __file__)
        if configured:
            warnings.warn(UserWarning(
                W_OLD_DJANGO_LAYOUT % os.path.realpath(project_dir)
            ))
        os.environ['DJANGO_PROJECT_DIR'] = project_dir


def _Django_old_layout_hack__load():
    try:
        sys.path.append(os.environ['DJANGO_PROJECT_DIR'])
    except KeyError:
        pass


def _module_parent_dir(mod):
    dir, filename = os.path.split(_module_dir(mod))
    if dir == os.curdir or not dir:
        dir = os.getcwd()
    return dir


def _module_dir(mod):
    if '__init__.py' in mod.__file__:
        return os.path.dirname(mod.__file__)
    return mod.__file__


def main():
    '''
    Run code specifed by data received over pipe
    '''
    global _forking_is_enabled
    _Django_old_layout_hack__load()

    assert is_forking(sys.argv)
    _forking_is_enabled = False

    handle = int(sys.argv[-1])
    if sys.platform == 'win32':
        fd = msvcrt.open_osfhandle(handle, os.O_RDONLY)
    else:
        fd = handle
    from_parent = os.fdopen(fd, 'rb')

    process.current_process()._inheriting = True
    preparation_data = load(from_parent)
    prepare(preparation_data)
    # Huge hack to make logging before Process.run work.
    try:
        os.environ["MP_MAIN_FILE"] = sys.modules["__main__"].__file__
    except KeyError:
        pass
    except AttributeError:
        pass
    loglevel = os.environ.get("_MP_FORK_LOGLEVEL_")
    logfile = os.environ.get("_MP_FORK_LOGFILE_") or None
    format = os.environ.get("_MP_FORK_LOGFORMAT_")
    if loglevel:
        from billiard import util
        import logging
        logger = util.get_logger()
        logger.setLevel(int(loglevel))
        if not logger.handlers:
            logger._rudimentary_setup = True
            logfile = logfile or sys.__stderr__
            if hasattr(logfile, "write"):
                handler = logging.StreamHandler(logfile)
            else:
                handler = logging.FileHandler(logfile)
            formatter = logging.Formatter(
                format or util.DEFAULT_LOGGING_FORMAT,
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)

    self = load(from_parent)
    process.current_process()._inheriting = False

    from_parent.close()

    exitcode = self._bootstrap()
    exit(exitcode)


def get_preparation_data(name):
    '''
    Return info about parent needed by child to unpickle process object
    '''
    from billiard.util import _logger, _log_to_stderr

    d = dict(
        name=name,
        sys_path=sys.path,
        sys_argv=sys.argv,
        log_to_stderr=_log_to_stderr,
        orig_dir=process.ORIGINAL_DIR,
        authkey=process.current_process().authkey,
    )

    if _logger is not None:
        d['log_level'] = _logger.getEffectiveLevel()

    if not WINEXE and not WINSERVICE:
        main_path = getattr(sys.modules['__main__'], '__file__', None)
        if not main_path and sys.argv[0] not in ('', '-c'):
            main_path = sys.argv[0]
        if main_path is not None:
            if (not os.path.isabs(main_path) and
                    process.ORIGINAL_DIR is not None):
                main_path = os.path.join(process.ORIGINAL_DIR, main_path)
            d['main_path'] = os.path.normpath(main_path)

    return d

#
# Prepare current process
#

old_main_modules = []


def prepare(data):
    '''
    Try to get current process ready to unpickle process object
    '''
    old_main_modules.append(sys.modules['__main__'])

    if 'name' in data:
        process.current_process().name = data['name']

    if 'authkey' in data:
        process.current_process()._authkey = data['authkey']

    if 'log_to_stderr' in data and data['log_to_stderr']:
        util.log_to_stderr()

    if 'log_level' in data:
        util.get_logger().setLevel(data['log_level'])

    if 'sys_path' in data:
        sys.path = data['sys_path']

    if 'sys_argv' in data:
        sys.argv = data['sys_argv']

    if 'dir' in data:
        os.chdir(data['dir'])

    if 'orig_dir' in data:
        process.ORIGINAL_DIR = data['orig_dir']

    if 'main_path' in data:
        main_path = data['main_path']
        main_name = os.path.splitext(os.path.basename(main_path))[0]
        if main_name == '__init__':
            main_name = os.path.basename(os.path.dirname(main_path))

        if main_name == '__main__':
            main_module = sys.modules['__main__']
            main_module.__file__ = main_path
        elif main_name != 'ipython':
            # Main modules not actually called __main__.py may
            # contain additional code that should still be executed
            import imp

            if main_path is None:
                dirs = None
            elif os.path.basename(main_path).startswith('__init__.py'):
                dirs = [os.path.dirname(os.path.dirname(main_path))]
            else:
                dirs = [os.path.dirname(main_path)]

            assert main_name not in sys.modules, main_name
            file, path_name, etc = imp.find_module(main_name, dirs)
            try:
                # We would like to do "imp.load_module('__main__', ...)"
                # here.  However, that would cause 'if __name__ ==
                # "__main__"' clauses to be executed.
                main_module = imp.load_module(
                    '__parents_main__', file, path_name, etc
                )
            finally:
                if file:
                    file.close()

            sys.modules['__main__'] = main_module
            main_module.__name__ = '__main__'

            # Try to make the potentially picklable objects in
            # sys.modules['__main__'] realize they are in the main
            # module -- somewhat ugly.
            for obj in list(main_module.__dict__.values()):
                try:
                    if obj.__module__ == '__parents_main__':
                        obj.__module__ = '__main__'
                except Exception:
                    pass
