# -*- coding: utf-8 -*-
"""
    sphinx.quickstart
    ~~~~~~~~~~~~~~~~~

    Quickly setup documentation source to work with Sphinx.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import print_function
from __future__ import absolute_import

import re
import os
import sys
import optparse
import time
from os import path
from io import open

# try to import readline, unix specific enhancement
try:
    import readline
    if readline.__doc__ and 'libedit' in readline.__doc__:
        readline.parse_and_bind("bind ^I rl_complete")
    else:
        readline.parse_and_bind("tab: complete")
except ImportError:
    pass

from six import PY2, PY3, text_type, binary_type
from six.moves import input
from six.moves.urllib.parse import quote as urlquote
from docutils.utils import column_width

from sphinx import __display_version__, package_dir
from sphinx.util.osutil import make_filename
from sphinx.util.console import (  # type: ignore
    purple, bold, red, turquoise, nocolor, color_terminal
)
from sphinx.util.template import SphinxRenderer
from sphinx.util import texescape

if False:
    # For type annotation
    from typing import Any, Callable, Dict, List, Pattern  # NOQA

TERM_ENCODING = getattr(sys.stdin, 'encoding', None)

DEFAULT_VALUE = {
    'path': '.',
    'sep': False,
    'dot': '_',
    'language': None,
    'suffix': '.rst',
    'master': 'index',
    'epub': False,
    'ext_autodoc': False,
    'ext_doctest': False,
    'ext_todo': False,
    'makefile': True,
    'batchfile': True,
}

EXTENSIONS = ('autodoc', 'doctest', 'intersphinx', 'todo', 'coverage',
              'imgmath', 'mathjax', 'ifconfig', 'viewcode', 'githubpages')

PROMPT_PREFIX = '> '


def mkdir_p(dir):
    # type: (unicode) -> None
    if path.isdir(dir):
        return
    os.makedirs(dir)


# function to get input from terminal -- overridden by the test suite
def term_input(prompt):
    # type: (unicode) -> unicode
    print(prompt, end='')
    return input('')


class ValidationError(Exception):
    """Raised for validation errors."""


def is_path(x):
    # type: (unicode) -> unicode
    x = path.expanduser(x)
    if path.exists(x) and not path.isdir(x):
        raise ValidationError("Please enter a valid path name.")
    return x


def allow_empty(x):
    # type: (unicode) -> unicode
    return x


def nonempty(x):
    # type: (unicode) -> unicode
    if not x:
        raise ValidationError("Please enter some text.")
    return x


def choice(*l):
    # type: (unicode) -> Callable[[unicode], unicode]
    def val(x):
        # type: (unicode) -> unicode
        if x not in l:
            raise ValidationError('Please enter one of %s.' % ', '.join(l))
        return x
    return val


def boolean(x):
    # type: (unicode) -> bool
    if x.upper() not in ('Y', 'YES', 'N', 'NO'):
        raise ValidationError("Please enter either 'y' or 'n'.")
    return x.upper() in ('Y', 'YES')


def suffix(x):
    # type: (unicode) -> unicode
    if not (x[0:1] == '.' and len(x) > 1):
        raise ValidationError("Please enter a file suffix, "
                              "e.g. '.rst' or '.txt'.")
    return x


def ok(x):
    # type: (unicode) -> unicode
    return x


def term_decode(text):
    # type: (unicode) -> unicode
    if isinstance(text, text_type):
        return text

    # for Python 2.x, try to get a Unicode string out of it
    if text.decode('ascii', 'replace').encode('ascii', 'replace') == text:
        return text

    if TERM_ENCODING:
        text = text.decode(TERM_ENCODING)
    else:
        print(turquoise('* Note: non-ASCII characters entered '
                        'and terminal encoding unknown -- assuming '
                        'UTF-8 or Latin-1.'))
        try:
            text = text.decode('utf-8')
        except UnicodeDecodeError:
            text = text.decode('latin1')
    return text


def do_prompt(d, key, text, default=None, validator=nonempty):
    # type: (Dict, unicode, unicode, unicode, Callable[[unicode], Any]) -> None
    while True:
        if default is not None:
            prompt = PROMPT_PREFIX + '%s [%s]: ' % (text, default)  # type: unicode
        else:
            prompt = PROMPT_PREFIX + text + ': '
        if PY2:
            # for Python 2.x, try to get a Unicode string out of it
            if prompt.encode('ascii', 'replace').decode('ascii', 'replace') \
                    != prompt:
                if TERM_ENCODING:
                    prompt = prompt.encode(TERM_ENCODING)
                else:
                    print(turquoise('* Note: non-ASCII default value provided '
                                    'and terminal encoding unknown -- assuming '
                                    'UTF-8 or Latin-1.'))
                    try:
                        prompt = prompt.encode('utf-8')
                    except UnicodeEncodeError:
                        prompt = prompt.encode('latin1')
        prompt = purple(prompt)
        x = term_input(prompt).strip()
        if default and not x:
            x = default
        x = term_decode(x)
        try:
            x = validator(x)
        except ValidationError as err:
            print(red('* ' + str(err)))
            continue
        break
    d[key] = x


def convert_python_source(source, rex=re.compile(r"[uU]('.*?')")):
    # type: (unicode, Pattern) -> unicode
    # remove Unicode literal prefixes
    if PY3:
        return rex.sub('\\1', source)
    else:
        return source


class QuickstartRenderer(SphinxRenderer):
    def __init__(self, templatedir):
        # type: (unicode) -> None
        self.templatedir = templatedir or ''
        super(QuickstartRenderer, self).__init__()

    def render(self, template_name, context):
        # type: (unicode, Dict) -> unicode
        user_template = path.join(self.templatedir, path.basename(template_name))
        if self.templatedir and path.exists(user_template):
            return self.render_from_file(user_template, context)
        else:
            return super(QuickstartRenderer, self).render(template_name, context)


def ask_user(d):
    # type: (Dict) -> None
    """Ask the user for quickstart values missing from *d*.

    Values are:

    * path:      root path
    * sep:       separate source and build dirs (bool)
    * dot:       replacement for dot in _templates etc.
    * project:   project name
    * author:    author names
    * version:   version of project
    * release:   release of project
    * language:  document language
    * suffix:    source file suffix
    * master:    master document name
    * epub:      use epub (bool)
    * ext_*:     extensions to use (bools)
    * makefile:  make Makefile
    * batchfile: make command file
    """

    print(bold('Welcome to the Sphinx %s quickstart utility.') % __display_version__)
    print('''
Please enter values for the following settings (just press Enter to
accept a default value, if one is given in brackets).''')

    if 'path' in d:
        print(bold('''
Selected root path: %s''' % d['path']))
    else:
        print('''
Enter the root path for documentation.''')
        do_prompt(d, 'path', 'Root path for the documentation', '.', is_path)

    while path.isfile(path.join(d['path'], 'conf.py')) or \
            path.isfile(path.join(d['path'], 'source', 'conf.py')):
        print()
        print(bold('Error: an existing conf.py has been found in the '
                   'selected root path.'))
        print('sphinx-quickstart will not overwrite existing Sphinx projects.')
        print()
        do_prompt(d, 'path', 'Please enter a new root path (or just Enter '
                  'to exit)', '', is_path)
        if not d['path']:
            sys.exit(1)

    if 'sep' not in d:
        print('''
You have two options for placing the build directory for Sphinx output.
Either, you use a directory "_build" within the root path, or you separate
"source" and "build" directories within the root path.''')
        do_prompt(d, 'sep', 'Separate source and build directories (y/n)', 'n',
                  boolean)

    if 'dot' not in d:
        print('''
Inside the root directory, two more directories will be created; "_templates"
for custom HTML templates and "_static" for custom stylesheets and other static
files. You can enter another prefix (such as ".") to replace the underscore.''')
        do_prompt(d, 'dot', 'Name prefix for templates and static dir', '_', ok)

    if 'project' not in d:
        print('''
The project name will occur in several places in the built documentation.''')
        do_prompt(d, 'project', 'Project name')
    if 'author' not in d:
        do_prompt(d, 'author', 'Author name(s)')

    if 'version' not in d:
        print('''
Sphinx has the notion of a "version" and a "release" for the
software. Each version can have multiple releases. For example, for
Python the version is something like 2.5 or 3.0, while the release is
something like 2.5.1 or 3.0a1.  If you don't need this dual structure,
just set both to the same value.''')
        do_prompt(d, 'version', 'Project version', '', allow_empty)
    if 'release' not in d:
        do_prompt(d, 'release', 'Project release', d['version'], allow_empty)

    if 'language' not in d:
        print('''
If the documents are to be written in a language other than English,
you can select a language here by its language code. Sphinx will then
translate text that it generates into that language.

For a list of supported codes, see
http://sphinx-doc.org/config.html#confval-language.''')
        do_prompt(d, 'language', 'Project language', 'en')
        if d['language'] == 'en':
            d['language'] = None

    if 'suffix' not in d:
        print('''
The file name suffix for source files. Commonly, this is either ".txt"
or ".rst".  Only files with this suffix are considered documents.''')
        do_prompt(d, 'suffix', 'Source file suffix', '.rst', suffix)

    if 'master' not in d:
        print('''
One document is special in that it is considered the top node of the
"contents tree", that is, it is the root of the hierarchical structure
of the documents. Normally, this is "index", but if your "index"
document is a custom template, you can also set this to another filename.''')
        do_prompt(d, 'master', 'Name of your master document (without suffix)',
                  'index')

    while path.isfile(path.join(d['path'], d['master'] + d['suffix'])) or \
            path.isfile(path.join(d['path'], 'source', d['master'] + d['suffix'])):
        print()
        print(bold('Error: the master file %s has already been found in the '
                   'selected root path.' % (d['master'] + d['suffix'])))
        print('sphinx-quickstart will not overwrite the existing file.')
        print()
        do_prompt(d, 'master', 'Please enter a new file name, or rename the '
                  'existing file and press Enter', d['master'])

    if 'epub' not in d:
        print('''
Sphinx can also add configuration for epub output:''')
        do_prompt(d, 'epub', 'Do you want to use the epub builder (y/n)',
                  'n', boolean)

    if 'ext_autodoc' not in d:
        print('''
Please indicate if you want to use one of the following Sphinx extensions:''')
        do_prompt(d, 'ext_autodoc', 'autodoc: automatically insert docstrings '
                  'from modules (y/n)', 'n', boolean)
    if 'ext_doctest' not in d:
        do_prompt(d, 'ext_doctest', 'doctest: automatically test code snippets '
                  'in doctest blocks (y/n)', 'n', boolean)
    if 'ext_intersphinx' not in d:
        do_prompt(d, 'ext_intersphinx', 'intersphinx: link between Sphinx '
                  'documentation of different projects (y/n)', 'n', boolean)
    if 'ext_todo' not in d:
        do_prompt(d, 'ext_todo', 'todo: write "todo" entries '
                  'that can be shown or hidden on build (y/n)', 'n', boolean)
    if 'ext_coverage' not in d:
        do_prompt(d, 'ext_coverage', 'coverage: checks for documentation '
                  'coverage (y/n)', 'n', boolean)
    if 'ext_imgmath' not in d:
        do_prompt(d, 'ext_imgmath', 'imgmath: include math, rendered '
                  'as PNG or SVG images (y/n)', 'n', boolean)
    if 'ext_mathjax' not in d:
        do_prompt(d, 'ext_mathjax', 'mathjax: include math, rendered in the '
                  'browser by MathJax (y/n)', 'n', boolean)
    if d['ext_imgmath'] and d['ext_mathjax']:
        print('''Note: imgmath and mathjax cannot be enabled at the same time.
imgmath has been deselected.''')
        d['ext_imgmath'] = False
    if 'ext_ifconfig' not in d:
        do_prompt(d, 'ext_ifconfig', 'ifconfig: conditional inclusion of '
                  'content based on config values (y/n)', 'n', boolean)
    if 'ext_viewcode' not in d:
        do_prompt(d, 'ext_viewcode', 'viewcode: include links to the source '
                  'code of documented Python objects (y/n)', 'n', boolean)
    if 'ext_githubpages' not in d:
        do_prompt(d, 'ext_githubpages', 'githubpages: create .nojekyll file '
                  'to publish the document on GitHub pages (y/n)', 'n', boolean)

    if 'no_makefile' in d:
        d['makefile'] = False
    elif 'makefile' not in d:
        print('''
A Makefile and a Windows command file can be generated for you so that you
only have to run e.g. `make html' instead of invoking sphinx-build
directly.''')
        do_prompt(d, 'makefile', 'Create Makefile? (y/n)', 'y', boolean)
    if 'no_batchfile' in d:
        d['batchfile'] = False
    elif 'batchfile' not in d:
        do_prompt(d, 'batchfile', 'Create Windows command file? (y/n)',
                  'y', boolean)
    print()


def generate(d, overwrite=True, silent=False, templatedir=None):
    # type: (Dict, bool, bool, unicode) -> None
    """Generate project based on values in *d*."""
    template = QuickstartRenderer(templatedir=templatedir)

    texescape.init()
    indent = ' ' * 4

    if 'mastertoctree' not in d:
        d['mastertoctree'] = ''
    if 'mastertocmaxdepth' not in d:
        d['mastertocmaxdepth'] = 2

    d['PY3'] = PY3
    d['project_fn'] = make_filename(d['project'])
    d['project_url'] = urlquote(d['project'].encode('idna'))
    d['project_manpage'] = d['project_fn'].lower()
    d['now'] = time.asctime()
    d['project_underline'] = column_width(d['project']) * '='
    d.setdefault('extensions', [])
    for name in EXTENSIONS:
        if d.get('ext_' + name):
            d['extensions'].append('sphinx.ext.' + name)
    d['extensions'] = (',\n' + indent).join(repr(name) for name in d['extensions'])
    d['copyright'] = time.strftime('%Y') + ', ' + d['author']
    d['author_texescaped'] = text_type(d['author']).\
        translate(texescape.tex_escape_map)
    d['project_doc'] = d['project'] + ' Documentation'
    d['project_doc_texescaped'] = text_type(d['project'] + ' Documentation').\
        translate(texescape.tex_escape_map)

    # escape backslashes and single quotes in strings that are put into
    # a Python string literal
    for key in ('project', 'project_doc', 'project_doc_texescaped',
                'author', 'author_texescaped', 'copyright',
                'version', 'release', 'master'):
        d[key + '_str'] = d[key].replace('\\', '\\\\').replace("'", "\\'")

    if not path.isdir(d['path']):
        mkdir_p(d['path'])

    srcdir = d['sep'] and path.join(d['path'], 'source') or d['path']

    mkdir_p(srcdir)
    if d['sep']:
        builddir = path.join(d['path'], 'build')
        d['exclude_patterns'] = ''
    else:
        builddir = path.join(srcdir, d['dot'] + 'build')
        exclude_patterns = map(repr, [
            d['dot'] + 'build',
            'Thumbs.db', '.DS_Store',
        ])
        d['exclude_patterns'] = ', '.join(exclude_patterns)
    mkdir_p(builddir)
    mkdir_p(path.join(srcdir, d['dot'] + 'templates'))
    mkdir_p(path.join(srcdir, d['dot'] + 'static'))

    def write_file(fpath, content, newline=None):
        # type: (unicode, unicode, unicode) -> None
        if overwrite or not path.isfile(fpath):
            print('Creating file %s.' % fpath)
            with open(fpath, 'wt', encoding='utf-8', newline=newline) as f:
                f.write(content)
        else:
            print('File %s already exists, skipping.' % fpath)

    conf_path = os.path.join(templatedir, 'conf.py_t') if templatedir else None
    if not conf_path or not path.isfile(conf_path):
        conf_path = os.path.join(package_dir, 'templates', 'quickstart', 'conf.py_t')
    with open(conf_path) as f:
        conf_text = convert_python_source(f.read())

    write_file(path.join(srcdir, 'conf.py'), template.render_string(conf_text, d))

    masterfile = path.join(srcdir, d['master'] + d['suffix'])
    write_file(masterfile, template.render('quickstart/master_doc.rst_t', d))

    if d.get('make_mode') is True:
        makefile_template = 'quickstart/Makefile.new_t'
        batchfile_template = 'quickstart/make.bat.new_t'
    else:
        makefile_template = 'quickstart/Makefile_t'
        batchfile_template = 'quickstart/make.bat_t'

    if d['makefile'] is True:
        d['rsrcdir'] = d['sep'] and 'source' or '.'
        d['rbuilddir'] = d['sep'] and 'build' or d['dot'] + 'build'
        # use binary mode, to avoid writing \r\n on Windows
        write_file(path.join(d['path'], 'Makefile'),
                   template.render(makefile_template, d), u'\n')

    if d['batchfile'] is True:
        d['rsrcdir'] = d['sep'] and 'source' or '.'
        d['rbuilddir'] = d['sep'] and 'build' or d['dot'] + 'build'
        write_file(path.join(d['path'], 'make.bat'),
                   template.render(batchfile_template, d), u'\r\n')

    if silent:
        return
    print()
    print(bold('Finished: An initial directory structure has been created.'))
    print('''
You should now populate your master file %s and create other documentation
source files. ''' % masterfile + ((d['makefile'] or d['batchfile']) and '''\
Use the Makefile to build the docs, like so:
   make builder
''' or '''\
Use the sphinx-build command to build the docs, like so:
   sphinx-build -b builder %s %s
''' % (srcdir, builddir)) + '''\
where "builder" is one of the supported builders, e.g. html, latex or linkcheck.
''')


def usage(argv, msg=None):
    # type: (List[unicode], unicode) -> None
    if msg:
        print(msg, file=sys.stderr)
        print(file=sys.stderr)


USAGE = """\
Sphinx v%s
Usage: %%prog [options] [projectdir]
""" % __display_version__

EPILOG = """\
For more information, visit <http://sphinx-doc.org/>.
"""


def valid_dir(d):
    # type: (Dict) -> bool
    dir = d['path']
    if not path.exists(dir):
        return True
    if not path.isdir(dir):
        return False

    if set(['Makefile', 'make.bat']) & set(os.listdir(dir)):
        return False

    if d['sep']:
        dir = os.path.join('source', dir)
        if not path.exists(dir):
            return True
        if not path.isdir(dir):
            return False

    reserved_names = [
        'conf.py',
        d['dot'] + 'static',
        d['dot'] + 'templates',
        d['master'] + d['suffix'],
    ]
    if set(reserved_names) & set(os.listdir(dir)):
        return False

    return True


class MyFormatter(optparse.IndentedHelpFormatter):
    def format_usage(self, usage):  # type: ignore
        # type: (str) -> str
        return usage

    def format_help(self, formatter):
        result = []
        if self.description:
            result.append(self.format_description(formatter))
        if self.option_list:
            result.append(self.format_option_help(formatter))
        return "\n".join(result)


def main(argv=sys.argv):
    # type: (List[str]) -> int
    if not color_terminal():
        nocolor()

    parser = optparse.OptionParser(USAGE, epilog=EPILOG,
                                   version='Sphinx v%s' % __display_version__,
                                   formatter=MyFormatter())
    parser.add_option('-q', '--quiet', action='store_true', dest='quiet',
                      default=False,
                      help='quiet mode')

    group = parser.add_option_group('Structure options')
    group.add_option('--sep', action='store_true', dest='sep',
                     help='if specified, separate source and build dirs')
    group.add_option('--dot', metavar='DOT', dest='dot',
                     help='replacement for dot in _templates etc.')

    group = parser.add_option_group('Project basic options')
    group.add_option('-p', '--project', metavar='PROJECT', dest='project',
                     help='project name')
    group.add_option('-a', '--author', metavar='AUTHOR', dest='author',
                     help='author names')
    group.add_option('-v', metavar='VERSION', dest='version',
                     help='version of project')
    group.add_option('-r', '--release', metavar='RELEASE', dest='release',
                     help='release of project')
    group.add_option('-l', '--language', metavar='LANGUAGE', dest='language',
                     help='document language')
    group.add_option('--suffix', metavar='SUFFIX', dest='suffix',
                     help='source file suffix')
    group.add_option('--master', metavar='MASTER', dest='master',
                     help='master document name')
    group.add_option('--epub', action='store_true', dest='epub',
                     default=False,
                     help='use epub')

    group = parser.add_option_group('Extension options')
    for ext in EXTENSIONS:
        group.add_option('--ext-' + ext, action='store_true',
                         dest='ext_' + ext, default=False,
                         help='enable %s extension' % ext)
    group.add_option('--extensions', metavar='EXTENSIONS', dest='extensions',
                     action='append', help='enable extensions')

    group = parser.add_option_group('Makefile and Batchfile creation')
    group.add_option('--makefile', action='store_true', dest='makefile',
                     default=False,
                     help='create makefile')
    group.add_option('--no-makefile', action='store_true', dest='no_makefile',
                     default=False,
                     help='not create makefile')
    group.add_option('--batchfile', action='store_true', dest='batchfile',
                     default=False,
                     help='create batchfile')
    group.add_option('--no-batchfile', action='store_true', dest='no_batchfile',
                     default=False,
                     help='not create batchfile')
    group.add_option('-M', '--no-use-make-mode', action='store_false', dest='make_mode',
                     help='not use make-mode for Makefile/make.bat')
    group.add_option('-m', '--use-make-mode', action='store_true', dest='make_mode',
                     default=True,
                     help='use make-mode for Makefile/make.bat')

    group = parser.add_option_group('Project templating')
    group.add_option('-t', '--templatedir', metavar='TEMPLATEDIR', dest='templatedir',
                     help='template directory for template files')
    group.add_option('-d', metavar='NAME=VALUE', action='append', dest='variables',
                     help='define a template variable')

    # parse options
    try:
        opts, args = parser.parse_args(argv[1:])
    except SystemExit as err:
        return err.code

    if len(args) > 0:
        opts.ensure_value('path', args[0])

    d = vars(opts)
    # delete None or False value
    d = dict((k, v) for k, v in d.items() if not (v is None or v is False))

    try:
        if 'quiet' in d:
            if not set(['project', 'author']).issubset(d):
                print('''"quiet" is specified, but any of "project" or \
"author" is not specified.''')
                return 1

        if set(['quiet', 'project', 'author']).issubset(d):
            # quiet mode with all required params satisfied, use default
            d.setdefault('version', '')
            d.setdefault('release', d['version'])
            d2 = DEFAULT_VALUE.copy()
            d2.update(dict(("ext_" + ext, False) for ext in EXTENSIONS))
            d2.update(d)
            d = d2
            if 'no_makefile' in d:
                d['makefile'] = False
            if 'no_batchfile' in d:
                d['batchfile'] = False

            if not valid_dir(d):
                print()
                print(bold('Error: specified path is not a directory, or sphinx'
                           ' files already exist.'))
                print('sphinx-quickstart only generate into a empty directory.'
                      ' Please specify a new root path.')
                return 1
        else:
            ask_user(d)
    except (KeyboardInterrupt, EOFError):
        print()
        print('[Interrupted.]')
        return 130  # 128 + SIGINT

    # decode values in d if value is a Python string literal
    for key, value in d.items():
        if isinstance(value, binary_type):
            d[key] = term_decode(value)

    # parse extensions list
    d.setdefault('extensions', [])
    for ext in d['extensions'][:]:
        if ',' in ext:
            d['extensions'].remove(ext)
            for modname in ext.split(','):
                d['extensions'].append(modname)

    for variable in d.get('variables', []):
        try:
            name, value = variable.split('=')
            d[name] = value
        except ValueError:
            print('Invalid template variable: %s' % variable)

    generate(d, templatedir=opts.templatedir)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
