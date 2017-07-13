# -*- coding: utf-8 -*-
"""
    sphinx.ext.autodoc
    ~~~~~~~~~~~~~~~~~~

    Automatically insert docstrings for functions, classes or whole modules into
    the doctree, thus avoiding duplication between docstrings and documentation
    for those who like elaborate docstrings.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re
import sys
import inspect
import traceback
import warnings
from types import FunctionType, MethodType, ModuleType

from six import PY2, iterkeys, iteritems, itervalues, text_type, class_types, \
    string_types, StringIO

from docutils import nodes
from docutils.utils import assemble_option_dict
from docutils.parsers.rst import Directive
from docutils.statemachine import ViewList

import sphinx
from sphinx.util import rpartition, force_decode
from sphinx.locale import _
from sphinx.pycode import ModuleAnalyzer, PycodeError
from sphinx.application import ExtensionError
from sphinx.util import logging
from sphinx.util.nodes import nested_parse_with_titles
from sphinx.util.inspect import getargspec, isdescriptor, safe_getmembers, \
    safe_getattr, object_description, is_builtin_class_method, \
    isenumclass, isenumattribute
from sphinx.util.docstrings import prepare_docstring

if False:
    # For type annotation
    from typing import Any, Callable, Dict, Iterator, List, Sequence, Set, Tuple, Type, Union  # NOQA
    from docutils.utils import Reporter  # NOQA
    from sphinx.application import Sphinx  # NOQA

try:
    if sys.version_info >= (3,):
        import typing
    else:
        typing = None
except ImportError:
    typing = None

logger = logging.getLogger(__name__)

# This type isn't exposed directly in any modules, but can be found
# here in most Python versions
MethodDescriptorType = type(type.__subclasses__)


#: extended signature RE: with explicit module name separated by ::
py_ext_sig_re = re.compile(
    r'''^ ([\w.]+::)?            # explicit module name
          ([\w.]+\.)?            # module and/or class name(s)
          (\w+)  \s*             # thing name
          (?: \((.*)\)           # optional: arguments
           (?:\s* -> \s* (.*))?  #           return annotation
          )? $                   # and nothing more
          ''', re.VERBOSE)


class DefDict(dict):
    """A dict that returns a default on nonexisting keys."""
    def __init__(self, default):
        # type: (Any) -> None
        dict.__init__(self)
        self.default = default

    def __getitem__(self, key):
        # type: (Any) -> Any
        try:
            return dict.__getitem__(self, key)
        except KeyError:
            return self.default

    def __bool__(self):
        # type: () -> bool
        # docutils check "if option_spec"
        return True
    __nonzero__ = __bool__  # for python2 compatibility


def identity(x):
    # type: (Any) -> Any
    return x


class Options(dict):
    """A dict/attribute hybrid that returns None on nonexisting keys."""
    def __getattr__(self, name):
        # type: (unicode) -> Any
        try:
            return self[name.replace('_', '-')]
        except KeyError:
            return None


class _MockObject(object):
    """Used by autodoc_mock_imports."""

    def __init__(self, *args, **kwargs):
        # type: (Any, Any) -> None
        pass

    def __len__(self):
        # type: () -> int
        return 0

    def __contains__(self, key):
        # type: (str) -> bool
        return False

    def __iter__(self):
        # type: () -> None
        pass

    def __getitem__(self, key):
        # type: (str) -> _MockObject
        return self

    def __getattr__(self, key):
        # type: (str) -> _MockObject
        return self

    def __call__(self, *args, **kw):
        # type: (Any, Any) -> Any
        if args and type(args[0]) in [FunctionType, MethodType]:
            # Appears to be a decorator, pass through unchanged
            return args[0]
        return self


class _MockModule(ModuleType):
    """Used by autodoc_mock_imports."""
    __file__ = '/dev/null'

    def __init__(self, name, loader):
        # type: (str, _MockImporter) -> None
        self.__name__ = self.__package__ = name
        self.__loader__ = loader
        self.__all__ = []  # type: List[str]
        self.__path__ = []  # type: List[str]

    def __getattr__(self, name):
        # type: (str) -> _MockObject
        o = _MockObject()
        o.__module__ = self.__name__
        return o


class _MockImporter(object):

    def __init__(self, names):
        # type: (List[str]) -> None
        self.base_packages = set()  # type: Set[str]
        for n in names:
            # Convert module names:
            #     ['a.b.c', 'd.e']
            # to a set of base packages:
            #     set(['a', 'd'])
            self.base_packages.add(n.split('.')[0])
        self.mocked_modules = []  # type: List[str]
        # enable hook by adding itself to meta_path
        sys.meta_path = sys.meta_path + [self]

    def disable(self):
        # remove `self` from `sys.meta_path` to disable import hook
        sys.meta_path = [i for i in sys.meta_path if i is not self]
        # remove mocked modules from sys.modules to avoid side effects after
        # running auto-documenter
        for m in self.mocked_modules:
            if m in sys.modules:
                del sys.modules[m]

    def find_module(self, name, path=None):
        # type: (str, str) -> Any
        base_package = name.split('.')[0]
        if base_package in self.base_packages:
            return self
        return None

    def load_module(self, name):
        # type: (str) -> ModuleType
        if name in sys.modules:
            # module has already been imported, return it
            return sys.modules[name]
        else:
            logger.debug('[autodoc] adding a mock module %s!', name)
            module = _MockModule(name, self)
            sys.modules[name] = module
            self.mocked_modules.append(name)
            return module


ALL = object()
INSTANCEATTR = object()


def members_option(arg):
    # type: (Any) -> Union[object, List[unicode]]
    """Used to convert the :members: option to auto directives."""
    if arg is None:
        return ALL
    return [x.strip() for x in arg.split(',')]


def members_set_option(arg):
    # type: (Any) -> Union[object, Set[unicode]]
    """Used to convert the :members: option to auto directives."""
    if arg is None:
        return ALL
    return set(x.strip() for x in arg.split(','))


SUPPRESS = object()


def annotation_option(arg):
    # type: (Any) -> Any
    if arg is None:
        # suppress showing the representation of the object
        return SUPPRESS
    else:
        return arg


def bool_option(arg):
    # type: (Any) -> bool
    """Used to convert flag options to auto directives.  (Instead of
    directives.flag(), which returns None).
    """
    return True


class AutodocReporter(object):
    """
    A reporter replacement that assigns the correct source name
    and line number to a system message, as recorded in a ViewList.
    """
    def __init__(self, viewlist, reporter):
        # type: (ViewList, Reporter) -> None
        self.viewlist = viewlist
        self.reporter = reporter

    def __getattr__(self, name):
        # type: (unicode) -> Any
        return getattr(self.reporter, name)

    def system_message(self, level, message, *children, **kwargs):
        # type: (int, unicode, Any, Any) -> nodes.system_message
        if 'line' in kwargs and 'source' not in kwargs:
            try:
                source, line = self.viewlist.items[kwargs['line']]
            except IndexError:
                pass
            else:
                kwargs['source'] = source
                kwargs['line'] = line
        return self.reporter.system_message(level, message,
                                            *children, **kwargs)

    def debug(self, *args, **kwargs):
        # type: (Any, Any) -> nodes.system_message
        if self.reporter.debug_flag:
            return self.system_message(0, *args, **kwargs)

    def info(self, *args, **kwargs):
        # type: (Any, Any) -> nodes.system_message
        return self.system_message(1, *args, **kwargs)

    def warning(self, *args, **kwargs):
        # type: (Any, Any) -> nodes.system_message
        return self.system_message(2, *args, **kwargs)

    def error(self, *args, **kwargs):
        # type: (Any, Any) -> nodes.system_message
        return self.system_message(3, *args, **kwargs)

    def severe(self, *args, **kwargs):
        # type: (Any, Any) -> nodes.system_message
        return self.system_message(4, *args, **kwargs)


# Some useful event listener factories for autodoc-process-docstring.

def cut_lines(pre, post=0, what=None):
    # type: (int, int, unicode) -> Callable
    """Return a listener that removes the first *pre* and last *post*
    lines of every docstring.  If *what* is a sequence of strings,
    only docstrings of a type in *what* will be processed.

    Use like this (e.g. in the ``setup()`` function of :file:`conf.py`)::

       from sphinx.ext.autodoc import cut_lines
       app.connect('autodoc-process-docstring', cut_lines(4, what=['module']))

    This can (and should) be used in place of :confval:`automodule_skip_lines`.
    """
    def process(app, what_, name, obj, options, lines):
        # type: (Sphinx, unicode, unicode, Any, Any, List[unicode]) -> None
        if what and what_ not in what:
            return
        del lines[:pre]
        if post:
            # remove one trailing blank line.
            if lines and not lines[-1]:
                lines.pop(-1)
            del lines[-post:]
        # make sure there is a blank line at the end
        if lines and lines[-1]:
            lines.append('')
    return process


def between(marker, what=None, keepempty=False, exclude=False):
    # type: (unicode, Sequence[unicode], bool, bool) -> Callable
    """Return a listener that either keeps, or if *exclude* is True excludes,
    lines between lines that match the *marker* regular expression.  If no line
    matches, the resulting docstring would be empty, so no change will be made
    unless *keepempty* is true.

    If *what* is a sequence of strings, only docstrings of a type in *what* will
    be processed.
    """
    marker_re = re.compile(marker)

    def process(app, what_, name, obj, options, lines):
        # type: (Sphinx, unicode, unicode, Any, Any, List[unicode]) -> None
        if what and what_ not in what:
            return
        deleted = 0
        delete = not exclude
        orig_lines = lines[:]
        for i, line in enumerate(orig_lines):
            if delete:
                lines.pop(i - deleted)
                deleted += 1
            if marker_re.match(line):
                delete = not delete
                if delete:
                    lines.pop(i - deleted)
                    deleted += 1
        if not lines and not keepempty:
            lines[:] = orig_lines
        # make sure there is a blank line at the end
        if lines and lines[-1]:
            lines.append('')
    return process


def format_annotation(annotation):
    # type: (Any) -> str
    """Return formatted representation of a type annotation.

    Show qualified names for types and additional details for types from
    the ``typing`` module.

    Displaying complex types from ``typing`` relies on its private API.
    """
    if typing and isinstance(annotation, typing.TypeVar):  # type: ignore
        return annotation.__name__
    if annotation == Ellipsis:
        return '...'
    if not isinstance(annotation, type):
        return repr(annotation)

    qualified_name = (annotation.__module__ + '.' + annotation.__qualname__  # type: ignore
                      if annotation else repr(annotation))

    if annotation.__module__ == 'builtins':
        return annotation.__qualname__  # type: ignore
    elif typing:
        if hasattr(typing, 'GenericMeta') and \
                isinstance(annotation, typing.GenericMeta):
            # In Python 3.5.2+, all arguments are stored in __args__,
            # whereas __parameters__ only contains generic parameters.
            #
            # Prior to Python 3.5.2, __args__ is not available, and all
            # arguments are in __parameters__.
            params = None
            if hasattr(annotation, '__args__'):
                if annotation.__args__ is None or len(annotation.__args__) <= 2:
                    params = annotation.__args__
                else:  # typing.Callable
                    args = ', '.join(format_annotation(a) for a in annotation.__args__[:-1])
                    result = format_annotation(annotation.__args__[-1])
                    return '%s[[%s], %s]' % (qualified_name, args, result)
            elif hasattr(annotation, '__parameters__'):
                params = annotation.__parameters__
            if params is not None:
                param_str = ', '.join(format_annotation(p) for p in params)
                return '%s[%s]' % (qualified_name, param_str)
        elif hasattr(typing, 'UnionMeta') and \
                isinstance(annotation, typing.UnionMeta) and \
                hasattr(annotation, '__union_params__'):
            params = annotation.__union_params__
            if params is not None:
                param_str = ', '.join(format_annotation(p) for p in params)
                return '%s[%s]' % (qualified_name, param_str)
        elif hasattr(typing, 'CallableMeta') and \
                isinstance(annotation, typing.CallableMeta) and \
                getattr(annotation, '__args__', None) is not None and \
                hasattr(annotation, '__result__'):
            # Skipped in the case of plain typing.Callable
            args = annotation.__args__
            if args is None:
                return qualified_name
            elif args is Ellipsis:
                args_str = '...'
            else:
                formatted_args = (format_annotation(a) for a in args)
                args_str = '[%s]' % ', '.join(formatted_args)
            return '%s[%s, %s]' % (qualified_name,
                                   args_str,
                                   format_annotation(annotation.__result__))
        elif hasattr(typing, 'TupleMeta') and \
                isinstance(annotation, typing.TupleMeta) and \
                hasattr(annotation, '__tuple_params__') and \
                hasattr(annotation, '__tuple_use_ellipsis__'):
            params = annotation.__tuple_params__
            if params is not None:
                param_strings = [format_annotation(p) for p in params]
                if annotation.__tuple_use_ellipsis__:
                    param_strings.append('...')
                return '%s[%s]' % (qualified_name,
                                   ', '.join(param_strings))
    return qualified_name


def formatargspec(function, args, varargs=None, varkw=None, defaults=None,
                  kwonlyargs=(), kwonlydefaults={}, annotations={}):
    # type: (Callable, Tuple[str, ...], str, str, Any, Tuple, Dict, Dict[str, Any]) -> str
    """Return a string representation of an ``inspect.FullArgSpec`` tuple.

    An enhanced version of ``inspect.formatargspec()`` that handles typing
    annotations better.
    """

    def format_arg_with_annotation(name):
        # type: (str) -> str
        if name in annotations:
            return '%s: %s' % (name, format_annotation(get_annotation(name)))
        return name

    def get_annotation(name):
        # type: (str) -> str
        value = annotations[name]
        if isinstance(value, string_types):
            return introspected_hints.get(name, value)
        else:
            return value

    introspected_hints = (typing.get_type_hints(function)  # type: ignore
                          if typing and hasattr(function, '__code__') else {})

    fd = StringIO()
    fd.write('(')

    formatted = []
    defaults_start = len(args) - len(defaults) if defaults else len(args)

    for i, arg in enumerate(args):
        arg_fd = StringIO()
        if isinstance(arg, list):
            # support tupled arguments list (only for py2): def foo((x, y))
            arg_fd.write('(')
            arg_fd.write(format_arg_with_annotation(arg[0]))
            for param in arg[1:]:
                arg_fd.write(', ')
                arg_fd.write(format_arg_with_annotation(param))
            arg_fd.write(')')
        else:
            arg_fd.write(format_arg_with_annotation(arg))
            if defaults and i >= defaults_start:
                arg_fd.write(' = ' if arg in annotations else '=')
                arg_fd.write(object_description(defaults[i - defaults_start]))  # type: ignore
        formatted.append(arg_fd.getvalue())

    if varargs:
        formatted.append('*' + format_arg_with_annotation(varargs))

    if kwonlyargs:
        if not varargs:
            formatted.append('*')

        for kwarg in kwonlyargs:
            arg_fd = StringIO()
            arg_fd.write(format_arg_with_annotation(kwarg))
            if kwonlydefaults and kwarg in kwonlydefaults:
                arg_fd.write(' = ' if kwarg in annotations else '=')
                arg_fd.write(object_description(kwonlydefaults[kwarg]))  # type: ignore
            formatted.append(arg_fd.getvalue())

    if varkw:
        formatted.append('**' + format_arg_with_annotation(varkw))

    fd.write(', '.join(formatted))
    fd.write(')')

    if 'return' in annotations:
        fd.write(' -> ')
        fd.write(format_annotation(get_annotation('return')))

    return fd.getvalue()


class Documenter(object):
    """
    A Documenter knows how to autodocument a single object type.  When
    registered with the AutoDirective, it will be used to document objects
    of that type when needed by autodoc.

    Its *objtype* attribute selects what auto directive it is assigned to
    (the directive name is 'auto' + objtype), and what directive it generates
    by default, though that can be overridden by an attribute called
    *directivetype*.

    A Documenter has an *option_spec* that works like a docutils directive's;
    in fact, it will be used to parse an auto directive's options that matches
    the documenter.
    """
    #: name by which the directive is called (auto...) and the default
    #: generated directive name
    objtype = 'object'
    #: indentation by which to indent the directive content
    content_indent = u'   '
    #: priority if multiple documenters return True from can_document_member
    priority = 0
    #: order if autodoc_member_order is set to 'groupwise'
    member_order = 0
    #: true if the generated content may contain titles
    titles_allowed = False

    option_spec = {'noindex': bool_option}  # type: Dict[unicode, Callable]

    @staticmethod
    def get_attr(obj, name, *defargs):
        # type: (Any, unicode, Any) -> Any
        """getattr() override for types such as Zope interfaces."""
        for typ, func in iteritems(AutoDirective._special_attrgetters):
            if isinstance(obj, typ):
                return func(obj, name, *defargs)
        return safe_getattr(obj, name, *defargs)

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        """Called to see if a member can be documented by this documenter."""
        raise NotImplementedError('must be implemented in subclasses')

    def __init__(self, directive, name, indent=u''):
        # type: (Directive, unicode, unicode) -> None
        self.directive = directive
        self.env = directive.env
        self.options = directive.genopt
        self.name = name
        self.indent = indent
        # the module and object path within the module, and the fully
        # qualified name (all set after resolve_name succeeds)
        self.modname = None         # type: str
        self.module = None          # type: ModuleType
        self.objpath = None         # type: List[unicode]
        self.fullname = None        # type: unicode
        # extra signature items (arguments and return annotation,
        # also set after resolve_name succeeds)
        self.args = None            # type: unicode
        self.retann = None          # type: unicode
        # the object to document (set after import_object succeeds)
        self.object = None          # type: Any
        self.object_name = None     # type: unicode
        # the parent/owner of the object to document
        self.parent = None          # type: Any
        # the module analyzer to get at attribute docs, or None
        self.analyzer = None        # type: Any

    def add_line(self, line, source, *lineno):
        # type: (unicode, unicode, int) -> None
        """Append one line of generated reST to the output."""
        self.directive.result.append(self.indent + line, source, *lineno)

    def resolve_name(self, modname, parents, path, base):
        # type: (str, Any, str, Any) -> Tuple[str, List[unicode]]
        """Resolve the module and name of the object to document given by the
        arguments and the current module/class.

        Must return a pair of the module name and a chain of attributes; for
        example, it would return ``('zipfile', ['ZipFile', 'open'])`` for the
        ``zipfile.ZipFile.open`` method.
        """
        raise NotImplementedError('must be implemented in subclasses')

    def parse_name(self):
        # type: () -> bool
        """Determine what module to import and what attribute to document.

        Returns True and sets *self.modname*, *self.objpath*, *self.fullname*,
        *self.args* and *self.retann* if parsing and resolving was successful.
        """
        # first, parse the definition -- auto directives for classes and
        # functions can contain a signature which is then used instead of
        # an autogenerated one
        try:
            explicit_modname, path, base, args, retann = \
                py_ext_sig_re.match(self.name).groups()  # type: ignore
        except AttributeError:
            self.directive.warn('invalid signature for auto%s (%r)' %
                                (self.objtype, self.name))
            return False

        # support explicit module and class name separation via ::
        if explicit_modname is not None:
            modname = explicit_modname[:-2]
            parents = path and path.rstrip('.').split('.') or []
        else:
            modname = None
            parents = []

        self.modname, self.objpath = self.resolve_name(modname, parents, path, base)

        if not self.modname:
            return False

        self.args = args
        self.retann = retann
        self.fullname = (self.modname or '') + \
                        (self.objpath and '.' + '.'.join(self.objpath) or '')
        return True

    def import_object(self):
        # type: () -> bool
        """Import the object given by *self.modname* and *self.objpath* and set
        it as *self.object*.

        Returns True if successful, False if an error occurred.
        """
        if self.objpath:
            logger.debug('[autodoc] from %s import %s',
                         self.modname, '.'.join(self.objpath))
        # always enable mock import hook
        # it will do nothing if autodoc_mock_imports is empty
        import_hook = _MockImporter(self.env.config.autodoc_mock_imports)
        try:
            logger.debug('[autodoc] import %s', self.modname)
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=ImportWarning)
                __import__(self.modname)
            parent = None
            obj = self.module = sys.modules[self.modname]
            logger.debug('[autodoc] => %r', obj)
            for part in self.objpath:
                parent = obj
                logger.debug('[autodoc] getattr(_, %r)', part)
                obj = self.get_attr(obj, part)
                logger.debug('[autodoc] => %r', obj)
                self.object_name = part
            self.parent = parent
            self.object = obj
            return True
        # this used to only catch SyntaxError, ImportError and AttributeError,
        # but importing modules with side effects can raise all kinds of errors
        except (Exception, SystemExit) as e:
            if self.objpath:
                errmsg = 'autodoc: failed to import %s %r from module %r' % \
                         (self.objtype, '.'.join(self.objpath), self.modname)
            else:
                errmsg = 'autodoc: failed to import %s %r' % \
                         (self.objtype, self.fullname)
            if isinstance(e, SystemExit):
                errmsg += ('; the module executes module level statement ' +
                           'and it might call sys.exit().')
            else:
                errmsg += '; the following exception was raised:\n%s' % \
                          traceback.format_exc()
            if PY2:
                errmsg = errmsg.decode('utf-8')  # type: ignore
            logger.debug(errmsg)
            self.directive.warn(errmsg)
            self.env.note_reread()
            return False
        finally:
            import_hook.disable()

    def get_real_modname(self):
        # type: () -> str
        """Get the real module name of an object to document.

        It can differ from the name of the module through which the object was
        imported.
        """
        return self.get_attr(self.object, '__module__', None) or self.modname

    def check_module(self):
        # type: () -> bool
        """Check if *self.object* is really defined in the module given by
        *self.modname*.
        """
        if self.options.imported_members:
            return True

        modname = self.get_attr(self.object, '__module__', None)
        if modname and modname != self.modname:
            return False
        return True

    def format_args(self):
        # type: () -> unicode
        """Format the argument signature of *self.object*.

        Should return None if the object does not have a signature.
        """
        return None

    def format_name(self):
        # type: () -> unicode
        """Format the name of *self.object*.

        This normally should be something that can be parsed by the generated
        directive, but doesn't need to be (Sphinx will display it unparsed
        then).
        """
        # normally the name doesn't contain the module (except for module
        # directives of course)
        return '.'.join(self.objpath) or self.modname

    def format_signature(self):
        # type: () -> unicode
        """Format the signature (arguments and return annotation) of the object.

        Let the user process it via the ``autodoc-process-signature`` event.
        """
        if self.args is not None:
            # signature given explicitly
            args = "(%s)" % self.args  # type: unicode
        else:
            # try to introspect the signature
            try:
                args = self.format_args()
            except Exception as err:
                self.directive.warn('error while formatting arguments for '
                                    '%s: %s' % (self.fullname, err))
                args = None

        retann = self.retann

        result = self.env.app.emit_firstresult(
            'autodoc-process-signature', self.objtype, self.fullname,
            self.object, self.options, args, retann)
        if result:
            args, retann = result

        if args is not None:
            return args + (retann and (' -> %s' % retann) or '')
        else:
            return ''

    def add_directive_header(self, sig):
        # type: (unicode) -> None
        """Add the directive header and options to the generated content."""
        domain = getattr(self, 'domain', 'py')
        directive = getattr(self, 'directivetype', self.objtype)
        name = self.format_name()
        sourcename = self.get_sourcename()
        self.add_line(u'.. %s:%s:: %s%s' % (domain, directive, name, sig),
                      sourcename)
        if self.options.noindex:
            self.add_line(u'   :noindex:', sourcename)
        if self.objpath:
            # Be explicit about the module, this is necessary since .. class::
            # etc. don't support a prepended module name
            self.add_line(u'   :module: %s' % self.modname, sourcename)

    def get_doc(self, encoding=None, ignore=1):
        # type: (unicode, int) -> List[List[unicode]]
        """Decode and return lines of the docstring(s) for the object."""
        docstring = self.get_attr(self.object, '__doc__', None)
        # make sure we have Unicode docstrings, then sanitize and split
        # into lines
        if isinstance(docstring, text_type):
            return [prepare_docstring(docstring, ignore)]
        elif isinstance(docstring, str):  # this will not trigger on Py3
            return [prepare_docstring(force_decode(docstring, encoding),
                                      ignore)]
        # ... else it is something strange, let's ignore it
        return []

    def process_doc(self, docstrings):
        # type: (List[List[unicode]]) -> Iterator[unicode]
        """Let the user process the docstrings before adding them."""
        for docstringlines in docstrings:
            if self.env.app:
                # let extensions preprocess docstrings
                self.env.app.emit('autodoc-process-docstring',
                                  self.objtype, self.fullname, self.object,
                                  self.options, docstringlines)
            for line in docstringlines:
                yield line

    def get_sourcename(self):
        # type: () -> unicode
        if self.analyzer:
            # prevent encoding errors when the file name is non-ASCII
            if not isinstance(self.analyzer.srcname, text_type):
                filename = text_type(self.analyzer.srcname,
                                     sys.getfilesystemencoding(), 'replace')
            else:
                filename = self.analyzer.srcname
            return u'%s:docstring of %s' % (filename, self.fullname)
        return u'docstring of %s' % self.fullname

    def add_content(self, more_content, no_docstring=False):
        # type: (Any, bool) -> None
        """Add content from docstrings, attribute documentation and user."""
        # set sourcename and add content from attribute documentation
        sourcename = self.get_sourcename()
        if self.analyzer:
            attr_docs = self.analyzer.find_attr_docs()
            if self.objpath:
                key = ('.'.join(self.objpath[:-1]), self.objpath[-1])
                if key in attr_docs:
                    no_docstring = True
                    docstrings = [attr_docs[key]]
                    for i, line in enumerate(self.process_doc(docstrings)):
                        self.add_line(line, sourcename, i)

        # add content from docstrings
        if not no_docstring:
            encoding = self.analyzer and self.analyzer.encoding
            docstrings = self.get_doc(encoding)
            if not docstrings:
                # append at least a dummy docstring, so that the event
                # autodoc-process-docstring is fired and can add some
                # content if desired
                docstrings.append([])
            for i, line in enumerate(self.process_doc(docstrings)):
                self.add_line(line, sourcename, i)

        # add additional content (e.g. from document), if present
        if more_content:
            for line, src in zip(more_content.data, more_content.items):
                self.add_line(line, src[0], src[1])

    def get_object_members(self, want_all):
        # type: (bool) -> Tuple[bool, List[Tuple[unicode, object]]]
        """Return `(members_check_module, members)` where `members` is a
        list of `(membername, member)` pairs of the members of *self.object*.

        If *want_all* is True, return all members.  Else, only return those
        members given by *self.options.members* (which may also be none).
        """
        analyzed_member_names = set()
        if self.analyzer:
            attr_docs = self.analyzer.find_attr_docs()
            namespace = '.'.join(self.objpath)
            for item in iteritems(attr_docs):
                if item[0][0] == namespace:
                    analyzed_member_names.add(item[0][1])
        if not want_all:
            if not self.options.members:
                return False, []
            # specific members given
            members = []
            for mname in self.options.members:
                try:
                    members.append((mname, self.get_attr(self.object, mname)))
                except AttributeError:
                    if mname not in analyzed_member_names:
                        self.directive.warn('missing attribute %s in object %s'
                                            % (mname, self.fullname))
        elif self.options.inherited_members:
            # safe_getmembers() uses dir() which pulls in members from all
            # base classes
            members = safe_getmembers(self.object, attr_getter=self.get_attr)
        else:
            # __dict__ contains only the members directly defined in
            # the class (but get them via getattr anyway, to e.g. get
            # unbound method objects instead of function objects);
            # using list(iterkeys()) because apparently there are objects for which
            # __dict__ changes while getting attributes
            try:
                obj_dict = self.get_attr(self.object, '__dict__')
            except AttributeError:
                members = []
            else:
                members = [(mname, self.get_attr(self.object, mname, None))
                           for mname in list(iterkeys(obj_dict))]

            # Py34 doesn't have enum members in __dict__.
            if isenumclass(self.object):
                members.extend(
                    item for item in self.object.__members__.items()
                    if item not in members
                )

        membernames = set(m[0] for m in members)
        # add instance attributes from the analyzer
        for aname in analyzed_member_names:
            if aname not in membernames and \
               (want_all or aname in self.options.members):
                members.append((aname, INSTANCEATTR))
        return False, sorted(members)

    def filter_members(self, members, want_all):
        # type: (List[Tuple[unicode, Any]], bool) -> List[Tuple[unicode, Any, bool]]
        """Filter the given member list.

        Members are skipped if

        - they are private (except if given explicitly or the private-members
          option is set)
        - they are special methods (except if given explicitly or the
          special-members option is set)
        - they are undocumented (except if the undoc-members option is set)

        The user can override the skipping decision by connecting to the
        ``autodoc-skip-member`` event.
        """
        ret = []

        # search for members in source code too
        namespace = '.'.join(self.objpath)  # will be empty for modules

        if self.analyzer:
            attr_docs = self.analyzer.find_attr_docs()
        else:
            attr_docs = {}

        # process members and determine which to skip
        for (membername, member) in members:
            # if isattr is True, the member is documented as an attribute
            isattr = False

            doc = self.get_attr(member, '__doc__', None)
            # if the member __doc__ is the same as self's __doc__, it's just
            # inherited and therefore not the member's doc
            cls = self.get_attr(member, '__class__', None)
            if cls:
                cls_doc = self.get_attr(cls, '__doc__', None)
                if cls_doc == doc:
                    doc = None
            has_doc = bool(doc)

            keep = False
            if want_all and membername.startswith('__') and \
                    membername.endswith('__') and len(membername) > 4:
                # special __methods__
                if self.options.special_members is ALL and \
                        membername != '__doc__':
                    keep = has_doc or self.options.undoc_members
                elif self.options.special_members and \
                    self.options.special_members is not ALL and \
                        membername in self.options.special_members:
                    keep = has_doc or self.options.undoc_members
            elif want_all and membername.startswith('_'):
                # ignore members whose name starts with _ by default
                keep = self.options.private_members and \
                    (has_doc or self.options.undoc_members)
            elif (namespace, membername) in attr_docs:
                # keep documented attributes
                keep = True
                isattr = True
            else:
                # ignore undocumented members if :undoc-members: is not given
                keep = has_doc or self.options.undoc_members

            # give the user a chance to decide whether this member
            # should be skipped
            if self.env.app:
                # let extensions preprocess docstrings
                skip_user = self.env.app.emit_firstresult(
                    'autodoc-skip-member', self.objtype, membername, member,
                    not keep, self.options)
                if skip_user is not None:
                    keep = not skip_user

            if keep:
                ret.append((membername, member, isattr))

        return ret

    def document_members(self, all_members=False):
        # type: (bool) -> None
        """Generate reST for member documentation.

        If *all_members* is True, do all members, else those given by
        *self.options.members*.
        """
        # set current namespace for finding members
        self.env.temp_data['autodoc:module'] = self.modname
        if self.objpath:
            self.env.temp_data['autodoc:class'] = self.objpath[0]

        want_all = all_members or self.options.inherited_members or \
            self.options.members is ALL
        # find out which members are documentable
        members_check_module, members = self.get_object_members(want_all)

        # remove members given by exclude-members
        if self.options.exclude_members:
            members = [(membername, member) for (membername, member) in members
                       if membername not in self.options.exclude_members]

        # document non-skipped members
        memberdocumenters = []  # type: List[Tuple[Documenter, bool]]
        for (mname, member, isattr) in self.filter_members(members, want_all):
            classes = [cls for cls in itervalues(AutoDirective._registry)
                       if cls.can_document_member(member, mname, isattr, self)]
            if not classes:
                # don't know how to document this member
                continue
            # prefer the documenter with the highest priority
            classes.sort(key=lambda cls: cls.priority)
            # give explicitly separated module name, so that members
            # of inner classes can be documented
            full_mname = self.modname + '::' + \
                '.'.join(self.objpath + [mname])
            documenter = classes[-1](self.directive, full_mname, self.indent)
            memberdocumenters.append((documenter, isattr))
        member_order = self.options.member_order or \
            self.env.config.autodoc_member_order
        if member_order == 'groupwise':
            # sort by group; relies on stable sort to keep items in the
            # same group sorted alphabetically
            memberdocumenters.sort(key=lambda e: e[0].member_order)
        elif member_order == 'bysource' and self.analyzer:
            # sort by source order, by virtue of the module analyzer
            tagorder = self.analyzer.tagorder

            def keyfunc(entry):
                # type: (Tuple[Documenter, bool]) -> int
                fullname = entry[0].name.split('::')[1]
                return tagorder.get(fullname, len(tagorder))
            memberdocumenters.sort(key=keyfunc)

        for documenter, isattr in memberdocumenters:
            documenter.generate(
                all_members=True, real_modname=self.real_modname,
                check_module=members_check_module and not isattr)

        # reset current objects
        self.env.temp_data['autodoc:module'] = None
        self.env.temp_data['autodoc:class'] = None

    def generate(self, more_content=None, real_modname=None,
                 check_module=False, all_members=False):
        # type: (Any, str, bool, bool) -> None
        """Generate reST for the object given by *self.name*, and possibly for
        its members.

        If *more_content* is given, include that content. If *real_modname* is
        given, use that module name to find attribute docs. If *check_module* is
        True, only generate if the object is defined in the module name it is
        imported from. If *all_members* is True, document all members.
        """
        if not self.parse_name():
            # need a module to import
            self.directive.warn(
                'don\'t know which module to import for autodocumenting '
                '%r (try placing a "module" or "currentmodule" directive '
                'in the document, or giving an explicit module name)'
                % self.name)
            return

        # now, import the module and get object to document
        if not self.import_object():
            return

        # If there is no real module defined, figure out which to use.
        # The real module is used in the module analyzer to look up the module
        # where the attribute documentation would actually be found in.
        # This is used for situations where you have a module that collects the
        # functions and classes of internal submodules.
        self.real_modname = real_modname or self.get_real_modname()

        # try to also get a source code analyzer for attribute docs
        try:
            self.analyzer = ModuleAnalyzer.for_module(self.real_modname)
            # parse right now, to get PycodeErrors on parsing (results will
            # be cached anyway)
            self.analyzer.find_attr_docs()
        except PycodeError as err:
            logger.debug('[autodoc] module analyzer failed: %s', err)
            # no source file -- e.g. for builtin and C modules
            self.analyzer = None
            # at least add the module.__file__ as a dependency
            if hasattr(self.module, '__file__') and self.module.__file__:
                self.directive.filename_set.add(self.module.__file__)
        else:
            self.directive.filename_set.add(self.analyzer.srcname)

        # check __module__ of object (for members not given explicitly)
        if check_module:
            if not self.check_module():
                return

        sourcename = self.get_sourcename()

        # make sure that the result starts with an empty line.  This is
        # necessary for some situations where another directive preprocesses
        # reST and no starting newline is present
        self.add_line(u'', sourcename)

        # format the object's signature, if any
        sig = self.format_signature()

        # generate the directive header and options, if applicable
        self.add_directive_header(sig)
        self.add_line(u'', sourcename)

        # e.g. the module directive doesn't have content
        self.indent += self.content_indent

        # add all content (from docstrings, attribute docs etc.)
        self.add_content(more_content)

        # document members, if possible
        self.document_members(all_members)


class ModuleDocumenter(Documenter):
    """
    Specialized Documenter subclass for modules.
    """
    objtype = 'module'
    content_indent = u''
    titles_allowed = True

    option_spec = {
        'members': members_option, 'undoc-members': bool_option,
        'noindex': bool_option, 'inherited-members': bool_option,
        'show-inheritance': bool_option, 'synopsis': identity,
        'platform': identity, 'deprecated': bool_option,
        'member-order': identity, 'exclude-members': members_set_option,
        'private-members': bool_option, 'special-members': members_option,
        'imported-members': bool_option,
    }  # type: Dict[unicode, Callable]

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        # don't document submodules automatically
        return False

    def resolve_name(self, modname, parents, path, base):
        # type: (str, Any, str, Any) -> Tuple[str, List[unicode]]
        if modname is not None:
            self.directive.warn('"::" in automodule name doesn\'t make sense')
        return (path or '') + base, []

    def parse_name(self):
        # type: () -> bool
        ret = Documenter.parse_name(self)
        if self.args or self.retann:
            self.directive.warn('signature arguments or return annotation '
                                'given for automodule %s' % self.fullname)
        return ret

    def add_directive_header(self, sig):
        # type: (unicode) -> None
        Documenter.add_directive_header(self, sig)

        sourcename = self.get_sourcename()

        # add some module-specific options
        if self.options.synopsis:
            self.add_line(
                u'   :synopsis: ' + self.options.synopsis, sourcename)
        if self.options.platform:
            self.add_line(
                u'   :platform: ' + self.options.platform, sourcename)
        if self.options.deprecated:
            self.add_line(u'   :deprecated:', sourcename)

    def get_object_members(self, want_all):
        # type: (bool) -> Tuple[bool, List[Tuple[unicode, object]]]
        if want_all:
            if not hasattr(self.object, '__all__'):
                # for implicit module members, check __module__ to avoid
                # documenting imported objects
                return True, safe_getmembers(self.object)
            else:
                memberlist = self.object.__all__
                # Sometimes __all__ is broken...
                if not isinstance(memberlist, (list, tuple)) or not \
                   all(isinstance(entry, string_types) for entry in memberlist):
                    self.directive.warn(
                        '__all__ should be a list of strings, not %r '
                        '(in module %s) -- ignoring __all__' %
                        (memberlist, self.fullname))
                    # fall back to all members
                    return True, safe_getmembers(self.object)
        else:
            memberlist = self.options.members or []
        ret = []
        for mname in memberlist:
            try:
                ret.append((mname, safe_getattr(self.object, mname)))
            except AttributeError:
                self.directive.warn(
                    'missing attribute mentioned in :members: or __all__: '
                    'module %s, attribute %s' % (
                        safe_getattr(self.object, '__name__', '???'), mname))
        return False, ret


class ModuleLevelDocumenter(Documenter):
    """
    Specialized Documenter subclass for objects on module level (functions,
    classes, data/constants).
    """
    def resolve_name(self, modname, parents, path, base):
        # type: (str, Any, str, Any) -> Tuple[str, List[unicode]]
        if modname is None:
            if path:
                modname = path.rstrip('.')
            else:
                # if documenting a toplevel object without explicit module,
                # it can be contained in another auto directive ...
                modname = self.env.temp_data.get('autodoc:module')
                # ... or in the scope of a module directive
                if not modname:
                    modname = self.env.ref_context.get('py:module')
                # ... else, it stays None, which means invalid
        return modname, parents + [base]


class ClassLevelDocumenter(Documenter):
    """
    Specialized Documenter subclass for objects on class level (methods,
    attributes).
    """
    def resolve_name(self, modname, parents, path, base):
        # type: (str, Any, str, Any) -> Tuple[str, List[unicode]]
        if modname is None:
            if path:
                mod_cls = path.rstrip('.')
            else:
                mod_cls = None
                # if documenting a class-level object without path,
                # there must be a current class, either from a parent
                # auto directive ...
                mod_cls = self.env.temp_data.get('autodoc:class')
                # ... or from a class directive
                if mod_cls is None:
                    mod_cls = self.env.ref_context.get('py:class')
                # ... if still None, there's no way to know
                if mod_cls is None:
                    return None, []
            modname, cls = rpartition(mod_cls, '.')  # type: ignore
            parents = [cls]
            # if the module name is still missing, get it like above
            if not modname:
                modname = self.env.temp_data.get('autodoc:module')
            if not modname:
                modname = self.env.ref_context.get('py:module')
            # ... else, it stays None, which means invalid
        return modname, parents + [base]


class DocstringSignatureMixin(object):
    """
    Mixin for FunctionDocumenter and MethodDocumenter to provide the
    feature of reading the signature from the docstring.
    """

    def _find_signature(self, encoding=None):
        # type: (unicode) -> Tuple[str, str]
        docstrings = self.get_doc(encoding)
        self._new_docstrings = docstrings[:]
        result = None
        for i, doclines in enumerate(docstrings):
            # no lines in docstring, no match
            if not doclines:
                continue
            # match first line of docstring against signature RE
            match = py_ext_sig_re.match(doclines[0])  # type: ignore
            if not match:
                continue
            exmod, path, base, args, retann = match.groups()
            # the base name must match ours
            valid_names = [self.objpath[-1]]  # type: ignore
            if isinstance(self, ClassDocumenter):
                valid_names.append('__init__')
                if hasattr(self.object, '__mro__'):
                    valid_names.extend(cls.__name__ for cls in self.object.__mro__)
            if base not in valid_names:
                continue
            # re-prepare docstring to ignore more leading indentation
            self._new_docstrings[i] = prepare_docstring('\n'.join(doclines[1:]))
            result = args, retann
            # don't look any further
            break
        return result

    def get_doc(self, encoding=None, ignore=1):
        # type: (unicode, int) -> List[List[unicode]]
        lines = getattr(self, '_new_docstrings', None)
        if lines is not None:
            return lines
        return Documenter.get_doc(self, encoding, ignore)  # type: ignore

    def format_signature(self):
        # type: () -> unicode
        if self.args is None and self.env.config.autodoc_docstring_signature:  # type: ignore
            # only act if a signature is not explicitly given already, and if
            # the feature is enabled
            result = self._find_signature()
            if result is not None:
                self.args, self.retann = result
        return Documenter.format_signature(self)  # type: ignore


class DocstringStripSignatureMixin(DocstringSignatureMixin):
    """
    Mixin for AttributeDocumenter to provide the
    feature of stripping any function signature from the docstring.
    """
    def format_signature(self):
        # type: () -> unicode
        if self.args is None and self.env.config.autodoc_docstring_signature:  # type: ignore
            # only act if a signature is not explicitly given already, and if
            # the feature is enabled
            result = self._find_signature()
            if result is not None:
                # Discarding _args is a only difference with
                # DocstringSignatureMixin.format_signature.
                # Documenter.format_signature use self.args value to format.
                _args, self.retann = result
        return Documenter.format_signature(self)  # type: ignore


class FunctionDocumenter(DocstringSignatureMixin, ModuleLevelDocumenter):  # type: ignore
    """
    Specialized Documenter subclass for functions.
    """
    objtype = 'function'
    member_order = 30

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        return inspect.isfunction(member) or inspect.isbuiltin(member)

    def format_args(self):
        # type: () -> unicode
        if inspect.isbuiltin(self.object) or \
                inspect.ismethoddescriptor(self.object):
            # cannot introspect arguments of a C function or method
            return None
        try:
            argspec = getargspec(self.object)
        except TypeError:
            if (is_builtin_class_method(self.object, '__new__') and
               is_builtin_class_method(self.object, '__init__')):
                raise TypeError('%r is a builtin class' % self.object)

            # if a class should be documented as function (yay duck
            # typing) we try to use the constructor signature as function
            # signature without the first argument.
            try:
                argspec = getargspec(self.object.__new__)
            except TypeError:
                argspec = getargspec(self.object.__init__)
                if argspec[0]:
                    del argspec[0][0]
        args = formatargspec(self.object, *argspec)
        # escape backslashes for reST
        args = args.replace('\\', '\\\\')
        return args

    def document_members(self, all_members=False):
        # type: (bool) -> None
        pass


class ClassDocumenter(DocstringSignatureMixin, ModuleLevelDocumenter):  # type: ignore
    """
    Specialized Documenter subclass for classes.
    """
    objtype = 'class'
    member_order = 20
    option_spec = {
        'members': members_option, 'undoc-members': bool_option,
        'noindex': bool_option, 'inherited-members': bool_option,
        'show-inheritance': bool_option, 'member-order': identity,
        'exclude-members': members_set_option,
        'private-members': bool_option, 'special-members': members_option,
    }  # type: Dict[unicode, Callable]

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        return isinstance(member, class_types)

    def import_object(self):
        # type: () -> Any
        ret = ModuleLevelDocumenter.import_object(self)
        # if the class is documented under another name, document it
        # as data/attribute
        if ret:
            if hasattr(self.object, '__name__'):
                self.doc_as_attr = (self.objpath[-1] != self.object.__name__)
            else:
                self.doc_as_attr = True
        return ret

    def format_args(self):
        # type: () -> unicode
        # for classes, the relevant signature is the __init__ method's
        initmeth = self.get_attr(self.object, '__init__', None)
        # classes without __init__ method, default __init__ or
        # __init__ written in C?
        if initmeth is None or \
                is_builtin_class_method(self.object, '__init__') or \
                not(inspect.ismethod(initmeth) or inspect.isfunction(initmeth)):
            return None
        try:
            argspec = getargspec(initmeth)
        except TypeError:
            # still not possible: happens e.g. for old-style classes
            # with __init__ in C
            return None
        if argspec[0] and argspec[0][0] in ('cls', 'self'):
            del argspec[0][0]
        return formatargspec(initmeth, *argspec)

    def format_signature(self):
        # type: () -> unicode
        if self.doc_as_attr:
            return ''

        return DocstringSignatureMixin.format_signature(self)

    def add_directive_header(self, sig):
        # type: (unicode) -> None
        if self.doc_as_attr:
            self.directivetype = 'attribute'
        Documenter.add_directive_header(self, sig)

        # add inheritance info, if wanted
        if not self.doc_as_attr and self.options.show_inheritance:
            sourcename = self.get_sourcename()
            self.add_line(u'', sourcename)
            if hasattr(self.object, '__bases__') and len(self.object.__bases__):
                bases = [b.__module__ in ('__builtin__', 'builtins') and
                         u':class:`%s`' % b.__name__ or
                         u':class:`%s.%s`' % (b.__module__, b.__name__)
                         for b in self.object.__bases__]
                self.add_line(u'   ' + _(u'Bases: %s') % ', '.join(bases),
                              sourcename)

    def get_doc(self, encoding=None, ignore=1):
        # type: (unicode, int) -> List[List[unicode]]
        lines = getattr(self, '_new_docstrings', None)
        if lines is not None:
            return lines

        content = self.env.config.autoclass_content

        docstrings = []
        attrdocstring = self.get_attr(self.object, '__doc__', None)
        if attrdocstring:
            docstrings.append(attrdocstring)

        # for classes, what the "docstring" is can be controlled via a
        # config value; the default is only the class docstring
        if content in ('both', 'init'):
            initdocstring = self.get_attr(
                self.get_attr(self.object, '__init__', None), '__doc__')
            # for new-style classes, no __init__ means default __init__
            if (initdocstring is not None and
                (initdocstring == object.__init__.__doc__ or  # for pypy
                 initdocstring.strip() == object.__init__.__doc__)):  # for !pypy
                initdocstring = None
            if not initdocstring:
                # try __new__
                initdocstring = self.get_attr(
                    self.get_attr(self.object, '__new__', None), '__doc__')
                # for new-style classes, no __new__ means default __new__
                if (initdocstring is not None and
                    (initdocstring == object.__new__.__doc__ or  # for pypy
                     initdocstring.strip() == object.__new__.__doc__)):  # for !pypy
                    initdocstring = None
            if initdocstring:
                if content == 'init':
                    docstrings = [initdocstring]
                else:
                    docstrings.append(initdocstring)
        doc = []
        for docstring in docstrings:
            if isinstance(docstring, text_type):
                doc.append(prepare_docstring(docstring, ignore))
            elif isinstance(docstring, str):  # this will not trigger on Py3
                doc.append(prepare_docstring(force_decode(docstring, encoding),
                                             ignore))
        return doc

    def add_content(self, more_content, no_docstring=False):
        # type: (Any, bool) -> None
        if self.doc_as_attr:
            classname = safe_getattr(self.object, '__name__', None)
            if classname:
                content = ViewList(
                    [_('alias of :class:`%s`') % classname], source='')
                ModuleLevelDocumenter.add_content(self, content,
                                                  no_docstring=True)
        else:
            ModuleLevelDocumenter.add_content(self, more_content)

    def document_members(self, all_members=False):
        # type: (bool) -> None
        if self.doc_as_attr:
            return
        ModuleLevelDocumenter.document_members(self, all_members)


class ExceptionDocumenter(ClassDocumenter):
    """
    Specialized ClassDocumenter subclass for exceptions.
    """
    objtype = 'exception'
    member_order = 10

    # needs a higher priority than ClassDocumenter
    priority = 10

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        return isinstance(member, class_types) and \
            issubclass(member, BaseException)  # type: ignore


class DataDocumenter(ModuleLevelDocumenter):
    """
    Specialized Documenter subclass for data items.
    """
    objtype = 'data'
    member_order = 40
    priority = -10
    option_spec = dict(ModuleLevelDocumenter.option_spec)
    option_spec["annotation"] = annotation_option

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        return isinstance(parent, ModuleDocumenter) and isattr

    def add_directive_header(self, sig):
        # type: (unicode) -> None
        ModuleLevelDocumenter.add_directive_header(self, sig)
        sourcename = self.get_sourcename()
        if not self.options.annotation:
            try:
                objrepr = object_description(self.object)
            except ValueError:
                pass
            else:
                self.add_line(u'   :annotation: = ' + objrepr, sourcename)
        elif self.options.annotation is SUPPRESS:
            pass
        else:
            self.add_line(u'   :annotation: %s' % self.options.annotation,
                          sourcename)

    def document_members(self, all_members=False):
        # type: (bool) -> None
        pass


class MethodDocumenter(DocstringSignatureMixin, ClassLevelDocumenter):  # type: ignore
    """
    Specialized Documenter subclass for methods (normal, static and class).
    """
    objtype = 'method'
    member_order = 50
    priority = 1  # must be more than FunctionDocumenter

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        return inspect.isroutine(member) and \
            not isinstance(parent, ModuleDocumenter)

    def import_object(self):
        # type: () -> Any
        ret = ClassLevelDocumenter.import_object(self)
        if not ret:
            return ret

        # to distinguish classmethod/staticmethod
        obj = self.parent.__dict__.get(self.object_name)

        if isinstance(obj, classmethod):
            self.directivetype = 'classmethod'
            # document class and static members before ordinary ones
            self.member_order = self.member_order - 1
        elif isinstance(obj, staticmethod):
            self.directivetype = 'staticmethod'
            # document class and static members before ordinary ones
            self.member_order = self.member_order - 1
        else:
            self.directivetype = 'method'
        return ret

    def format_args(self):
        # type: () -> unicode
        if inspect.isbuiltin(self.object) or \
                inspect.ismethoddescriptor(self.object):
            # can never get arguments of a C function or method
            return None
        argspec = getargspec(self.object)
        if argspec[0] and argspec[0][0] in ('cls', 'self'):
            del argspec[0][0]
        args = formatargspec(self.object, *argspec)
        # escape backslashes for reST
        args = args.replace('\\', '\\\\')
        return args

    def document_members(self, all_members=False):
        # type: (bool) -> None
        pass


class AttributeDocumenter(DocstringStripSignatureMixin, ClassLevelDocumenter):  # type: ignore
    """
    Specialized Documenter subclass for attributes.
    """
    objtype = 'attribute'
    member_order = 60
    option_spec = dict(ModuleLevelDocumenter.option_spec)
    option_spec["annotation"] = annotation_option

    # must be higher than the MethodDocumenter, else it will recognize
    # some non-data descriptors as methods
    priority = 10

    @staticmethod
    def is_function_or_method(obj):
        return inspect.isfunction(obj) or inspect.isbuiltin(obj) or inspect.ismethod(obj)

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        non_attr_types = (type, MethodDescriptorType)
        isdatadesc = isdescriptor(member) and not \
            cls.is_function_or_method(member) and not \
            isinstance(member, non_attr_types) and not \
            type(member).__name__ == "instancemethod"
        # That last condition addresses an obscure case of C-defined
        # methods using a deprecated type in Python 3, that is not otherwise
        # exported anywhere by Python
        return isdatadesc or (not isinstance(parent, ModuleDocumenter) and
                              not inspect.isroutine(member) and
                              not isinstance(member, class_types))

    def document_members(self, all_members=False):
        # type: (bool) -> None
        pass

    def import_object(self):
        # type: () -> Any
        ret = ClassLevelDocumenter.import_object(self)
        if isenumattribute(self.object):
            self.object = self.object.value
        if isdescriptor(self.object) and \
                not self.is_function_or_method(self.object):
            self._datadescriptor = True
        else:
            # if it's not a data descriptor
            self._datadescriptor = False
        return ret

    def get_real_modname(self):
        # type: () -> str
        return self.get_attr(self.parent or self.object, '__module__', None) \
            or self.modname

    def add_directive_header(self, sig):
        # type: (unicode) -> None
        ClassLevelDocumenter.add_directive_header(self, sig)
        sourcename = self.get_sourcename()
        if not self.options.annotation:
            if not self._datadescriptor:
                try:
                    objrepr = object_description(self.object)
                except ValueError:
                    pass
                else:
                    self.add_line(u'   :annotation: = ' + objrepr, sourcename)
        elif self.options.annotation is SUPPRESS:
            pass
        else:
            self.add_line(u'   :annotation: %s' % self.options.annotation,
                          sourcename)

    def add_content(self, more_content, no_docstring=False):
        # type: (Any, bool) -> None
        if not self._datadescriptor:
            # if it's not a data descriptor, its docstring is very probably the
            # wrong thing to display
            no_docstring = True
        ClassLevelDocumenter.add_content(self, more_content, no_docstring)


class InstanceAttributeDocumenter(AttributeDocumenter):
    """
    Specialized Documenter subclass for attributes that cannot be imported
    because they are instance attributes (e.g. assigned in __init__).
    """
    objtype = 'instanceattribute'
    directivetype = 'attribute'
    member_order = 60

    # must be higher than AttributeDocumenter
    priority = 11

    @classmethod
    def can_document_member(cls, member, membername, isattr, parent):
        # type: (Any, unicode, bool, Any) -> bool
        """This documents only INSTANCEATTR members."""
        return isattr and (member is INSTANCEATTR)

    def import_object(self):
        # type: () -> bool
        """Never import anything."""
        # disguise as an attribute
        self.objtype = 'attribute'
        self._datadescriptor = False
        return True

    def add_content(self, more_content, no_docstring=False):
        # type: (Any, bool) -> None
        """Never try to get a docstring from the object."""
        AttributeDocumenter.add_content(self, more_content, no_docstring=True)


class AutoDirective(Directive):
    """
    The AutoDirective class is used for all autodoc directives.  It dispatches
    most of the work to one of the Documenters, which it selects through its
    *_registry* dictionary.

    The *_special_attrgetters* attribute is used to customize ``getattr()``
    calls that the Documenters make; its entries are of the form ``type:
    getattr_function``.

    Note: When importing an object, all items along the import chain are
    accessed using the descendant's *_special_attrgetters*, thus this
    dictionary should include all necessary functions for accessing
    attributes of the parents.
    """
    # a registry of objtype -> documenter class
    _registry = {}  # type: Dict[unicode, Type[Documenter]]

    # a registry of type -> getattr function
    _special_attrgetters = {}  # type: Dict[Type, Callable]

    # flags that can be given in autodoc_default_flags
    _default_flags = set([
        'members', 'undoc-members', 'inherited-members', 'show-inheritance',
        'private-members', 'special-members',
    ])

    # standard docutils directive settings
    has_content = True
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    # allow any options to be passed; the options are parsed further
    # by the selected Documenter
    option_spec = DefDict(identity)

    def warn(self, msg):
        # type: (unicode) -> None
        self.warnings.append(self.reporter.warning(msg, line=self.lineno))

    def run(self):
        # type: () -> List[nodes.Node]
        self.filename_set = set()   # type: Set[unicode]
                                    # a set of dependent filenames
        self.reporter = self.state.document.reporter
        self.env = self.state.document.settings.env
        self.warnings = []  # type: List[unicode]
        self.result = ViewList()

        try:
            source, lineno = self.reporter.get_source_and_line(self.lineno)
        except AttributeError:
            source = lineno = None
        logger.debug('[autodoc] %s:%s: input:\n%s',
                     source, lineno, self.block_text)

        # find out what documenter to call
        objtype = self.name[4:]
        doc_class = self._registry[objtype]
        # add default flags
        for flag in self._default_flags:
            if flag not in doc_class.option_spec:
                continue
            negated = self.options.pop('no-' + flag, 'not given') is None
            if flag in self.env.config.autodoc_default_flags and \
               not negated:
                self.options[flag] = None
        # process the options with the selected documenter's option_spec
        try:
            self.genopt = Options(assemble_option_dict(
                self.options.items(), doc_class.option_spec))
        except (KeyError, ValueError, TypeError) as err:
            # an option is either unknown or has a wrong type
            msg = self.reporter.error('An option to %s is either unknown or '
                                      'has an invalid value: %s' % (self.name, err),
                                      line=self.lineno)
            return [msg]
        # generate the output
        documenter = doc_class(self, self.arguments[0])
        documenter.generate(more_content=self.content)
        if not self.result:
            return self.warnings

        logger.debug('[autodoc] output:\n%s', '\n'.join(self.result))

        # record all filenames as dependencies -- this will at least
        # partially make automatic invalidation possible
        for fn in self.filename_set:
            self.state.document.settings.record_dependencies.add(fn)

        # use a custom reporter that correctly assigns lines to source
        # filename/description and lineno
        old_reporter = self.state.memo.reporter
        self.state.memo.reporter = AutodocReporter(self.result,
                                                   self.state.memo.reporter)

        if documenter.titles_allowed:
            node = nodes.section()
            # necessary so that the child nodes get the right source/line set
            node.document = self.state.document
            nested_parse_with_titles(self.state, self.result, node)
        else:
            node = nodes.paragraph()
            node.document = self.state.document
            self.state.nested_parse(self.result, 0, node)
        self.state.memo.reporter = old_reporter
        return self.warnings + node.children


def add_documenter(cls):
    # type: (Type[Documenter]) -> None
    """Register a new Documenter."""
    if not issubclass(cls, Documenter):
        raise ExtensionError('autodoc documenter %r must be a subclass '
                             'of Documenter' % cls)
    # actually, it should be possible to override Documenters
    # if cls.objtype in AutoDirective._registry:
    #    raise ExtensionError('autodoc documenter for %r is already '
    #                         'registered' % cls.objtype)
    AutoDirective._registry[cls.objtype] = cls


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    app.add_autodocumenter(ModuleDocumenter)
    app.add_autodocumenter(ClassDocumenter)
    app.add_autodocumenter(ExceptionDocumenter)
    app.add_autodocumenter(DataDocumenter)
    app.add_autodocumenter(FunctionDocumenter)
    app.add_autodocumenter(MethodDocumenter)
    app.add_autodocumenter(AttributeDocumenter)
    app.add_autodocumenter(InstanceAttributeDocumenter)

    app.add_config_value('autoclass_content', 'class', True)
    app.add_config_value('autodoc_member_order', 'alphabetic', True)
    app.add_config_value('autodoc_default_flags', [], True)
    app.add_config_value('autodoc_docstring_signature', True, True)
    app.add_config_value('autodoc_mock_imports', [], True)
    app.add_event('autodoc-process-docstring')
    app.add_event('autodoc-process-signature')
    app.add_event('autodoc-skip-member')

    return {'version': sphinx.__display_version__, 'parallel_read_safe': True}


class testcls:
    """test doc string"""

    def __getattr__(self, x):
        # type: (Any) -> Any
        return x

    def __setattr__(self, x, y):
        # type: (Any, Any) -> None
        """Attr setter."""
