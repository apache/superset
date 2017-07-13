from __future__ import absolute_import

from celery.bin.amqp import (
    AMQPAdmin,
    AMQShell,
    dump_message,
    amqp,
    main,
)

from celery.tests.case import AppCase, Mock, WhateverIO, patch


class test_AMQShell(AppCase):

    def setup(self):
        self.fh = WhateverIO()
        self.adm = self.create_adm()
        self.shell = AMQShell(connect=self.adm.connect, out=self.fh)

    def create_adm(self, *args, **kwargs):
        return AMQPAdmin(app=self.app, out=self.fh, *args, **kwargs)

    def test_queue_declare(self):
        self.shell.onecmd('queue.declare foo')
        self.assertIn('ok', self.fh.getvalue())

    def test_missing_command(self):
        self.shell.onecmd('foo foo')
        self.assertIn('unknown syntax', self.fh.getvalue())

    def RV(self):
        raise Exception(self.fh.getvalue())

    def test_spec_format_response(self):
        spec = self.shell.amqp['exchange.declare']
        self.assertEqual(spec.format_response(None), 'ok.')
        self.assertEqual(spec.format_response('NO'), 'NO')

    def test_missing_namespace(self):
        self.shell.onecmd('ns.cmd arg')
        self.assertIn('unknown syntax', self.fh.getvalue())

    def test_help(self):
        self.shell.onecmd('help')
        self.assertIn('Example:', self.fh.getvalue())

    def test_help_command(self):
        self.shell.onecmd('help queue.declare')
        self.assertIn('passive:no', self.fh.getvalue())

    def test_help_unknown_command(self):
        self.shell.onecmd('help foo.baz')
        self.assertIn('unknown syntax', self.fh.getvalue())

    def test_onecmd_error(self):
        self.shell.dispatch = Mock()
        self.shell.dispatch.side_effect = MemoryError()
        self.shell.say = Mock()
        self.assertFalse(self.shell.needs_reconnect)
        self.shell.onecmd('hello')
        self.assertTrue(self.shell.say.called)
        self.assertTrue(self.shell.needs_reconnect)

    def test_exit(self):
        with self.assertRaises(SystemExit):
            self.shell.onecmd('exit')
        self.assertIn("don't leave!", self.fh.getvalue())

    def test_note_silent(self):
        self.shell.silent = True
        self.shell.note('foo bar')
        self.assertNotIn('foo bar', self.fh.getvalue())

    def test_reconnect(self):
        self.shell.onecmd('queue.declare foo')
        self.shell.needs_reconnect = True
        self.shell.onecmd('queue.delete foo')

    def test_completenames(self):
        self.assertEqual(
            self.shell.completenames('queue.dec'),
            ['queue.declare'],
        )
        self.assertEqual(
            sorted(self.shell.completenames('declare')),
            sorted(['queue.declare', 'exchange.declare']),
        )

    def test_empty_line(self):
        self.shell.emptyline = Mock()
        self.shell.default = Mock()
        self.shell.onecmd('')
        self.shell.emptyline.assert_called_with()
        self.shell.onecmd('foo')
        self.shell.default.assert_called_with('foo')

    def test_respond(self):
        self.shell.respond({'foo': 'bar'})
        self.assertIn('foo', self.fh.getvalue())

    def test_prompt(self):
        self.assertTrue(self.shell.prompt)

    def test_no_returns(self):
        self.shell.onecmd('queue.declare foo')
        self.shell.onecmd('exchange.declare bar direct yes')
        self.shell.onecmd('queue.bind foo bar baz')
        self.shell.onecmd('basic.ack 1')

    def test_dump_message(self):
        m = Mock()
        m.body = 'the quick brown fox'
        m.properties = {'a': 1}
        m.delivery_info = {'exchange': 'bar'}
        self.assertTrue(dump_message(m))

    def test_dump_message_no_message(self):
        self.assertIn('No messages in queue', dump_message(None))

    def test_note(self):
        self.adm.silent = True
        self.adm.note('FOO')
        self.assertNotIn('FOO', self.fh.getvalue())

    def test_run(self):
        a = self.create_adm('queue.declare foo')
        a.run()
        self.assertIn('ok', self.fh.getvalue())

    def test_run_loop(self):
        a = self.create_adm()
        a.Shell = Mock()
        shell = a.Shell.return_value = Mock()
        shell.cmdloop = Mock()
        a.run()
        shell.cmdloop.assert_called_with()

        shell.cmdloop.side_effect = KeyboardInterrupt()
        a.run()
        self.assertIn('bibi', self.fh.getvalue())

    @patch('celery.bin.amqp.amqp')
    def test_main(self, Command):
        c = Command.return_value = Mock()
        main()
        c.execute_from_commandline.assert_called_with()

    @patch('celery.bin.amqp.AMQPAdmin')
    def test_command(self, cls):
        x = amqp(app=self.app)
        x.run()
        self.assertIs(cls.call_args[1]['app'], self.app)
