from __future__ import absolute_import

import sys

from anyjson import dumps
from datetime import datetime

from celery import __main__
from celery.platforms import EX_FAILURE, EX_USAGE, EX_OK
from celery.bin.base import Error
from celery.bin.celery import (
    Command,
    list_,
    call,
    purge,
    result,
    inspect,
    control,
    status,
    migrate,
    help,
    report,
    CeleryCommand,
    determine_exit_status,
    multi,
    main as mainfun,
    _RemoteControl,
    command,
)

from celery.tests.case import (
    AppCase, Mock, WhateverIO, override_stdouts, patch,
)


class test__main__(AppCase):

    def test_warn_deprecated(self):
        with override_stdouts() as (stdout, _):
            __main__._warn_deprecated('YADDA YADDA')
            self.assertIn('command is deprecated', stdout.getvalue())
            self.assertIn('YADDA YADDA', stdout.getvalue())

    def test_main(self):
        with patch('celery.__main__.maybe_patch_concurrency') as mpc:
            with patch('celery.bin.celery.main') as main:
                __main__.main()
                mpc.assert_called_with()
                main.assert_called_with()

    def test_compat_worker(self):
        with patch('celery.__main__.maybe_patch_concurrency') as mpc:
            with patch('celery.__main__._warn_deprecated') as depr:
                with patch('celery.bin.worker.main') as main:
                    __main__._compat_worker()
                    mpc.assert_called_with()
                    depr.assert_called_with('celery worker')
                    main.assert_called_with()

    def test_compat_multi(self):
        with patch('celery.__main__.maybe_patch_concurrency') as mpc:
            with patch('celery.__main__._warn_deprecated') as depr:
                with patch('celery.bin.multi.main') as main:
                    __main__._compat_multi()
                    self.assertFalse(mpc.called)
                    depr.assert_called_with('celery multi')
                    main.assert_called_with()

    def test_compat_beat(self):
        with patch('celery.__main__.maybe_patch_concurrency') as mpc:
            with patch('celery.__main__._warn_deprecated') as depr:
                with patch('celery.bin.beat.main') as main:
                    __main__._compat_beat()
                    mpc.assert_called_with()
                    depr.assert_called_with('celery beat')
                    main.assert_called_with()


class test_Command(AppCase):

    def test_Error_repr(self):
        x = Error('something happened')
        self.assertIsNotNone(x.status)
        self.assertTrue(x.reason)
        self.assertTrue(str(x))

    def setup(self):
        self.out = WhateverIO()
        self.err = WhateverIO()
        self.cmd = Command(self.app, stdout=self.out, stderr=self.err)

    def test_error(self):
        self.cmd.out = Mock()
        self.cmd.error('FOO')
        self.assertTrue(self.cmd.out.called)

    def test_out(self):
        f = Mock()
        self.cmd.out('foo', f)

    def test_call(self):

        def ok_run():
            pass

        self.cmd.run = ok_run
        self.assertEqual(self.cmd(), EX_OK)

        def error_run():
            raise Error('error', EX_FAILURE)
        self.cmd.run = error_run
        self.assertEqual(self.cmd(), EX_FAILURE)

    def test_run_from_argv(self):
        with self.assertRaises(NotImplementedError):
            self.cmd.run_from_argv('prog', ['foo', 'bar'])

    def test_pretty_list(self):
        self.assertEqual(self.cmd.pretty([])[1], '- empty -')
        self.assertIn('bar', self.cmd.pretty(['foo', 'bar'])[1])

    def test_pretty_dict(self):
        self.assertIn(
            'OK',
            str(self.cmd.pretty({'ok': 'the quick brown fox'})[0]),
        )
        self.assertIn(
            'ERROR',
            str(self.cmd.pretty({'error': 'the quick brown fox'})[0]),
        )

    def test_pretty(self):
        self.assertIn('OK', str(self.cmd.pretty('the quick brown')))
        self.assertIn('OK', str(self.cmd.pretty(object())))
        self.assertIn('OK', str(self.cmd.pretty({'foo': 'bar'})))


class test_list(AppCase):

    def test_list_bindings_no_support(self):
        l = list_(app=self.app, stderr=WhateverIO())
        management = Mock()
        management.get_bindings.side_effect = NotImplementedError()
        with self.assertRaises(Error):
            l.list_bindings(management)

    def test_run(self):
        l = list_(app=self.app, stderr=WhateverIO())
        l.run('bindings')

        with self.assertRaises(Error):
            l.run(None)

        with self.assertRaises(Error):
            l.run('foo')


class test_call(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add

    @patch('celery.app.base.Celery.send_task')
    def test_run(self, send_task):
        a = call(app=self.app, stderr=WhateverIO(), stdout=WhateverIO())
        a.run(self.add.name)
        self.assertTrue(send_task.called)

        a.run(self.add.name,
              args=dumps([4, 4]),
              kwargs=dumps({'x': 2, 'y': 2}))
        self.assertEqual(send_task.call_args[1]['args'], [4, 4])
        self.assertEqual(send_task.call_args[1]['kwargs'], {'x': 2, 'y': 2})

        a.run(self.add.name, expires=10, countdown=10)
        self.assertEqual(send_task.call_args[1]['expires'], 10)
        self.assertEqual(send_task.call_args[1]['countdown'], 10)

        now = datetime.now()
        iso = now.isoformat()
        a.run(self.add.name, expires=iso)
        self.assertEqual(send_task.call_args[1]['expires'], now)
        with self.assertRaises(ValueError):
            a.run(self.add.name, expires='foobaribazibar')


class test_purge(AppCase):

    @patch('celery.app.control.Control.purge')
    def test_run(self, purge_):
        out = WhateverIO()
        a = purge(app=self.app, stdout=out)
        purge_.return_value = 0
        a.run(force=True)
        self.assertIn('No messages purged', out.getvalue())

        purge_.return_value = 100
        a.run(force=True)
        self.assertIn('100 messages', out.getvalue())


class test_result(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add

    def test_run(self):
        with patch('celery.result.AsyncResult.get') as get:
            out = WhateverIO()
            r = result(app=self.app, stdout=out)
            get.return_value = 'Jerry'
            r.run('id')
            self.assertIn('Jerry', out.getvalue())

            get.return_value = 'Elaine'
            r.run('id', task=self.add.name)
            self.assertIn('Elaine', out.getvalue())

            with patch('celery.result.AsyncResult.traceback') as tb:
                r.run('id', task=self.add.name, traceback=True)
                self.assertIn(str(tb), out.getvalue())


class test_status(AppCase):

    @patch('celery.bin.celery.inspect')
    def test_run(self, inspect_):
        out, err = WhateverIO(), WhateverIO()
        ins = inspect_.return_value = Mock()
        ins.run.return_value = []
        s = status(self.app, stdout=out, stderr=err)
        with self.assertRaises(Error):
            s.run()

        ins.run.return_value = ['a', 'b', 'c']
        s.run()
        self.assertIn('3 nodes online', out.getvalue())
        s.run(quiet=True)


class test_migrate(AppCase):

    @patch('celery.contrib.migrate.migrate_tasks')
    def test_run(self, migrate_tasks):
        out = WhateverIO()
        m = migrate(app=self.app, stdout=out, stderr=WhateverIO())
        with self.assertRaises(TypeError):
            m.run()
        self.assertFalse(migrate_tasks.called)

        m.run('memory://foo', 'memory://bar')
        self.assertTrue(migrate_tasks.called)

        state = Mock()
        state.count = 10
        state.strtotal = 30
        m.on_migrate_task(state, {'task': 'tasks.add', 'id': 'ID'}, None)
        self.assertIn('10/30', out.getvalue())


class test_report(AppCase):

    def test_run(self):
        out = WhateverIO()
        r = report(app=self.app, stdout=out)
        self.assertEqual(r.run(), EX_OK)
        self.assertTrue(out.getvalue())


class test_help(AppCase):

    def test_run(self):
        out = WhateverIO()
        h = help(app=self.app, stdout=out)
        h.parser = Mock()
        self.assertEqual(h.run(), EX_USAGE)
        self.assertTrue(out.getvalue())
        self.assertTrue(h.usage('help'))
        h.parser.print_help.assert_called_with()


class test_CeleryCommand(AppCase):

    def test_execute_from_commandline(self):
        x = CeleryCommand(app=self.app)
        x.handle_argv = Mock()
        x.handle_argv.return_value = 1
        with self.assertRaises(SystemExit):
            x.execute_from_commandline()

        x.handle_argv.return_value = True
        with self.assertRaises(SystemExit):
            x.execute_from_commandline()

        x.handle_argv.side_effect = KeyboardInterrupt()
        with self.assertRaises(SystemExit):
            x.execute_from_commandline()

        x.respects_app_option = True
        with self.assertRaises(SystemExit):
            x.execute_from_commandline(['celery', 'multi'])
        self.assertFalse(x.respects_app_option)
        x.respects_app_option = True
        with self.assertRaises(SystemExit):
            x.execute_from_commandline(['manage.py', 'celery', 'multi'])
        self.assertFalse(x.respects_app_option)

    def test_with_pool_option(self):
        x = CeleryCommand(app=self.app)
        self.assertIsNone(x.with_pool_option(['celery', 'events']))
        self.assertTrue(x.with_pool_option(['celery', 'worker']))
        self.assertTrue(x.with_pool_option(['manage.py', 'celery', 'worker']))

    def test_load_extensions_no_commands(self):
        with patch('celery.bin.celery.Extensions') as Ext:
            ext = Ext.return_value = Mock(name='Extension')
            ext.load.return_value = None
            x = CeleryCommand(app=self.app)
            x.load_extension_commands()

    def test_determine_exit_status(self):
        self.assertEqual(determine_exit_status('true'), EX_OK)
        self.assertEqual(determine_exit_status(''), EX_FAILURE)

    def test_relocate_args_from_start(self):
        x = CeleryCommand(app=self.app)
        self.assertEqual(x._relocate_args_from_start(None), [])
        self.assertEqual(
            x._relocate_args_from_start(
                ['-l', 'debug', 'worker', '-c', '3', '--foo'],
            ),
            ['worker', '-c', '3', '--foo', '-l', 'debug'],
        )
        self.assertEqual(
            x._relocate_args_from_start(
                ['--pool=gevent', '-l', 'debug', 'worker', '--foo', '-c', '3'],
            ),
            ['worker', '--foo', '-c', '3', '--pool=gevent', '-l', 'debug'],
        )
        self.assertEqual(
            x._relocate_args_from_start(['foo', '--foo=1']),
            ['foo', '--foo=1'],
        )

    def test_handle_argv(self):
        x = CeleryCommand(app=self.app)
        x.execute = Mock()
        x.handle_argv('celery', [])
        x.execute.assert_called_with('help', ['help'])

        x.handle_argv('celery', ['start', 'foo'])
        x.execute.assert_called_with('start', ['start', 'foo'])

    def test_execute(self):
        x = CeleryCommand(app=self.app)
        Help = x.commands['help'] = Mock()
        help = Help.return_value = Mock()
        x.execute('fooox', ['a'])
        help.run_from_argv.assert_called_with(x.prog_name, [], command='help')
        help.reset()
        x.execute('help', ['help'])
        help.run_from_argv.assert_called_with(x.prog_name, [], command='help')

        Dummy = x.commands['dummy'] = Mock()
        dummy = Dummy.return_value = Mock()
        exc = dummy.run_from_argv.side_effect = Error(
            'foo', status='EX_FAILURE',
        )
        x.on_error = Mock(name='on_error')
        help.reset()
        x.execute('dummy', ['dummy'])
        x.on_error.assert_called_with(exc)
        dummy.run_from_argv.assert_called_with(
            x.prog_name, [], command='dummy',
        )
        help.run_from_argv.assert_called_with(
            x.prog_name, [], command='help',
        )

        exc = dummy.run_from_argv.side_effect = x.UsageError('foo')
        x.on_usage_error = Mock()
        x.execute('dummy', ['dummy'])
        x.on_usage_error.assert_called_with(exc)

    def test_on_usage_error(self):
        x = CeleryCommand(app=self.app)
        x.error = Mock()
        x.on_usage_error(x.UsageError('foo'), command=None)
        self.assertTrue(x.error.called)
        x.on_usage_error(x.UsageError('foo'), command='dummy')

    def test_prepare_prog_name(self):
        x = CeleryCommand(app=self.app)
        main = Mock(name='__main__')
        main.__file__ = '/opt/foo.py'
        with patch.dict(sys.modules, __main__=main):
            self.assertEqual(x.prepare_prog_name('__main__.py'), '/opt/foo.py')
            self.assertEqual(x.prepare_prog_name('celery'), 'celery')


class test_RemoteControl(AppCase):

    def test_call_interface(self):
        with self.assertRaises(NotImplementedError):
            _RemoteControl(app=self.app).call()


class test_inspect(AppCase):

    def test_usage(self):
        self.assertTrue(inspect(app=self.app).usage('foo'))

    def test_command_info(self):
        i = inspect(app=self.app)
        self.assertTrue(i.get_command_info(
            'ping', help=True, color=i.colored.red,
        ))

    def test_list_commands_color(self):
        i = inspect(app=self.app)
        self.assertTrue(i.list_commands(
            help=True, color=i.colored.red,
        ))
        self.assertTrue(i.list_commands(
            help=False, color=None,
        ))

    def test_epilog(self):
        self.assertTrue(inspect(app=self.app).epilog)

    def test_do_call_method_sql_transport_type(self):
        self.app.connection = Mock()
        conn = self.app.connection.return_value = Mock(name='Connection')
        conn.transport.driver_type = 'sql'
        i = inspect(app=self.app)
        with self.assertRaises(i.Error):
            i.do_call_method(['ping'])

    def test_say_directions(self):
        i = inspect(self.app)
        i.out = Mock()
        i.quiet = True
        i.say_chat('<-', 'hello out')
        self.assertFalse(i.out.called)

        i.say_chat('->', 'hello in')
        self.assertTrue(i.out.called)

        i.quiet = False
        i.out.reset_mock()
        i.say_chat('<-', 'hello out', 'body')
        self.assertTrue(i.out.called)

    @patch('celery.app.control.Control.inspect')
    def test_run(self, real):
        out = WhateverIO()
        i = inspect(app=self.app, stdout=out)
        with self.assertRaises(Error):
            i.run()
        with self.assertRaises(Error):
            i.run('help')
        with self.assertRaises(Error):
            i.run('xyzzybaz')

        i.run('ping')
        self.assertTrue(real.called)
        i.run('ping', destination='foo,bar')
        self.assertEqual(real.call_args[1]['destination'], ['foo', 'bar'])
        self.assertEqual(real.call_args[1]['timeout'], 0.2)
        callback = real.call_args[1]['callback']

        callback({'foo': {'ok': 'pong'}})
        self.assertIn('OK', out.getvalue())

        instance = real.return_value = Mock()
        instance.ping.return_value = None
        with self.assertRaises(Error):
            i.run('ping')

        out.seek(0)
        out.truncate()
        i.quiet = True
        i.say_chat('<-', 'hello')
        self.assertFalse(out.getvalue())


class test_control(AppCase):

    def control(self, patch_call, *args, **kwargs):
        kwargs.setdefault('app', Mock(name='app'))
        c = control(*args, **kwargs)
        if patch_call:
            c.call = Mock(name='control.call')
        return c

    def test_call(self):
        i = self.control(False)
        i.call('foo', 1, kw=2)
        i.app.control.foo.assert_called_with(1, kw=2, reply=True)

    def test_pool_grow(self):
        i = self.control(True)
        i.pool_grow('pool_grow', n=2)
        i.call.assert_called_with('pool_grow', 2)

    def test_pool_shrink(self):
        i = self.control(True)
        i.pool_shrink('pool_shrink', n=2)
        i.call.assert_called_with('pool_shrink', 2)

    def test_autoscale(self):
        i = self.control(True)
        i.autoscale('autoscale', max=3, min=2)
        i.call.assert_called_with('autoscale', 3, 2)

    def test_rate_limit(self):
        i = self.control(True)
        i.rate_limit('rate_limit', 'proj.add', '1/s')
        i.call.assert_called_with('rate_limit', 'proj.add', '1/s')

    def test_time_limit(self):
        i = self.control(True)
        i.time_limit('time_limit', 'proj.add', 10, 30)
        i.call.assert_called_with('time_limit', 'proj.add', 10, 30)

    def test_add_consumer(self):
        i = self.control(True)
        i.add_consumer(
            'add_consumer', 'queue', 'exchange', 'topic', 'rkey',
            durable=True,
        )
        i.call.assert_called_with(
            'add_consumer', 'queue', 'exchange', 'topic', 'rkey',
            durable=True,
        )

    def test_cancel_consumer(self):
        i = self.control(True)
        i.cancel_consumer('cancel_consumer', 'queue')
        i.call.assert_called_with('cancel_consumer', 'queue')


class test_multi(AppCase):

    def test_get_options(self):
        self.assertTupleEqual(multi(app=self.app).get_options(), ())

    def test_run_from_argv(self):
        with patch('celery.bin.multi.MultiTool') as MultiTool:
            m = MultiTool.return_value = Mock()
            multi(self.app).run_from_argv('celery', ['arg'], command='multi')
            m.execute_from_commandline.assert_called_with(
                ['multi', 'arg'], 'celery',
            )


class test_main(AppCase):

    @patch('celery.bin.celery.CeleryCommand')
    def test_main(self, Command):
        cmd = Command.return_value = Mock()
        mainfun()
        cmd.execute_from_commandline.assert_called_with(None)

    @patch('celery.bin.celery.CeleryCommand')
    def test_main_KeyboardInterrupt(self, Command):
        cmd = Command.return_value = Mock()
        cmd.execute_from_commandline.side_effect = KeyboardInterrupt()
        mainfun()
        cmd.execute_from_commandline.assert_called_with(None)


class test_compat(AppCase):

    def test_compat_command_decorator(self):
        with patch('celery.bin.celery.CeleryCommand') as CC:
            self.assertEqual(command(), CC.register_command)
            fun = Mock(name='fun')
            command(fun)
            CC.register_command.assert_called_with(fun)
