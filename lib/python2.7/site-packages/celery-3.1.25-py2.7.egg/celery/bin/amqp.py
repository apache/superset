# -*- coding: utf-8 -*-
"""
The :program:`celery amqp` command.

.. program:: celery amqp

"""
from __future__ import absolute_import, print_function, unicode_literals

import cmd
import sys
import shlex
import pprint

from functools import partial
from itertools import count

from kombu.utils.encoding import safe_str

from celery.utils.functional import padlist

from celery.bin.base import Command
from celery.five import string_t
from celery.utils import strtobool

__all__ = ['AMQPAdmin', 'AMQShell', 'Spec', 'amqp']

# Map to coerce strings to other types.
COERCE = {bool: strtobool}

HELP_HEADER = """
Commands
--------
""".rstrip()

EXAMPLE_TEXT = """
Example:
    -> queue.delete myqueue yes no
"""

say = partial(print, file=sys.stderr)


class Spec(object):
    """AMQP Command specification.

    Used to convert arguments to Python values and display various help
    and tooltips.

    :param args: see :attr:`args`.
    :keyword returns: see :attr:`returns`.

    .. attribute args::

        List of arguments this command takes. Should
        contain `(argument_name, argument_type)` tuples.

    .. attribute returns:

        Helpful human string representation of what this command returns.
        May be :const:`None`, to signify the return type is unknown.

    """
    def __init__(self, *args, **kwargs):
        self.args = args
        self.returns = kwargs.get('returns')

    def coerce(self, index, value):
        """Coerce value for argument at index."""
        arg_info = self.args[index]
        arg_type = arg_info[1]
        # Might be a custom way to coerce the string value,
        # so look in the coercion map.
        return COERCE.get(arg_type, arg_type)(value)

    def str_args_to_python(self, arglist):
        """Process list of string arguments to values according to spec.

        e.g:

            >>> spec = Spec([('queue', str), ('if_unused', bool)])
            >>> spec.str_args_to_python('pobox', 'true')
            ('pobox', True)

        """
        return tuple(
            self.coerce(index, value) for index, value in enumerate(arglist))

    def format_response(self, response):
        """Format the return value of this command in a human-friendly way."""
        if not self.returns:
            return 'ok.' if response is None else response
        if callable(self.returns):
            return self.returns(response)
        return self.returns.format(response)

    def format_arg(self, name, type, default_value=None):
        if default_value is not None:
            return '{0}:{1}'.format(name, default_value)
        return name

    def format_signature(self):
        return ' '.join(self.format_arg(*padlist(list(arg), 3))
                        for arg in self.args)


def dump_message(message):
    if message is None:
        return 'No messages in queue. basic.publish something.'
    return {'body': message.body,
            'properties': message.properties,
            'delivery_info': message.delivery_info}


def format_declare_queue(ret):
    return 'ok. queue:{0} messages:{1} consumers:{2}.'.format(*ret)


class AMQShell(cmd.Cmd):
    """AMQP API Shell.

    :keyword connect: Function used to connect to the server, must return
        connection object.

    :keyword silent: If :const:`True`, the commands won't have annoying
                     output not relevant when running in non-shell mode.


    .. attribute: builtins

        Mapping of built-in command names -> method names

    .. attribute:: amqp

        Mapping of AMQP API commands and their :class:`Spec`.

    """
    conn = None
    chan = None
    prompt_fmt = '{self.counter}> '
    identchars = cmd.IDENTCHARS = '.'
    needs_reconnect = False
    counter = 1
    inc_counter = count(2)

    builtins = {'EOF': 'do_exit',
                'exit': 'do_exit',
                'help': 'do_help'}

    amqp = {
        'exchange.declare': Spec(('exchange', str),
                                 ('type', str),
                                 ('passive', bool, 'no'),
                                 ('durable', bool, 'no'),
                                 ('auto_delete', bool, 'no'),
                                 ('internal', bool, 'no')),
        'exchange.delete': Spec(('exchange', str),
                                ('if_unused', bool)),
        'queue.bind': Spec(('queue', str),
                           ('exchange', str),
                           ('routing_key', str)),
        'queue.declare': Spec(('queue', str),
                              ('passive', bool, 'no'),
                              ('durable', bool, 'no'),
                              ('exclusive', bool, 'no'),
                              ('auto_delete', bool, 'no'),
                              returns=format_declare_queue),
        'queue.delete': Spec(('queue', str),
                             ('if_unused', bool, 'no'),
                             ('if_empty', bool, 'no'),
                             returns='ok. {0} messages deleted.'),
        'queue.purge': Spec(('queue', str),
                            returns='ok. {0} messages deleted.'),
        'basic.get': Spec(('queue', str),
                          ('no_ack', bool, 'off'),
                          returns=dump_message),
        'basic.publish': Spec(('msg', str),
                              ('exchange', str),
                              ('routing_key', str),
                              ('mandatory', bool, 'no'),
                              ('immediate', bool, 'no')),
        'basic.ack': Spec(('delivery_tag', int)),
    }

    def _prepare_spec(self, conn):
        # XXX Hack to fix Issue #2013
        from amqp import Connection, Message
        if isinstance(conn.connection, Connection):
            self.amqp['basic.publish'] = Spec(('msg', Message),
                                              ('exchange', str),
                                              ('routing_key', str),
                                              ('mandatory', bool, 'no'),
                                              ('immediate', bool, 'no'))

    def __init__(self, *args, **kwargs):
        self.connect = kwargs.pop('connect')
        self.silent = kwargs.pop('silent', False)
        self.out = kwargs.pop('out', sys.stderr)
        cmd.Cmd.__init__(self, *args, **kwargs)
        self._reconnect()

    def note(self, m):
        """Say something to the user. Disabled if :attr:`silent`."""
        if not self.silent:
            say(m, file=self.out)

    def say(self, m):
        say(m, file=self.out)

    def get_amqp_api_command(self, cmd, arglist):
        """With a command name and a list of arguments, convert the arguments
        to Python values and find the corresponding method on the AMQP channel
        object.

        :returns: tuple of `(method, processed_args)`.

        """
        spec = self.amqp[cmd]
        args = spec.str_args_to_python(arglist)
        attr_name = cmd.replace('.', '_')
        if self.needs_reconnect:
            self._reconnect()
        return getattr(self.chan, attr_name), args, spec.format_response

    def do_exit(self, *args):
        """The `'exit'` command."""
        self.note("\n-> please, don't leave!")
        sys.exit(0)

    def display_command_help(self, cmd, short=False):
        spec = self.amqp[cmd]
        self.say('{0} {1}'.format(cmd, spec.format_signature()))

    def do_help(self, *args):
        if not args:
            self.say(HELP_HEADER)
            for cmd_name in self.amqp:
                self.display_command_help(cmd_name, short=True)
            self.say(EXAMPLE_TEXT)
        else:
            self.display_command_help(args[0])

    def default(self, line):
        self.say("unknown syntax: {0!r}. how about some 'help'?".format(line))

    def get_names(self):
        return set(self.builtins) | set(self.amqp)

    def completenames(self, text, *ignored):
        """Return all commands starting with `text`, for tab-completion."""
        names = self.get_names()
        first = [cmd for cmd in names
                 if cmd.startswith(text.replace('_', '.'))]
        if first:
            return first
        return [cmd for cmd in names
                if cmd.partition('.')[2].startswith(text)]

    def dispatch(self, cmd, argline):
        """Dispatch and execute the command.

        Lookup order is: :attr:`builtins` -> :attr:`amqp`.

        """
        arglist = shlex.split(safe_str(argline))
        if cmd in self.builtins:
            return getattr(self, self.builtins[cmd])(*arglist)
        fun, args, formatter = self.get_amqp_api_command(cmd, arglist)
        return formatter(fun(*args))

    def parseline(self, line):
        """Parse input line.

        :returns: tuple of three items:
            `(command_name, arglist, original_line)`

        """
        parts = line.split()
        if parts:
            return parts[0], ' '.join(parts[1:]), line
        return '', '', line

    def onecmd(self, line):
        """Parse line and execute command."""
        cmd, arg, line = self.parseline(line)
        if not line:
            return self.emptyline()
        self.lastcmd = line
        self.counter = next(self.inc_counter)
        try:
            self.respond(self.dispatch(cmd, arg))
        except (AttributeError, KeyError) as exc:
            self.default(line)
        except Exception as exc:
            self.say(exc)
            self.needs_reconnect = True

    def respond(self, retval):
        """What to do with the return value of a command."""
        if retval is not None:
            if isinstance(retval, string_t):
                self.say(retval)
            else:
                self.say(pprint.pformat(retval))

    def _reconnect(self):
        """Re-establish connection to the AMQP server."""
        self.conn = self.connect(self.conn)
        self._prepare_spec(self.conn)
        self.chan = self.conn.default_channel
        self.needs_reconnect = False

    @property
    def prompt(self):
        return self.prompt_fmt.format(self=self)


class AMQPAdmin(object):
    """The celery :program:`celery amqp` utility."""
    Shell = AMQShell

    def __init__(self, *args, **kwargs):
        self.app = kwargs['app']
        self.out = kwargs.setdefault('out', sys.stderr)
        self.silent = kwargs.get('silent')
        self.args = args

    def connect(self, conn=None):
        if conn:
            conn.close()
        conn = self.app.connection()
        self.note('-> connecting to {0}.'.format(conn.as_uri()))
        conn.connect()
        self.note('-> connected.')
        return conn

    def run(self):
        shell = self.Shell(connect=self.connect, out=self.out)
        if self.args:
            return shell.onecmd(' '.join(self.args))
        try:
            return shell.cmdloop()
        except KeyboardInterrupt:
            self.note('(bibi)')
            pass

    def note(self, m):
        if not self.silent:
            say(m, file=self.out)


class amqp(Command):
    """AMQP Administration Shell.

    Also works for non-amqp transports (but not ones that
    store declarations in memory).

    Examples::

        celery amqp
            start shell mode
        celery amqp help
            show list of commands

        celery amqp exchange.delete name
        celery amqp queue.delete queue
        celery amqp queue.delete queue yes yes

    """

    def run(self, *args, **options):
        options['app'] = self.app
        return AMQPAdmin(*args, **options).run()


def main():
    amqp().execute_from_commandline()

if __name__ == '__main__':  # pragma: no cover
    main()
