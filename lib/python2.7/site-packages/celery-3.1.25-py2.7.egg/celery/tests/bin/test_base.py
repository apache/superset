from __future__ import absolute_import

import os

from celery.bin.base import (
    Command,
    Option,
    Extensions,
    HelpFormatter,
)
from celery.tests.case import (
    AppCase, Mock, depends_on_current_app, override_stdouts, patch,
)


class Object(object):
    pass


class MyApp(object):
    user_options = {'preload': None}

APP = MyApp()  # <-- Used by test_with_custom_app


class MockCommand(Command):
    mock_args = ('arg1', 'arg2', 'arg3')

    def parse_options(self, prog_name, arguments, command=None):
        options = Object()
        options.foo = 'bar'
        options.prog_name = prog_name
        return options, self.mock_args

    def run(self, *args, **kwargs):
        return args, kwargs


class test_Extensions(AppCase):

    def test_load(self):
        with patch('pkg_resources.iter_entry_points') as iterep:
            with patch('celery.bin.base.symbol_by_name') as symbyname:
                ep = Mock()
                ep.name = 'ep'
                ep.module_name = 'foo'
                ep.attrs = ['bar', 'baz']
                iterep.return_value = [ep]
                cls = symbyname.return_value = Mock()
                register = Mock()
                e = Extensions('unit', register)
                e.load()
                symbyname.assert_called_with('foo:bar')
                register.assert_called_with(cls, name='ep')

            with patch('celery.bin.base.symbol_by_name') as symbyname:
                symbyname.side_effect = SyntaxError()
                with patch('warnings.warn') as warn:
                    e.load()
                    self.assertTrue(warn.called)

            with patch('celery.bin.base.symbol_by_name') as symbyname:
                symbyname.side_effect = KeyError('foo')
                with self.assertRaises(KeyError):
                    e.load()


class test_HelpFormatter(AppCase):

    def test_format_epilog(self):
        f = HelpFormatter()
        self.assertTrue(f.format_epilog('hello'))
        self.assertFalse(f.format_epilog(''))

    def test_format_description(self):
        f = HelpFormatter()
        self.assertTrue(f.format_description('hello'))


class test_Command(AppCase):

    def test_get_options(self):
        cmd = Command()
        cmd.option_list = (1, 2, 3)
        self.assertTupleEqual(cmd.get_options(), (1, 2, 3))

    def test_custom_description(self):

        class C(Command):
            description = 'foo'

        c = C()
        self.assertEqual(c.description, 'foo')

    def test_register_callbacks(self):
        c = Command(on_error=8, on_usage_error=9)
        self.assertEqual(c.on_error, 8)
        self.assertEqual(c.on_usage_error, 9)

    def test_run_raises_UsageError(self):
        cb = Mock()
        c = Command(on_usage_error=cb)
        c.verify_args = Mock()
        c.run = Mock()
        exc = c.run.side_effect = c.UsageError('foo', status=3)

        self.assertEqual(c(), exc.status)
        cb.assert_called_with(exc)
        c.verify_args.assert_called_with(())

    def test_default_on_usage_error(self):
        cmd = Command()
        cmd.handle_error = Mock()
        exc = Exception()
        cmd.on_usage_error(exc)
        cmd.handle_error.assert_called_with(exc)

    def test_verify_args_missing(self):
        c = Command()

        def run(a, b, c):
            pass
        c.run = run

        with self.assertRaises(c.UsageError):
            c.verify_args((1, ))
        c.verify_args((1, 2, 3))

    def test_run_interface(self):
        with self.assertRaises(NotImplementedError):
            Command().run()

    @patch('sys.stdout')
    def test_early_version(self, stdout):
        cmd = Command()
        with self.assertRaises(SystemExit):
            cmd.early_version(['--version'])

    def test_execute_from_commandline(self):
        cmd = MockCommand(app=self.app)
        args1, kwargs1 = cmd.execute_from_commandline()     # sys.argv
        self.assertTupleEqual(args1, cmd.mock_args)
        self.assertDictContainsSubset({'foo': 'bar'}, kwargs1)
        self.assertTrue(kwargs1.get('prog_name'))
        args2, kwargs2 = cmd.execute_from_commandline(['foo'])   # pass list
        self.assertTupleEqual(args2, cmd.mock_args)
        self.assertDictContainsSubset({'foo': 'bar', 'prog_name': 'foo'},
                                      kwargs2)

    def test_with_bogus_args(self):
        with override_stdouts() as (_, stderr):
            cmd = MockCommand(app=self.app)
            cmd.supports_args = False
            with self.assertRaises(SystemExit):
                cmd.execute_from_commandline(argv=['--bogus'])
            self.assertTrue(stderr.getvalue())
            self.assertIn('Unrecognized', stderr.getvalue())

    def test_with_custom_config_module(self):
        prev = os.environ.pop('CELERY_CONFIG_MODULE', None)
        try:
            cmd = MockCommand(app=self.app)
            cmd.setup_app_from_commandline(['--config=foo.bar.baz'])
            self.assertEqual(os.environ.get('CELERY_CONFIG_MODULE'),
                             'foo.bar.baz')
        finally:
            if prev:
                os.environ['CELERY_CONFIG_MODULE'] = prev
            else:
                os.environ.pop('CELERY_CONFIG_MODULE', None)

    def test_with_custom_broker(self):
        prev = os.environ.pop('CELERY_BROKER_URL', None)
        try:
            cmd = MockCommand(app=self.app)
            cmd.setup_app_from_commandline(['--broker=xyzza://'])
            self.assertEqual(
                os.environ.get('CELERY_BROKER_URL'), 'xyzza://',
            )
        finally:
            if prev:
                os.environ['CELERY_BROKER_URL'] = prev
            else:
                os.environ.pop('CELERY_BROKER_URL', None)

    def test_with_custom_app(self):
        cmd = MockCommand(app=self.app)
        app = '.'.join([__name__, 'APP'])
        cmd.setup_app_from_commandline(['--app=%s' % (app, ),
                                        '--loglevel=INFO'])
        self.assertIs(cmd.app, APP)
        cmd.setup_app_from_commandline(['-A', app,
                                        '--loglevel=INFO'])
        self.assertIs(cmd.app, APP)

    def test_setup_app_sets_quiet(self):
        cmd = MockCommand(app=self.app)
        cmd.setup_app_from_commandline(['-q'])
        self.assertTrue(cmd.quiet)
        cmd2 = MockCommand(app=self.app)
        cmd2.setup_app_from_commandline(['--quiet'])
        self.assertTrue(cmd2.quiet)

    def test_setup_app_sets_chdir(self):
        with patch('os.chdir') as chdir:
            cmd = MockCommand(app=self.app)
            cmd.setup_app_from_commandline(['--workdir=/opt'])
            chdir.assert_called_with('/opt')

    def test_setup_app_sets_loader(self):
        prev = os.environ.get('CELERY_LOADER')
        try:
            cmd = MockCommand(app=self.app)
            cmd.setup_app_from_commandline(['--loader=X.Y:Z'])
            self.assertEqual(os.environ['CELERY_LOADER'], 'X.Y:Z')
        finally:
            if prev is not None:
                os.environ['CELERY_LOADER'] = prev

    def test_setup_app_no_respect(self):
        cmd = MockCommand(app=self.app)
        cmd.respects_app_option = False
        with patch('celery.bin.base.Celery') as cp:
            cmd.setup_app_from_commandline(['--app=x.y:z'])
            self.assertTrue(cp.called)

    def test_setup_app_custom_app(self):
        cmd = MockCommand(app=self.app)
        app = cmd.app = Mock()
        app.user_options = {'preload': None}
        cmd.setup_app_from_commandline([])
        self.assertEqual(cmd.app, app)

    def test_find_app_suspects(self):
        cmd = MockCommand(app=self.app)
        self.assertTrue(cmd.find_app('celery.tests.bin.proj.app'))
        self.assertTrue(cmd.find_app('celery.tests.bin.proj'))
        self.assertTrue(cmd.find_app('celery.tests.bin.proj:hello'))
        self.assertTrue(cmd.find_app('celery.tests.bin.proj.app:app'))

        with self.assertRaises(AttributeError):
            cmd.find_app(__name__)

    def test_host_format(self):
        cmd = MockCommand(app=self.app)
        with patch('socket.gethostname') as hn:
            hn.return_value = 'blacktron.example.com'
            self.assertEqual(cmd.host_format(''), '')
            self.assertEqual(
                cmd.host_format('celery@%h'),
                'celery@blacktron.example.com',
            )
            self.assertEqual(
                cmd.host_format('celery@%d'),
                'celery@example.com',
            )
            self.assertEqual(
                cmd.host_format('celery@%n'),
                'celery@blacktron',
            )

    def test_say_chat_quiet(self):
        cmd = MockCommand(app=self.app)
        cmd.quiet = True
        self.assertIsNone(cmd.say_chat('<-', 'foo', 'foo'))

    def test_say_chat_show_body(self):
        cmd = MockCommand(app=self.app)
        cmd.out = Mock()
        cmd.show_body = True
        cmd.say_chat('->', 'foo', 'body')
        cmd.out.assert_called_with('body')

    def test_say_chat_no_body(self):
        cmd = MockCommand(app=self.app)
        cmd.out = Mock()
        cmd.show_body = False
        cmd.say_chat('->', 'foo', 'body')

    @depends_on_current_app
    def test_with_cmdline_config(self):
        cmd = MockCommand(app=self.app)
        cmd.enable_config_from_cmdline = True
        cmd.namespace = 'celeryd'
        rest = cmd.setup_app_from_commandline(argv=[
            '--loglevel=INFO', '--',
            'broker.url=amqp://broker.example.com',
            '.prefetch_multiplier=100'])
        self.assertEqual(cmd.app.conf.BROKER_URL,
                         'amqp://broker.example.com')
        self.assertEqual(cmd.app.conf.CELERYD_PREFETCH_MULTIPLIER, 100)
        self.assertListEqual(rest, ['--loglevel=INFO'])

    def test_find_app(self):
        cmd = MockCommand(app=self.app)
        with patch('celery.bin.base.symbol_by_name') as sbn:
            from types import ModuleType
            x = ModuleType('proj')

            def on_sbn(*args, **kwargs):

                def after(*args, **kwargs):
                    x.app = 'quick brown fox'
                    x.__path__ = None
                    return x
                sbn.side_effect = after
                return x
            sbn.side_effect = on_sbn
            x.__path__ = [True]
            self.assertEqual(cmd.find_app('proj'), 'quick brown fox')

    def test_parse_preload_options_shortopt(self):
        cmd = Command()
        cmd.preload_options = (Option('-s', action='store', dest='silent'), )
        acc = cmd.parse_preload_options(['-s', 'yes'])
        self.assertEqual(acc.get('silent'), 'yes')

    def test_parse_preload_options_with_equals_and_append(self):
        cmd = Command()
        opt = Option('--zoom', action='append', default=[])
        cmd.preload_options = (opt,)
        acc = cmd.parse_preload_options(['--zoom=1', '--zoom=2'])

        self.assertEqual(acc, {'zoom': ['1', '2']})

    def test_parse_preload_options_without_equals_and_append(self):
        cmd = Command()
        opt = Option('--zoom', action='append', default=[])
        cmd.preload_options = (opt,)
        acc = cmd.parse_preload_options(['--zoom', '1', '--zoom', '2'])

        self.assertEqual(acc, {'zoom': ['1', '2']})
