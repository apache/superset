# -*- coding: utf-8 -*-
"""

.. program:: celery multi

Examples
========

.. code-block:: bash

    # Single worker with explicit name and events enabled.
    $ celery multi start Leslie -E

    # Pidfiles and logfiles are stored in the current directory
    # by default.  Use --pidfile and --logfile argument to change
    # this.  The abbreviation %N will be expanded to the current
    # node name.
    $ celery multi start Leslie -E --pidfile=/var/run/celery/%N.pid
                                    --logfile=/var/log/celery/%N.log


    # You need to add the same arguments when you restart,
    # as these are not persisted anywhere.
    $ celery multi restart Leslie -E --pidfile=/var/run/celery/%N.pid
                                     --logfile=/var/run/celery/%N.log

    # To stop the node, you need to specify the same pidfile.
    $ celery multi stop Leslie --pidfile=/var/run/celery/%N.pid

    # 3 workers, with 3 processes each
    $ celery multi start 3 -c 3
    celery worker -n celery1@myhost -c 3
    celery worker -n celery2@myhost -c 3
    celery worker -n celery3@myhost -c 3

    # start 3 named workers
    $ celery multi start image video data -c 3
    celery worker -n image@myhost -c 3
    celery worker -n video@myhost -c 3
    celery worker -n data@myhost -c 3

    # specify custom hostname
    $ celery multi start 2 --hostname=worker.example.com -c 3
    celery worker -n celery1@worker.example.com -c 3
    celery worker -n celery2@worker.example.com -c 3

    # specify fully qualified nodenames
    $ celery multi start foo@worker.example.com bar@worker.example.com -c 3

    # Advanced example starting 10 workers in the background:
    #   * Three of the workers processes the images and video queue
    #   * Two of the workers processes the data queue with loglevel DEBUG
    #   * the rest processes the default' queue.
    $ celery multi start 10 -l INFO -Q:1-3 images,video -Q:4,5 data
        -Q default -L:4,5 DEBUG

    # You can show the commands necessary to start the workers with
    # the 'show' command:
    $ celery multi show 10 -l INFO -Q:1-3 images,video -Q:4,5 data
        -Q default -L:4,5 DEBUG

    # Additional options are added to each celery worker' comamnd,
    # but you can also modify the options for ranges of, or specific workers

    # 3 workers: Two with 3 processes, and one with 10 processes.
    $ celery multi start 3 -c 3 -c:1 10
    celery worker -n celery1@myhost -c 10
    celery worker -n celery2@myhost -c 3
    celery worker -n celery3@myhost -c 3

    # can also specify options for named workers
    $ celery multi start image video data -c 3 -c:image 10
    celery worker -n image@myhost -c 10
    celery worker -n video@myhost -c 3
    celery worker -n data@myhost -c 3

    # ranges and lists of workers in options is also allowed:
    # (-c:1-3 can also be written as -c:1,2,3)
    $ celery multi start 5 -c 3  -c:1-3 10
    celery worker -n celery1@myhost -c 10
    celery worker -n celery2@myhost -c 10
    celery worker -n celery3@myhost -c 10
    celery worker -n celery4@myhost -c 3
    celery worker -n celery5@myhost -c 3

    # lists also works with named workers
    $ celery multi start foo bar baz xuzzy -c 3 -c:foo,bar,baz 10
    celery worker -n foo@myhost -c 10
    celery worker -n bar@myhost -c 10
    celery worker -n baz@myhost -c 10
    celery worker -n xuzzy@myhost -c 3

"""
from __future__ import absolute_import, print_function, unicode_literals

import errno
import os
import shlex
import signal
import socket
import sys

from collections import defaultdict, namedtuple
from subprocess import Popen
from time import sleep

from kombu.utils import cached_property
from kombu.utils.compat import OrderedDict
from kombu.utils.encoding import from_utf8

from celery import VERSION_BANNER
from celery.five import items
from celery.platforms import Pidfile, IS_WINDOWS
from celery.utils import term, nodesplit
from celery.utils.text import pluralize

__all__ = ['MultiTool']

SIGNAMES = set(sig for sig in dir(signal)
               if sig.startswith('SIG') and '_' not in sig)
SIGMAP = dict((getattr(signal, name), name) for name in SIGNAMES)

USAGE = """\
usage: {prog_name} start <node1 node2 nodeN|range> [worker options]
       {prog_name} stop <n1 n2 nN|range> [-SIG (default: -TERM)]
       {prog_name} stopwait <n1 n2 nN|range> [-SIG (default: -TERM)]
       {prog_name} restart <n1 n2 nN|range> [-SIG] [worker options]
       {prog_name} kill <n1 n2 nN|range>

       {prog_name} show <n1 n2 nN|range> [worker options]
       {prog_name} get hostname <n1 n2 nN|range> [-qv] [worker options]
       {prog_name} names <n1 n2 nN|range>
       {prog_name} expand template <n1 n2 nN|range>
       {prog_name} help

additional options (must appear after command name):

    * --nosplash:   Don't display program info.
    * --quiet:      Don't show as much output.
    * --verbose:    Show more output.
    * --no-color:   Don't display colors.
"""

multi_args_t = namedtuple(
    'multi_args_t', ('name', 'argv', 'expander', 'namespace'),
)


def main():
    sys.exit(MultiTool().execute_from_commandline(sys.argv))


CELERY_EXE = 'celery'
if sys.version_info < (2, 7):
    # pkg.__main__ first supported in Py2.7
    CELERY_EXE = 'celery.__main__'


def celery_exe(*args):
    return ' '.join((CELERY_EXE, ) + args)


class MultiTool(object):
    retcode = 0  # Final exit code.

    def __init__(self, env=None, fh=None, quiet=False, verbose=False,
                 no_color=False, nosplash=False, stdout=None, stderr=None):
        """fh is an old alias to stdout."""
        self.stdout = self.fh = stdout or fh or sys.stdout
        self.stderr = stderr or sys.stderr
        self.env = env
        self.nosplash = nosplash
        self.quiet = quiet
        self.verbose = verbose
        self.no_color = no_color
        self.prog_name = 'celery multi'
        self.commands = {'start': self.start,
                         'show': self.show,
                         'stop': self.stop,
                         'stopwait': self.stopwait,
                         'stop_verify': self.stopwait,  # compat alias
                         'restart': self.restart,
                         'kill': self.kill,
                         'names': self.names,
                         'expand': self.expand,
                         'get': self.get,
                         'help': self.help}

    def execute_from_commandline(self, argv, cmd='celery worker'):
        argv = list(argv)   # don't modify callers argv.

        # Reserve the --nosplash|--quiet|-q/--verbose options.
        if '--nosplash' in argv:
            self.nosplash = argv.pop(argv.index('--nosplash'))
        if '--quiet' in argv:
            self.quiet = argv.pop(argv.index('--quiet'))
        if '-q' in argv:
            self.quiet = argv.pop(argv.index('-q'))
        if '--verbose' in argv:
            self.verbose = argv.pop(argv.index('--verbose'))
        if '--no-color' in argv:
            self.no_color = argv.pop(argv.index('--no-color'))

        self.prog_name = os.path.basename(argv.pop(0))
        if not argv or argv[0][0] == '-':
            return self.error()

        try:
            self.commands[argv[0]](argv[1:], cmd)
        except KeyError:
            self.error('Invalid command: {0}'.format(argv[0]))

        return self.retcode

    def say(self, m, newline=True, file=None):
        print(m, file=file or self.stdout, end='\n' if newline else '')

    def carp(self, m, newline=True, file=None):
        return self.say(m, newline, file or self.stderr)

    def names(self, argv, cmd):
        p = NamespacedOptionParser(argv)
        self.say('\n'.join(
            n.name for n in multi_args(p, cmd)),
        )

    def get(self, argv, cmd):
        wanted = argv[0]
        p = NamespacedOptionParser(argv[1:])
        for node in multi_args(p, cmd):
            if node.name == wanted:
                self.say(' '.join(node.argv))
                return

    def show(self, argv, cmd):
        p = NamespacedOptionParser(argv)
        self.with_detacher_default_options(p)
        self.say('\n'.join(
            ' '.join([sys.executable] + n.argv) for n in multi_args(p, cmd)),
        )

    def start(self, argv, cmd):
        self.splash()
        p = NamespacedOptionParser(argv)
        self.with_detacher_default_options(p)
        retcodes = []
        self.note('> Starting nodes...')
        for node in multi_args(p, cmd):
            self.note('\t> {0}: '.format(node.name), newline=False)
            retcode = self.waitexec(node.argv, path=p.options['--executable'])
            self.note(retcode and self.FAILED or self.OK)
            retcodes.append(retcode)
        self.retcode = int(any(retcodes))

    def with_detacher_default_options(self, p):
        _setdefaultopt(p.options, ['--pidfile', '-p'], '%N.pid')
        _setdefaultopt(p.options, ['--logfile', '-f'], '%N.log')
        p.options.setdefault(
            '--cmd',
            '-m {0}'.format(celery_exe('worker', '--detach')),
        )
        _setdefaultopt(p.options, ['--executable'], sys.executable)

    def signal_node(self, nodename, pid, sig):
        try:
            os.kill(pid, sig)
        except OSError as exc:
            if exc.errno != errno.ESRCH:
                raise
            self.note('Could not signal {0} ({1}): No such process'.format(
                nodename, pid))
            return False
        return True

    def node_alive(self, pid):
        try:
            os.kill(pid, 0)
        except OSError as exc:
            if exc.errno == errno.ESRCH:
                return False
            raise
        return True

    def shutdown_nodes(self, nodes, sig=signal.SIGTERM, retry=None,
                       callback=None):
        if not nodes:
            return
        P = set(nodes)

        def on_down(node):
            P.discard(node)
            if callback:
                callback(*node)

        self.note(self.colored.blue('> Stopping nodes...'))
        for node in list(P):
            if node in P:
                nodename, _, pid = node
                self.note('\t> {0}: {1} -> {2}'.format(
                    nodename, SIGMAP[sig][3:], pid))
                if not self.signal_node(nodename, pid, sig):
                    on_down(node)

        def note_waiting():
            left = len(P)
            if left:
                pids = ', '.join(str(pid) for _, _, pid in P)
                self.note(self.colored.blue(
                    '> Waiting for {0} {1} -> {2}...'.format(
                        left, pluralize(left, 'node'), pids)), newline=False)

        if retry:
            note_waiting()
            its = 0
            while P:
                for node in P:
                    its += 1
                    self.note('.', newline=False)
                    nodename, _, pid = node
                    if not self.node_alive(pid):
                        self.note('\n\t> {0}: {1}'.format(nodename, self.OK))
                        on_down(node)
                        note_waiting()
                        break
                if P and not its % len(P):
                    sleep(float(retry))
            self.note('')

    def getpids(self, p, cmd, callback=None):
        _setdefaultopt(p.options, ['--pidfile', '-p'], '%N.pid')

        nodes = []
        for node in multi_args(p, cmd):
            try:
                pidfile_template = _getopt(
                    p.namespaces[node.namespace], ['--pidfile', '-p'],
                )
            except KeyError:
                pidfile_template = _getopt(p.options, ['--pidfile', '-p'])
            pid = None
            pidfile = node.expander(pidfile_template)
            try:
                pid = Pidfile(pidfile).read_pid()
            except ValueError:
                pass
            if pid:
                nodes.append((node.name, tuple(node.argv), pid))
            else:
                self.note('> {0.name}: {1}'.format(node, self.DOWN))
                if callback:
                    callback(node.name, node.argv, pid)

        return nodes

    def kill(self, argv, cmd):
        self.splash()
        p = NamespacedOptionParser(argv)
        for nodename, _, pid in self.getpids(p, cmd):
            self.note('Killing node {0} ({1})'.format(nodename, pid))
            self.signal_node(nodename, pid, signal.SIGKILL)

    def stop(self, argv, cmd, retry=None, callback=None):
        self.splash()
        p = NamespacedOptionParser(argv)
        return self._stop_nodes(p, cmd, retry=retry, callback=callback)

    def _stop_nodes(self, p, cmd, retry=None, callback=None):
        restargs = p.args[len(p.values):]
        self.shutdown_nodes(self.getpids(p, cmd, callback=callback),
                            sig=findsig(restargs),
                            retry=retry,
                            callback=callback)

    def restart(self, argv, cmd):
        self.splash()
        p = NamespacedOptionParser(argv)
        self.with_detacher_default_options(p)
        retvals = []

        def on_node_shutdown(nodename, argv, pid):
            self.note(self.colored.blue(
                '> Restarting node {0}: '.format(nodename)), newline=False)
            retval = self.waitexec(argv, path=p.options['--executable'])
            self.note(retval and self.FAILED or self.OK)
            retvals.append(retval)

        self._stop_nodes(p, cmd, retry=2, callback=on_node_shutdown)
        self.retval = int(any(retvals))

    def stopwait(self, argv, cmd):
        self.splash()
        p = NamespacedOptionParser(argv)
        self.with_detacher_default_options(p)
        return self._stop_nodes(p, cmd, retry=2)
    stop_verify = stopwait  # compat

    def expand(self, argv, cmd=None):
        template = argv[0]
        p = NamespacedOptionParser(argv[1:])
        for node in multi_args(p, cmd):
            self.say(node.expander(template))

    def help(self, argv, cmd=None):
        self.say(__doc__)

    def usage(self):
        self.splash()
        self.say(USAGE.format(prog_name=self.prog_name))

    def splash(self):
        if not self.nosplash:
            c = self.colored
            self.note(c.cyan('celery multi v{0}'.format(VERSION_BANNER)))

    def waitexec(self, argv, path=sys.executable):
        args = ' '.join([path] + list(argv))
        argstr = shlex.split(from_utf8(args), posix=not IS_WINDOWS)
        pipe = Popen(argstr, env=self.env)
        self.info('  {0}'.format(' '.join(argstr)))
        retcode = pipe.wait()
        if retcode < 0:
            self.note('* Child was terminated by signal {0}'.format(-retcode))
            return -retcode
        elif retcode > 0:
            self.note('* Child terminated with errorcode {0}'.format(retcode))
        return retcode

    def error(self, msg=None):
        if msg:
            self.carp(msg)
        self.usage()
        self.retcode = 1
        return 1

    def info(self, msg, newline=True):
        if self.verbose:
            self.note(msg, newline=newline)

    def note(self, msg, newline=True):
        if not self.quiet:
            self.say(str(msg), newline=newline)

    @cached_property
    def colored(self):
        return term.colored(enabled=not self.no_color)

    @cached_property
    def OK(self):
        return str(self.colored.green('OK'))

    @cached_property
    def FAILED(self):
        return str(self.colored.red('FAILED'))

    @cached_property
    def DOWN(self):
        return str(self.colored.magenta('DOWN'))


def multi_args(p, cmd='celery worker', append='', prefix='', suffix=''):
    names = p.values
    options = dict(p.options)
    passthrough = p.passthrough
    ranges = len(names) == 1
    if ranges:
        try:
            noderange = int(names[0])
        except ValueError:
            pass
        else:
            names = [str(n) for n in range(1, noderange + 1)]
            prefix = 'celery'
    cmd = options.pop('--cmd', cmd)
    append = options.pop('--append', append)
    hostname = options.pop('--hostname',
                           options.pop('-n', socket.gethostname()))
    prefix = options.pop('--prefix', prefix) or ''
    suffix = options.pop('--suffix', suffix) or hostname
    if suffix in ('""', "''"):
        suffix = ''

    for ns_name, ns_opts in list(items(p.namespaces)):
        if ',' in ns_name or (ranges and '-' in ns_name):
            for subns in parse_ns_range(ns_name, ranges):
                p.namespaces[subns].update(ns_opts)
            p.namespaces.pop(ns_name)

    # Numbers in args always refers to the index in the list of names.
    # (e.g. `start foo bar baz -c:1` where 1 is foo, 2 is bar, and so on).
    for ns_name, ns_opts in list(items(p.namespaces)):
        if ns_name.isdigit():
            ns_index = int(ns_name) - 1
            if ns_index < 0:
                raise KeyError('Indexes start at 1 got: %r' % (ns_name, ))
            try:
                p.namespaces[names[ns_index]].update(ns_opts)
            except IndexError:
                raise KeyError('No node at index %r' % (ns_name, ))

    for name in names:
        this_suffix = suffix
        if '@' in name:
            this_name = options['-n'] = name
            nodename, this_suffix = nodesplit(name)
            name = nodename
        else:
            nodename = '%s%s' % (prefix, name)
            this_name = options['-n'] = '%s@%s' % (nodename, this_suffix)
        expand = abbreviations({'%h': this_name,
                                '%n': name,
                                '%N': nodename,
                                '%d': this_suffix})
        argv = ([expand(cmd)] +
                [format_opt(opt, expand(value))
                 for opt, value in items(p.optmerge(name, options))] +
                [passthrough])
        if append:
            argv.append(expand(append))
        yield multi_args_t(this_name, argv, expand, name)


class NamespacedOptionParser(object):

    def __init__(self, args):
        self.args = args
        self.options = OrderedDict()
        self.values = []
        self.passthrough = ''
        self.namespaces = defaultdict(lambda: OrderedDict())

        self.parse()

    def parse(self):
        rargs = list(self.args)
        pos = 0
        while pos < len(rargs):
            arg = rargs[pos]
            if arg == '--':
                self.passthrough = ' '.join(rargs[pos:])
                break
            elif arg[0] == '-':
                if arg[1] == '-':
                    self.process_long_opt(arg[2:])
                else:
                    value = None
                    if len(rargs) > pos + 1 and rargs[pos + 1][0] != '-':
                        value = rargs[pos + 1]
                        pos += 1
                    self.process_short_opt(arg[1:], value)
            else:
                self.values.append(arg)
            pos += 1

    def process_long_opt(self, arg, value=None):
        if '=' in arg:
            arg, value = arg.split('=', 1)
        self.add_option(arg, value, short=False)

    def process_short_opt(self, arg, value=None):
        self.add_option(arg, value, short=True)

    def optmerge(self, ns, defaults=None):
        if defaults is None:
            defaults = self.options
        return OrderedDict(defaults, **self.namespaces[ns])

    def add_option(self, name, value, short=False, ns=None):
        prefix = short and '-' or '--'
        dest = self.options
        if ':' in name:
            name, ns = name.split(':')
            dest = self.namespaces[ns]
        dest[prefix + name] = value


def quote(v):
    return "\\'".join("'" + p + "'" for p in v.split("'"))


def format_opt(opt, value):
    if not value:
        return opt
    if opt.startswith('--'):
        return '{0}={1}'.format(opt, value)
    return '{0} {1}'.format(opt, value)


def parse_ns_range(ns, ranges=False):
    ret = []
    for space in ',' in ns and ns.split(',') or [ns]:
        if ranges and '-' in space:
            start, stop = space.split('-')
            ret.extend(
                str(n) for n in range(int(start), int(stop) + 1)
            )
        else:
            ret.append(space)
    return ret


def abbreviations(mapping):

    def expand(S):
        ret = S
        if S is not None:
            for short_opt, long_opt in items(mapping):
                ret = ret.replace(short_opt, long_opt)
        return ret

    return expand


def findsig(args, default=signal.SIGTERM):
    for arg in reversed(args):
        if len(arg) == 2 and arg[0] == '-':
            try:
                return int(arg[1])
            except ValueError:
                pass
        if arg[0] == '-':
            maybe_sig = 'SIG' + arg[1:]
            if maybe_sig in SIGNAMES:
                return getattr(signal, maybe_sig)
    return default


def _getopt(d, alt):
    for opt in alt:
        try:
            return d[opt]
        except KeyError:
            pass
    raise KeyError(alt[0])


def _setdefaultopt(d, alt, value):
    for opt in alt[1:]:
        try:
            return d[opt]
        except KeyError:
            pass
    return d.setdefault(alt[0], value)


if __name__ == '__main__':              # pragma: no cover
    main()
