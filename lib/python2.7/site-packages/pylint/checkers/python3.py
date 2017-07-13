# Copyright (c) 2014-2015 Brett Cannon <brett@python.org>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Pavel Roskin <proski@gnu.org>
# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Check Python 2 code for Python 2/3 source-compatible issues."""
from __future__ import absolute_import, print_function

import re
import sys
import tokenize

from collections import namedtuple

import six

import astroid
from astroid import bases

from pylint import checkers, interfaces
from pylint.interfaces import INFERENCE_FAILURE, INFERENCE
from pylint.utils import WarningScope
from pylint.checkers import utils


_ZERO = re.compile("^0+$")

def _is_old_octal(literal):
    if _ZERO.match(literal):
        return False
    if re.match(r'0\d+', literal):
        try:
            int(literal, 8)
        except ValueError:
            return False
        return True

def _check_dict_node(node):
    inferred_types = set()
    try:
        inferred = node.infer()
        for inferred_node in inferred:
            inferred_types.add(inferred_node)
    except astroid.InferenceError:
        pass
    return (not inferred_types
            or any(isinstance(x, astroid.Dict) for x in inferred_types))

def _is_builtin(node):
    return getattr(node, 'name', None) in ('__builtin__', 'builtins')

_ACCEPTS_ITERATOR = {'iter', 'list', 'tuple', 'sorted', 'set', 'sum', 'any',
                     'all', 'enumerate', 'dict'}

def _in_iterating_context(node):
    """Check if the node is being used as an iterator.

    Definition is taken from lib2to3.fixer_util.in_special_context().
    """
    parent = node.parent
    # Since a call can't be the loop variant we only need to know if the node's
    # parent is a 'for' loop to know it's being used as the iterator for the
    # loop.
    if isinstance(parent, astroid.For):
        return True
    # Need to make sure the use of the node is in the iterator part of the
    # comprehension.
    elif isinstance(parent, astroid.Comprehension):
        if parent.iter == node:
            return True
    # Various built-ins can take in an iterable or list and lead to the same
    # value.
    elif isinstance(parent, astroid.Call):
        if isinstance(parent.func, astroid.Name):
            parent_scope = parent.func.lookup(parent.func.name)[0]
            if _is_builtin(parent_scope) and parent.func.name in _ACCEPTS_ITERATOR:
                return True
        elif isinstance(parent.func, astroid.Attribute):
            if parent.func.attrname == 'join':
                return True
    # If the call is in an unpacking, there's no need to warn,
    # since it can be considered iterating.
    elif (isinstance(parent, astroid.Assign) and
          isinstance(parent.targets[0], (astroid.List, astroid.Tuple))):
        if len(parent.targets[0].elts) > 1:
            return True
    return False


def _is_conditional_import(node):
    """Checks if a import node is in the context of a conditional.
    """
    parent = node.parent
    return isinstance(parent, (astroid.TryExcept, astroid.ExceptHandler,
                               astroid.If, astroid.IfExp))

Branch = namedtuple('Branch', ['node', 'is_py2_only'])

class Python3Checker(checkers.BaseChecker):

    __implements__ = interfaces.IAstroidChecker
    enabled = False
    name = 'python3'

    msgs = {
        # Errors for what will syntactically break in Python 3, warnings for
        # everything else.
        'E1601': ('print statement used',
                  'print-statement',
                  'Used when a print statement is used '
                  '(`print` is a function in Python 3)',
                  {'maxversion': (3, 0)}),
        'E1602': ('Parameter unpacking specified',
                  'parameter-unpacking',
                  'Used when parameter unpacking is specified for a function'
                  "(Python 3 doesn't allow it)",
                  {'maxversion': (3, 0)}),
        'E1603': ('Implicit unpacking of exceptions is not supported '
                  'in Python 3',
                  'unpacking-in-except',
                  'Python3 will not allow implicit unpacking of '
                  'exceptions in except clauses. '
                  'See http://www.python.org/dev/peps/pep-3110/',
                  {'maxversion': (3, 0),
                   'old_names': [('W0712', 'unpacking-in-except')]}),
        'E1604': ('Use raise ErrorClass(args) instead of '
                  'raise ErrorClass, args.',
                  'old-raise-syntax',
                  "Used when the alternate raise syntax "
                  "'raise foo, bar' is used "
                  "instead of 'raise foo(bar)'.",
                  {'maxversion': (3, 0),
                   'old_names': [('W0121', 'old-raise-syntax')]}),
        'E1605': ('Use of the `` operator',
                  'backtick',
                  'Used when the deprecated "``" (backtick) operator is used '
                  'instead  of the str() function.',
                  {'scope': WarningScope.NODE,
                   'maxversion': (3, 0),
                   'old_names': [('W0333', 'backtick')]}),
        'E1609': ('Import * only allowed at module level',
                  'import-star-module-level',
                  'Used when the import star syntax is used somewhere '
                  'else than the module level.',
                  {'maxversion': (3, 0)}),
        'W1601': ('apply built-in referenced',
                  'apply-builtin',
                  'Used when the apply built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1602': ('basestring built-in referenced',
                  'basestring-builtin',
                  'Used when the basestring built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1603': ('buffer built-in referenced',
                  'buffer-builtin',
                  'Used when the buffer built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1604': ('cmp built-in referenced',
                  'cmp-builtin',
                  'Used when the cmp built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1605': ('coerce built-in referenced',
                  'coerce-builtin',
                  'Used when the coerce built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1606': ('execfile built-in referenced',
                  'execfile-builtin',
                  'Used when the execfile built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1607': ('file built-in referenced',
                  'file-builtin',
                  'Used when the file built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1608': ('long built-in referenced',
                  'long-builtin',
                  'Used when the long built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1609': ('raw_input built-in referenced',
                  'raw_input-builtin',
                  'Used when the raw_input built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1610': ('reduce built-in referenced',
                  'reduce-builtin',
                  'Used when the reduce built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1611': ('StandardError built-in referenced',
                  'standarderror-builtin',
                  'Used when the StandardError built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1612': ('unicode built-in referenced',
                  'unicode-builtin',
                  'Used when the unicode built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1613': ('xrange built-in referenced',
                  'xrange-builtin',
                  'Used when the xrange built-in function is referenced '
                  '(missing from Python 3)',
                  {'maxversion': (3, 0)}),
        'W1614': ('__coerce__ method defined',
                  'coerce-method',
                  'Used when a __coerce__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1615': ('__delslice__ method defined',
                  'delslice-method',
                  'Used when a __delslice__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1616': ('__getslice__ method defined',
                  'getslice-method',
                  'Used when a __getslice__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1617': ('__setslice__ method defined',
                  'setslice-method',
                  'Used when a __setslice__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1618': ('import missing `from __future__ import absolute_import`',
                  'no-absolute-import',
                  'Used when an import is not accompanied by '
                  '``from __future__ import absolute_import`` '
                  '(default behaviour in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1619': ('division w/o __future__ statement',
                  'old-division',
                  'Used for non-floor division w/o a float literal or '
                  '``from __future__ import division`` '
                  '(Python 3 returns a float for int division unconditionally)',
                  {'maxversion': (3, 0)}),
        'W1620': ('Calling a dict.iter*() method',
                  'dict-iter-method',
                  'Used for calls to dict.iterkeys(), itervalues() or iteritems() '
                  '(Python 3 lacks these methods)',
                  {'maxversion': (3, 0)}),
        'W1621': ('Calling a dict.view*() method',
                  'dict-view-method',
                  'Used for calls to dict.viewkeys(), viewvalues() or viewitems() '
                  '(Python 3 lacks these methods)',
                  {'maxversion': (3, 0)}),
        'W1622': ('Called a next() method on an object',
                  'next-method-called',
                  "Used when an object's next() method is called "
                  '(Python 3 uses the next() built-in function)',
                  {'maxversion': (3, 0)}),
        'W1623': ("Assigning to a class's __metaclass__ attribute",
                  'metaclass-assignment',
                  "Used when a metaclass is specified by assigning to __metaclass__ "
                  '(Python 3 specifies the metaclass as a class statement argument)',
                  {'maxversion': (3, 0)}),
        'W1624': ('Indexing exceptions will not work on Python 3',
                  'indexing-exception',
                  'Indexing exceptions will not work on Python 3. Use '
                  '`exception.args[index]` instead.',
                  {'maxversion': (3, 0),
                   'old_names': [('W0713', 'indexing-exception')]}),
        'W1625': ('Raising a string exception',
                  'raising-string',
                  'Used when a string exception is raised. This will not '
                  'work on Python 3.',
                  {'maxversion': (3, 0),
                   'old_names': [('W0701', 'raising-string')]}),
        'W1626': ('reload built-in referenced',
                  'reload-builtin',
                  'Used when the reload built-in function is referenced '
                  '(missing from Python 3). You can use instead imp.reload '
                  'or importlib.reload.',
                  {'maxversion': (3, 0)}),
        'W1627': ('__oct__ method defined',
                  'oct-method',
                  'Used when a __oct__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1628': ('__hex__ method defined',
                  'hex-method',
                  'Used when a __hex__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1629': ('__nonzero__ method defined',
                  'nonzero-method',
                  'Used when a __nonzero__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1630': ('__cmp__ method defined',
                  'cmp-method',
                  'Used when a __cmp__ method is defined '
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        # 'W1631': replaced by W1636
        'W1632': ('input built-in referenced',
                  'input-builtin',
                  'Used when the input built-in is referenced '
                  '(backwards-incompatible semantics in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1633': ('round built-in referenced',
                  'round-builtin',
                  'Used when the round built-in is referenced '
                  '(backwards-incompatible semantics in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1634': ('intern built-in referenced',
                  'intern-builtin',
                  'Used when the intern built-in is referenced '
                  '(Moved to sys.intern in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1635': ('unichr built-in referenced',
                  'unichr-builtin',
                  'Used when the unichr built-in is referenced '
                  '(Use chr in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1636': ('map built-in referenced when not iterating',
                  'map-builtin-not-iterating',
                  'Used when the map built-in is referenced in a non-iterating '
                  'context (returns an iterator in Python 3)',
                  {'maxversion': (3, 0),
                   'old_names': [('W1631', 'implicit-map-evaluation')]}),
        'W1637': ('zip built-in referenced when not iterating',
                  'zip-builtin-not-iterating',
                  'Used when the zip built-in is referenced in a non-iterating '
                  'context (returns an iterator in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1638': ('range built-in referenced when not iterating',
                  'range-builtin-not-iterating',
                  'Used when the range built-in is referenced in a non-iterating '
                  'context (returns an iterator in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1639': ('filter built-in referenced when not iterating',
                  'filter-builtin-not-iterating',
                  'Used when the filter built-in is referenced in a non-iterating '
                  'context (returns an iterator in Python 3)',
                  {'maxversion': (3, 0)}),
        'W1640': ('Using the cmp argument for list.sort / sorted',
                  'using-cmp-argument',
                  'Using the cmp argument for list.sort or the sorted '
                  'builtin should be avoided, since it was removed in '
                  'Python 3. Using either `key` or `functools.cmp_to_key` '
                  'should be preferred.',
                  {'maxversion': (3, 0)}),
        'W1641': ('Implementing __eq__ without also implementing __hash__',
                  'eq-without-hash',
                  'Used when a class implements __eq__ but not __hash__.  In Python 2, objects '
                  'get object.__hash__ as the default implementation, in Python 3 objects get '
                  'None as their default __hash__ implementation if they also implement __eq__.',
                  {'maxversion': (3, 0)}),
        'W1642': ('__div__ method defined',
                  'div-method',
                  'Used when a __div__ method is defined.  Using `__truediv__` and setting'
                  '__div__ = __truediv__ should be preferred.'
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1643': ('__idiv__ method defined',
                  'idiv-method',
                  'Used when a __idiv__ method is defined.  Using `__itruediv__` and setting'
                  '__idiv__ = __itruediv__ should be preferred.'
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1644': ('__rdiv__ method defined',
                  'rdiv-method',
                  'Used when a __rdiv__ method is defined.  Using `__rtruediv__` and setting'
                  '__rdiv__ = __rtruediv__ should be preferred.'
                  '(method is not used by Python 3)',
                  {'maxversion': (3, 0)}),
        'W1645': ('Exception.message removed in Python 3',
                  'exception-message-attribute',
                  'Used when the message attribute is accessed on an Exception.  Use '
                  'str(exception) instead.',
                  {'maxversion': (3, 0)}),
        'W1646': ('non-text encoding used in str.decode',
                  'invalid-str-codec',
                  'Used when using str.encode or str.decode with a non-text encoding.  Use '
                  'codecs module to handle arbitrary codecs.',
                  {'maxversion': (3, 0)}),
        'W1647': ('sys.maxint removed in Python 3',
                  'sys-max-int',
                  'Used when accessing sys.maxint.  Use sys.maxsize instead.',
                  {'maxversion': (3, 0)}),
        'W1648': ('Module moved in Python 3',
                  'bad-python3-import',
                  'Used when importing a module that no longer exists in Python 3.',
                  {'maxversion': (3, 0)}),
        'W1649': ('Accessing a function method on the string module',
                  'deprecated-string-function',
                  'Used when accessing a string function that has been deprecated in Python 3.',
                  {'maxversion': (3, 0)}),
        'W1650': ('Using str.translate with deprecated deletechars parameters',
                  'deprecated-str-translate-call',
                  'Used when using the deprecated deletechars parameters from str.translate.  Use'
                  're.sub to remove the desired characters ',
                  {'maxversion': (3, 0)}),
    }

    _bad_builtins = frozenset([
        'apply',
        'basestring',
        'buffer',
        'cmp',
        'coerce',
        'execfile',
        'file',
        'input',  # Not missing, but incompatible semantics
        'intern',
        'long',
        'raw_input',
        'reduce',
        'round',  # Not missing, but incompatible semantics
        'StandardError',
        'unichr',
        'unicode',
        'xrange',
        'reload',
    ])

    _unused_magic_methods = frozenset([
        '__coerce__',
        '__delslice__',
        '__getslice__',
        '__setslice__',
        '__oct__',
        '__hex__',
        '__nonzero__',
        '__cmp__',
        '__div__',
        '__idiv__',
        '__rdiv__',
    ])

    _invalid_encodings = frozenset([
        'base64_codec',
        'base64',
        'base_64',
        'bz2_codec',
        'bz2',
        'hex_codec',
        'hex',
        'quopri_codec',
        'quopri',
        'quotedprintable',
        'quoted_printable',
        'uu_codec',
        'uu',
        'zlib_codec',
        'zlib',
        'zip',
        'rot13',
        'rot_13',
    ])

    _bad_python3_module_map = {
        'sys-max-int': {
            'sys': frozenset(['maxint'])
        },
        'bad-python3-import': frozenset([
            'anydbm', 'BaseHTTPServer', '__builtin__', 'CGIHTTPServer', 'ConfigParser', 'copy_reg',
            'cPickle', 'cProfile', 'cStringIO', 'Cookie', 'cookielib', 'dbhash', 'dbm', 'dumbdbm',
            'dumbdb', 'Dialog', 'DocXMLRPCServer', 'FileDialog', 'FixTk', 'gdbm', 'htmlentitydefs',
            'HTMLParser', 'httplib', 'markupbase', 'Queue', 'repr', 'robotparser', 'ScrolledText',
            'SimpleDialog', 'SimpleHTTPServer', 'SimpleXMLRPCServer', 'StringIO', 'dummy_thread',
            'SocketServer', 'test.test_support', 'Tkinter', 'Tix', 'Tkconstants', 'tkColorChooser',
            'tkCommonDialog', 'Tkdnd', 'tkFileDialog', 'tkFont', 'tkMessageBox', 'tkSimpleDialog',
            'turtle', 'UserList', 'UserString', 'whichdb', '_winreg', 'xmlrpclib', 'audiodev',
            'Bastion', 'bsddb185', 'bsddb3', 'Canvas', 'cfmfile', 'cl', 'commands', 'compiler',
            'dircache', 'dl', 'exception', 'fpformat', 'htmllib', 'ihooks', 'imageop', 'imputil',
            'linuxaudiodev', 'md5', 'mhlib', 'mimetools', 'MimeWriter', 'mimify', 'multifile',
            'mutex', 'new', 'popen2', 'posixfile', 'pure', 'rexec', 'rfc822', 'sha', 'sgmllib',
            'sre', 'stat', 'stringold', 'sunaudio', 'sv', 'test.testall', 'thread', 'timing',
            'toaiff', 'user', 'urllib2', 'urlparse'
        ]),
        'deprecated-string-function': {
            'string': frozenset([
                'maketrans', 'atof', 'atoi', 'atol', 'capitalize', 'expandtabs', 'find', 'rfind',
                'index', 'rindex', 'count', 'lower', 'split', 'rsplit', 'splitfields', 'join',
                'joinfields', 'lstrip', 'rstrip', 'strip', 'swapcase', 'translate', 'upper',
                'ljust', 'rjust', 'center', 'zfill', 'replace'
            ])
        }
    }

    if (3, 4) <= sys.version_info < (3, 4, 4):
        # Python 3.4.0 -> 3.4.3 has a bug which breaks `repr_tree()`:
        # https://bugs.python.org/issue23572
        _python_2_tests = frozenset()
    else:
        _python_2_tests = frozenset(
            [astroid.extract_node(x).repr_tree() for x in [
                'sys.version_info[0] == 2',
                'sys.version_info[0] < 3',
                'sys.version_info == (2, 7)',
                'sys.version_info <= (2, 7)',
                'sys.version_info < (3, 0)',
            ]])

    def __init__(self, *args, **kwargs):
        self._future_division = False
        self._future_absolute_import = False
        self._modules_warned_about = set()
        self._branch_stack = []
        super(Python3Checker, self).__init__(*args, **kwargs)

    def add_message(self, msg_id, always_warn=False,  # pylint: disable=arguments-differ
                    *args, **kwargs):
        if always_warn or not (self._branch_stack and self._branch_stack[-1].is_py2_only):
            super(Python3Checker, self).add_message(msg_id, *args, **kwargs)

    def _is_py2_test(self, node):
        if isinstance(node.test, astroid.Attribute) and isinstance(node.test.expr, astroid.Name):
            if node.test.expr.name == 'six' and node.test.attrname == 'PY2':
                return True
        elif (isinstance(node.test, astroid.Compare) and
              node.test.repr_tree() in self._python_2_tests):
            return True
        return False

    def visit_if(self, node):
        self._branch_stack.append(Branch(node, self._is_py2_test(node)))

    def leave_if(self, node):
        assert self._branch_stack.pop().node == node

    def visit_ifexp(self, node):
        self._branch_stack.append(Branch(node, self._is_py2_test(node)))

    def leave_ifexp(self, node):
        assert self._branch_stack.pop().node == node

    def visit_module(self, node):  # pylint: disable=unused-argument
        """Clear checker state after previous module."""
        self._future_division = False
        self._future_absolute_import = False

    def visit_functiondef(self, node):
        if node.is_method() and node.name in self._unused_magic_methods:
            method_name = node.name
            if node.name.startswith('__'):
                method_name = node.name[2:-2]
            self.add_message(method_name + '-method', node=node)

    @utils.check_messages('parameter-unpacking')
    def visit_arguments(self, node):
        for arg in node.args:
            if isinstance(arg, astroid.Tuple):
                self.add_message('parameter-unpacking', node=arg)

    def visit_name(self, node):
        """Detect when a "bad" built-in is referenced."""
        found_node = node.lookup(node.name)[0]
        if _is_builtin(found_node):
            if node.name in self._bad_builtins:
                message = node.name.lower() + '-builtin'
                self.add_message(message, node=node)

    @utils.check_messages('print-statement')
    def visit_print(self, node):
        self.add_message('print-statement', node=node, always_warn=True)

    def _warn_if_deprecated(self, node, module, attributes, report_on_modules=True):
        for message, module_map in six.iteritems(self._bad_python3_module_map):
            if module in module_map and module not in self._modules_warned_about:
                if isinstance(module_map, frozenset):
                    if report_on_modules:
                        self._modules_warned_about.add(module)
                        self.add_message(message, node=node)
                elif attributes and module_map[module].intersection(attributes):
                    self.add_message(message, node=node)

    def visit_importfrom(self, node):
        if node.modname == '__future__':
            for name, _ in node.names:
                if name == 'division':
                    self._future_division = True
                elif name == 'absolute_import':
                    self._future_absolute_import = True
        else:
            if not self._future_absolute_import:
                if self.linter.is_message_enabled('no-absolute-import'):
                    self.add_message('no-absolute-import', node=node)
            if not _is_conditional_import(node):
                self._warn_if_deprecated(node, node.modname, {x[0] for x in node.names})

        if node.names[0][0] == '*':
            if self.linter.is_message_enabled('import-star-module-level'):
                if not isinstance(node.scope(), astroid.Module):
                    self.add_message('import-star-module-level', node=node)

    def visit_import(self, node):
        if not self._future_absolute_import:
            self.add_message('no-absolute-import', node=node)
        if not _is_conditional_import(node):
            for name, _ in node.names:
                self._warn_if_deprecated(node, name, None)

    @utils.check_messages('metaclass-assignment')
    def visit_classdef(self, node):
        if '__metaclass__' in node.locals:
            self.add_message('metaclass-assignment', node=node)
        locals_and_methods = set(node.locals).union(x.name for x in node.mymethods())
        if '__eq__' in locals_and_methods and '__hash__' not in locals_and_methods:
            self.add_message('eq-without-hash', node=node)

    @utils.check_messages('old-division')
    def visit_binop(self, node):
        if not self._future_division and node.op == '/':
            for arg in (node.left, node.right):
                if isinstance(arg, astroid.Const) and isinstance(arg.value, float):
                    break
            else:
                self.add_message('old-division', node=node)

    def _check_cmp_argument(self, node):
        # Check that the `cmp` argument is used
        kwargs = []
        if (isinstance(node.func, astroid.Attribute)
                and node.func.attrname == 'sort'):
            inferred = utils.safe_infer(node.func.expr)
            if not inferred:
                return

            builtins_list = "{}.list".format(bases.BUILTINS)
            if (isinstance(inferred, astroid.List)
                    or inferred.qname() == builtins_list):
                kwargs = node.keywords

        elif (isinstance(node.func, astroid.Name)
              and node.func.name == 'sorted'):
            inferred = utils.safe_infer(node.func)
            if not inferred:
                return

            builtins_sorted = "{}.sorted".format(bases.BUILTINS)
            if inferred.qname() == builtins_sorted:
                kwargs = node.keywords

        for kwarg in kwargs or []:
            if kwarg.arg == 'cmp':
                self.add_message('using-cmp-argument', node=node)
                return

    @staticmethod
    def _is_constant_string_or_name(node):
        if isinstance(node, astroid.Const):
            return isinstance(node.value, six.string_types)
        return isinstance(node, astroid.Name)

    @staticmethod
    def _is_none(node):
        return isinstance(node, astroid.Const) and node.value is None

    @staticmethod
    def _has_only_n_positional_args(node, number_of_args):
        return len(node.args) == number_of_args and all(node.args) and not node.keywords

    @staticmethod
    def _could_be_string(inferred_types):
        confidence = INFERENCE if inferred_types else INFERENCE_FAILURE
        for inferred_type in inferred_types:
            if inferred_type is astroid.Uninferable:
                confidence = INFERENCE_FAILURE
            elif not (isinstance(inferred_type, astroid.Const) and
                      isinstance(inferred_type.value, six.string_types)):
                return None
        return confidence

    def visit_call(self, node):
        self._check_cmp_argument(node)

        if isinstance(node.func, astroid.Attribute):
            inferred_types = set()
            try:
                for inferred_receiver in node.func.expr.infer():
                    inferred_types.add(inferred_receiver)
                    if isinstance(inferred_receiver, astroid.Module):
                        self._warn_if_deprecated(node, inferred_receiver.name,
                                                 {node.func.attrname},
                                                 report_on_modules=False)
            except astroid.InferenceError:
                pass
            if node.args:
                is_str_confidence = self._could_be_string(inferred_types)
                if is_str_confidence:
                    if (node.func.attrname in ('encode', 'decode') and
                            len(node.args) >= 1 and node.args[0]):
                        first_arg = node.args[0]
                        self._validate_encoding(first_arg, node)
                    if (node.func.attrname == 'translate' and
                            self._has_only_n_positional_args(node, 2) and
                            self._is_none(node.args[0]) and
                            self._is_constant_string_or_name(node.args[1])):
                        # The above statement looking for calls of the form:
                        #
                        # foo.translate(None, 'abc123')
                        #
                        # or
                        #
                        # foo.translate(None, some_variable)
                        #
                        # This check is somewhat broad and _may_ have some false positives, but
                        # after checking several large codebases it did not have any false
                        # positives while finding several real issues.  This call pattern seems
                        # rare enough that the trade off is worth it.
                        self.add_message('deprecated-str-translate-call',
                                         node=node,
                                         confidence=is_str_confidence)
                return
            if node.keywords:
                return
            if node.func.attrname == 'next':
                self.add_message('next-method-called', node=node)
            else:
                if _check_dict_node(node.func.expr):
                    if node.func.attrname in ('iterkeys', 'itervalues', 'iteritems'):
                        self.add_message('dict-iter-method', node=node)
                    elif node.func.attrname in ('viewkeys', 'viewvalues', 'viewitems'):
                        self.add_message('dict-view-method', node=node)
        elif isinstance(node.func, astroid.Name):
            found_node = node.func.lookup(node.func.name)[0]
            if _is_builtin(found_node):
                if node.func.name in ('filter', 'map', 'range', 'zip'):
                    if not _in_iterating_context(node):
                        checker = '{}-builtin-not-iterating'.format(node.func.name)
                        self.add_message(checker, node=node)
                if node.func.name == 'open' and node.keywords:
                    kwargs = node.keywords
                    for kwarg in kwargs or []:
                        if kwarg.arg == 'encoding':
                            self._validate_encoding(kwarg.value, node)
                            break

    def _validate_encoding(self, encoding, node):
        if isinstance(encoding, astroid.Const):
            value = encoding.value
            if value in self._invalid_encodings:
                self.add_message('invalid-str-codec',
                                 node=node)

    @utils.check_messages('indexing-exception')
    def visit_subscript(self, node):
        """ Look for indexing exceptions. """
        try:
            for inferred in node.value.infer():
                if not isinstance(inferred, astroid.Instance):
                    continue
                if utils.inherit_from_std_ex(inferred):
                    self.add_message('indexing-exception', node=node)
        except astroid.InferenceError:
            return

    def visit_assignattr(self, node):
        if isinstance(node.assign_type(), astroid.AugAssign):
            self.visit_attribute(node)

    def visit_delattr(self, node):
        self.visit_attribute(node)

    @utils.check_messages('exception-message-attribute')
    def visit_attribute(self, node):
        """ Look for accessing message on exceptions. """
        try:
            for inferred in node.expr.infer():
                if (isinstance(inferred, astroid.Instance) and
                        utils.inherit_from_std_ex(inferred)):
                    if node.attrname == 'message':
                        self.add_message('exception-message-attribute', node=node)
                if isinstance(inferred, astroid.Module):
                    self._warn_if_deprecated(node, inferred.name, {node.attrname},
                                             report_on_modules=False)
        except astroid.InferenceError:
            return

    @utils.check_messages('unpacking-in-except')
    def visit_excepthandler(self, node):
        """Visit an except handler block and check for exception unpacking."""
        if isinstance(node.name, (astroid.Tuple, astroid.List)):
            self.add_message('unpacking-in-except', node=node)

    @utils.check_messages('backtick')
    def visit_repr(self, node):
        self.add_message('backtick', node=node)

    @utils.check_messages('raising-string', 'old-raise-syntax')
    def visit_raise(self, node):
        """Visit a raise statement and check for raising
        strings or old-raise-syntax.
        """
        if (node.exc is not None and
                node.inst is not None and
                node.tback is None):
            self.add_message('old-raise-syntax', node=node)

        # Ignore empty raise.
        if node.exc is None:
            return
        expr = node.exc
        if self._check_raise_value(node, expr):
            return
        else:
            try:
                value = next(astroid.unpack_infer(expr))
            except astroid.InferenceError:
                return
            self._check_raise_value(node, value)

    def _check_raise_value(self, node, expr):
        if isinstance(expr, astroid.Const):
            value = expr.value
            if isinstance(value, str):
                self.add_message('raising-string', node=node)
                return True


class Python3TokenChecker(checkers.BaseTokenChecker):
    __implements__ = interfaces.ITokenChecker
    name = 'python3'
    enabled = False

    msgs = {
        'E1606': ('Use of long suffix',
                  'long-suffix',
                  'Used when "l" or "L" is used to mark a long integer. '
                  'This will not work in Python 3, since `int` and `long` '
                  'types have merged.',
                  {'maxversion': (3, 0)}),
        'E1607': ('Use of the <> operator',
                  'old-ne-operator',
                  'Used when the deprecated "<>" operator is used instead '
                  'of "!=". This is removed in Python 3.',
                  {'maxversion': (3, 0),
                   'old_names': [('W0331', 'old-ne-operator')]}),
        'E1608': ('Use of old octal literal',
                  'old-octal-literal',
                  'Used when encountering the old octal syntax, '
                  'removed in Python 3. To use the new syntax, '
                  'prepend 0o on the number.',
                  {'maxversion': (3, 0)}),
    }

    def process_tokens(self, tokens):
        for idx, (tok_type, token, start, _, _) in enumerate(tokens):
            if tok_type == tokenize.NUMBER:
                if token.lower().endswith('l'):
                    # This has a different semantic than lowercase-l-suffix.
                    self.add_message('long-suffix', line=start[0])
                elif _is_old_octal(token):
                    self.add_message('old-octal-literal', line=start[0])
            if tokens[idx][1] == '<>':
                self.add_message('old-ne-operator', line=tokens[idx][2][0])


def register(linter):
    linter.register_checker(Python3Checker(linter))
    linter.register_checker(Python3TokenChecker(linter))
