# -*- coding: utf-8 -*-
"""

.. _preload-options:

Preload Options
---------------

These options are supported by all commands,
and usually parsed before command-specific arguments.

.. cmdoption:: -A, --app

    app instance to use (e.g. module.attr_name)

.. cmdoption:: -b, --broker

    url to broker.  default is 'amqp://guest@localhost//'

.. cmdoption:: --loader

    name of custom loader class to use.

.. cmdoption:: --config

    Name of the configuration module

.. _daemon-options:

Daemon Options
--------------

These options are supported by commands that can detach
into the background (daemon).  They will be present
in any command that also has a `--detach` option.

.. cmdoption:: -f, --logfile

    Path to log file. If no logfile is specified, `stderr` is used.

.. cmdoption:: --pidfile

    Optional file used to store the process pid.

    The program will not start if this file already exists
    and the pid is still alive.

.. cmdoption:: --uid

    User id, or user name of the user to run as after detaching.

.. cmdoption:: --gid

    Group id, or group name of the main group to change to after
    detaching.

.. cmdoption:: --umask

    Effective umask (in octal) of the process after detaching.  Inherits
    the umask of the parent process by default.

.. cmdoption:: --workdir

    Optional directory to change to after detaching.

.. cmdoption:: --executable

    Executable to use for the detached process.

"""
from __future__ import absolute_import, print_function, unicode_literals

import os
import random
import re
import sys
import warnings
import json

from collections import defaultdict
from heapq import heappush
from inspect import getargspec
from optparse import OptionParser, IndentedHelpFormatter, make_option as Option
from pprint import pformat

from celery import VERSION_BANNER, Celery, maybe_patch_concurrency
from celery import signals
from celery.exceptions import CDeprecationWarning, CPendingDeprecationWarning
from celery.five import items, string, string_t
from celery.platforms import EX_FAILURE, EX_OK, EX_USAGE
from celery.utils import term
from celery.utils import text
from celery.utils import node_format, host_format
from celery.utils.imports import symbol_by_name, import_from_cwd

try:
    input = raw_input
except NameError:
    pass

# always enable DeprecationWarnings, so our users can see them.
for warning in (CDeprecationWarning, CPendingDeprecationWarning):
    warnings.simplefilter('once', warning, 0)

ARGV_DISABLED = """
Unrecognized command-line arguments: {0}

Try --help?
"""

find_long_opt = re.compile(r'.+?(--.+?)(?:\s|,|$)')
find_rst_ref = re.compile(r':\w+:`(.+?)`')

__all__ = ['Error', 'UsageError', 'Extensions', 'HelpFormatter',
           'Command', 'Option', 'daemon_options']


class Error(Exception):
    status = EX_FAILURE

    def __init__(self, reason, status=None):
        self.reason = reason
        self.status = status if status is not None else self.status
        super(Error, self).__init__(reason, status)

    def __str__(self):
        return self.reason
    __unicode__ = __str__


class UsageError(Error):
    status = EX_USAGE


class Extensions(object):

    def __init__(self, namespace, register):
        self.names = []
        self.namespace = namespace
        self.register = register

    def add(self, cls, name):
        heappush(self.names, name)
        self.register(cls, name=name)

    def load(self):
        try:
            from pkg_resources import iter_entry_points
        except ImportError:  # pragma: no cover
            return

        for ep in iter_entry_points(self.namespace):
            sym = ':'.join([ep.module_name, ep.attrs[0]])
            try:
                cls = symbol_by_name(sym)
            except (ImportError, SyntaxError) as exc:
                warnings.warn(
                    'Cannot load extension {0!r}: {1!r}'.format(sym, exc))
            else:
                self.add(cls, ep.name)
        return self.names


class HelpFormatter(IndentedHelpFormatter):

    def format_epilog(self, epilog):
        if epilog:
            return '\n{0}\n\n'.format(epilog)
        return ''

    def format_description(self, description):
        return text.ensure_2lines(text.fill_paragraphs(
            text.dedent(description), self.width))


class Command(object):
    """Base class for command-line applications.

    :keyword app: The current app.
    :keyword get_app: Callable returning the current app if no app provided.

    """
    Error = Error
    UsageError = UsageError
    Parser = OptionParser

    #: Arg list used in help.
    args = ''

    #: Application version.
    version = VERSION_BANNER

    #: If false the parser will raise an exception if positional
    #: args are provided.
    supports_args = True

    #: List of options (without preload options).
    option_list = ()

    # module Rst documentation to parse help from (if any)
    doc = None

    # Some programs (multi) does not want to load the app specified
    # (Issue #1008).
    respects_app_option = True

    #: List of options to parse before parsing other options.
    preload_options = (
        Option('-A', '--app', default=None),
        Option('-b', '--broker', default=None),
        Option('--loader', default=None),
        Option('--config', default=None),
        Option('--workdir', default=None, dest='working_directory'),
        Option('--no-color', '-C', action='store_true', default=None),
        Option('--quiet', '-q', action='store_true'),
    )

    #: Enable if the application should support config from the cmdline.
    enable_config_from_cmdline = False

    #: Default configuration namespace.
    namespace = 'celery'

    #: Text to print at end of --help
    epilog = None

    #: Text to print in --help before option list.
    description = ''

    #: Set to true if this command doesn't have subcommands
    leaf = True

    # used by :meth:`say_remote_command_reply`.
    show_body = True
    # used by :meth:`say_chat`.
    show_reply = True

    prog_name = 'celery'

    def __init__(self, app=None, get_app=None, no_color=False,
                 stdout=None, stderr=None, quiet=False, on_error=None,
                 on_usage_error=None):
        self.app = app
        self.get_app = get_app or self._get_default_app
        self.stdout = stdout or sys.stdout
        self.stderr = stderr or sys.stderr
        self._colored = None
        self._no_color = no_color
        self.quiet = quiet
        if not self.description:
            self.description = self.__doc__
        if on_error:
            self.on_error = on_error
        if on_usage_error:
            self.on_usage_error = on_usage_error

    def run(self, *args, **options):
        """This is the body of the command called by :meth:`handle_argv`."""
        raise NotImplementedError('subclass responsibility')

    def on_error(self, exc):
        self.error(self.colored.red('Error: {0}'.format(exc)))

    def on_usage_error(self, exc):
        self.handle_error(exc)

    def on_concurrency_setup(self):
        pass

    def __call__(self, *args, **kwargs):
        random.seed()  # maybe we were forked.
        self.verify_args(args)
        try:
            ret = self.run(*args, **kwargs)
            return ret if ret is not None else EX_OK
        except self.UsageError as exc:
            self.on_usage_error(exc)
            return exc.status
        except self.Error as exc:
            self.on_error(exc)
            return exc.status

    def verify_args(self, given, _index=0):
        S = getargspec(self.run)
        _index = 1 if S.args and S.args[0] == 'self' else _index
        required = S.args[_index:-len(S.defaults) if S.defaults else None]
        missing = required[len(given):]
        if missing:
            raise self.UsageError('Missing required {0}: {1}'.format(
                text.pluralize(len(missing), 'argument'),
                ', '.join(missing)
            ))

    def execute_from_commandline(self, argv=None):
        """Execute application from command-line.

        :keyword argv: The list of command-line arguments.
                       Defaults to ``sys.argv``.

        """
        if argv is None:
            argv = list(sys.argv)
        # Should we load any special concurrency environment?
        self.maybe_patch_concurrency(argv)
        self.on_concurrency_setup()

        # Dump version and exit if '--version' arg set.
        self.early_version(argv)
        argv = self.setup_app_from_commandline(argv)
        self.prog_name = os.path.basename(argv[0])
        return self.handle_argv(self.prog_name, argv[1:])

    def run_from_argv(self, prog_name, argv=None, command=None):
        return self.handle_argv(prog_name,
                                sys.argv if argv is None else argv, command)

    def maybe_patch_concurrency(self, argv=None):
        argv = argv or sys.argv
        pool_option = self.with_pool_option(argv)
        if pool_option:
            maybe_patch_concurrency(argv, *pool_option)
            short_opts, long_opts = pool_option

    def usage(self, command):
        return '%prog {0} [options] {self.args}'.format(command, self=self)

    def get_options(self):
        """Get supported command-line options."""
        return self.option_list

    def expanduser(self, value):
        if isinstance(value, string_t):
            return os.path.expanduser(value)
        return value

    def ask(self, q, choices, default=None):
        """Prompt user to choose from a tuple of string values.

        :param q: the question to ask (do not include questionark)
        :param choice: tuple of possible choices, must be lowercase.
        :param default: Default value if any.

        If a default is not specified the question will be repeated
        until the user gives a valid choice.

        Matching is done case insensitively.

        """
        schoices = choices
        if default is not None:
            schoices = [c.upper() if c == default else c.lower()
                        for c in choices]
        schoices = '/'.join(schoices)

        p = '{0} ({1})? '.format(q.capitalize(), schoices)
        while 1:
            val = input(p).lower()
            if val in choices:
                return val
            elif default is not None:
                break
        return default

    def handle_argv(self, prog_name, argv, command=None):
        """Parse command-line arguments from ``argv`` and dispatch
        to :meth:`run`.

        :param prog_name: The program name (``argv[0]``).
        :param argv: Command arguments.

        Exits with an error message if :attr:`supports_args` is disabled
        and ``argv`` contains positional arguments.

        """
        options, args = self.prepare_args(
            *self.parse_options(prog_name, argv, command))
        return self(*args, **options)

    def prepare_args(self, options, args):
        if options:
            options = dict((k, self.expanduser(v))
                           for k, v in items(vars(options))
                           if not k.startswith('_'))
        args = [self.expanduser(arg) for arg in args]
        self.check_args(args)
        return options, args

    def check_args(self, args):
        if not self.supports_args and args:
            self.die(ARGV_DISABLED.format(', '.join(args)), EX_USAGE)

    def error(self, s):
        self.out(s, fh=self.stderr)

    def out(self, s, fh=None):
        print(s, file=fh or self.stdout)

    def die(self, msg, status=EX_FAILURE):
        self.error(msg)
        sys.exit(status)

    def early_version(self, argv):
        if '--version' in argv:
            print(self.version, file=self.stdout)
            sys.exit(0)

    def parse_options(self, prog_name, arguments, command=None):
        """Parse the available options."""
        # Don't want to load configuration to just print the version,
        # so we handle --version manually here.
        self.parser = self.create_parser(prog_name, command)
        return self.parser.parse_args(arguments)

    def create_parser(self, prog_name, command=None):
        option_list = (
            self.preload_options +
            self.get_options() +
            tuple(self.app.user_options['preload'])
        )
        return self.prepare_parser(self.Parser(
            prog=prog_name,
            usage=self.usage(command),
            version=self.version,
            epilog=self.epilog,
            formatter=HelpFormatter(),
            description=self.description,
            option_list=option_list,
        ))

    def prepare_parser(self, parser):
        docs = [self.parse_doc(doc) for doc in (self.doc, __doc__) if doc]
        for doc in docs:
            for long_opt, help in items(doc):
                option = parser.get_option(long_opt)
                if option is not None:
                    option.help = ' '.join(help).format(default=option.default)
        return parser

    def setup_app_from_commandline(self, argv):
        preload_options = self.parse_preload_options(argv)
        quiet = preload_options.get('quiet')
        if quiet is not None:
            self.quiet = quiet
        try:
            self.no_color = preload_options['no_color']
        except KeyError:
            pass
        workdir = preload_options.get('working_directory')
        if workdir:
            os.chdir(workdir)
        app = (preload_options.get('app') or
               os.environ.get('CELERY_APP') or
               self.app)
        preload_loader = preload_options.get('loader')
        if preload_loader:
            # Default app takes loader from this env (Issue #1066).
            os.environ['CELERY_LOADER'] = preload_loader
        loader = (preload_loader,
                  os.environ.get('CELERY_LOADER') or
                  'default')
        broker = preload_options.get('broker', None)
        if broker:
            os.environ['CELERY_BROKER_URL'] = broker
        config = preload_options.get('config')
        if config:
            os.environ['CELERY_CONFIG_MODULE'] = config
        if self.respects_app_option:
            if app:
                self.app = self.find_app(app)
            elif self.app is None:
                self.app = self.get_app(loader=loader)
            if self.enable_config_from_cmdline:
                argv = self.process_cmdline_config(argv)
        else:
            self.app = Celery(fixups=[])

        user_preload = tuple(self.app.user_options['preload'] or ())
        if user_preload:
            user_options = self.preparse_options(argv, user_preload)
            for user_option in user_preload:
                user_options.setdefault(user_option.dest, user_option.default)
            signals.user_preload_options.send(
                sender=self, app=self.app, options=user_options,
            )
        return argv

    def find_app(self, app):
        from celery.app.utils import find_app
        return find_app(app, symbol_by_name=self.symbol_by_name)

    def symbol_by_name(self, name, imp=import_from_cwd):
        return symbol_by_name(name, imp=imp)
    get_cls_by_name = symbol_by_name  # XXX compat

    def process_cmdline_config(self, argv):
        try:
            cargs_start = argv.index('--')
        except ValueError:
            return argv
        argv, cargs = argv[:cargs_start], argv[cargs_start + 1:]
        self.app.config_from_cmdline(cargs, namespace=self.namespace)
        return argv

    def parse_preload_options(self, args):
        return self.preparse_options(args, self.preload_options)

    def add_append_opt(self, acc, opt, value):
        acc.setdefault(opt.dest, opt.default or [])
        acc[opt.dest].append(value)

    def preparse_options(self, args, options):
        acc = {}
        opts = {}
        for opt in options:
            for t in (opt._long_opts, opt._short_opts):
                opts.update(dict(zip(t, [opt] * len(t))))
        index = 0
        length = len(args)
        while index < length:
            arg = args[index]
            if arg.startswith('--'):
                if '=' in arg:
                    key, value = arg.split('=', 1)
                    opt = opts.get(key)
                    if opt:
                        if opt.action == 'append':
                            self.add_append_opt(acc, opt, value)
                        else:
                            acc[opt.dest] = value
                else:
                    opt = opts.get(arg)
                    if opt and opt.takes_value():
                        # optparse also supports ['--opt', 'value']
                        # (Issue #1668)
                        if opt.action == 'append':
                            self.add_append_opt(acc, opt, args[index + 1])
                        else:
                            acc[opt.dest] = args[index + 1]
                        index += 1
                    elif opt and opt.action == 'store_true':
                        acc[opt.dest] = True
            elif arg.startswith('-'):
                opt = opts.get(arg)
                if opt:
                    if opt.takes_value():
                        try:
                            acc[opt.dest] = args[index + 1]
                        except IndexError:
                            raise ValueError(
                                'Missing required argument for {0}'.format(
                                    arg))
                        index += 1
                    elif opt.action == 'store_true':
                        acc[opt.dest] = True
            index += 1
        return acc

    def parse_doc(self, doc):
        options, in_option = defaultdict(list), None
        for line in doc.splitlines():
            if line.startswith('.. cmdoption::'):
                m = find_long_opt.match(line)
                if m:
                    in_option = m.groups()[0].strip()
                assert in_option, 'missing long opt'
            elif in_option and line.startswith(' ' * 4):
                options[in_option].append(
                    find_rst_ref.sub(r'\1', line.strip()).replace('`', ''))
        return options

    def with_pool_option(self, argv):
        """Return tuple of ``(short_opts, long_opts)`` if the command
        supports a pool argument, and used to monkey patch eventlet/gevent
        environments as early as possible.

        E.g::
              has_pool_option = (['-P'], ['--pool'])
        """
        pass

    def node_format(self, s, nodename, **extra):
        return node_format(s, nodename, **extra)

    def host_format(self, s, **extra):
        return host_format(s, **extra)

    def _get_default_app(self, *args, **kwargs):
        from celery._state import get_current_app
        return get_current_app()  # omit proxy

    def pretty_list(self, n):
        c = self.colored
        if not n:
            return '- empty -'
        return '\n'.join(
            str(c.reset(c.white('*'), ' {0}'.format(item))) for item in n
        )

    def pretty_dict_ok_error(self, n):
        c = self.colored
        try:
            return (c.green('OK'),
                    text.indent(self.pretty(n['ok'])[1], 4))
        except KeyError:
            pass
        return (c.red('ERROR'),
                text.indent(self.pretty(n['error'])[1], 4))

    def say_remote_command_reply(self, replies):
        c = self.colored
        node = next(iter(replies))  # <-- take first.
        reply = replies[node]
        status, preply = self.pretty(reply)
        self.say_chat('->', c.cyan(node, ': ') + status,
                      text.indent(preply, 4) if self.show_reply else '')

    def pretty(self, n):
        OK = str(self.colored.green('OK'))
        if isinstance(n, list):
            return OK, self.pretty_list(n)
        if isinstance(n, dict):
            if 'ok' in n or 'error' in n:
                return self.pretty_dict_ok_error(n)
            else:
                return OK, json.dumps(n, sort_keys=True, indent=4)
        if isinstance(n, string_t):
            return OK, string(n)
        return OK, pformat(n)

    def say_chat(self, direction, title, body=''):
        c = self.colored
        if direction == '<-' and self.quiet:
            return
        dirstr = not self.quiet and c.bold(c.white(direction), ' ') or ''
        self.out(c.reset(dirstr, title))
        if body and self.show_body:
            self.out(body)

    @property
    def colored(self):
        if self._colored is None:
            self._colored = term.colored(enabled=not self.no_color)
        return self._colored

    @colored.setter
    def colored(self, obj):
        self._colored = obj

    @property
    def no_color(self):
        return self._no_color

    @no_color.setter
    def no_color(self, value):
        self._no_color = value
        if self._colored is not None:
            self._colored.enabled = not self._no_color


def daemon_options(default_pidfile=None, default_logfile=None):
    return (
        Option('-f', '--logfile', default=default_logfile),
        Option('--pidfile', default=default_pidfile),
        Option('--uid', default=None),
        Option('--gid', default=None),
        Option('--umask', default=None),
        Option('--executable', default=None),
    )
