# -*- coding: utf-8 -*-
"""

The :program:`celery` umbrella command.

.. program:: celery

"""
from __future__ import absolute_import, unicode_literals

import anyjson
import numbers
import os
import sys

from functools import partial
from importlib import import_module

from celery.five import string_t, values
from celery.platforms import EX_OK, EX_FAILURE, EX_UNAVAILABLE, EX_USAGE
from celery.utils import term
from celery.utils import text
from celery.utils.timeutils import maybe_iso8601

# Cannot use relative imports here due to a Windows issue (#1111).
from celery.bin.base import Command, Option, Extensions

# Import commands from other modules
from celery.bin.amqp import amqp
from celery.bin.beat import beat
from celery.bin.events import events
from celery.bin.graph import graph
from celery.bin.worker import worker

__all__ = ['CeleryCommand', 'main']

HELP = """
---- -- - - ---- Commands- -------------- --- ------------

{commands}
---- -- - - --------- -- - -------------- --- ------------

Type '{prog_name} <command> --help' for help using a specific command.
"""

MIGRATE_PROGRESS_FMT = """\
Migrating task {state.count}/{state.strtotal}: \
{body[task]}[{body[id]}]\
"""

DEBUG = os.environ.get('C_DEBUG', False)

command_classes = [
    ('Main', ['worker', 'events', 'beat', 'shell', 'multi', 'amqp'], 'green'),
    ('Remote Control', ['status', 'inspect', 'control'], 'blue'),
    ('Utils', ['purge', 'list', 'migrate', 'call', 'result', 'report'], None),
]
if DEBUG:  # pragma: no cover
    command_classes.append(
        ('Debug', ['graph'], 'red'),
    )


def determine_exit_status(ret):
    if isinstance(ret, numbers.Integral):
        return ret
    return EX_OK if ret else EX_FAILURE


def main(argv=None):
    # Fix for setuptools generated scripts, so that it will
    # work with multiprocessing fork emulation.
    # (see multiprocessing.forking.get_preparation_data())
    try:
        if __name__ != '__main__':  # pragma: no cover
            sys.modules['__main__'] = sys.modules[__name__]
        cmd = CeleryCommand()
        cmd.maybe_patch_concurrency()
        from billiard import freeze_support
        freeze_support()
        cmd.execute_from_commandline(argv)
    except KeyboardInterrupt:
        pass


class multi(Command):
    """Start multiple worker instances."""
    respects_app_option = False

    def get_options(self):
        return ()

    def run_from_argv(self, prog_name, argv, command=None):
        from celery.bin.multi import MultiTool
        multi = MultiTool(quiet=self.quiet, no_color=self.no_color)
        return multi.execute_from_commandline(
            [command] + argv, prog_name,
        )


class list_(Command):
    """Get info from broker.

    Examples::

        celery list bindings

    NOTE: For RabbitMQ the management plugin is required.
    """
    args = '[bindings]'

    def list_bindings(self, management):
        try:
            bindings = management.get_bindings()
        except NotImplementedError:
            raise self.Error('Your transport cannot list bindings.')

        def fmt(q, e, r):
            return self.out('{0:<28} {1:<28} {2}'.format(q, e, r))
        fmt('Queue', 'Exchange', 'Routing Key')
        fmt('-' * 16, '-' * 16, '-' * 16)
        for b in bindings:
            fmt(b['destination'], b['source'], b['routing_key'])

    def run(self, what=None, *_, **kw):
        topics = {'bindings': self.list_bindings}
        available = ', '.join(topics)
        if not what:
            raise self.UsageError(
                'You must specify one of {0}'.format(available))
        if what not in topics:
            raise self.UsageError(
                'unknown topic {0!r} (choose one of: {1})'.format(
                    what, available))
        with self.app.connection() as conn:
            self.app.amqp.TaskConsumer(conn).declare()
            topics[what](conn.manager)


class call(Command):
    """Call a task by name.

    Examples::

        celery call tasks.add --args='[2, 2]'
        celery call tasks.add --args='[2, 2]' --countdown=10
    """
    args = '<task_name>'
    option_list = Command.option_list + (
        Option('--args', '-a', help='positional arguments (json).'),
        Option('--kwargs', '-k', help='keyword arguments (json).'),
        Option('--eta', help='scheduled time (ISO-8601).'),
        Option('--countdown', type='float',
               help='eta in seconds from now (float/int).'),
        Option('--expires', help='expiry time (ISO-8601/float/int).'),
        Option('--serializer', default='json', help='defaults to json.'),
        Option('--queue', help='custom queue name.'),
        Option('--exchange', help='custom exchange name.'),
        Option('--routing-key', help='custom routing key.'),
    )

    def run(self, name, *_, **kw):
        # Positional args.
        args = kw.get('args') or ()
        if isinstance(args, string_t):
            args = anyjson.loads(args)

        # Keyword args.
        kwargs = kw.get('kwargs') or {}
        if isinstance(kwargs, string_t):
            kwargs = anyjson.loads(kwargs)

        # Expires can be int/float.
        expires = kw.get('expires') or None
        try:
            expires = float(expires)
        except (TypeError, ValueError):
            # or a string describing an ISO 8601 datetime.
            try:
                expires = maybe_iso8601(expires)
            except (TypeError, ValueError):
                raise

        res = self.app.send_task(name, args=args, kwargs=kwargs,
                                 countdown=kw.get('countdown'),
                                 serializer=kw.get('serializer'),
                                 queue=kw.get('queue'),
                                 exchange=kw.get('exchange'),
                                 routing_key=kw.get('routing_key'),
                                 eta=maybe_iso8601(kw.get('eta')),
                                 expires=expires)
        self.out(res.id)


class purge(Command):
    """Erase all messages from all known task queues.

    WARNING: There is no undo operation for this command.

    """
    warn_prelude = (
        '{warning}: This will remove all tasks from {queues}: {names}.\n'
        '         There is no undo for this operation!\n\n'
        '(to skip this prompt use the -f option)\n'
    )
    warn_prompt = 'Are you sure you want to delete all tasks'
    fmt_purged = 'Purged {mnum} {messages} from {qnum} known task {queues}.'
    fmt_empty = 'No messages purged from {qnum} {queues}'
    option_list = Command.option_list + (
        Option('--force', '-f', action='store_true',
               help='Do not prompt for verification'),
    )

    def run(self, force=False, **kwargs):
        names = list(sorted(self.app.amqp.queues.keys()))
        qnum = len(names)
        if not force:
            self.out(self.warn_prelude.format(
                warning=self.colored.red('WARNING'),
                queues=text.pluralize(qnum, 'queue'), names=', '.join(names),
            ))
            if self.ask(self.warn_prompt, ('yes', 'no'), 'no') != 'yes':
                return
        messages = self.app.control.purge()
        fmt = self.fmt_purged if messages else self.fmt_empty
        self.out(fmt.format(
            mnum=messages, qnum=qnum,
            messages=text.pluralize(messages, 'message'),
            queues=text.pluralize(qnum, 'queue')))


class result(Command):
    """Gives the return value for a given task id.

    Examples::

        celery result 8f511516-e2f5-4da4-9d2f-0fb83a86e500
        celery result 8f511516-e2f5-4da4-9d2f-0fb83a86e500 -t tasks.add
        celery result 8f511516-e2f5-4da4-9d2f-0fb83a86e500 --traceback

    """
    args = '<task_id>'
    option_list = Command.option_list + (
        Option('--task', '-t', help='name of task (if custom backend)'),
        Option('--traceback', action='store_true',
               help='show traceback instead'),
    )

    def run(self, task_id, *args, **kwargs):
        result_cls = self.app.AsyncResult
        task = kwargs.get('task')
        traceback = kwargs.get('traceback', False)

        if task:
            result_cls = self.app.tasks[task].AsyncResult
        result = result_cls(task_id)
        if traceback:
            value = result.traceback
        else:
            value = result.get()
        self.out(self.pretty(value)[1])


class _RemoteControl(Command):
    name = None
    choices = None
    leaf = False
    option_list = Command.option_list + (
        Option('--timeout', '-t', type='float',
               help='Timeout in seconds (float) waiting for reply'),
        Option('--destination', '-d',
               help='Comma separated list of destination node names.'))

    def __init__(self, *args, **kwargs):
        self.show_body = kwargs.pop('show_body', True)
        self.show_reply = kwargs.pop('show_reply', True)
        super(_RemoteControl, self).__init__(*args, **kwargs)

    @classmethod
    def get_command_info(self, command,
                         indent=0, prefix='', color=None, help=False):
        if help:
            help = '|' + text.indent(self.choices[command][1], indent + 4)
        else:
            help = None
        try:
            # see if it uses args.
            meth = getattr(self, command)
            return text.join([
                '|' + text.indent('{0}{1} {2}'.format(
                    prefix, color(command), meth.__doc__), indent),
                help,
            ])

        except AttributeError:
            return text.join([
                '|' + text.indent(prefix + str(color(command)), indent), help,
            ])

    @classmethod
    def list_commands(self, indent=0, prefix='', color=None, help=False):
        color = color if color else lambda x: x
        prefix = prefix + ' ' if prefix else ''
        return '\n'.join(self.get_command_info(c, indent, prefix, color, help)
                         for c in sorted(self.choices))

    @property
    def epilog(self):
        return '\n'.join([
            '[Commands]',
            self.list_commands(indent=4, help=True)
        ])

    def usage(self, command):
        return '%prog {0} [options] {1} <command> [arg1 .. argN]'.format(
            command, self.args)

    def call(self, *args, **kwargs):
        raise NotImplementedError('call')

    def run(self, *args, **kwargs):
        if not args:
            raise self.UsageError(
                'Missing {0.name} method. See --help'.format(self))
        return self.do_call_method(args, **kwargs)

    def do_call_method(self, args, **kwargs):
        method = args[0]
        if method == 'help':
            raise self.Error("Did you mean '{0.name} --help'?".format(self))
        if method not in self.choices:
            raise self.UsageError(
                'Unknown {0.name} method {1}'.format(self, method))

        if self.app.connection().transport.driver_type == 'sql':
            raise self.Error('Broadcast not supported by SQL broker transport')

        destination = kwargs.get('destination')
        timeout = kwargs.get('timeout') or self.choices[method][0]
        if destination and isinstance(destination, string_t):
            destination = [dest.strip() for dest in destination.split(',')]

        handler = getattr(self, method, self.call)

        replies = handler(method, *args[1:], timeout=timeout,
                          destination=destination,
                          callback=self.say_remote_command_reply)
        if not replies:
            raise self.Error('No nodes replied within time constraint.',
                             status=EX_UNAVAILABLE)
        return replies


class inspect(_RemoteControl):
    """Inspect the worker at runtime.

    Availability: RabbitMQ (amqp), Redis, and MongoDB transports.

    Examples::

        celery inspect active --timeout=5
        celery inspect scheduled -d worker1@example.com
        celery inspect revoked -d w1@e.com,w2@e.com

    """
    name = 'inspect'
    choices = {
        'active': (1.0, 'dump active tasks (being processed)'),
        'active_queues': (1.0, 'dump queues being consumed from'),
        'scheduled': (1.0, 'dump scheduled tasks (eta/countdown/retry)'),
        'reserved': (1.0, 'dump reserved tasks (waiting to be processed)'),
        'stats': (1.0, 'dump worker statistics'),
        'revoked': (1.0, 'dump of revoked task ids'),
        'registered': (1.0, 'dump of registered tasks'),
        'ping': (0.2, 'ping worker(s)'),
        'clock': (1.0, 'get value of logical clock'),
        'conf': (1.0, 'dump worker configuration'),
        'report': (1.0, 'get bugreport info'),
        'memsample': (1.0, 'sample memory (requires psutil)'),
        'memdump': (1.0, 'dump memory samples (requires psutil)'),
        'objgraph': (60.0, 'create object graph (requires objgraph)'),
    }

    def call(self, method, *args, **options):
        i = self.app.control.inspect(**options)
        return getattr(i, method)(*args)

    def objgraph(self, type_='Request', *args, **kwargs):
        return self.call('objgraph', type_, **kwargs)

    def conf(self, with_defaults=False, *args, **kwargs):
        return self.call('conf', with_defaults, **kwargs)


class control(_RemoteControl):
    """Workers remote control.

    Availability: RabbitMQ (amqp), Redis, and MongoDB transports.

    Examples::

        celery control enable_events --timeout=5
        celery control -d worker1@example.com enable_events
        celery control -d w1.e.com,w2.e.com enable_events

        celery control -d w1.e.com add_consumer queue_name
        celery control -d w1.e.com cancel_consumer queue_name

        celery control -d w1.e.com add_consumer queue exchange direct rkey

    """
    name = 'control'
    choices = {
        'enable_events': (1.0, 'tell worker(s) to enable events'),
        'disable_events': (1.0, 'tell worker(s) to disable events'),
        'add_consumer': (1.0, 'tell worker(s) to start consuming a queue'),
        'cancel_consumer': (1.0, 'tell worker(s) to stop consuming a queue'),
        'rate_limit': (
            1.0, 'tell worker(s) to modify the rate limit for a task type'),
        'time_limit': (
            1.0, 'tell worker(s) to modify the time limit for a task type.'),
        'autoscale': (1.0, 'change autoscale settings'),
        'pool_grow': (1.0, 'start more pool processes'),
        'pool_shrink': (1.0, 'use less pool processes'),
    }

    def call(self, method, *args, **options):
        return getattr(self.app.control, method)(*args, reply=True, **options)

    def pool_grow(self, method, n=1, **kwargs):
        """[N=1]"""
        return self.call(method, int(n), **kwargs)

    def pool_shrink(self, method, n=1, **kwargs):
        """[N=1]"""
        return self.call(method, int(n), **kwargs)

    def autoscale(self, method, max=None, min=None, **kwargs):
        """[max] [min]"""
        return self.call(method, int(max), int(min), **kwargs)

    def rate_limit(self, method, task_name, rate_limit, **kwargs):
        """<task_name> <rate_limit> (e.g. 5/s | 5/m | 5/h)>"""
        return self.call(method, task_name, rate_limit, **kwargs)

    def time_limit(self, method, task_name, soft, hard=None, **kwargs):
        """<task_name> <soft_secs> [hard_secs]"""
        return self.call(method, task_name,
                         float(soft), float(hard), **kwargs)

    def add_consumer(self, method, queue, exchange=None,
                     exchange_type='direct', routing_key=None, **kwargs):
        """<queue> [exchange [type [routing_key]]]"""
        return self.call(method, queue, exchange,
                         exchange_type, routing_key, **kwargs)

    def cancel_consumer(self, method, queue, **kwargs):
        """<queue>"""
        return self.call(method, queue, **kwargs)


class status(Command):
    """Show list of workers that are online."""
    option_list = inspect.option_list

    def run(self, *args, **kwargs):
        I = inspect(
            app=self.app,
            no_color=kwargs.get('no_color', False),
            stdout=self.stdout, stderr=self.stderr,
            show_reply=False, show_body=False, quiet=True,
        )
        replies = I.run('ping', **kwargs)
        if not replies:
            raise self.Error('No nodes replied within time constraint',
                             status=EX_UNAVAILABLE)
        nodecount = len(replies)
        if not kwargs.get('quiet', False):
            self.out('\n{0} {1} online.'.format(
                nodecount, text.pluralize(nodecount, 'node')))


class migrate(Command):
    """Migrate tasks from one broker to another.

    Examples::

        celery migrate redis://localhost amqp://guest@localhost//
        celery migrate django:// redis://localhost

    NOTE: This command is experimental, make sure you have
          a backup of the tasks before you continue.
    """
    args = '<source_url> <dest_url>'
    option_list = Command.option_list + (
        Option('--limit', '-n', type='int',
               help='Number of tasks to consume (int)'),
        Option('--timeout', '-t', type='float', default=1.0,
               help='Timeout in seconds (float) waiting for tasks'),
        Option('--ack-messages', '-a', action='store_true',
               help='Ack messages from source broker.'),
        Option('--tasks', '-T',
               help='List of task names to filter on.'),
        Option('--queues', '-Q',
               help='List of queues to migrate.'),
        Option('--forever', '-F', action='store_true',
               help='Continually migrate tasks until killed.'),
    )
    progress_fmt = MIGRATE_PROGRESS_FMT

    def on_migrate_task(self, state, body, message):
        self.out(self.progress_fmt.format(state=state, body=body))

    def run(self, source, destination, **kwargs):
        from kombu import Connection
        from celery.contrib.migrate import migrate_tasks

        migrate_tasks(Connection(source),
                      Connection(destination),
                      callback=self.on_migrate_task,
                      **kwargs)


class shell(Command):  # pragma: no cover
    """Start shell session with convenient access to celery symbols.

    The following symbols will be added to the main globals:

        - celery:  the current application.
        - chord, group, chain, chunks,
          xmap, xstarmap subtask, Task
        - all registered tasks.

    """
    option_list = Command.option_list + (
        Option('--ipython', '-I',
               action='store_true', dest='force_ipython',
               help='force iPython.'),
        Option('--bpython', '-B',
               action='store_true', dest='force_bpython',
               help='force bpython.'),
        Option('--python', '-P',
               action='store_true', dest='force_python',
               help='force default Python shell.'),
        Option('--without-tasks', '-T', action='store_true',
               help="don't add tasks to locals."),
        Option('--eventlet', action='store_true',
               help='use eventlet.'),
        Option('--gevent', action='store_true', help='use gevent.'),
    )

    def run(self, force_ipython=False, force_bpython=False,
            force_python=False, without_tasks=False, eventlet=False,
            gevent=False, **kwargs):
        sys.path.insert(0, os.getcwd())
        if eventlet:
            import_module('celery.concurrency.eventlet')
        if gevent:
            import_module('celery.concurrency.gevent')
        import celery
        import celery.task.base
        self.app.loader.import_default_modules()
        self.locals = {'app': self.app,
                       'celery': self.app,
                       'Task': celery.Task,
                       'chord': celery.chord,
                       'group': celery.group,
                       'chain': celery.chain,
                       'chunks': celery.chunks,
                       'xmap': celery.xmap,
                       'xstarmap': celery.xstarmap,
                       'subtask': celery.subtask,
                       'signature': celery.signature}

        if not without_tasks:
            self.locals.update(dict(
                (task.__name__, task) for task in values(self.app.tasks)
                if not task.name.startswith('celery.')),
            )

        if force_python:
            return self.invoke_fallback_shell()
        elif force_bpython:
            return self.invoke_bpython_shell()
        elif force_ipython:
            return self.invoke_ipython_shell()
        return self.invoke_default_shell()

    def invoke_default_shell(self):
        try:
            import IPython  # noqa
        except ImportError:
            try:
                import bpython  # noqa
            except ImportError:
                return self.invoke_fallback_shell()
            else:
                return self.invoke_bpython_shell()
        else:
            return self.invoke_ipython_shell()

    def invoke_fallback_shell(self):
        import code
        try:
            import readline
        except ImportError:
            pass
        else:
            import rlcompleter
            readline.set_completer(
                rlcompleter.Completer(self.locals).complete)
            readline.parse_and_bind('tab:complete')
        code.interact(local=self.locals)

    def invoke_ipython_shell(self):
        for ip in (self._ipython, self._ipython_pre_10,
                   self._ipython_terminal, self._ipython_010,
                   self._no_ipython):
            try:
                return ip()
            except ImportError:
                pass

    def _ipython(self):
        from IPython import start_ipython
        start_ipython(argv=[], user_ns=self.locals)

    def _ipython_pre_10(self):  # pragma: no cover
        from IPython.frontend.terminal.ipapp import TerminalIPythonApp
        app = TerminalIPythonApp.instance()
        app.initialize(argv=[])
        app.shell.user_ns.update(self.locals)
        app.start()

    def _ipython_terminal(self):  # pragma: no cover
        from IPython.terminal import embed
        embed.TerminalInteractiveShell(user_ns=self.locals).mainloop()

    def _ipython_010(self):  # pragma: no cover
        from IPython.Shell import IPShell
        IPShell(argv=[], user_ns=self.locals).mainloop()

    def _no_ipython(self):  # pragma: no cover
        raise ImportError("no suitable ipython found")

    def invoke_bpython_shell(self):
        import bpython
        bpython.embed(self.locals)


class help(Command):
    """Show help screen and exit."""

    def usage(self, command):
        return '%prog <command> [options] {0.args}'.format(self)

    def run(self, *args, **kwargs):
        self.parser.print_help()
        self.out(HELP.format(
            prog_name=self.prog_name,
            commands=CeleryCommand.list_commands(colored=self.colored),
        ))

        return EX_USAGE


class report(Command):
    """Shows information useful to include in bugreports."""

    def run(self, *args, **kwargs):
        self.out(self.app.bugreport())
        return EX_OK


class CeleryCommand(Command):
    namespace = 'celery'
    ext_fmt = '{self.namespace}.commands'
    commands = {
        'amqp': amqp,
        'beat': beat,
        'call': call,
        'control': control,
        'events': events,
        'graph': graph,
        'help': help,
        'inspect': inspect,
        'list': list_,
        'migrate': migrate,
        'multi': multi,
        'purge': purge,
        'report': report,
        'result': result,
        'shell': shell,
        'status': status,
        'worker': worker,

    }
    enable_config_from_cmdline = True
    prog_name = 'celery'

    @classmethod
    def register_command(cls, fun, name=None):
        cls.commands[name or fun.__name__] = fun
        return fun

    def execute(self, command, argv=None):
        try:
            cls = self.commands[command]
        except KeyError:
            cls, argv = self.commands['help'], ['help']
        cls = self.commands.get(command) or self.commands['help']
        try:
            return cls(
                app=self.app, on_error=self.on_error,
                no_color=self.no_color, quiet=self.quiet,
                on_usage_error=partial(self.on_usage_error, command=command),
            ).run_from_argv(self.prog_name, argv[1:], command=argv[0])
        except self.UsageError as exc:
            self.on_usage_error(exc)
            return exc.status
        except self.Error as exc:
            self.on_error(exc)
            return exc.status

    def on_usage_error(self, exc, command=None):
        if command:
            helps = '{self.prog_name} {command} --help'
        else:
            helps = '{self.prog_name} --help'
        self.error(self.colored.magenta('Error: {0}'.format(exc)))
        self.error("""Please try '{0}'""".format(helps.format(
            self=self, command=command,
        )))

    def _relocate_args_from_start(self, argv, index=0):
        if argv:
            rest = []
            while index < len(argv):
                value = argv[index]
                if value.startswith('--'):
                    rest.append(value)
                elif value.startswith('-'):
                    # we eat the next argument even though we don't know
                    # if this option takes an argument or not.
                    # instead we will assume what is the command name in the
                    # return statements below.
                    try:
                        nxt = argv[index + 1]
                        if nxt.startswith('-'):
                            # is another option
                            rest.append(value)
                        else:
                            # is (maybe) a value for this option
                            rest.extend([value, nxt])
                            index += 1
                    except IndexError:
                        rest.append(value)
                        break
                else:
                    break
                index += 1
            if argv[index:]:
                # if there are more arguments left then divide and swap
                # we assume the first argument in argv[i:] is the command
                # name.
                return argv[index:] + rest
            # if there are no more arguments then the last arg in rest'
            # must be the command.
            [rest.pop()] + rest
        return []

    def prepare_prog_name(self, name):
        if name == '__main__.py':
            return sys.modules['__main__'].__file__
        return name

    def handle_argv(self, prog_name, argv):
        self.prog_name = self.prepare_prog_name(prog_name)
        argv = self._relocate_args_from_start(argv)
        _, argv = self.prepare_args(None, argv)
        try:
            command = argv[0]
        except IndexError:
            command, argv = 'help', ['help']
        return self.execute(command, argv)

    def execute_from_commandline(self, argv=None):
        argv = sys.argv if argv is None else argv
        if 'multi' in argv[1:3]:  # Issue 1008
            self.respects_app_option = False
        try:
            sys.exit(determine_exit_status(
                super(CeleryCommand, self).execute_from_commandline(argv)))
        except KeyboardInterrupt:
            sys.exit(EX_FAILURE)

    @classmethod
    def get_command_info(self, command, indent=0, color=None, colored=None):
        colored = term.colored() if colored is None else colored
        colored = colored.names[color] if color else lambda x: x
        obj = self.commands[command]
        cmd = 'celery {0}'.format(colored(command))
        if obj.leaf:
            return '|' + text.indent(cmd, indent)
        return text.join([
            ' ',
            '|' + text.indent('{0} --help'.format(cmd), indent),
            obj.list_commands(indent, 'celery {0}'.format(command), colored),
        ])

    @classmethod
    def list_commands(self, indent=0, colored=None):
        colored = term.colored() if colored is None else colored
        white = colored.white
        ret = []
        for cls, commands, color in command_classes:
            ret.extend([
                text.indent('+ {0}: '.format(white(cls)), indent),
                '\n'.join(
                    self.get_command_info(command, indent + 4, color, colored)
                    for command in commands),
                ''
            ])
        return '\n'.join(ret).strip()

    def with_pool_option(self, argv):
        if len(argv) > 1 and 'worker' in argv[0:3]:
            # this command supports custom pools
            # that may have to be loaded as early as possible.
            return (['-P'], ['--pool'])

    def on_concurrency_setup(self):
        self.load_extension_commands()

    def load_extension_commands(self):
        names = Extensions(self.ext_fmt.format(self=self),
                           self.register_command).load()
        if names:
            command_classes.append(('Extensions', names, 'magenta'))


def command(*args, **kwargs):
    """Deprecated: Use classmethod :meth:`CeleryCommand.register_command`
    instead."""
    _register = CeleryCommand.register_command
    return _register(args[0]) if args else _register


if __name__ == '__main__':          # pragma: no cover
    main()
