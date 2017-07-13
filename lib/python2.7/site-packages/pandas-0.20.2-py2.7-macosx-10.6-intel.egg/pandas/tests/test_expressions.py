# -*- coding: utf-8 -*-
from __future__ import print_function
# pylint: disable-msg=W0612,E1101

from warnings import catch_warnings
import re
import operator
import pytest

from numpy.random import randn

import numpy as np

from pandas.core.api import DataFrame, Panel
from pandas.core.computation import expressions as expr
from pandas import compat, _np_version_under1p11
from pandas.util.testing import (assert_almost_equal, assert_series_equal,
                                 assert_frame_equal, assert_panel_equal,
                                 assert_panel4d_equal, slow)
from pandas.io.formats.printing import pprint_thing
import pandas.util.testing as tm


_frame = DataFrame(randn(10000, 4), columns=list('ABCD'), dtype='float64')
_frame2 = DataFrame(randn(100, 4), columns=list('ABCD'), dtype='float64')
_mixed = DataFrame({'A': _frame['A'].copy(),
                    'B': _frame['B'].astype('float32'),
                    'C': _frame['C'].astype('int64'),
                    'D': _frame['D'].astype('int32')})
_mixed2 = DataFrame({'A': _frame2['A'].copy(),
                     'B': _frame2['B'].astype('float32'),
                     'C': _frame2['C'].astype('int64'),
                     'D': _frame2['D'].astype('int32')})
_integer = DataFrame(
    np.random.randint(1, 100,
                      size=(10001, 4)),
    columns=list('ABCD'), dtype='int64')
_integer2 = DataFrame(np.random.randint(1, 100, size=(101, 4)),
                      columns=list('ABCD'), dtype='int64')

with catch_warnings(record=True):
    _frame_panel = Panel(dict(ItemA=_frame.copy(),
                              ItemB=(_frame.copy() + 3),
                              ItemC=_frame.copy(),
                              ItemD=_frame.copy()))
    _frame2_panel = Panel(dict(ItemA=_frame2.copy(),
                               ItemB=(_frame2.copy() + 3),
                               ItemC=_frame2.copy(),
                               ItemD=_frame2.copy()))
    _integer_panel = Panel(dict(ItemA=_integer,
                                ItemB=(_integer + 34).astype('int64')))
    _integer2_panel = Panel(dict(ItemA=_integer2,
                                 ItemB=(_integer2 + 34).astype('int64')))
    _mixed_panel = Panel(dict(ItemA=_mixed, ItemB=(_mixed + 3)))
    _mixed2_panel = Panel(dict(ItemA=_mixed2, ItemB=(_mixed2 + 3)))


@pytest.mark.skipif(not expr._USE_NUMEXPR, reason='not using numexpr')
class TestExpressions(object):

    def setup_method(self, method):

        self.frame = _frame.copy()
        self.frame2 = _frame2.copy()
        self.mixed = _mixed.copy()
        self.mixed2 = _mixed2.copy()
        self.integer = _integer.copy()
        self._MIN_ELEMENTS = expr._MIN_ELEMENTS

    def teardown_method(self, method):
        expr._MIN_ELEMENTS = self._MIN_ELEMENTS

    def run_arithmetic(self, df, other, assert_func, check_dtype=False,
                       test_flex=True):
        expr._MIN_ELEMENTS = 0
        operations = ['add', 'sub', 'mul', 'mod', 'truediv', 'floordiv', 'pow']
        if not compat.PY3:
            operations.append('div')
        for arith in operations:

            # numpy >= 1.11 doesn't handle integers
            # raised to integer powers
            # https://github.com/pandas-dev/pandas/issues/15363
            if arith == 'pow' and not _np_version_under1p11:
                continue

            operator_name = arith
            if arith == 'div':
                operator_name = 'truediv'

            if test_flex:
                op = lambda x, y: getattr(df, arith)(y)
                op.__name__ = arith
            else:
                op = getattr(operator, operator_name)
            expr.set_use_numexpr(False)
            expected = op(df, other)
            expr.set_use_numexpr(True)

            result = op(df, other)
            try:
                if check_dtype:
                    if arith == 'truediv':
                        assert expected.dtype.kind == 'f'
                assert_func(expected, result)
            except Exception:
                pprint_thing("Failed test with operator %r" % op.__name__)
                raise

    def test_integer_arithmetic(self):
        self.run_arithmetic(self.integer, self.integer,
                            assert_frame_equal)
        self.run_arithmetic(self.integer.iloc[:, 0],
                            self.integer.iloc[:, 0], assert_series_equal,
                            check_dtype=True)

    def run_binary(self, df, other, assert_func, test_flex=False,
                   numexpr_ops=set(['gt', 'lt', 'ge', 'le', 'eq', 'ne'])):
        """
        tests solely that the result is the same whether or not numexpr is
        enabled.  Need to test whether the function does the correct thing
        elsewhere.
        """
        expr._MIN_ELEMENTS = 0
        expr.set_test_mode(True)
        operations = ['gt', 'lt', 'ge', 'le', 'eq', 'ne']
        for arith in operations:
            if test_flex:
                op = lambda x, y: getattr(df, arith)(y)
                op.__name__ = arith
            else:
                op = getattr(operator, arith)
            expr.set_use_numexpr(False)
            expected = op(df, other)
            expr.set_use_numexpr(True)
            expr.get_test_result()
            result = op(df, other)
            used_numexpr = expr.get_test_result()
            try:
                if arith in numexpr_ops:
                    assert used_numexpr, "Did not use numexpr as expected."
                else:
                    assert not used_numexpr, "Used numexpr unexpectedly."
                assert_func(expected, result)
            except Exception:
                pprint_thing("Failed test with operation %r" % arith)
                pprint_thing("test_flex was %r" % test_flex)
                raise

    def run_frame(self, df, other, binary_comp=None, run_binary=True,
                  **kwargs):
        self.run_arithmetic(df, other, assert_frame_equal,
                            test_flex=False, **kwargs)
        self.run_arithmetic(df, other, assert_frame_equal, test_flex=True,
                            **kwargs)
        if run_binary:
            if binary_comp is None:
                expr.set_use_numexpr(False)
                binary_comp = other + 1
                expr.set_use_numexpr(True)
            self.run_binary(df, binary_comp, assert_frame_equal,
                            test_flex=False, **kwargs)
            self.run_binary(df, binary_comp, assert_frame_equal,
                            test_flex=True, **kwargs)

    def run_series(self, ser, other, binary_comp=None, **kwargs):
        self.run_arithmetic(ser, other, assert_series_equal,
                            test_flex=False, **kwargs)
        self.run_arithmetic(ser, other, assert_almost_equal,
                            test_flex=True, **kwargs)
        # series doesn't uses vec_compare instead of numexpr...
        # if binary_comp is None:
        #     binary_comp = other + 1
        # self.run_binary(ser, binary_comp, assert_frame_equal,
        # test_flex=False, **kwargs)
        # self.run_binary(ser, binary_comp, assert_frame_equal,
        # test_flex=True, **kwargs)

    def run_panel(self, panel, other, binary_comp=None, run_binary=True,
                  assert_func=assert_panel_equal, **kwargs):
        self.run_arithmetic(panel, other, assert_func, test_flex=False,
                            **kwargs)
        self.run_arithmetic(panel, other, assert_func, test_flex=True,
                            **kwargs)
        if run_binary:
            if binary_comp is None:
                binary_comp = other + 1
            self.run_binary(panel, binary_comp, assert_func,
                            test_flex=False, **kwargs)
            self.run_binary(panel, binary_comp, assert_func,
                            test_flex=True, **kwargs)

    def test_integer_arithmetic_frame(self):
        self.run_frame(self.integer, self.integer)

    def test_integer_arithmetic_series(self):
        self.run_series(self.integer.iloc[:, 0], self.integer.iloc[:, 0])

    @slow
    def test_integer_panel(self):
        self.run_panel(_integer2_panel, np.random.randint(1, 100))

    def test_float_arithemtic_frame(self):
        self.run_frame(self.frame2, self.frame2)

    def test_float_arithmetic_series(self):
        self.run_series(self.frame2.iloc[:, 0], self.frame2.iloc[:, 0])

    @slow
    def test_float_panel(self):
        self.run_panel(_frame2_panel, np.random.randn() + 0.1, binary_comp=0.8)

    @slow
    def test_panel4d(self):
        with catch_warnings(record=True):
            self.run_panel(tm.makePanel4D(), np.random.randn() + 0.5,
                           assert_func=assert_panel4d_equal, binary_comp=3)

    def test_mixed_arithmetic_frame(self):
        # TODO: FIGURE OUT HOW TO GET IT TO WORK...
        # can't do arithmetic because comparison methods try to do *entire*
        # frame instead of by-column
        self.run_frame(self.mixed2, self.mixed2, run_binary=False)

    def test_mixed_arithmetic_series(self):
        for col in self.mixed2.columns:
            self.run_series(self.mixed2[col], self.mixed2[col], binary_comp=4)

    @slow
    def test_mixed_panel(self):
        self.run_panel(_mixed2_panel, np.random.randint(1, 100),
                       binary_comp=-2)

    def test_float_arithemtic(self):
        self.run_arithmetic(self.frame, self.frame, assert_frame_equal)
        self.run_arithmetic(self.frame.iloc[:, 0], self.frame.iloc[:, 0],
                            assert_series_equal, check_dtype=True)

    def test_mixed_arithmetic(self):
        self.run_arithmetic(self.mixed, self.mixed, assert_frame_equal)
        for col in self.mixed.columns:
            self.run_arithmetic(self.mixed[col], self.mixed[col],
                                assert_series_equal)

    def test_integer_with_zeros(self):
        self.integer *= np.random.randint(0, 2, size=np.shape(self.integer))
        self.run_arithmetic(self.integer, self.integer,
                            assert_frame_equal)
        self.run_arithmetic(self.integer.iloc[:, 0],
                            self.integer.iloc[:, 0], assert_series_equal)

    def test_invalid(self):

        # no op
        result = expr._can_use_numexpr(operator.add, None, self.frame,
                                       self.frame, 'evaluate')
        assert not result

        # mixed
        result = expr._can_use_numexpr(operator.add, '+', self.mixed,
                                       self.frame, 'evaluate')
        assert not result

        # min elements
        result = expr._can_use_numexpr(operator.add, '+', self.frame2,
                                       self.frame2, 'evaluate')
        assert not result

        # ok, we only check on first part of expression
        result = expr._can_use_numexpr(operator.add, '+', self.frame,
                                       self.frame2, 'evaluate')
        assert result

    def test_binary_ops(self):
        def testit():

            for f, f2 in [(self.frame, self.frame2),
                          (self.mixed, self.mixed2)]:

                for op, op_str in [('add', '+'), ('sub', '-'), ('mul', '*'),
                                   ('div', '/'), ('pow', '**')]:

                    # numpy >= 1.11 doesn't handle integers
                    # raised to integer powers
                    # https://github.com/pandas-dev/pandas/issues/15363
                    if op == 'pow' and not _np_version_under1p11:
                        continue

                    if op == 'div':
                        op = getattr(operator, 'truediv', None)
                    else:
                        op = getattr(operator, op, None)
                    if op is not None:
                        result = expr._can_use_numexpr(op, op_str, f, f,
                                                       'evaluate')
                        assert result != f._is_mixed_type

                        result = expr.evaluate(op, op_str, f, f,
                                               use_numexpr=True)
                        expected = expr.evaluate(op, op_str, f, f,
                                                 use_numexpr=False)

                        if isinstance(result, DataFrame):
                            tm.assert_frame_equal(result, expected)
                        else:
                            tm.assert_numpy_array_equal(result,
                                                        expected.values)

                        result = expr._can_use_numexpr(op, op_str, f2, f2,
                                                       'evaluate')
                        assert not result

        expr.set_use_numexpr(False)
        testit()
        expr.set_use_numexpr(True)
        expr.set_numexpr_threads(1)
        testit()
        expr.set_numexpr_threads()
        testit()

    def test_boolean_ops(self):
        def testit():
            for f, f2 in [(self.frame, self.frame2),
                          (self.mixed, self.mixed2)]:

                f11 = f
                f12 = f + 1

                f21 = f2
                f22 = f2 + 1

                for op, op_str in [('gt', '>'), ('lt', '<'), ('ge', '>='),
                                   ('le', '<='), ('eq', '=='), ('ne', '!=')]:

                    op = getattr(operator, op)

                    result = expr._can_use_numexpr(op, op_str, f11, f12,
                                                   'evaluate')
                    assert result != f11._is_mixed_type

                    result = expr.evaluate(op, op_str, f11, f12,
                                           use_numexpr=True)
                    expected = expr.evaluate(op, op_str, f11, f12,
                                             use_numexpr=False)
                    if isinstance(result, DataFrame):
                        tm.assert_frame_equal(result, expected)
                    else:
                        tm.assert_numpy_array_equal(result, expected.values)

                    result = expr._can_use_numexpr(op, op_str, f21, f22,
                                                   'evaluate')
                    assert not result

        expr.set_use_numexpr(False)
        testit()
        expr.set_use_numexpr(True)
        expr.set_numexpr_threads(1)
        testit()
        expr.set_numexpr_threads()
        testit()

    def test_where(self):
        def testit():
            for f in [self.frame, self.frame2, self.mixed, self.mixed2]:

                for cond in [True, False]:

                    c = np.empty(f.shape, dtype=np.bool_)
                    c.fill(cond)
                    result = expr.where(c, f.values, f.values + 1)
                    expected = np.where(c, f.values, f.values + 1)
                    tm.assert_numpy_array_equal(result, expected)

        expr.set_use_numexpr(False)
        testit()
        expr.set_use_numexpr(True)
        expr.set_numexpr_threads(1)
        testit()
        expr.set_numexpr_threads()
        testit()

    def test_bool_ops_raise_on_arithmetic(self):
        df = DataFrame({'a': np.random.rand(10) > 0.5,
                        'b': np.random.rand(10) > 0.5})
        names = 'div', 'truediv', 'floordiv', 'pow'
        ops = '/', '/', '//', '**'
        msg = 'operator %r not implemented for bool dtypes'
        for op, name in zip(ops, names):
            if not compat.PY3 or name != 'div':
                f = getattr(operator, name)
                err_msg = re.escape(msg % op)

                with tm.assert_raises_regex(NotImplementedError, err_msg):
                    f(df, df)

                with tm.assert_raises_regex(NotImplementedError, err_msg):
                    f(df.a, df.b)

                with tm.assert_raises_regex(NotImplementedError, err_msg):
                    f(df.a, True)

                with tm.assert_raises_regex(NotImplementedError, err_msg):
                    f(False, df.a)

                with tm.assert_raises_regex(TypeError, err_msg):
                    f(False, df)

                with tm.assert_raises_regex(TypeError, err_msg):
                    f(df, True)

    def test_bool_ops_warn_on_arithmetic(self):
        n = 10
        df = DataFrame({'a': np.random.rand(n) > 0.5,
                        'b': np.random.rand(n) > 0.5})
        names = 'add', 'mul', 'sub'
        ops = '+', '*', '-'
        subs = {'+': '|', '*': '&', '-': '^'}
        sub_funcs = {'|': 'or_', '&': 'and_', '^': 'xor'}
        for op, name in zip(ops, names):
            f = getattr(operator, name)
            fe = getattr(operator, sub_funcs[subs[op]])

            with tm.use_numexpr(True, min_elements=5):
                with tm.assert_produces_warning(check_stacklevel=False):
                    r = f(df, df)
                    e = fe(df, df)
                    tm.assert_frame_equal(r, e)

                with tm.assert_produces_warning(check_stacklevel=False):
                    r = f(df.a, df.b)
                    e = fe(df.a, df.b)
                    tm.assert_series_equal(r, e)

                with tm.assert_produces_warning(check_stacklevel=False):
                    r = f(df.a, True)
                    e = fe(df.a, True)
                    tm.assert_series_equal(r, e)

                with tm.assert_produces_warning(check_stacklevel=False):
                    r = f(False, df.a)
                    e = fe(False, df.a)
                    tm.assert_series_equal(r, e)

                with tm.assert_produces_warning(check_stacklevel=False):
                    r = f(False, df)
                    e = fe(False, df)
                    tm.assert_frame_equal(r, e)

                with tm.assert_produces_warning(check_stacklevel=False):
                    r = f(df, True)
                    e = fe(df, True)
                    tm.assert_frame_equal(r, e)
