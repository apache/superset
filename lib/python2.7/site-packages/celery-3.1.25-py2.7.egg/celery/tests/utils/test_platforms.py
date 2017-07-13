from __future__ import absolute_import

import errno
import os
import sys
import signal
import tempfile

from celery import _find_option_with_arg
from celery import platforms
from celery.five import open_fqdn
from celery.platforms import (
    get_fdmax,
    ignore_errno,
    set_process_title,
    signals,
    maybe_drop_privileges,
    setuid,
    setgid,
    initgroups,
    parse_uid,
    parse_gid,
    detached,
    DaemonContext,
    create_pidlock,
    Pidfile,
    LockFailed,
    setgroups,
    _setgroups_hack,
    close_open_fds,
    fd_by_path,
)

try:
    import resource
except ImportError:  # pragma: no cover
    resource = None  # noqa

from celery.tests.case import (
    Case, WhateverIO, Mock, SkipTest,
    call, override_stdouts, mock_open, patch,
)


class test_find_option_with_arg(Case):

    def test_long_opt(self):
        self.assertEqual(
            _find_option_with_arg(['--foo=bar'], long_opts=['--foo']),
            'bar'
        )

    def test_short_opt(self):
        self.assertEqual(
            _find_option_with_arg(['-f', 'bar'], short_opts=['-f']),
            'bar'
        )


class test_fd_by_path(Case):

    def test_finds(self):
        test_file = tempfile.NamedTemporaryFile()
        keep = fd_by_path([test_file.name])
        self.assertEqual(keep, [test_file.file.fileno()])
        test_file.close()


class test_close_open_fds(Case):

    def test_closes(self):
        with patch('os.close') as _close:
            with patch('os.closerange', create=True) as closerange:
                with patch('celery.platforms.get_fdmax') as fdmax:
                    fdmax.return_value = 3
                    close_open_fds()
                    if not closerange.called:
                        _close.assert_has_calls([call(2), call(1), call(0)])
                        _close.side_effect = OSError()
                        _close.side_effect.errno = errno.EBADF
                    close_open_fds()


class test_ignore_errno(Case):

    def test_raises_EBADF(self):
        with ignore_errno('EBADF'):
            exc = OSError()
            exc.errno = errno.EBADF
            raise exc

    def test_otherwise(self):
        with self.assertRaises(OSError):
            with ignore_errno('EBADF'):
                exc = OSError()
                exc.errno = errno.ENOENT
                raise exc


class test_set_process_title(Case):

    def when_no_setps(self):
        prev = platforms._setproctitle = platforms._setproctitle, None
        try:
            set_process_title('foo')
        finally:
            platforms._setproctitle = prev


class test_Signals(Case):

    @patch('signal.getsignal')
    def test_getitem(self, getsignal):
        signals['SIGINT']
        getsignal.assert_called_with(signal.SIGINT)

    def test_supported(self):
        self.assertTrue(signals.supported('INT'))
        self.assertFalse(signals.supported('SIGIMAGINARY'))

    def test_reset_alarm(self):
        if sys.platform == 'win32':
            raise SkipTest('signal.alarm not available on Windows')
        with patch('signal.alarm') as _alarm:
            signals.reset_alarm()
            _alarm.assert_called_with(0)

    def test_arm_alarm(self):
        if hasattr(signal, 'setitimer'):
            with patch('signal.setitimer', create=True) as seti:
                signals.arm_alarm(30)
                self.assertTrue(seti.called)

    def test_signum(self):
        self.assertEqual(signals.signum(13), 13)
        self.assertEqual(signals.signum('INT'), signal.SIGINT)
        self.assertEqual(signals.signum('SIGINT'), signal.SIGINT)
        with self.assertRaises(TypeError):
            signals.signum('int')
            signals.signum(object())

    @patch('signal.signal')
    def test_ignore(self, set):
        signals.ignore('SIGINT')
        set.assert_called_with(signals.signum('INT'), signals.ignored)
        signals.ignore('SIGTERM')
        set.assert_called_with(signals.signum('TERM'), signals.ignored)

    @patch('signal.signal')
    def test_setitem(self, set):
        def handle(*a):
            return a
        signals['INT'] = handle
        set.assert_called_with(signal.SIGINT, handle)

    @patch('signal.signal')
    def test_setitem_raises(self, set):
        set.side_effect = ValueError()
        signals['INT'] = lambda *a: a


if not platforms.IS_WINDOWS:

    class test_get_fdmax(Case):

        @patch('resource.getrlimit')
        def test_when_infinity(self, getrlimit):
            with patch('os.sysconf') as sysconfig:
                sysconfig.side_effect = KeyError()
                getrlimit.return_value = [None, resource.RLIM_INFINITY]
                default = object()
                self.assertIs(get_fdmax(default), default)

        @patch('resource.getrlimit')
        def test_when_actual(self, getrlimit):
            with patch('os.sysconf') as sysconfig:
                sysconfig.side_effect = KeyError()
                getrlimit.return_value = [None, 13]
                self.assertEqual(get_fdmax(None), 13)

    class test_maybe_drop_privileges(Case):

        @patch('celery.platforms.parse_uid')
        @patch('pwd.getpwuid')
        @patch('celery.platforms.setgid')
        @patch('celery.platforms.setuid')
        @patch('celery.platforms.initgroups')
        def test_with_uid(self, initgroups, setuid, setgid,
                          getpwuid, parse_uid):

            class pw_struct(object):
                pw_gid = 50001

            def raise_on_second_call(*args, **kwargs):
                setuid.side_effect = OSError()
                setuid.side_effect.errno = errno.EPERM
            setuid.side_effect = raise_on_second_call
            getpwuid.return_value = pw_struct()
            parse_uid.return_value = 5001
            maybe_drop_privileges(uid='user')
            parse_uid.assert_called_with('user')
            getpwuid.assert_called_with(5001)
            setgid.assert_called_with(50001)
            initgroups.assert_called_with(5001, 50001)
            setuid.assert_has_calls([call(5001), call(0)])

        @patch('celery.platforms.parse_uid')
        @patch('celery.platforms.parse_gid')
        @patch('celery.platforms.setgid')
        @patch('celery.platforms.setuid')
        @patch('celery.platforms.initgroups')
        def test_with_guid(self, initgroups, setuid, setgid,
                           parse_gid, parse_uid):

            def raise_on_second_call(*args, **kwargs):
                setuid.side_effect = OSError()
                setuid.side_effect.errno = errno.EPERM
            setuid.side_effect = raise_on_second_call
            parse_uid.return_value = 5001
            parse_gid.return_value = 50001
            maybe_drop_privileges(uid='user', gid='group')
            parse_uid.assert_called_with('user')
            parse_gid.assert_called_with('group')
            setgid.assert_called_with(50001)
            initgroups.assert_called_with(5001, 50001)
            setuid.assert_has_calls([call(5001), call(0)])

            setuid.side_effect = None
            with self.assertRaises(RuntimeError):
                maybe_drop_privileges(uid='user', gid='group')
            setuid.side_effect = OSError()
            setuid.side_effect.errno = errno.EINVAL
            with self.assertRaises(OSError):
                maybe_drop_privileges(uid='user', gid='group')

        @patch('celery.platforms.setuid')
        @patch('celery.platforms.setgid')
        @patch('celery.platforms.parse_gid')
        def test_only_gid(self, parse_gid, setgid, setuid):
            parse_gid.return_value = 50001
            maybe_drop_privileges(gid='group')
            parse_gid.assert_called_with('group')
            setgid.assert_called_with(50001)
            self.assertFalse(setuid.called)

    class test_setget_uid_gid(Case):

        @patch('celery.platforms.parse_uid')
        @patch('os.setuid')
        def test_setuid(self, _setuid, parse_uid):
            parse_uid.return_value = 5001
            setuid('user')
            parse_uid.assert_called_with('user')
            _setuid.assert_called_with(5001)

        @patch('celery.platforms.parse_gid')
        @patch('os.setgid')
        def test_setgid(self, _setgid, parse_gid):
            parse_gid.return_value = 50001
            setgid('group')
            parse_gid.assert_called_with('group')
            _setgid.assert_called_with(50001)

        def test_parse_uid_when_int(self):
            self.assertEqual(parse_uid(5001), 5001)

        @patch('pwd.getpwnam')
        def test_parse_uid_when_existing_name(self, getpwnam):

            class pwent(object):
                pw_uid = 5001

            getpwnam.return_value = pwent()
            self.assertEqual(parse_uid('user'), 5001)

        @patch('pwd.getpwnam')
        def test_parse_uid_when_nonexisting_name(self, getpwnam):
            getpwnam.side_effect = KeyError('user')

            with self.assertRaises(KeyError):
                parse_uid('user')

        def test_parse_gid_when_int(self):
            self.assertEqual(parse_gid(50001), 50001)

        @patch('grp.getgrnam')
        def test_parse_gid_when_existing_name(self, getgrnam):

            class grent(object):
                gr_gid = 50001

            getgrnam.return_value = grent()
            self.assertEqual(parse_gid('group'), 50001)

        @patch('grp.getgrnam')
        def test_parse_gid_when_nonexisting_name(self, getgrnam):
            getgrnam.side_effect = KeyError('group')

            with self.assertRaises(KeyError):
                parse_gid('group')

    class test_initgroups(Case):

        @patch('pwd.getpwuid')
        @patch('os.initgroups', create=True)
        def test_with_initgroups(self, initgroups_, getpwuid):
            getpwuid.return_value = ['user']
            initgroups(5001, 50001)
            initgroups_.assert_called_with('user', 50001)

        @patch('celery.platforms.setgroups')
        @patch('grp.getgrall')
        @patch('pwd.getpwuid')
        def test_without_initgroups(self, getpwuid, getgrall, setgroups):
            prev = getattr(os, 'initgroups', None)
            try:
                delattr(os, 'initgroups')
            except AttributeError:
                pass
            try:
                getpwuid.return_value = ['user']

                class grent(object):
                    gr_mem = ['user']

                    def __init__(self, gid):
                        self.gr_gid = gid

                getgrall.return_value = [grent(1), grent(2), grent(3)]
                initgroups(5001, 50001)
                setgroups.assert_called_with([1, 2, 3])
            finally:
                if prev:
                    os.initgroups = prev

    class test_detached(Case):

        def test_without_resource(self):
            prev, platforms.resource = platforms.resource, None
            try:
                with self.assertRaises(RuntimeError):
                    detached()
            finally:
                platforms.resource = prev

        @patch('celery.platforms._create_pidlock')
        @patch('celery.platforms.signals')
        @patch('celery.platforms.maybe_drop_privileges')
        @patch('os.geteuid')
        @patch(open_fqdn)
        def test_default(self, open, geteuid, maybe_drop,
                         signals, pidlock):
            geteuid.return_value = 0
            context = detached(uid='user', gid='group')
            self.assertIsInstance(context, DaemonContext)
            signals.reset.assert_called_with('SIGCLD')
            maybe_drop.assert_called_with(uid='user', gid='group')
            open.return_value = Mock()

            geteuid.return_value = 5001
            context = detached(uid='user', gid='group', logfile='/foo/bar')
            self.assertIsInstance(context, DaemonContext)
            self.assertTrue(context.after_chdir)
            context.after_chdir()
            open.assert_called_with('/foo/bar', 'a')
            open.return_value.close.assert_called_with()

            context = detached(pidfile='/foo/bar/pid')
            self.assertIsInstance(context, DaemonContext)
            self.assertTrue(context.after_chdir)
            context.after_chdir()
            pidlock.assert_called_with('/foo/bar/pid')

    class test_DaemonContext(Case):

        @patch('os.fork')
        @patch('os.setsid')
        @patch('os._exit')
        @patch('os.chdir')
        @patch('os.umask')
        @patch('os.close')
        @patch('os.closerange')
        @patch('os.open')
        @patch('os.dup2')
        def test_open(self, dup2, open, close, closer, umask, chdir,
                      _exit, setsid, fork):
            x = DaemonContext(workdir='/opt/workdir', umask=0o22)
            x.stdfds = [0, 1, 2]

            fork.return_value = 0
            with x:
                self.assertTrue(x._is_open)
                with x:
                    pass
            self.assertEqual(fork.call_count, 2)
            setsid.assert_called_with()
            self.assertFalse(_exit.called)

            chdir.assert_called_with(x.workdir)
            umask.assert_called_with(0o22)
            self.assertTrue(dup2.called)

            fork.reset_mock()
            fork.return_value = 1
            x = DaemonContext(workdir='/opt/workdir')
            x.stdfds = [0, 1, 2]
            with x:
                pass
            self.assertEqual(fork.call_count, 1)
            _exit.assert_called_with(0)

            x = DaemonContext(workdir='/opt/workdir', fake=True)
            x.stdfds = [0, 1, 2]
            x._detach = Mock()
            with x:
                pass
            self.assertFalse(x._detach.called)

            x.after_chdir = Mock()
            with x:
                pass
            x.after_chdir.assert_called_with()

    class test_Pidfile(Case):

        @patch('celery.platforms.Pidfile')
        def test_create_pidlock(self, Pidfile):
            p = Pidfile.return_value = Mock()
            p.is_locked.return_value = True
            p.remove_if_stale.return_value = False
            with override_stdouts() as (_, err):
                with self.assertRaises(SystemExit):
                    create_pidlock('/var/pid')
                self.assertIn('already exists', err.getvalue())

            p.remove_if_stale.return_value = True
            ret = create_pidlock('/var/pid')
            self.assertIs(ret, p)

        def test_context(self):
            p = Pidfile('/var/pid')
            p.write_pid = Mock()
            p.remove = Mock()

            with p as _p:
                self.assertIs(_p, p)
            p.write_pid.assert_called_with()
            p.remove.assert_called_with()

        def test_acquire_raises_LockFailed(self):
            p = Pidfile('/var/pid')
            p.write_pid = Mock()
            p.write_pid.side_effect = OSError()

            with self.assertRaises(LockFailed):
                with p:
                    pass

        @patch('os.path.exists')
        def test_is_locked(self, exists):
            p = Pidfile('/var/pid')
            exists.return_value = True
            self.assertTrue(p.is_locked())
            exists.return_value = False
            self.assertFalse(p.is_locked())

        def test_read_pid(self):
            with mock_open() as s:
                s.write('1816\n')
                s.seek(0)
                p = Pidfile('/var/pid')
                self.assertEqual(p.read_pid(), 1816)

        def test_read_pid_partially_written(self):
            with mock_open() as s:
                s.write('1816')
                s.seek(0)
                p = Pidfile('/var/pid')
                with self.assertRaises(ValueError):
                    p.read_pid()

        def test_read_pid_raises_ENOENT(self):
            exc = IOError()
            exc.errno = errno.ENOENT
            with mock_open(side_effect=exc):
                p = Pidfile('/var/pid')
                self.assertIsNone(p.read_pid())

        def test_read_pid_raises_IOError(self):
            exc = IOError()
            exc.errno = errno.EAGAIN
            with mock_open(side_effect=exc):
                p = Pidfile('/var/pid')
                with self.assertRaises(IOError):
                    p.read_pid()

        def test_read_pid_bogus_pidfile(self):
            with mock_open() as s:
                s.write('eighteensixteen\n')
                s.seek(0)
                p = Pidfile('/var/pid')
                with self.assertRaises(ValueError):
                    p.read_pid()

        @patch('os.unlink')
        def test_remove(self, unlink):
            unlink.return_value = True
            p = Pidfile('/var/pid')
            p.remove()
            unlink.assert_called_with(p.path)

        @patch('os.unlink')
        def test_remove_ENOENT(self, unlink):
            exc = OSError()
            exc.errno = errno.ENOENT
            unlink.side_effect = exc
            p = Pidfile('/var/pid')
            p.remove()
            unlink.assert_called_with(p.path)

        @patch('os.unlink')
        def test_remove_EACCES(self, unlink):
            exc = OSError()
            exc.errno = errno.EACCES
            unlink.side_effect = exc
            p = Pidfile('/var/pid')
            p.remove()
            unlink.assert_called_with(p.path)

        @patch('os.unlink')
        def test_remove_OSError(self, unlink):
            exc = OSError()
            exc.errno = errno.EAGAIN
            unlink.side_effect = exc
            p = Pidfile('/var/pid')
            with self.assertRaises(OSError):
                p.remove()
            unlink.assert_called_with(p.path)

        @patch('os.kill')
        def test_remove_if_stale_process_alive(self, kill):
            p = Pidfile('/var/pid')
            p.read_pid = Mock()
            p.read_pid.return_value = 1816
            kill.return_value = 0
            self.assertFalse(p.remove_if_stale())
            kill.assert_called_with(1816, 0)
            p.read_pid.assert_called_with()

            kill.side_effect = OSError()
            kill.side_effect.errno = errno.ENOENT
            self.assertFalse(p.remove_if_stale())

        @patch('os.kill')
        def test_remove_if_stale_process_dead(self, kill):
            with override_stdouts():
                p = Pidfile('/var/pid')
                p.read_pid = Mock()
                p.read_pid.return_value = 1816
                p.remove = Mock()
                exc = OSError()
                exc.errno = errno.ESRCH
                kill.side_effect = exc
                self.assertTrue(p.remove_if_stale())
                kill.assert_called_with(1816, 0)
                p.remove.assert_called_with()

        def test_remove_if_stale_broken_pid(self):
            with override_stdouts():
                p = Pidfile('/var/pid')
                p.read_pid = Mock()
                p.read_pid.side_effect = ValueError()
                p.remove = Mock()

                self.assertTrue(p.remove_if_stale())
                p.remove.assert_called_with()

        def test_remove_if_stale_no_pidfile(self):
            p = Pidfile('/var/pid')
            p.read_pid = Mock()
            p.read_pid.return_value = None
            p.remove = Mock()

            self.assertTrue(p.remove_if_stale())
            p.remove.assert_called_with()

        @patch('os.fsync')
        @patch('os.getpid')
        @patch('os.open')
        @patch('os.fdopen')
        @patch(open_fqdn)
        def test_write_pid(self, open_, fdopen, osopen, getpid, fsync):
            getpid.return_value = 1816
            osopen.return_value = 13
            w = fdopen.return_value = WhateverIO()
            w.close = Mock()
            r = open_.return_value = WhateverIO()
            r.write('1816\n')
            r.seek(0)

            p = Pidfile('/var/pid')
            p.write_pid()
            w.seek(0)
            self.assertEqual(w.readline(), '1816\n')
            self.assertTrue(w.close.called)
            getpid.assert_called_with()
            osopen.assert_called_with(p.path, platforms.PIDFILE_FLAGS,
                                      platforms.PIDFILE_MODE)
            fdopen.assert_called_with(13, 'w')
            fsync.assert_called_with(13)
            open_.assert_called_with(p.path)

        @patch('os.fsync')
        @patch('os.getpid')
        @patch('os.open')
        @patch('os.fdopen')
        @patch(open_fqdn)
        def test_write_reread_fails(self, open_, fdopen,
                                    osopen, getpid, fsync):
            getpid.return_value = 1816
            osopen.return_value = 13
            w = fdopen.return_value = WhateverIO()
            w.close = Mock()
            r = open_.return_value = WhateverIO()
            r.write('11816\n')
            r.seek(0)

            p = Pidfile('/var/pid')
            with self.assertRaises(LockFailed):
                p.write_pid()

    class test_setgroups(Case):

        @patch('os.setgroups', create=True)
        def test_setgroups_hack_ValueError(self, setgroups):

            def on_setgroups(groups):
                if len(groups) <= 200:
                    setgroups.return_value = True
                    return
                raise ValueError()
            setgroups.side_effect = on_setgroups
            _setgroups_hack(list(range(400)))

            setgroups.side_effect = ValueError()
            with self.assertRaises(ValueError):
                _setgroups_hack(list(range(400)))

        @patch('os.setgroups', create=True)
        def test_setgroups_hack_OSError(self, setgroups):
            exc = OSError()
            exc.errno = errno.EINVAL

            def on_setgroups(groups):
                if len(groups) <= 200:
                    setgroups.return_value = True
                    return
                raise exc
            setgroups.side_effect = on_setgroups

            _setgroups_hack(list(range(400)))

            setgroups.side_effect = exc
            with self.assertRaises(OSError):
                _setgroups_hack(list(range(400)))

            exc2 = OSError()
            exc.errno = errno.ESRCH
            setgroups.side_effect = exc2
            with self.assertRaises(OSError):
                _setgroups_hack(list(range(400)))

        @patch('os.sysconf')
        @patch('celery.platforms._setgroups_hack')
        def test_setgroups(self, hack, sysconf):
            sysconf.return_value = 100
            setgroups(list(range(400)))
            hack.assert_called_with(list(range(100)))

        @patch('os.sysconf')
        @patch('celery.platforms._setgroups_hack')
        def test_setgroups_sysconf_raises(self, hack, sysconf):
            sysconf.side_effect = ValueError()
            setgroups(list(range(400)))
            hack.assert_called_with(list(range(400)))

        @patch('os.getgroups')
        @patch('os.sysconf')
        @patch('celery.platforms._setgroups_hack')
        def test_setgroups_raises_ESRCH(self, hack, sysconf, getgroups):
            sysconf.side_effect = ValueError()
            esrch = OSError()
            esrch.errno = errno.ESRCH
            hack.side_effect = esrch
            with self.assertRaises(OSError):
                setgroups(list(range(400)))

        @patch('os.getgroups')
        @patch('os.sysconf')
        @patch('celery.platforms._setgroups_hack')
        def test_setgroups_raises_EPERM(self, hack, sysconf, getgroups):
            sysconf.side_effect = ValueError()
            eperm = OSError()
            eperm.errno = errno.EPERM
            hack.side_effect = eperm
            getgroups.return_value = list(range(400))
            setgroups(list(range(400)))
            getgroups.assert_called_with()

            getgroups.return_value = [1000]
            with self.assertRaises(OSError):
                setgroups(list(range(400)))
            getgroups.assert_called_with()
