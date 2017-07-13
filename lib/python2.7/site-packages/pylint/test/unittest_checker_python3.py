# Copyright (c) 2014-2015 Brett Cannon <brett@python.org>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Tests for the python3 checkers."""
from __future__ import absolute_import

import sys
import textwrap

import pytest

import astroid

from pylint import testutils
from pylint.checkers import python3 as checker
from pylint.interfaces import INFERENCE_FAILURE, INFERENCE


# Decorator for any tests that will fail under Python 3
python2_only = pytest.mark.skipif(sys.version_info[0] > 2, reason='Python 2 only')

# TODO(cpopa): Port these to the functional test framework instead.

class TestPython3Checker(testutils.CheckerTestCase):
    CHECKER_CLASS = checker.Python3Checker

    def check_bad_builtin(self, builtin_name):
        node = astroid.extract_node(builtin_name + '  #@')
        message = builtin_name.lower() + '-builtin'
        with self.assertAddsMessages(testutils.Message(message, node=node)):
            self.checker.visit_name(node)

    @python2_only
    def test_bad_builtins(self):
        builtins = [
            'apply',
            'buffer',
            'cmp',
            'coerce',
            'execfile',
            'file',
            'input',
            'intern',
            'long',
            'raw_input',
            'round',
            'reduce',
            'StandardError',
            'unichr',
            'unicode',
            'xrange',
            'reload',
        ]
        for builtin in builtins:
            self.check_bad_builtin(builtin)

    def as_iterable_in_for_loop_test(self, fxn):
        code = "for x in {}(): pass".format(fxn)
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    def as_used_by_iterable_in_for_loop_test(self, fxn):
        checker = '{}-builtin-not-iterating'.format(fxn)
        node = astroid.extract_node("""
        for x in (whatever(
            {}() #@
        )):
            pass
        """.format(fxn))
        message = testutils.Message(checker, node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def as_iterable_in_genexp_test(self, fxn):
        code = "x = (x for x in {}())".format(fxn)
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    def as_iterable_in_listcomp_test(self, fxn):
        code = "x = [x for x in {}(None, [1])]".format(fxn)
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    def as_used_in_variant_in_genexp_test(self, fxn):
        checker = '{}-builtin-not-iterating'.format(fxn)
        node = astroid.extract_node("""
        list(
            __({}(x))
            for x in [1]
        )
        """.format(fxn))
        message = testutils.Message(checker, node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def as_used_in_variant_in_listcomp_test(self, fxn):
        checker = '{}-builtin-not-iterating'.format(fxn)
        node = astroid.extract_node("""
        [
            __({}(None, x))
        for x in [[1]]]
        """.format(fxn))
        message = testutils.Message(checker, node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def as_argument_to_callable_constructor_test(self, fxn, callable_fn):
        module = astroid.parse("x = {}({}())".format(callable_fn, fxn))
        with self.assertNoMessages():
            self.walk(module)

    def as_argument_to_random_fxn_test(self, fxn):
        checker = '{}-builtin-not-iterating'.format(fxn)
        node = astroid.extract_node("""
        y(
            {}() #@
        )
        """.format(fxn))
        message = testutils.Message(checker, node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def as_argument_to_str_join_test(self, fxn):
        code = "x = ''.join({}())".format(fxn)
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    def as_iterable_in_unpacking(self, fxn):
        node = astroid.extract_node("""
        a, b = __({}())
        """.format(fxn))
        with self.assertNoMessages():
            self.checker.visit_call(node)

    def as_assignment(self, fxn):
        checker = '{}-builtin-not-iterating'.format(fxn)
        node = astroid.extract_node("""
        a = __({}())
        """.format(fxn))
        message = testutils.Message(checker, node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def iterating_context_tests(self, fxn):
        """Helper for verifying a function isn't used as an iterator."""
        self.as_iterable_in_for_loop_test(fxn)
        self.as_used_by_iterable_in_for_loop_test(fxn)
        self.as_iterable_in_genexp_test(fxn)
        self.as_iterable_in_listcomp_test(fxn)
        self.as_used_in_variant_in_genexp_test(fxn)
        self.as_used_in_variant_in_listcomp_test(fxn)
        self.as_argument_to_random_fxn_test(fxn)
        self.as_argument_to_str_join_test(fxn)
        self.as_iterable_in_unpacking(fxn)
        self.as_assignment(fxn)

        for func in ('iter', 'list', 'tuple', 'sorted',
                     'set', 'sum', 'any', 'all',
                     'enumerate', 'dict'):
            self.as_argument_to_callable_constructor_test(fxn, func)

    @python2_only
    def test_map_in_iterating_context(self):
        self.iterating_context_tests('map')

    @python2_only
    def test_zip_in_iterating_context(self):
        self.iterating_context_tests('zip')

    @python2_only
    def test_range_in_iterating_context(self):
        self.iterating_context_tests('range')

    @python2_only
    def test_filter_in_iterating_context(self):
        self.iterating_context_tests('filter')

    def defined_method_test(self, method, warning):
        """Helper for verifying that a certain method is not defined."""
        node = astroid.extract_node("""
            class Foo(object):
                def __{0}__(self, other):  #@
                    pass""".format(method))
        message = testutils.Message(warning, node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_functiondef(node)

    def test_delslice_method(self):
        self.defined_method_test('delslice', 'delslice-method')

    def test_getslice_method(self):
        self.defined_method_test('getslice', 'getslice-method')

    def test_setslice_method(self):
        self.defined_method_test('setslice', 'setslice-method')

    def test_coerce_method(self):
        self.defined_method_test('coerce', 'coerce-method')

    def test_oct_method(self):
        self.defined_method_test('oct', 'oct-method')

    def test_hex_method(self):
        self.defined_method_test('hex', 'hex-method')

    def test_nonzero_method(self):
        self.defined_method_test('nonzero', 'nonzero-method')

    def test_cmp_method(self):
        self.defined_method_test('cmp', 'cmp-method')

    def test_div_method(self):
        self.defined_method_test('div', 'div-method')

    def test_idiv_method(self):
        self.defined_method_test('idiv', 'idiv-method')

    def test_rdiv_method(self):
        self.defined_method_test('rdiv', 'rdiv-method')

    def test_eq_and_hash_method(self):
        """Helper for verifying that a certain method is not defined."""
        node = astroid.extract_node("""
            class Foo(object):  #@
                def __eq__(self, other):
                    pass
                def __hash__(self):
                    pass""")
        with self.assertNoMessages():
            self.checker.visit_classdef(node)

    def test_eq_and_hash_is_none(self):
        """Helper for verifying that a certain method is not defined."""
        node = astroid.extract_node("""
            class Foo(object):  #@
                def __eq__(self, other):
                    pass
                __hash__ = None""")
        with self.assertNoMessages():
            self.checker.visit_classdef(node)

    def test_eq_without_hash_method(self):
        """Helper for verifying that a certain method is not defined."""
        node = astroid.extract_node("""
            class Foo(object):  #@
                def __eq__(self, other):
                    pass""")
        message = testutils.Message('eq-without-hash', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_classdef(node)

    @python2_only
    def test_print_statement(self):
        node = astroid.extract_node('print "Hello, World!" #@')
        message = testutils.Message('print-statement', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_print(node)

    @python2_only
    def test_backtick(self):
        node = astroid.extract_node('`test`')
        message = testutils.Message('backtick', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_repr(node)

    def test_relative_import(self):
        node = astroid.extract_node('import string  #@')
        message = testutils.Message('no-absolute-import', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_import(node)

    def test_relative_from_import(self):
        node = astroid.extract_node('from os import path  #@')
        message = testutils.Message('no-absolute-import', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_import(node)

    def test_absolute_import(self):
        module_import = astroid.parse(
            'from __future__ import absolute_import; import os')
        module_from = astroid.parse(
            'from __future__ import absolute_import; from os import path')
        with self.assertNoMessages():
            for module in (module_import, module_from):
                self.walk(module)

    def test_import_star_module_level(self):
        node = astroid.extract_node('''
        def test():
            from lala import * #@
        ''')
        absolute = testutils.Message('no-absolute-import', node=node)
        star = testutils.Message('import-star-module-level', node=node)
        with self.assertAddsMessages(absolute, star):
            self.checker.visit_importfrom(node)

    def test_division(self):
        node = astroid.extract_node('3 / 2  #@')
        message = testutils.Message('old-division', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_binop(node)

    def test_division_with_future_statement(self):
        module = astroid.parse('from __future__ import division; 3 / 2')
        with self.assertNoMessages():
            self.walk(module)

    def test_floor_division(self):
        node = astroid.extract_node(' 3 // 2  #@')
        with self.assertNoMessages():
            self.checker.visit_binop(node)

    def test_division_by_float(self):
        left_node = astroid.extract_node('3.0 / 2 #@')
        right_node = astroid.extract_node(' 3 / 2.0  #@')
        with self.assertNoMessages():
            for node in (left_node, right_node):
                self.checker.visit_binop(node)

    def test_dict_iter_method(self):
        for meth in ('keys', 'values', 'items'):
            node = astroid.extract_node('x.iter%s()  #@' % meth)
            message = testutils.Message('dict-iter-method', node=node)
            with self.assertAddsMessages(message):
                self.checker.visit_call(node)

    def test_dict_iter_method_on_dict(self):
        node = astroid.extract_node('{}.iterkeys()')
        message = testutils.Message('dict-iter-method', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def test_dict_not_iter_method(self):
        arg_node = astroid.extract_node('x.iterkeys(x)  #@')
        stararg_node = astroid.extract_node('x.iterkeys(*x)  #@')
        kwarg_node = astroid.extract_node('x.iterkeys(y=x)  #@')
        non_dict_node = astroid.extract_node('x=[]\nx.iterkeys() #@')
        with self.assertNoMessages():
            for node in (arg_node, stararg_node, kwarg_node, non_dict_node):
                self.checker.visit_call(node)

    def test_dict_view_method(self):
        for meth in ('keys', 'values', 'items'):
            node = astroid.extract_node('x.view%s()  #@' % meth)
            message = testutils.Message('dict-view-method', node=node)
            with self.assertAddsMessages(message):
                self.checker.visit_call(node)

    def test_dict_view_method_on_dict(self):
        node = astroid.extract_node('{}.viewkeys()')
        message = testutils.Message('dict-view-method', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def test_dict_not_view_method(self):
        arg_node = astroid.extract_node('x.viewkeys(x)  #@')
        stararg_node = astroid.extract_node('x.viewkeys(*x)  #@')
        kwarg_node = astroid.extract_node('x.viewkeys(y=x)  #@')
        non_dict_node = astroid.extract_node('x=[]\nx.viewkeys() #@')
        with self.assertNoMessages():
            for node in (arg_node, stararg_node, kwarg_node, non_dict_node):
                self.checker.visit_call(node)

    def test_next_method(self):
        node = astroid.extract_node('x.next()  #@')
        message = testutils.Message('next-method-called', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    def test_not_next_method(self):
        arg_node = astroid.extract_node('x.next(x)  #@')
        stararg_node = astroid.extract_node('x.next(*x)  #@')
        kwarg_node = astroid.extract_node('x.next(y=x)  #@')
        with self.assertNoMessages():
            for node in (arg_node, stararg_node, kwarg_node):
                self.checker.visit_call(node)

    def test_metaclass_assignment(self):
        node = astroid.extract_node("""
            class Foo(object):  #@
                __metaclass__ = type""")
        message = testutils.Message('metaclass-assignment', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_classdef(node)

    def test_metaclass_global_assignment(self):
        module = astroid.parse('__metaclass__ = type')
        with self.assertNoMessages():
            self.walk(module)

    @python2_only
    def test_parameter_unpacking(self):
        node = astroid.extract_node('def func((a, b)):#@\n pass')
        arg = node.args.args[0]
        with self.assertAddsMessages(testutils.Message('parameter-unpacking', node=arg)):
            self.checker.visit_arguments(node.args)

    @python2_only
    def test_old_raise_syntax(self):
        node = astroid.extract_node('raise Exception, "test"')
        message = testutils.Message('old-raise-syntax', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_raise(node)

    @python2_only
    def test_exception_message_attribute(self):
        node = astroid.extract_node("""
        try:
            raise Exception("test")
        except Exception as e:
            e.message #@
        """)
        message = testutils.Message('exception-message-attribute', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_attribute(node)

    @python2_only
    def test_normal_message_attribute(self):
        node = astroid.extract_node("""
        e.message #@
        """)
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @python2_only
    def test_invalid_codec(self):
        node = astroid.extract_node('foobar.encode("hex") #@')
        message = testutils.Message('invalid-str-codec', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    @python2_only
    def test_valid_codec(self):
        node = astroid.extract_node('foobar.encode("ascii", "ignore")  #@')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_visit_call_with_kwarg(self):
        node = astroid.extract_node('foobar.raz(encoding="hex")  #@')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_invalid_open_codec(self):
        node = astroid.extract_node('open(foobar, encoding="hex") #@')
        message = testutils.Message('invalid-str-codec', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    @python2_only
    def test_valid_open_codec(self):
        node = astroid.extract_node('open(foobar, encoding="palmos") #@')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_raising_string(self):
        node = astroid.extract_node('raise "Test"')
        message = testutils.Message('raising-string', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_raise(node)

    @python2_only
    def test_checker_disabled_by_default(self):
        node = astroid.parse(textwrap.dedent("""
        abc = 1l
        raise Exception, "test"
        raise "test"
        `abc`
        """))
        with self.assertNoMessages():
            self.walk(node)

    def test_using_cmp_argument(self):
        nodes = astroid.extract_node("""
        [].sort(cmp=lambda x: x) #@
        a = list(range(x))
        a.sort(cmp=lambda x: x) #@

        sorted([], cmp=lambda x: x) #@
        """)
        for node in nodes:
            message = testutils.Message('using-cmp-argument', node=node)
            with self.assertAddsMessages(message):
                self.checker.visit_call(node)

    @python2_only
    def test_sys_maxint(self):
        node = astroid.extract_node('''
        import sys
        sys.maxint #@
        ''')
        message = testutils.Message('sys-max-int', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_attribute(node)

    @python2_only
    def test_sys_maxint_imort_from(self):
        node = astroid.extract_node('''
        from sys import maxint #@
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        message = testutils.Message('sys-max-int', node=node)
        with self.assertAddsMessages(absolute_import_message, message):
            self.checker.visit_importfrom(node)

    @python2_only
    def test_object_maxint(self):
        node = astroid.extract_node('''
        sys = object()
        sys.maxint #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @python2_only
    def test_bad_import(self):
        node = astroid.extract_node('''
        import urllib2, sys #@
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        message = testutils.Message('bad-python3-import', node=node)
        with self.assertAddsMessages(absolute_import_message, message):
            self.checker.visit_import(node)

    @python2_only
    def test_bad_import_conditional(self):
        node = astroid.extract_node('''
        import six
        if six.PY2:
            import urllib2 #@
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        with self.assertAddsMessages(absolute_import_message):
            self.checker.visit_import(node)

    @python2_only
    def test_bad_import_try_except_handler(self):
        node = astroid.extract_node('''
        try:
            from hashlib import sha
        except:
            import sha #@
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        with self.assertAddsMessages(absolute_import_message):
            self.checker.visit_import(node)

    @python2_only
    def test_bad_import_try(self):
        node = astroid.extract_node('''
        try:
            import md5  #@
        except:
            from hashlib import md5
        finally:
            pass
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        with self.assertAddsMessages(absolute_import_message):
            self.checker.visit_import(node)

    @python2_only
    def test_bad_import_try_finally(self):
        node = astroid.extract_node('''
        try:
            import Queue  #@
        finally:
            import queue
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        message = testutils.Message('bad-python3-import', node=node)
        with self.assertAddsMessages(absolute_import_message, message):
            self.checker.visit_import(node)

    @python2_only
    def test_bad_import_from(self):
        node = astroid.extract_node('''
        from cStringIO import StringIO #@
        ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        message = testutils.Message('bad-python3-import', node=node)
        with self.assertAddsMessages(absolute_import_message, message):
            self.checker.visit_importfrom(node)

    @python2_only
    def test_bad_string_attribute(self):
        node = astroid.extract_node('''
        import string
        string.maketrans #@
        ''')
        message = testutils.Message('deprecated-string-function', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_attribute(node)

    @python2_only
    def test_ok_string_attribute(self):
        node = astroid.extract_node('''
        import string
        string.letters #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_attribute(node)

    @python2_only
    def test_bad_string_call(self):
        node = astroid.extract_node('''
        import string
        string.upper("hello world") #@
        ''')
        message = testutils.Message('deprecated-string-function', node=node)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    @python2_only
    def test_ok_shadowed_call(self):
        node = astroid.extract_node('''
        import six.moves.configparser
        six.moves.configparser.ConfigParser() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_ok_string_call(self):
        node = astroid.extract_node('''
        import string
        string.Foramtter() #@
        ''')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_bad_string_import_from(self):
        node = astroid.extract_node('''
         from string import atoi #@
         ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        message = testutils.Message('deprecated-string-function', node=node)
        with self.assertAddsMessages(absolute_import_message, message):
            self.checker.visit_importfrom(node)

    @python2_only
    def test_ok_string_import_from(self):
        node = astroid.extract_node('''
         from string import digits #@
         ''')
        absolute_import_message = testutils.Message('no-absolute-import', node=node)
        with self.assertAddsMessages(absolute_import_message):
            self.checker.visit_importfrom(node)

    @python2_only
    def test_bad_str_translate_call_string_literal(self):
        node = astroid.extract_node('''
         foobar.translate(None, 'abc123') #@
         ''')
        message = testutils.Message('deprecated-str-translate-call', node=node,
                                    confidence=INFERENCE_FAILURE)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    @python2_only
    def test_bad_str_translate_call_variable(self):
        node = astroid.extract_node('''
         def raz(foobar):
           foobar.translate(None, 'hello') #@
         ''')
        message = testutils.Message('deprecated-str-translate-call', node=node,
                                    confidence=INFERENCE_FAILURE)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    @python2_only
    def test_bad_str_translate_call_infer_str(self):
        node = astroid.extract_node('''
         foobar = "hello world"
         foobar.translate(None, foobar) #@
         ''')
        message = testutils.Message('deprecated-str-translate-call', node=node,
                                    confidence=INFERENCE)
        with self.assertAddsMessages(message):
            self.checker.visit_call(node)

    @python2_only
    def test_ok_str_translate_call_integer(self):
        node = astroid.extract_node('''
         foobar.translate(None, 33) #@
         ''')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_ok_str_translate_call_keyword(self):
        node = astroid.extract_node('''
         foobar.translate(None, 'foobar', raz=33) #@
         ''')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    @python2_only
    def test_ok_str_translate_call_not_str(self):
        node = astroid.extract_node('''
         foobar = {}
         foobar.translate(None, 'foobar') #@
         ''')
        with self.assertNoMessages():
            self.checker.visit_call(node)

    def test_non_py2_conditional(self):
        code = '''
        from __future__ import absolute_import
        import sys
        x = {}
        if sys.maxsize:
            x.iterkeys()  #@
        '''
        node = astroid.extract_node(code)
        module = node.parent.parent
        message = testutils.Message('dict-iter-method', node=node)
        with self.assertAddsMessages(message):
            self.walk(module)

    def test_six_conditional(self):
        code = '''
        from __future__ import absolute_import
        import six
        x = {}
        if six.PY2:
            x.iterkeys()
        '''
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    @python2_only
    def test_versioninfo_conditional(self):
        code = '''
        from __future__ import absolute_import
        import sys
        x = {}
        if sys.version_info[0] == 2:
            x.iterkeys()
        '''
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    @python2_only
    def test_versioninfo_tuple_conditional(self):
        code = '''
        from __future__ import absolute_import
        import sys
        x = {}
        if sys.version_info == (2, 7):
            x.iterkeys()
        '''
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

    @python2_only
    def test_six_ifexp_conditional(self):
        code = '''
        from __future__ import absolute_import
        import six
        import string
        string.translate if six.PY2 else None
        '''
        module = astroid.parse(code)
        with self.assertNoMessages():
            self.walk(module)

@python2_only
class TestPython3TokenChecker(testutils.CheckerTestCase):

    CHECKER_CLASS = checker.Python3TokenChecker

    def _test_token_message(self, code, symbolic_message):
        tokens = testutils.tokenize_str(code)
        message = testutils.Message(symbolic_message, line=1)
        with self.assertAddsMessages(message):
            self.checker.process_tokens(tokens)

    def test_long_suffix(self):
        for code in ("1l", "1L"):
            self._test_token_message(code, 'long-suffix')

    def test_old_ne_operator(self):
        self._test_token_message("1 <> 2", "old-ne-operator")

    def test_old_octal_literal(self):
        for octal in ("045", "055", "075", "077", "076543"):
            self._test_token_message(octal, "old-octal-literal")

        # Make sure we are catching only octals.
        for non_octal in ("45", "00", "085", "08", "1"):
            tokens = testutils.tokenize_str(non_octal)
            with self.assertNoMessages():
                self.checker.process_tokens(tokens)
