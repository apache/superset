# -*- coding: utf-8 -*-
"""
    celery.platforms
    ~~~~~~~~~~~~~~~~

    Utilities dealing with platform specifics: signals, daemonization,
    users, groups, and so on.

"""
from __future__ import absolute_import, print_function

import atexit
import errno
import math
import numbers
import os
import platform as _platform
import signal as _signal
import sys
import warnings

from collections import namedtuple

from billiard import current_process
# fileno used to be in this module
from kombu.utils import maybe_fileno
from kombu.utils.compat import get_errno
from kombu.utils.encoding import safe_str
from contextlib import contextmanager

from .local import try_import
from .five import items, range, reraise, string_t, zip_longest
from .utils.functional import uniq

_setproctitle = try_import('setproctitle')
resource = try_import('resource')
pwd = try_import('pwd')
grp = try_import('grp')
mputil = try_import('multiprocessing.util')

__all__ = ['EX_OK', 'EX_FAILURE', 'EX_UNAVAILABLE', 'EX_USAGE', 'SYSTEM',
           'IS_OSX', 'IS_WINDOWS', 'pyimplementation', 'LockFailed',
           'get_fdmax', 'Pidfile', 'create_pidlock',
           'close_open_fds', 'DaemonContext', 'detached', 'parse_uid',
           'parse_gid', 'setgroups', 'initgroups', 'setgid', 'setuid',
           'maybe_drop_privileges', 'signals', 'set_process_title',
           'set_mp_process_title', 'get_errno_name', 'ignore_errno',
           'fd_by_path']

# exitcodes
EX_OK = getattr(os, 'EX_OK', 0)
EX_FAILURE = 1
EX_UNAVAILABLE = getattr(os, 'EX_UNAVAILABLE', 69)
EX_USAGE = getattr(os, 'EX_USAGE', 64)
EX_CANTCREAT = getattr(os, 'EX_CANTCREAT', 73)

SYSTEM = _platform.system()
IS_OSX = SYSTEM == 'Darwin'
IS_WINDOWS = SYSTEM == 'Windows'

DAEMON_WORKDIR = '/'

PIDFILE_FLAGS = os.O_CREAT | os.O_EXCL | os.O_WRONLY
PIDFILE_MODE = ((os.R_OK | os.W_OK) << 6) | ((os.R_OK) << 3) | ((os.R_OK))

PIDLOCKED = """ERROR: Pidfile ({0}) already exists.
Seems we're already running? (pid: {1})"""

_range = namedtuple('_range', ('start', 'stop'))

C_FORCE_ROOT = os.environ.get('C_FORCE_ROOT', False)

ROOT_DISALLOWED = """\
Running a worker with superuser privileges when the
worker accepts messages serialized with pickle is a very bad idea!

If you really want to continue then you have to set the C_FORCE_ROOT
environment variable (but please think about this before you do).

User information: uid={uid} euid={euid} gid={gid} egid={egid}
"""

ROOT_DISCOURAGED = """\
You are running the worker with superuser privileges, which is
absolutely not recommended!

Please specify a different user using the -u option.

User information: uid={uid} euid={euid} gid={gid} egid={egid}
"""


def pyimplementation():
    """Return string identifying the current Python implementation."""
    if hasattr(_platform, 'python_implementation'):
        return _platform.python_implementation()
    elif sys.platform.startswith('java'):
        return 'Jython ' + sys.platform
    elif hasattr(sys, 'pypy_version_info'):
        v = '.'.join(str(p) for p in sys.pypy_version_info[:3])
        if sys.pypy_version_info[3:]:
            v += '-' + ''.join(str(p) for p in sys.pypy_version_info[3:])
        return 'PyPy ' + v
    else:
        return 'CPython'


class LockFailed(Exception):
    """Raised if a pidlock can't be acquired."""


def get_fdmax(default=None):
    """Return the maximum number of open file descriptors
    on this system.

    :keyword default: Value returned if there's no file
                      descriptor limit.

    """
    try:
        return os.sysconf('SC_OPEN_MAX')
    except:
        pass
    if resource is None:  # Windows
        return default
    fdmax = resource.getrlimit(resource.RLIMIT_NOFILE)[1]
    if fdmax == resource.RLIM_INFINITY:
        return default
    return fdmax


class Pidfile(object):
    """Pidfile

    This is the type returned by :func:`create_pidlock`.

    TIP: Use the :func:`create_pidlock` function instead,
    which is more convenient and also removes stale pidfiles (when
    the process holding the lock is no longer running).

    """

    #: Path to the pid lock file.
    path = None

    def __init__(self, path):
        self.path = os.path.abspath(path)

    def acquire(self):
        """Acquire lock."""
        try:
            self.write_pid()
        except OSError as exc:
            reraise(LockFailed, LockFailed(str(exc)), sys.exc_info()[2])
        return self
    __enter__ = acquire

    def is_locked(self):
        """Return true if the pid lock exists."""
        return os.path.exists(self.path)

    def release(self, *args):
        """Release lock."""
        self.remove()
    __exit__ = release

    def read_pid(self):
        """Read and return the current pid."""
        with ignore_errno('ENOENT'):
            with open(self.path, 'r') as fh:
                line = fh.readline()
                if line.strip() == line:  # must contain '\n'
                    raise ValueError(
                        'Partial or invalid pidfile {0.path}'.format(self))

                try:
                    return int(line.strip())
                except ValueError:
                    raise ValueError(
                        'pidfile {0.path} contents invalid.'.format(self))

    def remove(self):
        """Remove the lock."""
        with ignore_errno(errno.ENOENT, errno.EACCES):
            os.unlink(self.path)

    def remove_if_stale(self):
        """Remove the lock if the process is not running.
        (does not respond to signals)."""
        try:
            pid = self.read_pid()
        except ValueError as exc:
            print('Broken pidfile found. Removing it.', file=sys.stderr)
            self.remove()
            return True
        if not pid:
            self.remove()
            return True

        try:
            os.kill(pid, 0)
        except os.error as exc:
            if exc.errno == errno.ESRCH:
                print('Stale pidfile exists. Removing it.', file=sys.stderr)
                self.remove()
                return True
        return False

    def write_pid(self):
        pid = os.getpid()
        content = '{0}\n'.format(pid)

        pidfile_fd = os.open(self.path, PIDFILE_FLAGS, PIDFILE_MODE)
        pidfile = os.fdopen(pidfile_fd, 'w')
        try:
            pidfile.write(content)
            # flush and sync so that the re-read below works.
            pidfile.flush()
            try:
                os.fsync(pidfile_fd)
            except AttributeError:  # pragma: no cover
                pass
        finally:
            pidfile.close()

        rfh = open(self.path)
        try:
            if rfh.read() != content:
                raise LockFailed(
                    "Inconsistency: Pidfile content doesn't match at re-read")
        finally:
            rfh.close()
PIDFile = Pidfile  # compat alias


def create_pidlock(pidfile):
    """Create and verify pidfile.

    If the pidfile already exists the program exits with an error message,
    however if the process it refers to is not running anymore, the pidfile
    is deleted and the program continues.

    This function will automatically install an :mod:`atexit` handler
    to release the lock at exit, you can skip this by calling
    :func:`_create_pidlock` instead.

    :returns: :class:`Pidfile`.

    **Example**:

    .. code-block:: python

        pidlock = create_pidlock('/var/run/app.pid')

    """
    pidlock = _create_pidlock(pidfile)
    atexit.register(pidlock.release)
    return pidlock


def _create_pidlock(pidfile):
    pidlock = Pidfile(pidfile)
    if pidlock.is_locked() and not pidlock.remove_if_stale():
        print(PIDLOCKED.format(pidfile, pidlock.read_pid()), file=sys.stderr)
        raise SystemExit(EX_CANTCREAT)
    pidlock.acquire()
    return pidlock


def fd_by_path(paths):
    """Return a list of fds.

    This method returns list of fds corresponding to
    file paths passed in paths variable.

    :keyword paths: List of file paths go get fd for.

    :returns: :list:.

    **Example**:

    .. code-block:: python

        keep = fd_by_path(['/dev/urandom',
                           '/my/precious/'])
    """
    stats = set()
    for path in paths:
        try:
            fd = os.open(path, os.O_RDONLY)
        except OSError:
            continue
        try:
            stats.add(os.fstat(fd)[1:3])
        finally:
            os.close(fd)

    def fd_in_stats(fd):
        try:
            return os.fstat(fd)[1:3] in stats
        except OSError:
            return False

    return [_fd for _fd in range(get_fdmax(2048)) if fd_in_stats(_fd)]


if hasattr(os, 'closerange'):

    def close_open_fds(keep=None):
        # must make sure this is 0-inclusive (Issue #1882)
        keep = list(uniq(sorted(
            f for f in map(maybe_fileno, keep or []) if f is not None
        )))
        maxfd = get_fdmax(default=2048)
        kL, kH = iter([-1] + keep), iter(keep + [maxfd])
        for low, high in zip_longest(kL, kH):
            if low + 1 != high:
                os.closerange(low + 1, high)

else:

    def close_open_fds(keep=None):  # noqa
        keep = [maybe_fileno(f)
                for f in (keep or []) if maybe_fileno(f) is not None]
        for fd in reversed(range(get_fdmax(default=2048))):
            if fd not in keep:
                with ignore_errno(errno.EBADF):
                    os.close(fd)


class DaemonContext(object):
    _is_open = False

    def __init__(self, pidfile=None, workdir=None, umask=None,
                 fake=False, after_chdir=None, after_forkers=True,
                 **kwargs):
        if isinstance(umask, string_t):
            # octal or decimal, depending on initial zero.
            umask = int(umask, 8 if umask.startswith('0') else 10)
        self.workdir = workdir or DAEMON_WORKDIR
        self.umask = umask
        self.fake = fake
        self.after_chdir = after_chdir
        self.after_forkers = after_forkers
        self.stdfds = (sys.stdin, sys.stdout, sys.stderr)

    def redirect_to_null(self, fd):
        if fd is not None:
            dest = os.open(os.devnull, os.O_RDWR)
            os.dup2(dest, fd)

    def open(self):
        if not self._is_open:
            if not self.fake:
                self._detach()

            os.chdir(self.workdir)
            if self.umask is not None:
                os.umask(self.umask)

            if self.after_chdir:
                self.after_chdir()

            if not self.fake:
                # We need to keep /dev/urandom from closing because
                # shelve needs it, and Beat needs shelve to start.
                keep = list(self.stdfds) + fd_by_path(['/dev/urandom'])
                close_open_fds(keep)
                for fd in self.stdfds:
                    self.redirect_to_null(maybe_fileno(fd))
                if self.after_forkers and mputil is not None:
                    mputil._run_after_forkers()

            self._is_open = True
    __enter__ = open

    def close(self, *args):
        if self._is_open:
            self._is_open = False
    __exit__ = close

    def _detach(self):
        if os.fork() == 0:      # first child
            os.setsid()         # create new session
            if os.fork() > 0:   # second child
                os._exit(0)
        else:
            os._exit(0)
        return self


def detached(logfile=None, pidfile=None, uid=None, gid=None, umask=0,
             workdir=None, fake=False, **opts):
    """Detach the current process in the background (daemonize).

    :keyword logfile: Optional log file.  The ability to write to this file
       will be verified before the process is detached.
    :keyword pidfile: Optional pidfile.  The pidfile will not be created,
      as this is the responsibility of the child.  But the process will
      exit if the pid lock exists and the pid written is still running.
    :keyword uid: Optional user id or user name to change
      effective privileges to.
    :keyword gid: Optional group id or group name to change effective
      privileges to.
    :keyword umask: Optional umask that will be effective in the child process.
    :keyword workdir: Optional new working directory.
    :keyword fake: Don't actually detach, intented for debugging purposes.
    :keyword \*\*opts: Ignored.

    **Example**:

    .. code-block:: python

        from celery.platforms import detached, create_pidlock

        with detached(logfile='/var/log/app.log', pidfile='/var/run/app.pid',
                      uid='nobody'):
            # Now in detached child process with effective user set to nobody,
            # and we know that our logfile can be written to, and that
            # the pidfile is not locked.
            pidlock = create_pidlock('/var/run/app.pid')

            # Run the program
            program.run(logfile='/var/log/app.log')

    """

    if not resource:
        raise RuntimeError('This platform does not support detach.')
    workdir = os.getcwd() if workdir is None else workdir

    signals.reset('SIGCLD')  # Make sure SIGCLD is using the default handler.
    maybe_drop_privileges(uid=uid, gid=gid)

    def after_chdir_do():
        # Since without stderr any errors will be silently suppressed,
        # we need to know that we have access to the logfile.
        logfile and open(logfile, 'a').close()
        # Doesn't actually create the pidfile, but makes sure it's not stale.
        if pidfile:
            _create_pidlock(pidfile).release()

    return DaemonContext(
        umask=umask, workdir=workdir, fake=fake, after_chdir=after_chdir_do,
    )


def parse_uid(uid):
    """Parse user id.

    uid can be an integer (uid) or a string (user name), if a user name
    the uid is taken from the system user registry.

    """
    try:
        return int(uid)
    except ValueError:
        try:
            return pwd.getpwnam(uid).pw_uid
        except (AttributeError, KeyError):
            raise KeyError('User does not exist: {0}'.format(uid))


def parse_gid(gid):
    """Parse group id.

    gid can be an integer (gid) or a string (group name), if a group name
    the gid is taken from the system group registry.

    """
    try:
        return int(gid)
    except ValueError:
        try:
            return grp.getgrnam(gid).gr_gid
        except (AttributeError, KeyError):
            raise KeyError('Group does not exist: {0}'.format(gid))


def _setgroups_hack(groups):
    """:fun:`setgroups` may have a platform-dependent limit,
    and it is not always possible to know in advance what this limit
    is, so we use this ugly hack stolen from glibc."""
    groups = groups[:]

    while 1:
        try:
            return os.setgroups(groups)
        except ValueError:   # error from Python's check.
            if len(groups) <= 1:
                raise
            groups[:] = groups[:-1]
        except OSError as exc:  # error from the OS.
            if exc.errno != errno.EINVAL or len(groups) <= 1:
                raise
            groups[:] = groups[:-1]


def setgroups(groups):
    """Set active groups from a list of group ids."""
    max_groups = None
    try:
        max_groups = os.sysconf('SC_NGROUPS_MAX')
    except Exception:
        pass
    try:
        return _setgroups_hack(groups[:max_groups])
    except OSError as exc:
        if exc.errno != errno.EPERM:
            raise
        if any(group not in groups for group in os.getgroups()):
            # we shouldn't be allowed to change to this group.
            raise


def initgroups(uid, gid):
    """Compat version of :func:`os.initgroups` which was first
    added to Python 2.7."""
    if not pwd:  # pragma: no cover
        return
    username = pwd.getpwuid(uid)[0]
    if hasattr(os, 'initgroups'):  # Python 2.7+
        return os.initgroups(username, gid)
    groups = [gr.gr_gid for gr in grp.getgrall()
              if username in gr.gr_mem]
    setgroups(groups)


def setgid(gid):
    """Version of :func:`os.setgid` supporting group names."""
    os.setgid(parse_gid(gid))


def setuid(uid):
    """Version of :func:`os.setuid` supporting usernames."""
    os.setuid(parse_uid(uid))


def maybe_drop_privileges(uid=None, gid=None):
    """Change process privileges to new user/group.

    If UID and GID is specified, the real user/group is changed.

    If only UID is specified, the real user is changed, and the group is
    changed to the users primary group.

    If only GID is specified, only the group is changed.

    """
    if sys.platform == 'win32':
        return
    if os.geteuid():
        # no point trying to setuid unless we're root.
        if not os.getuid():
            raise AssertionError('contact support')
    uid = uid and parse_uid(uid)
    gid = gid and parse_gid(gid)

    if uid:
        # If GID isn't defined, get the primary GID of the user.
        if not gid and pwd:
            gid = pwd.getpwuid(uid).pw_gid
        # Must set the GID before initgroups(), as setgid()
        # is known to zap the group list on some platforms.

        # setgid must happen before setuid (otherwise the setgid operation
        # may fail because of insufficient privileges and possibly stay
        # in a privileged group).
        setgid(gid)
        initgroups(uid, gid)

        # at last:
        setuid(uid)
        # ... and make sure privileges cannot be restored:
        try:
            setuid(0)
        except OSError as exc:
            if get_errno(exc) != errno.EPERM:
                raise
            pass  # Good: cannot restore privileges.
        else:
            raise RuntimeError(
                'non-root user able to restore privileges after setuid.')
    else:
        gid and setgid(gid)

    if uid and (not os.getuid()) and not (os.geteuid()):
        raise AssertionError('Still root uid after drop privileges!')
    if gid and (not os.getgid()) and not (os.getegid()):
        raise AssertionError('Still root gid after drop privileges!')


class Signals(object):
    """Convenience interface to :mod:`signals`.

    If the requested signal is not supported on the current platform,
    the operation will be ignored.

    **Examples**:

    .. code-block:: python

        >>> from celery.platforms import signals

        >>> from proj.handlers import my_handler
        >>> signals['INT'] = my_handler

        >>> signals['INT']
        my_handler

        >>> signals.supported('INT')
        True

        >>> signals.signum('INT')
        2

        >>> signals.ignore('USR1')
        >>> signals['USR1'] == signals.ignored
        True

        >>> signals.reset('USR1')
        >>> signals['USR1'] == signals.default
        True

        >>> from proj.handlers import exit_handler, hup_handler
        >>> signals.update(INT=exit_handler,
        ...                TERM=exit_handler,
        ...                HUP=hup_handler)

    """

    ignored = _signal.SIG_IGN
    default = _signal.SIG_DFL

    if hasattr(_signal, 'setitimer'):

        def arm_alarm(self, seconds):
            _signal.setitimer(_signal.ITIMER_REAL, seconds)
    else:  # pragma: no cover
        try:
            from itimer import alarm as _itimer_alarm  # noqa
        except ImportError:

            def arm_alarm(self, seconds):  # noqa
                _signal.alarm(math.ceil(seconds))
        else:  # pragma: no cover

            def arm_alarm(self, seconds):      # noqa
                return _itimer_alarm(seconds)  # noqa

    def reset_alarm(self):
        return _signal.alarm(0)

    def supported(self, signal_name):
        """Return true value if ``signal_name`` exists on this platform."""
        try:
            return self.signum(signal_name)
        except AttributeError:
            pass

    def signum(self, signal_name):
        """Get signal number from signal name."""
        if isinstance(signal_name, numbers.Integral):
            return signal_name
        if not isinstance(signal_name, string_t) \
                or not signal_name.isupper():
            raise TypeError('signal name must be uppercase string.')
        if not signal_name.startswith('SIG'):
            signal_name = 'SIG' + signal_name
        return getattr(_signal, signal_name)

    def reset(self, *signal_names):
        """Reset signals to the default signal handler.

        Does nothing if the platform doesn't support signals,
        or the specified signal in particular.

        """
        self.update((sig, self.default) for sig in signal_names)

    def ignore(self, *signal_names):
        """Ignore signal using :const:`SIG_IGN`.

        Does nothing if the platform doesn't support signals,
        or the specified signal in particular.

        """
        self.update((sig, self.ignored) for sig in signal_names)

    def __getitem__(self, signal_name):
        return _signal.getsignal(self.signum(signal_name))

    def __setitem__(self, signal_name, handler):
        """Install signal handler.

        Does nothing if the current platform doesn't support signals,
        or the specified signal in particular.

        """
        try:
            _signal.signal(self.signum(signal_name), handler)
        except (AttributeError, ValueError):
            pass

    def update(self, _d_=None, **sigmap):
        """Set signal handlers from a mapping."""
        for signal_name, handler in items(dict(_d_ or {}, **sigmap)):
            self[signal_name] = handler

signals = Signals()
get_signal = signals.signum                   # compat
install_signal_handler = signals.__setitem__  # compat
reset_signal = signals.reset                  # compat
ignore_signal = signals.ignore                # compat


def strargv(argv):
    arg_start = 2 if 'manage' in argv[0] else 1
    if len(argv) > arg_start:
        return ' '.join(argv[arg_start:])
    return ''


def set_process_title(progname, info=None):
    """Set the ps name for the currently running process.

    Only works if :mod:`setproctitle` is installed.

    """
    proctitle = '[{0}]'.format(progname)
    proctitle = '{0} {1}'.format(proctitle, info) if info else proctitle
    if _setproctitle:
        _setproctitle.setproctitle(safe_str(proctitle))
    return proctitle


if os.environ.get('NOSETPS'):  # pragma: no cover

    def set_mp_process_title(*a, **k):
        pass
else:

    def set_mp_process_title(progname, info=None, hostname=None):  # noqa
        """Set the ps name using the multiprocessing process name.

        Only works if :mod:`setproctitle` is installed.

        """
        if hostname:
            progname = '{0}: {1}'.format(progname, hostname)
        return set_process_title(
            '{0}:{1}'.format(progname, current_process().name), info=info)


def get_errno_name(n):
    """Get errno for string, e.g. ``ENOENT``."""
    if isinstance(n, string_t):
        return getattr(errno, n)
    return n


@contextmanager
def ignore_errno(*errnos, **kwargs):
    """Context manager to ignore specific POSIX error codes.

    Takes a list of error codes to ignore, which can be either
    the name of the code, or the code integer itself::

        >>> with ignore_errno('ENOENT'):
        ...     with open('foo', 'r') as fh:
        ...         return fh.read()

        >>> with ignore_errno(errno.ENOENT, errno.EPERM):
        ...    pass

    :keyword types: A tuple of exceptions to ignore (when the errno matches),
                    defaults to :exc:`Exception`.
    """
    types = kwargs.get('types') or (Exception, )
    errnos = [get_errno_name(errno) for errno in errnos]
    try:
        yield
    except types as exc:
        if not hasattr(exc, 'errno'):
            raise
        if exc.errno not in errnos:
            raise


def check_privileges(accept_content):
    uid = os.getuid() if hasattr(os, 'getuid') else 65535
    gid = os.getgid() if hasattr(os, 'getgid') else 65535
    euid = os.geteuid() if hasattr(os, 'geteuid') else 65535
    egid = os.getegid() if hasattr(os, 'getegid') else 65535

    if hasattr(os, 'fchown'):
        if not all(hasattr(os, attr)
                   for attr in ['getuid', 'getgid', 'geteuid', 'getegid']):
            raise AssertionError('suspicious platform, contact support')

    if not uid or not gid or not euid or not egid:
        if ('pickle' in accept_content or
                'application/x-python-serialize' in accept_content):
            if not C_FORCE_ROOT:
                try:
                    print(ROOT_DISALLOWED.format(
                        uid=uid, euid=euid, gid=gid, egid=egid,
                    ), file=sys.stderr)
                finally:
                    os._exit(1)
        warnings.warn(RuntimeWarning(ROOT_DISCOURAGED.format(
            uid=uid, euid=euid, gid=gid, egid=egid,
        )))
