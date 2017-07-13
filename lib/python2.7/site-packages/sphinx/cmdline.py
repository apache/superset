# -*- coding: utf-8 -*-
"""
    sphinx.cmdline
    ~~~~~~~~~~~~~~

    sphinx-build command-line handling.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import print_function

import sys
import optparse
import traceback
from os import path

from six import text_type, binary_type

from docutils.utils import SystemMessage

from sphinx import __display_version__
from sphinx.errors import SphinxError
from sphinx.application import Sphinx
from sphinx.util import Tee, format_exception_cut_frames, save_traceback
from sphinx.util.console import red, nocolor, color_terminal  # type: ignore
from sphinx.util.docutils import docutils_namespace, patch_docutils
from sphinx.util.osutil import abspath, fs_encoding
from sphinx.util.pycompat import terminal_safe

if False:
    # For type annotation
    from typing import Any, IO, List, Union  # NOQA


USAGE = """\
Sphinx v%s
Usage: %%prog [options] sourcedir outdir [filenames...]

Filename arguments:
  without -a and without filenames, write new and changed files.
  with -a, write all files.
  with filenames, write these.
""" % __display_version__

EPILOG = """\
For more information, visit <http://sphinx-doc.org/>.
"""


class MyFormatter(optparse.IndentedHelpFormatter):
    def format_usage(self, usage):
        # type: (Any) -> Any
        return usage

    def format_help(self, formatter):
        # type: (Any) -> unicode
        result = []  # type: List[unicode]
        if self.description:  # type: ignore
            result.append(self.format_description(formatter))
        if self.option_list:  # type: ignore
            result.append(self.format_option_help(formatter))  # type: ignore
        return "\n".join(result)


def handle_exception(app, opts, exception, stderr=sys.stderr):
    # type: (Sphinx, Any, Union[Exception, KeyboardInterrupt], IO) -> None
    if opts.pdb:
        import pdb
        print(red('Exception occurred while building, starting debugger:'),
              file=stderr)
        traceback.print_exc()
        pdb.post_mortem(sys.exc_info()[2])
    else:
        print(file=stderr)
        if opts.verbosity or opts.traceback:
            traceback.print_exc(None, stderr)
            print(file=stderr)
        if isinstance(exception, KeyboardInterrupt):
            print('interrupted!', file=stderr)
        elif isinstance(exception, SystemMessage):
            print(red('reST markup error:'), file=stderr)
            print(terminal_safe(exception.args[0]), file=stderr)
        elif isinstance(exception, SphinxError):
            print(red('%s:' % exception.category), file=stderr)
            print(terminal_safe(text_type(exception)), file=stderr)
        elif isinstance(exception, UnicodeError):
            print(red('Encoding error:'), file=stderr)
            print(terminal_safe(text_type(exception)), file=stderr)
            tbpath = save_traceback(app)
            print(red('The full traceback has been saved in %s, if you want '
                      'to report the issue to the developers.' % tbpath),
                  file=stderr)
        elif isinstance(exception, RuntimeError) and 'recursion depth' in str(exception):
            print(red('Recursion error:'), file=stderr)
            print(terminal_safe(text_type(exception)), file=stderr)
            print(file=stderr)
            print('This can happen with very large or deeply nested source '
                  'files.  You can carefully increase the default Python '
                  'recursion limit of 1000 in conf.py with e.g.:', file=stderr)
            print('    import sys; sys.setrecursionlimit(1500)', file=stderr)
        else:
            print(red('Exception occurred:'), file=stderr)
            print(format_exception_cut_frames().rstrip(), file=stderr)
            tbpath = save_traceback(app)
            print(red('The full traceback has been saved in %s, if you '
                      'want to report the issue to the developers.' % tbpath),
                  file=stderr)
            print('Please also report this if it was a user error, so '
                  'that a better error message can be provided next time.',
                  file=stderr)
            print('A bug report can be filed in the tracker at '
                  '<https://github.com/sphinx-doc/sphinx/issues>. Thanks!',
                  file=stderr)


def main(argv):
    # type: (List[unicode]) -> int
    parser = optparse.OptionParser(USAGE, epilog=EPILOG, formatter=MyFormatter())
    parser.add_option('--version', action='store_true', dest='version',
                      help='show version information and exit')

    group = parser.add_option_group('General options')
    group.add_option('-b', metavar='BUILDER', dest='builder', default='html',
                     help='builder to use; default is html')
    group.add_option('-a', action='store_true', dest='force_all',
                     help='write all files; default is to only write new and '
                     'changed files')
    group.add_option('-E', action='store_true', dest='freshenv',
                     help='don\'t use a saved environment, always read '
                     'all files')
    group.add_option('-d', metavar='PATH', default=None, dest='doctreedir',
                     help='path for the cached environment and doctree files '
                     '(default: outdir/.doctrees)')
    group.add_option('-j', metavar='N', default=1, type='int', dest='jobs',
                     help='build in parallel with N processes where possible')
    # this option never gets through to this point (it is intercepted earlier)
    # group.add_option('-M', metavar='BUILDER', dest='make_mode',
    #                 help='"make" mode -- as used by Makefile, like '
    #                 '"sphinx-build -M html"')

    group = parser.add_option_group('Build configuration options')
    group.add_option('-c', metavar='PATH', dest='confdir',
                     help='path where configuration file (conf.py) is located '
                     '(default: same as sourcedir)')
    group.add_option('-C', action='store_true', dest='noconfig',
                     help='use no config file at all, only -D options')
    group.add_option('-D', metavar='setting=value', action='append',
                     dest='define', default=[],
                     help='override a setting in configuration file')
    group.add_option('-A', metavar='name=value', action='append',
                     dest='htmldefine', default=[],
                     help='pass a value into HTML templates')
    group.add_option('-t', metavar='TAG', action='append',
                     dest='tags', default=[],
                     help='define tag: include "only" blocks with TAG')
    group.add_option('-n', action='store_true', dest='nitpicky',
                     help='nit-picky mode, warn about all missing references')

    group = parser.add_option_group('Console output options')
    group.add_option('-v', action='count', dest='verbosity', default=0,
                     help='increase verbosity (can be repeated)')
    group.add_option('-q', action='store_true', dest='quiet',
                     help='no output on stdout, just warnings on stderr')
    group.add_option('-Q', action='store_true', dest='really_quiet',
                     help='no output at all, not even warnings')
    group.add_option('--color', dest='color',
                     action='store_const', const='yes', default='auto',
                     help='Do emit colored output (default: auto-detect)')
    group.add_option('-N', '--no-color', dest='color',
                     action='store_const', const='no',
                     help='Do not emit colored output (default: auot-detect)')
    group.add_option('-w', metavar='FILE', dest='warnfile',
                     help='write warnings (and errors) to given file')
    group.add_option('-W', action='store_true', dest='warningiserror',
                     help='turn warnings into errors')
    group.add_option('-T', action='store_true', dest='traceback',
                     help='show full traceback on exception')
    group.add_option('-P', action='store_true', dest='pdb',
                     help='run Pdb on exception')

    # parse options
    try:
        opts, args = parser.parse_args(list(argv[1:]))
    except SystemExit as err:
        return err.code

    # handle basic options
    if opts.version:
        print('Sphinx (sphinx-build) %s' % __display_version__)
        return 0

    # get paths (first and second positional argument)
    try:
        srcdir = abspath(args[0])
        confdir = abspath(opts.confdir or srcdir)
        if opts.noconfig:
            confdir = None
        if not path.isdir(srcdir):
            print('Error: Cannot find source directory `%s\'.' % srcdir,
                  file=sys.stderr)
            return 1
        if not opts.noconfig and not path.isfile(path.join(confdir, 'conf.py')):
            print('Error: Config directory doesn\'t contain a conf.py file.',
                  file=sys.stderr)
            return 1
        outdir = abspath(args[1])
        if srcdir == outdir:
            print('Error: source directory and destination directory are same.',
                  file=sys.stderr)
            return 1
    except IndexError:
        parser.print_help()
        return 1
    except UnicodeError:
        print(
            'Error: Multibyte filename not supported on this filesystem '
            'encoding (%r).' % fs_encoding, file=sys.stderr)
        return 1

    # handle remaining filename arguments
    filenames = args[2:]
    errored = False
    for filename in filenames:
        if not path.isfile(filename):
            print('Error: Cannot find file %r.' % filename, file=sys.stderr)
            errored = True
    if errored:
        return 1

    # likely encoding used for command-line arguments
    try:
        locale = __import__('locale')  # due to submodule of the same name
        likely_encoding = locale.getpreferredencoding()
    except Exception:
        likely_encoding = None

    if opts.force_all and filenames:
        print('Error: Cannot combine -a option and filenames.', file=sys.stderr)
        return 1

    if opts.color == 'no' or (opts.color == 'auto' and not color_terminal()):
        nocolor()

    doctreedir = abspath(opts.doctreedir or path.join(outdir, '.doctrees'))

    status = sys.stdout
    warning = sys.stderr
    error = sys.stderr

    if opts.quiet:
        status = None
    if opts.really_quiet:
        status = warning = None
    if warning and opts.warnfile:
        try:
            warnfp = open(opts.warnfile, 'w')
        except Exception as exc:
            print('Error: Cannot open warning file %r: %s' %
                  (opts.warnfile, exc), file=sys.stderr)
            sys.exit(1)
        warning = Tee(warning, warnfp)  # type: ignore
        error = warning

    confoverrides = {}
    for val in opts.define:
        try:
            key, val = val.split('=', 1)
        except ValueError:
            print('Error: -D option argument must be in the form name=value.',
                  file=sys.stderr)
            return 1
        if likely_encoding and isinstance(val, binary_type):
            try:
                val = val.decode(likely_encoding)
            except UnicodeError:
                pass
        confoverrides[key] = val

    for val in opts.htmldefine:
        try:
            key, val = val.split('=')
        except ValueError:
            print('Error: -A option argument must be in the form name=value.',
                  file=sys.stderr)
            return 1
        try:
            val = int(val)
        except ValueError:
            if likely_encoding and isinstance(val, binary_type):
                try:
                    val = val.decode(likely_encoding)
                except UnicodeError:
                    pass
        confoverrides['html_context.%s' % key] = val

    if opts.nitpicky:
        confoverrides['nitpicky'] = True

    app = None
    try:
        with patch_docutils(), docutils_namespace():
            app = Sphinx(srcdir, confdir, outdir, doctreedir, opts.builder,
                         confoverrides, status, warning, opts.freshenv,
                         opts.warningiserror, opts.tags, opts.verbosity, opts.jobs)
            app.build(opts.force_all, filenames)
            return app.statuscode
    except (Exception, KeyboardInterrupt) as exc:
        handle_exception(app, opts, exc, error)
        return 1
