import warnings
from warnings import catch_warnings
import operator
from itertools import product

import pytest

from numpy.random import randn, rand, randint
import numpy as np

from pandas.core.dtypes.common import is_bool, is_list_like, is_scalar
import pandas as pd
from pandas.core import common as com
from pandas.errors import PerformanceWarning
from pandas import DataFrame, Series, Panel, date_range
from pandas.util.testing import makeCustomDataframe as mkdf

from pandas.core.computation import pytables
from pandas.core.computation.engines import _engines, NumExprClobberingError
from pandas.core.computation.expr import PythonExprVisitor, PandasExprVisitor
from pandas.core.computation.expressions import (
    _USE_NUMEXPR, _NUMEXPR_INSTALLED)
from pandas.core.computation.ops import (
    _binary_ops_dict,
    _special_case_arith_ops_syms,
    _arith_ops_syms, _bool_ops_syms,
    _unary_math_ops, _binary_math_ops)

import pandas.core.computation.expr as expr
import pandas.util.testing as tm
from pandas.util.testing import (assert_frame_equal, randbool,
                                 assert_numpy_array_equal, assert_series_equal,
                                 assert_produces_warning, slow)
from pandas.compat import PY3, reduce

_series_frame_incompatible = _bool_ops_syms
_scalar_skip = 'in', 'not in'


@pytest.fixture(params=(
    pytest.mark.skipif(engine == 'numexpr' and not _USE_NUMEXPR,
                       reason='numexpr enabled->{enabled}, '
                              'installed->{installed}'.format(
                                  enabled=_USE_NUMEXPR,
                                  installed=_NUMEXPR_INSTALLED))(engine)
                       for engine in _engines  # noqa
))
def engine(request):
    return request.param


@pytest.fixture(params=expr._parsers)
def parser(request):
    return request.param


def engine_has_neg_frac(engine):
    return _engines[engine].has_neg_frac


def _eval_single_bin(lhs, cmp1, rhs, engine):
    c = _binary_ops_dict[cmp1]
    if engine_has_neg_frac(engine):
        try:
            return c(lhs, rhs)
        except ValueError as e:
            if str(e).startswith('negative number cannot be '
                                 'raised to a fractional power'):
                return np.nan
            raise
    return c(lhs, rhs)


def _series_and_2d_ndarray(lhs, rhs):
    return ((isinstance(lhs, Series) and
             isinstance(rhs, np.ndarray) and rhs.ndim > 1) or
            (isinstance(rhs, Series) and
             isinstance(lhs, np.ndarray) and lhs.ndim > 1))


def _series_and_frame(lhs, rhs):
    return ((isinstance(lhs, Series) and isinstance(rhs, DataFrame)) or
            (isinstance(rhs, Series) and isinstance(lhs, DataFrame)))


def _bool_and_frame(lhs, rhs):
    return isinstance(lhs, bool) and isinstance(rhs, pd.core.generic.NDFrame)


def _is_py3_complex_incompat(result, expected):
    return (PY3 and isinstance(expected, (complex, np.complexfloating)) and
            np.isnan(result))


_good_arith_ops = com.difference(_arith_ops_syms, _special_case_arith_ops_syms)


class TestEvalNumexprPandas(object):

    @classmethod
    def setup_class(cls):
        tm.skip_if_no_ne()
        import numexpr as ne
        cls.ne = ne
        cls.engine = 'numexpr'
        cls.parser = 'pandas'

    @classmethod
    def teardown_class(cls):
        del cls.engine, cls.parser
        if hasattr(cls, 'ne'):
            del cls.ne

    def setup_data(self):
        nan_df1 = DataFrame(rand(10, 5))
        nan_df1[nan_df1 > 0.5] = np.nan
        nan_df2 = DataFrame(rand(10, 5))
        nan_df2[nan_df2 > 0.5] = np.nan

        self.pandas_lhses = (DataFrame(randn(10, 5)), Series(randn(5)),
                             Series([1, 2, np.nan, np.nan, 5]), nan_df1)
        self.pandas_rhses = (DataFrame(randn(10, 5)), Series(randn(5)),
                             Series([1, 2, np.nan, np.nan, 5]), nan_df2)
        self.scalar_lhses = randn(),
        self.scalar_rhses = randn(),

        self.lhses = self.pandas_lhses + self.scalar_lhses
        self.rhses = self.pandas_rhses + self.scalar_rhses

    def setup_ops(self):
        self.cmp_ops = expr._cmp_ops_syms
        self.cmp2_ops = self.cmp_ops[::-1]
        self.bin_ops = expr._bool_ops_syms
        self.special_case_ops = _special_case_arith_ops_syms
        self.arith_ops = _good_arith_ops
        self.unary_ops = '-', '~', 'not '

    def setup_method(self, method):
        self.setup_ops()
        self.setup_data()
        self.current_engines = filter(lambda x: x != self.engine, _engines)

    def teardown_method(self, method):
        del self.lhses, self.rhses, self.scalar_rhses, self.scalar_lhses
        del self.pandas_rhses, self.pandas_lhses, self.current_engines

    @slow
    def test_complex_cmp_ops(self):
        cmp_ops = ('!=', '==', '<=', '>=', '<', '>')
        cmp2_ops = ('>', '<')
        for lhs, cmp1, rhs, binop, cmp2 in product(self.lhses, cmp_ops,
                                                   self.rhses, self.bin_ops,
                                                   cmp2_ops):
            self.check_complex_cmp_op(lhs, cmp1, rhs, binop, cmp2)

    def test_simple_cmp_ops(self):
        bool_lhses = (DataFrame(randbool(size=(10, 5))),
                      Series(randbool((5,))), randbool())
        bool_rhses = (DataFrame(randbool(size=(10, 5))),
                      Series(randbool((5,))), randbool())
        for lhs, rhs, cmp_op in product(bool_lhses, bool_rhses, self.cmp_ops):
            self.check_simple_cmp_op(lhs, cmp_op, rhs)

    @slow
    def test_binary_arith_ops(self):
        for lhs, op, rhs in product(self.lhses, self.arith_ops, self.rhses):
            self.check_binary_arith_op(lhs, op, rhs)

    def test_modulus(self):
        for lhs, rhs in product(self.lhses, self.rhses):
            self.check_modulus(lhs, '%', rhs)

    def test_floor_division(self):
        for lhs, rhs in product(self.lhses, self.rhses):
            self.check_floor_division(lhs, '//', rhs)

    def test_pow(self):
        tm._skip_if_windows()

        # odd failure on win32 platform, so skip
        for lhs, rhs in product(self.lhses, self.rhses):
            self.check_pow(lhs, '**', rhs)

    @slow
    def test_single_invert_op(self):
        for lhs, op, rhs in product(self.lhses, self.cmp_ops, self.rhses):
            self.check_single_invert_op(lhs, op, rhs)

    @slow
    def test_compound_invert_op(self):
        for lhs, op, rhs in product(self.lhses, self.cmp_ops, self.rhses):
            self.check_compound_invert_op(lhs, op, rhs)

    @slow
    def test_chained_cmp_op(self):
        mids = self.lhses
        cmp_ops = '<', '>'
        for lhs, cmp1, mid, cmp2, rhs in product(self.lhses, cmp_ops,
                                                 mids, cmp_ops, self.rhses):
            self.check_chained_cmp_op(lhs, cmp1, mid, cmp2, rhs)

    def check_equal(self, result, expected):
        if isinstance(result, DataFrame):
            tm.assert_frame_equal(result, expected)
        elif isinstance(result, Series):
            tm.assert_series_equal(result, expected)
        elif isinstance(result, np.ndarray):
            tm.assert_numpy_array_equal(result, expected)
        else:
            assert result == expected

    def check_complex_cmp_op(self, lhs, cmp1, rhs, binop, cmp2):
        skip_these = _scalar_skip
        ex = '(lhs {cmp1} rhs) {binop} (lhs {cmp2} rhs)'.format(cmp1=cmp1,
                                                                binop=binop,
                                                                cmp2=cmp2)
        scalar_with_in_notin = (is_scalar(rhs) and (cmp1 in skip_these or
                                                    cmp2 in skip_these))
        if scalar_with_in_notin:
            with pytest.raises(TypeError):
                pd.eval(ex, engine=self.engine, parser=self.parser)
            with pytest.raises(TypeError):
                pd.eval(ex, engine=self.engine, parser=self.parser,
                        local_dict={'lhs': lhs, 'rhs': rhs})
        else:
            lhs_new = _eval_single_bin(lhs, cmp1, rhs, self.engine)
            rhs_new = _eval_single_bin(lhs, cmp2, rhs, self.engine)
            if (isinstance(lhs_new, Series) and
                    isinstance(rhs_new, DataFrame) and
                    binop in _series_frame_incompatible):
                pass
                # TODO: the code below should be added back when left and right
                # hand side bool ops are fixed.
                #
                # try:
                #     pytest.raises(Exception, pd.eval, ex,
                #                   local_dict={'lhs': lhs, 'rhs': rhs},
                #                   engine=self.engine, parser=self.parser)
                # except AssertionError:
                #     import ipdb
                #
                #     ipdb.set_trace()
                #     raise
            else:
                expected = _eval_single_bin(
                    lhs_new, binop, rhs_new, self.engine)
                result = pd.eval(ex, engine=self.engine, parser=self.parser)
                self.check_equal(result, expected)

    def check_chained_cmp_op(self, lhs, cmp1, mid, cmp2, rhs):

        def check_operands(left, right, cmp_op):
            return _eval_single_bin(left, cmp_op, right, self.engine)

        lhs_new = check_operands(lhs, mid, cmp1)
        rhs_new = check_operands(mid, rhs, cmp2)

        if lhs_new is not None and rhs_new is not None:
            ex1 = 'lhs {0} mid {1} rhs'.format(cmp1, cmp2)
            ex2 = 'lhs {0} mid and mid {1} rhs'.format(cmp1, cmp2)
            ex3 = '(lhs {0} mid) & (mid {1} rhs)'.format(cmp1, cmp2)
            expected = _eval_single_bin(lhs_new, '&', rhs_new, self.engine)

            for ex in (ex1, ex2, ex3):
                result = pd.eval(ex, engine=self.engine,
                                 parser=self.parser)

                tm.assert_almost_equal(result, expected)

    def check_simple_cmp_op(self, lhs, cmp1, rhs):
        ex = 'lhs {0} rhs'.format(cmp1)
        if cmp1 in ('in', 'not in') and not is_list_like(rhs):
            pytest.raises(TypeError, pd.eval, ex, engine=self.engine,
                          parser=self.parser, local_dict={'lhs': lhs,
                                                          'rhs': rhs})
        else:
            expected = _eval_single_bin(lhs, cmp1, rhs, self.engine)
            result = pd.eval(ex, engine=self.engine, parser=self.parser)
            self.check_equal(result, expected)

    def check_binary_arith_op(self, lhs, arith1, rhs):
        ex = 'lhs {0} rhs'.format(arith1)
        result = pd.eval(ex, engine=self.engine, parser=self.parser)
        expected = _eval_single_bin(lhs, arith1, rhs, self.engine)

        tm.assert_almost_equal(result, expected)
        ex = 'lhs {0} rhs {0} rhs'.format(arith1)
        result = pd.eval(ex, engine=self.engine, parser=self.parser)
        nlhs = _eval_single_bin(lhs, arith1, rhs,
                                self.engine)
        self.check_alignment(result, nlhs, rhs, arith1)

    def check_alignment(self, result, nlhs, ghs, op):
        try:
            nlhs, ghs = nlhs.align(ghs)
        except (ValueError, TypeError, AttributeError):
            # ValueError: series frame or frame series align
            # TypeError, AttributeError: series or frame with scalar align
            pass
        else:

            # direct numpy comparison
            expected = self.ne.evaluate('nlhs {0} ghs'.format(op))
            tm.assert_numpy_array_equal(result.values, expected)

    # modulus, pow, and floor division require special casing

    def check_modulus(self, lhs, arith1, rhs):
        ex = 'lhs {0} rhs'.format(arith1)
        result = pd.eval(ex, engine=self.engine, parser=self.parser)
        expected = lhs % rhs

        tm.assert_almost_equal(result, expected)
        expected = self.ne.evaluate('expected {0} rhs'.format(arith1))
        if isinstance(result, (DataFrame, Series)):
            tm.assert_almost_equal(result.values, expected)
        else:
            tm.assert_almost_equal(result, expected.item())

    def check_floor_division(self, lhs, arith1, rhs):
        ex = 'lhs {0} rhs'.format(arith1)

        if self.engine == 'python':
            res = pd.eval(ex, engine=self.engine, parser=self.parser)
            expected = lhs // rhs
            self.check_equal(res, expected)
        else:
            pytest.raises(TypeError, pd.eval, ex,
                          local_dict={'lhs': lhs, 'rhs': rhs},
                          engine=self.engine, parser=self.parser)

    def get_expected_pow_result(self, lhs, rhs):
        try:
            expected = _eval_single_bin(lhs, '**', rhs, self.engine)
        except ValueError as e:
            if str(e).startswith('negative number cannot be '
                                 'raised to a fractional power'):
                if self.engine == 'python':
                    pytest.skip(str(e))
                else:
                    expected = np.nan
            else:
                raise
        return expected

    def check_pow(self, lhs, arith1, rhs):
        ex = 'lhs {0} rhs'.format(arith1)
        expected = self.get_expected_pow_result(lhs, rhs)
        result = pd.eval(ex, engine=self.engine, parser=self.parser)

        if (is_scalar(lhs) and is_scalar(rhs) and
                _is_py3_complex_incompat(result, expected)):
            pytest.raises(AssertionError, tm.assert_numpy_array_equal,
                          result, expected)
        else:
            tm.assert_almost_equal(result, expected)

            ex = '(lhs {0} rhs) {0} rhs'.format(arith1)
            result = pd.eval(ex, engine=self.engine, parser=self.parser)
            expected = self.get_expected_pow_result(
                self.get_expected_pow_result(lhs, rhs), rhs)
            tm.assert_almost_equal(result, expected)

    def check_single_invert_op(self, lhs, cmp1, rhs):
        # simple
        for el in (lhs, rhs):
            try:
                elb = el.astype(bool)
            except AttributeError:
                elb = np.array([bool(el)])
            expected = ~elb
            result = pd.eval('~elb', engine=self.engine, parser=self.parser)
            tm.assert_almost_equal(expected, result)

            for engine in self.current_engines:
                tm.skip_if_no_ne(engine)
                tm.assert_almost_equal(result, pd.eval('~elb', engine=engine,
                                                       parser=self.parser))

    def check_compound_invert_op(self, lhs, cmp1, rhs):
        skip_these = 'in', 'not in'
        ex = '~(lhs {0} rhs)'.format(cmp1)

        if is_scalar(rhs) and cmp1 in skip_these:
            pytest.raises(TypeError, pd.eval, ex, engine=self.engine,
                          parser=self.parser, local_dict={'lhs': lhs,
                                                          'rhs': rhs})
        else:
            # compound
            if is_scalar(lhs) and is_scalar(rhs):
                lhs, rhs = map(lambda x: np.array([x]), (lhs, rhs))
            expected = _eval_single_bin(lhs, cmp1, rhs, self.engine)
            if is_scalar(expected):
                expected = not expected
            else:
                expected = ~expected
            result = pd.eval(ex, engine=self.engine, parser=self.parser)
            tm.assert_almost_equal(expected, result)

            # make sure the other engines work the same as this one
            for engine in self.current_engines:
                tm.skip_if_no_ne(engine)
                ev = pd.eval(ex, engine=self.engine, parser=self.parser)
                tm.assert_almost_equal(ev, result)

    def ex(self, op, var_name='lhs'):
        return '{0}{1}'.format(op, var_name)

    def test_frame_invert(self):
        expr = self.ex('~')

        # ~ ##
        # frame
        # float always raises
        lhs = DataFrame(randn(5, 2))
        if self.engine == 'numexpr':
            with pytest.raises(NotImplementedError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)

        # int raises on numexpr
        lhs = DataFrame(randint(5, size=(5, 2)))
        if self.engine == 'numexpr':
            with pytest.raises(NotImplementedError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = ~lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_frame_equal(expect, result)

        # bool always works
        lhs = DataFrame(rand(5, 2) > 0.5)
        expect = ~lhs
        result = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert_frame_equal(expect, result)

        # object raises
        lhs = DataFrame({'b': ['a', 1, 2.0], 'c': rand(3) > 0.5})
        if self.engine == 'numexpr':
            with pytest.raises(ValueError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)

    def test_series_invert(self):
        # ~ ####
        expr = self.ex('~')

        # series
        # float raises
        lhs = Series(randn(5))
        if self.engine == 'numexpr':
            with pytest.raises(NotImplementedError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)

        # int raises on numexpr
        lhs = Series(randint(5, size=5))
        if self.engine == 'numexpr':
            with pytest.raises(NotImplementedError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = ~lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_series_equal(expect, result)

        # bool
        lhs = Series(rand(5) > 0.5)
        expect = ~lhs
        result = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert_series_equal(expect, result)

        # float
        # int
        # bool

        # object
        lhs = Series(['a', 1, 2.0])
        if self.engine == 'numexpr':
            with pytest.raises(ValueError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)

    def test_frame_negate(self):
        expr = self.ex('-')

        # float
        lhs = DataFrame(randn(5, 2))
        expect = -lhs
        result = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert_frame_equal(expect, result)

        # int
        lhs = DataFrame(randint(5, size=(5, 2)))
        expect = -lhs
        result = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert_frame_equal(expect, result)

        # bool doesn't work with numexpr but works elsewhere
        lhs = DataFrame(rand(5, 2) > 0.5)
        if self.engine == 'numexpr':
            with pytest.raises(NotImplementedError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = -lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_frame_equal(expect, result)

    def test_series_negate(self):
        expr = self.ex('-')

        # float
        lhs = Series(randn(5))
        expect = -lhs
        result = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert_series_equal(expect, result)

        # int
        lhs = Series(randint(5, size=5))
        expect = -lhs
        result = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert_series_equal(expect, result)

        # bool doesn't work with numexpr but works elsewhere
        lhs = Series(rand(5) > 0.5)
        if self.engine == 'numexpr':
            with pytest.raises(NotImplementedError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = -lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_series_equal(expect, result)

    def test_frame_pos(self):
        expr = self.ex('+')

        # float
        lhs = DataFrame(randn(5, 2))
        if self.engine == 'python':
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_frame_equal(expect, result)

        # int
        lhs = DataFrame(randint(5, size=(5, 2)))
        if self.engine == 'python':
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_frame_equal(expect, result)

        # bool doesn't work with numexpr but works elsewhere
        lhs = DataFrame(rand(5, 2) > 0.5)
        if self.engine == 'python':
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_frame_equal(expect, result)

    def test_series_pos(self):
        expr = self.ex('+')

        # float
        lhs = Series(randn(5))
        if self.engine == 'python':
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_series_equal(expect, result)

        # int
        lhs = Series(randint(5, size=5))
        if self.engine == 'python':
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_series_equal(expect, result)

        # bool doesn't work with numexpr but works elsewhere
        lhs = Series(rand(5) > 0.5)
        if self.engine == 'python':
            with pytest.raises(TypeError):
                result = pd.eval(expr, engine=self.engine, parser=self.parser)
        else:
            expect = lhs
            result = pd.eval(expr, engine=self.engine, parser=self.parser)
            assert_series_equal(expect, result)

    def test_scalar_unary(self):
        with pytest.raises(TypeError):
            pd.eval('~1.0', engine=self.engine, parser=self.parser)

        assert pd.eval('-1.0', parser=self.parser,
                       engine=self.engine) == -1.0
        assert pd.eval('+1.0', parser=self.parser,
                       engine=self.engine) == +1.0
        assert pd.eval('~1', parser=self.parser,
                       engine=self.engine) == ~1
        assert pd.eval('-1', parser=self.parser,
                       engine=self.engine) == -1
        assert pd.eval('+1', parser=self.parser,
                       engine=self.engine) == +1
        assert pd.eval('~True', parser=self.parser,
                       engine=self.engine) == ~True
        assert pd.eval('~False', parser=self.parser,
                       engine=self.engine) == ~False
        assert pd.eval('-True', parser=self.parser,
                       engine=self.engine) == -True
        assert pd.eval('-False', parser=self.parser,
                       engine=self.engine) == -False
        assert pd.eval('+True', parser=self.parser,
                       engine=self.engine) == +True
        assert pd.eval('+False', parser=self.parser,
                       engine=self.engine) == +False

    def test_unary_in_array(self):
        # GH 11235
        assert_numpy_array_equal(
            pd.eval('[-True, True, ~True, +True,'
                    '-False, False, ~False, +False,'
                    '-37, 37, ~37, +37]'),
            np.array([-True, True, ~True, +True,
                      -False, False, ~False, +False,
                      -37, 37, ~37, +37], dtype=np.object_))

    def test_disallow_scalar_bool_ops(self):
        exprs = '1 or 2', '1 and 2'
        exprs += 'a and b', 'a or b'
        exprs += '1 or 2 and (3 + 2) > 3',
        exprs += '2 * x > 2 or 1 and 2',
        exprs += '2 * df > 3 and 1 or a',

        x, a, b, df = np.random.randn(3), 1, 2, DataFrame(randn(3, 2))  # noqa
        for ex in exprs:
            with pytest.raises(NotImplementedError):
                pd.eval(ex, engine=self.engine, parser=self.parser)

    def test_identical(self):
        # see gh-10546
        x = 1
        result = pd.eval('x', engine=self.engine, parser=self.parser)
        assert result == 1
        assert is_scalar(result)

        x = 1.5
        result = pd.eval('x', engine=self.engine, parser=self.parser)
        assert result == 1.5
        assert is_scalar(result)

        x = False
        result = pd.eval('x', engine=self.engine, parser=self.parser)
        assert not result
        assert is_bool(result)
        assert is_scalar(result)

        x = np.array([1])
        result = pd.eval('x', engine=self.engine, parser=self.parser)
        tm.assert_numpy_array_equal(result, np.array([1]))
        assert result.shape == (1, )

        x = np.array([1.5])
        result = pd.eval('x', engine=self.engine, parser=self.parser)
        tm.assert_numpy_array_equal(result, np.array([1.5]))
        assert result.shape == (1, )

        x = np.array([False])  # noqa
        result = pd.eval('x', engine=self.engine, parser=self.parser)
        tm.assert_numpy_array_equal(result, np.array([False]))
        assert result.shape == (1, )

    def test_line_continuation(self):
        # GH 11149
        exp = """1 + 2 * \
        5 - 1 + 2 """
        result = pd.eval(exp, engine=self.engine, parser=self.parser)
        assert result == 12

    def test_float_truncation(self):
        # GH 14241
        exp = '1000000000.006'
        result = pd.eval(exp, engine=self.engine, parser=self.parser)
        expected = np.float64(exp)
        assert result == expected

        df = pd.DataFrame({'A': [1000000000.0009,
                                 1000000000.0011,
                                 1000000000.0015]})
        cutoff = 1000000000.0006
        result = df.query("A < %.4f" % cutoff)
        assert result.empty

        cutoff = 1000000000.0010
        result = df.query("A > %.4f" % cutoff)
        expected = df.loc[[1, 2], :]
        tm.assert_frame_equal(expected, result)

        exact = 1000000000.0011
        result = df.query('A == %.4f' % exact)
        expected = df.loc[[1], :]
        tm.assert_frame_equal(expected, result)


class TestEvalNumexprPython(TestEvalNumexprPandas):

    @classmethod
    def setup_class(cls):
        super(TestEvalNumexprPython, cls).setup_class()
        tm.skip_if_no_ne()
        import numexpr as ne
        cls.ne = ne
        cls.engine = 'numexpr'
        cls.parser = 'python'

    def setup_ops(self):
        self.cmp_ops = list(filter(lambda x: x not in ('in', 'not in'),
                                   expr._cmp_ops_syms))
        self.cmp2_ops = self.cmp_ops[::-1]
        self.bin_ops = [s for s in expr._bool_ops_syms
                        if s not in ('and', 'or')]
        self.special_case_ops = _special_case_arith_ops_syms
        self.arith_ops = _good_arith_ops
        self.unary_ops = '+', '-', '~'

    def check_chained_cmp_op(self, lhs, cmp1, mid, cmp2, rhs):
        ex1 = 'lhs {0} mid {1} rhs'.format(cmp1, cmp2)
        with pytest.raises(NotImplementedError):
            pd.eval(ex1, engine=self.engine, parser=self.parser)


class TestEvalPythonPython(TestEvalNumexprPython):

    @classmethod
    def setup_class(cls):
        super(TestEvalPythonPython, cls).setup_class()
        cls.engine = 'python'
        cls.parser = 'python'

    def check_modulus(self, lhs, arith1, rhs):
        ex = 'lhs {0} rhs'.format(arith1)
        result = pd.eval(ex, engine=self.engine, parser=self.parser)

        expected = lhs % rhs
        tm.assert_almost_equal(result, expected)

        expected = _eval_single_bin(expected, arith1, rhs, self.engine)
        tm.assert_almost_equal(result, expected)

    def check_alignment(self, result, nlhs, ghs, op):
        try:
            nlhs, ghs = nlhs.align(ghs)
        except (ValueError, TypeError, AttributeError):
            # ValueError: series frame or frame series align
            # TypeError, AttributeError: series or frame with scalar align
            pass
        else:
            expected = eval('nlhs {0} ghs'.format(op))
            tm.assert_almost_equal(result, expected)


class TestEvalPythonPandas(TestEvalPythonPython):

    @classmethod
    def setup_class(cls):
        super(TestEvalPythonPandas, cls).setup_class()
        cls.engine = 'python'
        cls.parser = 'pandas'

    def check_chained_cmp_op(self, lhs, cmp1, mid, cmp2, rhs):
        TestEvalNumexprPandas.check_chained_cmp_op(self, lhs, cmp1, mid, cmp2,
                                                   rhs)


f = lambda *args, **kwargs: np.random.randn()


# -------------------------------------
# gh-12388: Typecasting rules consistency with python


class TestTypeCasting(object):
    @pytest.mark.parametrize('op', ['+', '-', '*', '**', '/'])
    # maybe someday... numexpr has too many upcasting rules now
    # chain(*(np.sctypes[x] for x in ['uint', 'int', 'float']))
    @pytest.mark.parametrize('dt', [np.float32, np.float64])
    def test_binop_typecasting(self, engine, parser, op, dt):
        df = mkdf(5, 3, data_gen_f=f, dtype=dt)
        s = 'df {} 3'.format(op)
        res = pd.eval(s, engine=engine, parser=parser)
        assert df.values.dtype == dt
        assert res.values.dtype == dt
        assert_frame_equal(res, eval(s))

        s = '3 {} df'.format(op)
        res = pd.eval(s, engine=engine, parser=parser)
        assert df.values.dtype == dt
        assert res.values.dtype == dt
        assert_frame_equal(res, eval(s))


# -------------------------------------
# Basic and complex alignment

def _is_datetime(x):
    return issubclass(x.dtype.type, np.datetime64)


def should_warn(*args):
    not_mono = not any(map(operator.attrgetter('is_monotonic'), args))
    only_one_dt = reduce(operator.xor, map(_is_datetime, args))
    return not_mono and only_one_dt


class TestAlignment(object):

    index_types = 'i', 'u', 'dt'
    lhs_index_types = index_types + ('s',)  # 'p'

    def test_align_nested_unary_op(self, engine, parser):
        s = 'df * ~2'
        df = mkdf(5, 3, data_gen_f=f)
        res = pd.eval(s, engine=engine, parser=parser)
        assert_frame_equal(res, df * ~2)

    def test_basic_frame_alignment(self, engine, parser):
        args = product(self.lhs_index_types, self.index_types,
                       self.index_types)
        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            for lr_idx_type, rr_idx_type, c_idx_type in args:
                df = mkdf(10, 10, data_gen_f=f, r_idx_type=lr_idx_type,
                          c_idx_type=c_idx_type)
                df2 = mkdf(20, 10, data_gen_f=f, r_idx_type=rr_idx_type,
                           c_idx_type=c_idx_type)
                # only warns if not monotonic and not sortable
                if should_warn(df.index, df2.index):
                    with tm.assert_produces_warning(RuntimeWarning):
                        res = pd.eval('df + df2', engine=engine, parser=parser)
                else:
                    res = pd.eval('df + df2', engine=engine, parser=parser)
                assert_frame_equal(res, df + df2)

    def test_frame_comparison(self, engine, parser):
        args = product(self.lhs_index_types, repeat=2)
        for r_idx_type, c_idx_type in args:
            df = mkdf(10, 10, data_gen_f=f, r_idx_type=r_idx_type,
                      c_idx_type=c_idx_type)
            res = pd.eval('df < 2', engine=engine, parser=parser)
            assert_frame_equal(res, df < 2)

            df3 = DataFrame(randn(*df.shape), index=df.index,
                            columns=df.columns)
            res = pd.eval('df < df3', engine=engine, parser=parser)
            assert_frame_equal(res, df < df3)

    @slow
    def test_medium_complex_frame_alignment(self, engine, parser):
        args = product(self.lhs_index_types, self.index_types,
                       self.index_types, self.index_types)

        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)

            for r1, c1, r2, c2 in args:
                df = mkdf(3, 2, data_gen_f=f, r_idx_type=r1, c_idx_type=c1)
                df2 = mkdf(4, 2, data_gen_f=f, r_idx_type=r2, c_idx_type=c2)
                df3 = mkdf(5, 2, data_gen_f=f, r_idx_type=r2, c_idx_type=c2)
                if should_warn(df.index, df2.index, df3.index):
                    with tm.assert_produces_warning(RuntimeWarning):
                        res = pd.eval('df + df2 + df3', engine=engine,
                                      parser=parser)
                else:
                    res = pd.eval('df + df2 + df3',
                                  engine=engine, parser=parser)
                assert_frame_equal(res, df + df2 + df3)

    def test_basic_frame_series_alignment(self, engine, parser):
        def testit(r_idx_type, c_idx_type, index_name):
            df = mkdf(10, 10, data_gen_f=f, r_idx_type=r_idx_type,
                      c_idx_type=c_idx_type)
            index = getattr(df, index_name)
            s = Series(np.random.randn(5), index[:5])

            if should_warn(df.index, s.index):
                with tm.assert_produces_warning(RuntimeWarning):
                    res = pd.eval('df + s', engine=engine, parser=parser)
            else:
                res = pd.eval('df + s', engine=engine, parser=parser)

            if r_idx_type == 'dt' or c_idx_type == 'dt':
                expected = df.add(s) if engine == 'numexpr' else df + s
            else:
                expected = df + s
            assert_frame_equal(res, expected)

        args = product(self.lhs_index_types, self.index_types,
                       ('index', 'columns'))
        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            for r_idx_type, c_idx_type, index_name in args:
                testit(r_idx_type, c_idx_type, index_name)

    def test_basic_series_frame_alignment(self, engine, parser):
        def testit(r_idx_type, c_idx_type, index_name):
            df = mkdf(10, 7, data_gen_f=f, r_idx_type=r_idx_type,
                      c_idx_type=c_idx_type)
            index = getattr(df, index_name)
            s = Series(np.random.randn(5), index[:5])
            if should_warn(s.index, df.index):
                with tm.assert_produces_warning(RuntimeWarning):
                    res = pd.eval('s + df', engine=engine, parser=parser)
            else:
                res = pd.eval('s + df', engine=engine, parser=parser)

            if r_idx_type == 'dt' or c_idx_type == 'dt':
                expected = df.add(s) if engine == 'numexpr' else s + df
            else:
                expected = s + df
            assert_frame_equal(res, expected)

        # only test dt with dt, otherwise weird joins result
        args = product(['i', 'u', 's'], ['i', 'u', 's'], ('index', 'columns'))
        with warnings.catch_warnings(record=True):
            for r_idx_type, c_idx_type, index_name in args:
                testit(r_idx_type, c_idx_type, index_name)

        # dt with dt
        args = product(['dt'], ['dt'], ('index', 'columns'))
        with warnings.catch_warnings(record=True):
            for r_idx_type, c_idx_type, index_name in args:
                testit(r_idx_type, c_idx_type, index_name)

    def test_series_frame_commutativity(self, engine, parser):
        args = product(self.lhs_index_types, self.index_types, ('+', '*'),
                       ('index', 'columns'))

        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            for r_idx_type, c_idx_type, op, index_name in args:
                df = mkdf(10, 10, data_gen_f=f, r_idx_type=r_idx_type,
                          c_idx_type=c_idx_type)
                index = getattr(df, index_name)
                s = Series(np.random.randn(5), index[:5])

                lhs = 's {0} df'.format(op)
                rhs = 'df {0} s'.format(op)
                if should_warn(df.index, s.index):
                    with tm.assert_produces_warning(RuntimeWarning):
                        a = pd.eval(lhs, engine=engine, parser=parser)
                    with tm.assert_produces_warning(RuntimeWarning):
                        b = pd.eval(rhs, engine=engine, parser=parser)
                else:
                    a = pd.eval(lhs, engine=engine, parser=parser)
                    b = pd.eval(rhs, engine=engine, parser=parser)

                if r_idx_type != 'dt' and c_idx_type != 'dt':
                    if engine == 'numexpr':
                        assert_frame_equal(a, b)

    @slow
    def test_complex_series_frame_alignment(self, engine, parser):
        import random
        args = product(self.lhs_index_types, self.index_types,
                       self.index_types, self.index_types)
        n = 3
        m1 = 5
        m2 = 2 * m1

        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            for r1, r2, c1, c2 in args:
                index_name = random.choice(['index', 'columns'])
                obj_name = random.choice(['df', 'df2'])

                df = mkdf(m1, n, data_gen_f=f, r_idx_type=r1, c_idx_type=c1)
                df2 = mkdf(m2, n, data_gen_f=f, r_idx_type=r2, c_idx_type=c2)
                index = getattr(locals().get(obj_name), index_name)
                s = Series(np.random.randn(n), index[:n])

                if r2 == 'dt' or c2 == 'dt':
                    if engine == 'numexpr':
                        expected2 = df2.add(s)
                    else:
                        expected2 = df2 + s
                else:
                    expected2 = df2 + s

                if r1 == 'dt' or c1 == 'dt':
                    if engine == 'numexpr':
                        expected = expected2.add(df)
                    else:
                        expected = expected2 + df
                else:
                    expected = expected2 + df

                if should_warn(df2.index, s.index, df.index):
                    with tm.assert_produces_warning(RuntimeWarning):
                        res = pd.eval('df2 + s + df', engine=engine,
                                      parser=parser)
                else:
                    res = pd.eval('df2 + s + df', engine=engine, parser=parser)
                assert res.shape == expected.shape
                assert_frame_equal(res, expected)

    def test_performance_warning_for_poor_alignment(self, engine, parser):
        df = DataFrame(randn(1000, 10))
        s = Series(randn(10000))
        if engine == 'numexpr':
            seen = PerformanceWarning
        else:
            seen = False

        with assert_produces_warning(seen):
            pd.eval('df + s', engine=engine, parser=parser)

        s = Series(randn(1000))
        with assert_produces_warning(False):
            pd.eval('df + s', engine=engine, parser=parser)

        df = DataFrame(randn(10, 10000))
        s = Series(randn(10000))
        with assert_produces_warning(False):
            pd.eval('df + s', engine=engine, parser=parser)

        df = DataFrame(randn(10, 10))
        s = Series(randn(10000))

        is_python_engine = engine == 'python'

        if not is_python_engine:
            wrn = PerformanceWarning
        else:
            wrn = False

        with assert_produces_warning(wrn) as w:
            pd.eval('df + s', engine=engine, parser=parser)

            if not is_python_engine:
                assert len(w) == 1
                msg = str(w[0].message)
                expected = ("Alignment difference on axis {0} is larger"
                            " than an order of magnitude on term {1!r}, "
                            "by more than {2:.4g}; performance may suffer"
                            "".format(1, 'df', np.log10(s.size - df.shape[1])))
                assert msg == expected


# ------------------------------------
# Slightly more complex ops

class TestOperationsNumExprPandas(object):

    @classmethod
    def setup_class(cls):
        tm.skip_if_no_ne()
        cls.engine = 'numexpr'
        cls.parser = 'pandas'
        cls.arith_ops = expr._arith_ops_syms + expr._cmp_ops_syms

    @classmethod
    def teardown_class(cls):
        del cls.engine, cls.parser

    def eval(self, *args, **kwargs):
        kwargs['engine'] = self.engine
        kwargs['parser'] = self.parser
        kwargs['level'] = kwargs.pop('level', 0) + 1
        return pd.eval(*args, **kwargs)

    def test_simple_arith_ops(self):
        ops = self.arith_ops

        for op in filter(lambda x: x != '//', ops):
            ex = '1 {0} 1'.format(op)
            ex2 = 'x {0} 1'.format(op)
            ex3 = '1 {0} (x + 1)'.format(op)

            if op in ('in', 'not in'):
                pytest.raises(TypeError, pd.eval, ex,
                              engine=self.engine, parser=self.parser)
            else:
                expec = _eval_single_bin(1, op, 1, self.engine)
                x = self.eval(ex, engine=self.engine, parser=self.parser)
                assert x == expec

                expec = _eval_single_bin(x, op, 1, self.engine)
                y = self.eval(ex2, local_dict={'x': x}, engine=self.engine,
                              parser=self.parser)
                assert y == expec

                expec = _eval_single_bin(1, op, x + 1, self.engine)
                y = self.eval(ex3, local_dict={'x': x},
                              engine=self.engine, parser=self.parser)
                assert y == expec

    def test_simple_bool_ops(self):
        for op, lhs, rhs in product(expr._bool_ops_syms, (True, False),
                                    (True, False)):
            ex = '{0} {1} {2}'.format(lhs, op, rhs)
            res = self.eval(ex)
            exp = eval(ex)
            assert res == exp

    def test_bool_ops_with_constants(self):
        for op, lhs, rhs in product(expr._bool_ops_syms, ('True', 'False'),
                                    ('True', 'False')):
            ex = '{0} {1} {2}'.format(lhs, op, rhs)
            res = self.eval(ex)
            exp = eval(ex)
            assert res == exp

    def test_panel_fails(self):
        with catch_warnings(record=True):
            x = Panel(randn(3, 4, 5))
            y = Series(randn(10))
            with pytest.raises(NotImplementedError):
                self.eval('x + y',
                          local_dict={'x': x, 'y': y})

    def test_4d_ndarray_fails(self):
        x = randn(3, 4, 5, 6)
        y = Series(randn(10))
        with pytest.raises(NotImplementedError):
            self.eval('x + y',
                      local_dict={'x': x, 'y': y})

    def test_constant(self):
        x = self.eval('1')
        assert x == 1

    def test_single_variable(self):
        df = DataFrame(randn(10, 2))
        df2 = self.eval('df', local_dict={'df': df})
        assert_frame_equal(df, df2)

    def test_truediv(self):
        s = np.array([1])
        ex = 's / 1'
        d = {'s': s}  # noqa

        if PY3:
            res = self.eval(ex, truediv=False)
            tm.assert_numpy_array_equal(res, np.array([1.0]))

            res = self.eval(ex, truediv=True)
            tm.assert_numpy_array_equal(res, np.array([1.0]))

            res = self.eval('1 / 2', truediv=True)
            expec = 0.5
            assert res == expec

            res = self.eval('1 / 2', truediv=False)
            expec = 0.5
            assert res == expec

            res = self.eval('s / 2', truediv=False)
            expec = 0.5
            assert res == expec

            res = self.eval('s / 2', truediv=True)
            expec = 0.5
            assert res == expec
        else:
            res = self.eval(ex, truediv=False)
            tm.assert_numpy_array_equal(res, np.array([1]))

            res = self.eval(ex, truediv=True)
            tm.assert_numpy_array_equal(res, np.array([1.0]))

            res = self.eval('1 / 2', truediv=True)
            expec = 0.5
            assert res == expec

            res = self.eval('1 / 2', truediv=False)
            expec = 0
            assert res == expec

            res = self.eval('s / 2', truediv=False)
            expec = 0
            assert res == expec

            res = self.eval('s / 2', truediv=True)
            expec = 0.5
            assert res == expec

    def test_failing_subscript_with_name_error(self):
        df = DataFrame(np.random.randn(5, 3))  # noqa
        with pytest.raises(NameError):
            self.eval('df[x > 2] > 2')

    def test_lhs_expression_subscript(self):
        df = DataFrame(np.random.randn(5, 3))
        result = self.eval('(df + 1)[df > 2]', local_dict={'df': df})
        expected = (df + 1)[df > 2]
        assert_frame_equal(result, expected)

    def test_attr_expression(self):
        df = DataFrame(np.random.randn(5, 3), columns=list('abc'))
        expr1 = 'df.a < df.b'
        expec1 = df.a < df.b
        expr2 = 'df.a + df.b + df.c'
        expec2 = df.a + df.b + df.c
        expr3 = 'df.a + df.b + df.c[df.b < 0]'
        expec3 = df.a + df.b + df.c[df.b < 0]
        exprs = expr1, expr2, expr3
        expecs = expec1, expec2, expec3
        for e, expec in zip(exprs, expecs):
            assert_series_equal(expec, self.eval(e, local_dict={'df': df}))

    def test_assignment_fails(self):
        df = DataFrame(np.random.randn(5, 3), columns=list('abc'))
        df2 = DataFrame(np.random.randn(5, 3))
        expr1 = 'df = df2'
        pytest.raises(ValueError, self.eval, expr1,
                      local_dict={'df': df, 'df2': df2})

    def test_assignment_column(self):
        df = DataFrame(np.random.randn(5, 2), columns=list('ab'))
        orig_df = df.copy()

        # multiple assignees
        pytest.raises(SyntaxError, df.eval, 'd c = a + b')

        # invalid assignees
        pytest.raises(SyntaxError, df.eval, 'd,c = a + b')
        pytest.raises(SyntaxError, df.eval, 'Timestamp("20131001") = a + b')

        # single assignment - existing variable
        expected = orig_df.copy()
        expected['a'] = expected['a'] + expected['b']
        df = orig_df.copy()
        df.eval('a = a + b', inplace=True)
        assert_frame_equal(df, expected)

        # single assignment - new variable
        expected = orig_df.copy()
        expected['c'] = expected['a'] + expected['b']
        df = orig_df.copy()
        df.eval('c = a + b', inplace=True)
        assert_frame_equal(df, expected)

        # with a local name overlap
        def f():
            df = orig_df.copy()
            a = 1  # noqa
            df.eval('a = 1 + b', inplace=True)
            return df

        df = f()
        expected = orig_df.copy()
        expected['a'] = 1 + expected['b']
        assert_frame_equal(df, expected)

        df = orig_df.copy()

        def f():
            a = 1  # noqa
            old_a = df.a.copy()
            df.eval('a = a + b', inplace=True)
            result = old_a + df.b
            assert_series_equal(result, df.a, check_names=False)
            assert result.name is None

        f()

        # multiple assignment
        df = orig_df.copy()
        df.eval('c = a + b', inplace=True)
        pytest.raises(SyntaxError, df.eval, 'c = a = b')

        # explicit targets
        df = orig_df.copy()
        self.eval('c = df.a + df.b', local_dict={'df': df},
                  target=df, inplace=True)
        expected = orig_df.copy()
        expected['c'] = expected['a'] + expected['b']
        assert_frame_equal(df, expected)

    def test_column_in(self):
        # GH 11235
        df = DataFrame({'a': [11], 'b': [-32]})
        result = df.eval('a in [11, -32]')
        expected = Series([True])
        assert_series_equal(result, expected)

    def assignment_not_inplace(self):
        # see gh-9297
        df = DataFrame(np.random.randn(5, 2), columns=list('ab'))

        actual = df.eval('c = a + b', inplace=False)
        assert actual is not None

        expected = df.copy()
        expected['c'] = expected['a'] + expected['b']
        tm.assert_frame_equal(df, expected)

        # Default for inplace will change
        with tm.assert_produces_warnings(FutureWarning):
            df.eval('c = a + b')

        # but don't warn without assignment
        with tm.assert_produces_warnings(None):
            df.eval('a + b')

    def test_multi_line_expression(self):
        # GH 11149
        df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        expected = df.copy()

        expected['c'] = expected['a'] + expected['b']
        expected['d'] = expected['c'] + expected['b']
        ans = df.eval("""
        c = a + b
        d = c + b""", inplace=True)
        assert_frame_equal(expected, df)
        assert ans is None

        expected['a'] = expected['a'] - 1
        expected['e'] = expected['a'] + 2
        ans = df.eval("""
        a = a - 1
        e = a + 2""", inplace=True)
        assert_frame_equal(expected, df)
        assert ans is None

        # multi-line not valid if not all assignments
        with pytest.raises(ValueError):
            df.eval("""
            a = b + 2
            b - 2""", inplace=False)

    def test_multi_line_expression_not_inplace(self):
        # GH 11149
        df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        expected = df.copy()

        expected['c'] = expected['a'] + expected['b']
        expected['d'] = expected['c'] + expected['b']
        df = df.eval("""
        c = a + b
        d = c + b""", inplace=False)
        assert_frame_equal(expected, df)

        expected['a'] = expected['a'] - 1
        expected['e'] = expected['a'] + 2
        df = df.eval("""
        a = a - 1
        e = a + 2""", inplace=False)
        assert_frame_equal(expected, df)

    def test_multi_line_expression_local_variable(self):
        # GH 15342
        df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        expected = df.copy()

        local_var = 7
        expected['c'] = expected['a'] * local_var
        expected['d'] = expected['c'] + local_var
        ans = df.eval("""
        c = a * @local_var
        d = c + @local_var
        """, inplace=True)
        assert_frame_equal(expected, df)
        assert ans is None

    def test_assignment_in_query(self):
        # GH 8664
        df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        df_orig = df.copy()
        with pytest.raises(ValueError):
            df.query('a = 1')
        assert_frame_equal(df, df_orig)

    def query_inplace(self):
        # GH 11149
        df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        expected = df.copy()
        expected = expected[expected['a'] == 2]
        df.query('a == 2', inplace=True)
        assert_frame_equal(expected, df)

    def test_basic_period_index_boolean_expression(self):
        df = mkdf(2, 2, data_gen_f=f, c_idx_type='p', r_idx_type='i')

        e = df < 2
        r = self.eval('df < 2', local_dict={'df': df})
        x = df < 2

        assert_frame_equal(r, e)
        assert_frame_equal(x, e)

    def test_basic_period_index_subscript_expression(self):
        df = mkdf(2, 2, data_gen_f=f, c_idx_type='p', r_idx_type='i')
        r = self.eval('df[df < 2 + 3]', local_dict={'df': df})
        e = df[df < 2 + 3]
        assert_frame_equal(r, e)

    def test_nested_period_index_subscript_expression(self):
        df = mkdf(2, 2, data_gen_f=f, c_idx_type='p', r_idx_type='i')
        r = self.eval('df[df[df < 2] < 2] + df * 2', local_dict={'df': df})
        e = df[df[df < 2] < 2] + df * 2
        assert_frame_equal(r, e)

    def test_date_boolean(self):
        df = DataFrame(randn(5, 3))
        df['dates1'] = date_range('1/1/2012', periods=5)
        res = self.eval('df.dates1 < 20130101', local_dict={'df': df},
                        engine=self.engine, parser=self.parser)
        expec = df.dates1 < '20130101'
        assert_series_equal(res, expec, check_names=False)

    def test_simple_in_ops(self):
        if self.parser != 'python':
            res = pd.eval('1 in [1, 2]', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('2 in (1, 2)', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('3 in (1, 2)', engine=self.engine,
                          parser=self.parser)
            assert not res

            res = pd.eval('3 not in (1, 2)', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('[3] not in (1, 2)', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('[3] in ([3], 2)', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('[[3]] in [[[3]], 2]', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('(3,) in [(3,), 2]', engine=self.engine,
                          parser=self.parser)
            assert res

            res = pd.eval('(3,) not in [(3,), 2]', engine=self.engine,
                          parser=self.parser)
            assert not res

            res = pd.eval('[(3,)] in [[(3,)], 2]', engine=self.engine,
                          parser=self.parser)
            assert res
        else:
            with pytest.raises(NotImplementedError):
                pd.eval('1 in [1, 2]', engine=self.engine, parser=self.parser)
            with pytest.raises(NotImplementedError):
                pd.eval('2 in (1, 2)', engine=self.engine, parser=self.parser)
            with pytest.raises(NotImplementedError):
                pd.eval('3 in (1, 2)', engine=self.engine, parser=self.parser)
            with pytest.raises(NotImplementedError):
                pd.eval('3 not in (1, 2)', engine=self.engine,
                        parser=self.parser)
            with pytest.raises(NotImplementedError):
                pd.eval('[(3,)] in (1, 2, [(3,)])', engine=self.engine,
                        parser=self.parser)
            with pytest.raises(NotImplementedError):
                pd.eval('[3] not in (1, 2, [[3]])', engine=self.engine,
                        parser=self.parser)


class TestOperationsNumExprPython(TestOperationsNumExprPandas):

    @classmethod
    def setup_class(cls):
        super(TestOperationsNumExprPython, cls).setup_class()
        cls.engine = 'numexpr'
        cls.parser = 'python'
        tm.skip_if_no_ne(cls.engine)
        cls.arith_ops = expr._arith_ops_syms + expr._cmp_ops_syms
        cls.arith_ops = filter(lambda x: x not in ('in', 'not in'),
                               cls.arith_ops)

    def test_check_many_exprs(self):
        a = 1  # noqa
        expr = ' * '.join('a' * 33)
        expected = 1
        res = pd.eval(expr, engine=self.engine, parser=self.parser)
        assert res == expected

    def test_fails_and(self):
        df = DataFrame(np.random.randn(5, 3))
        pytest.raises(NotImplementedError, pd.eval, 'df > 2 and df > 3',
                      local_dict={'df': df}, parser=self.parser,
                      engine=self.engine)

    def test_fails_or(self):
        df = DataFrame(np.random.randn(5, 3))
        pytest.raises(NotImplementedError, pd.eval, 'df > 2 or df > 3',
                      local_dict={'df': df}, parser=self.parser,
                      engine=self.engine)

    def test_fails_not(self):
        df = DataFrame(np.random.randn(5, 3))
        pytest.raises(NotImplementedError, pd.eval, 'not df > 2',
                      local_dict={'df': df}, parser=self.parser,
                      engine=self.engine)

    def test_fails_ampersand(self):
        df = DataFrame(np.random.randn(5, 3))  # noqa
        ex = '(df + 2)[df > 1] > 0 & (df > 0)'
        with pytest.raises(NotImplementedError):
            pd.eval(ex, parser=self.parser, engine=self.engine)

    def test_fails_pipe(self):
        df = DataFrame(np.random.randn(5, 3))  # noqa
        ex = '(df + 2)[df > 1] > 0 | (df > 0)'
        with pytest.raises(NotImplementedError):
            pd.eval(ex, parser=self.parser, engine=self.engine)

    def test_bool_ops_with_constants(self):
        for op, lhs, rhs in product(expr._bool_ops_syms, ('True', 'False'),
                                    ('True', 'False')):
            ex = '{0} {1} {2}'.format(lhs, op, rhs)
            if op in ('and', 'or'):
                with pytest.raises(NotImplementedError):
                    self.eval(ex)
            else:
                res = self.eval(ex)
                exp = eval(ex)
                assert res == exp

    def test_simple_bool_ops(self):
        for op, lhs, rhs in product(expr._bool_ops_syms, (True, False),
                                    (True, False)):
            ex = 'lhs {0} rhs'.format(op)
            if op in ('and', 'or'):
                with pytest.raises(NotImplementedError):
                    pd.eval(ex, engine=self.engine, parser=self.parser)
            else:
                res = pd.eval(ex, engine=self.engine, parser=self.parser)
                exp = eval(ex)
                assert res == exp


class TestOperationsPythonPython(TestOperationsNumExprPython):

    @classmethod
    def setup_class(cls):
        super(TestOperationsPythonPython, cls).setup_class()
        cls.engine = cls.parser = 'python'
        cls.arith_ops = expr._arith_ops_syms + expr._cmp_ops_syms
        cls.arith_ops = filter(lambda x: x not in ('in', 'not in'),
                               cls.arith_ops)


class TestOperationsPythonPandas(TestOperationsNumExprPandas):

    @classmethod
    def setup_class(cls):
        super(TestOperationsPythonPandas, cls).setup_class()
        cls.engine = 'python'
        cls.parser = 'pandas'
        cls.arith_ops = expr._arith_ops_syms + expr._cmp_ops_syms


class TestMathPythonPython(object):

    @classmethod
    def setup_class(cls):
        tm.skip_if_no_ne()
        cls.engine = 'python'
        cls.parser = 'pandas'
        cls.unary_fns = _unary_math_ops
        cls.binary_fns = _binary_math_ops

    @classmethod
    def teardown_class(cls):
        del cls.engine, cls.parser

    def eval(self, *args, **kwargs):
        kwargs['engine'] = self.engine
        kwargs['parser'] = self.parser
        kwargs['level'] = kwargs.pop('level', 0) + 1
        return pd.eval(*args, **kwargs)

    def test_unary_functions(self):
        df = DataFrame({'a': np.random.randn(10)})
        a = df.a
        for fn in self.unary_fns:
            expr = "{0}(a)".format(fn)
            got = self.eval(expr)
            with np.errstate(all='ignore'):
                expect = getattr(np, fn)(a)
            tm.assert_series_equal(got, expect, check_names=False)

    def test_binary_functions(self):
        df = DataFrame({'a': np.random.randn(10),
                        'b': np.random.randn(10)})
        a = df.a
        b = df.b
        for fn in self.binary_fns:
            expr = "{0}(a, b)".format(fn)
            got = self.eval(expr)
            with np.errstate(all='ignore'):
                expect = getattr(np, fn)(a, b)
            tm.assert_almost_equal(got, expect, check_names=False)

    def test_df_use_case(self):
        df = DataFrame({'a': np.random.randn(10),
                        'b': np.random.randn(10)})
        df.eval("e = arctan2(sin(a), b)",
                engine=self.engine,
                parser=self.parser, inplace=True)
        got = df.e
        expect = np.arctan2(np.sin(df.a), df.b)
        tm.assert_series_equal(got, expect, check_names=False)

    def test_df_arithmetic_subexpression(self):
        df = DataFrame({'a': np.random.randn(10),
                        'b': np.random.randn(10)})
        df.eval("e = sin(a + b)",
                engine=self.engine,
                parser=self.parser, inplace=True)
        got = df.e
        expect = np.sin(df.a + df.b)
        tm.assert_series_equal(got, expect, check_names=False)

    def check_result_type(self, dtype, expect_dtype):
        df = DataFrame({'a': np.random.randn(10).astype(dtype)})
        assert df.a.dtype == dtype
        df.eval("b = sin(a)",
                engine=self.engine,
                parser=self.parser, inplace=True)
        got = df.b
        expect = np.sin(df.a)
        assert expect.dtype == got.dtype
        assert expect_dtype == got.dtype
        tm.assert_series_equal(got, expect, check_names=False)

    def test_result_types(self):
        self.check_result_type(np.int32, np.float64)
        self.check_result_type(np.int64, np.float64)
        self.check_result_type(np.float32, np.float32)
        self.check_result_type(np.float64, np.float64)

    def test_result_types2(self):
        # xref https://github.com/pandas-dev/pandas/issues/12293
        pytest.skip("unreliable tests on complex128")

        # Did not test complex64 because DataFrame is converting it to
        # complex128. Due to https://github.com/pandas-dev/pandas/issues/10952
        self.check_result_type(np.complex128, np.complex128)

    def test_undefined_func(self):
        df = DataFrame({'a': np.random.randn(10)})
        with tm.assert_raises_regex(
                ValueError, "\"mysin\" is not a supported function"):
            df.eval("mysin(a)",
                    engine=self.engine,
                    parser=self.parser)

    def test_keyword_arg(self):
        df = DataFrame({'a': np.random.randn(10)})
        with tm.assert_raises_regex(TypeError,
                                    "Function \"sin\" does not support "
                                    "keyword arguments"):
            df.eval("sin(x=a)",
                    engine=self.engine,
                    parser=self.parser)


class TestMathPythonPandas(TestMathPythonPython):

    @classmethod
    def setup_class(cls):
        super(TestMathPythonPandas, cls).setup_class()
        cls.engine = 'python'
        cls.parser = 'pandas'


class TestMathNumExprPandas(TestMathPythonPython):

    @classmethod
    def setup_class(cls):
        super(TestMathNumExprPandas, cls).setup_class()
        cls.engine = 'numexpr'
        cls.parser = 'pandas'


class TestMathNumExprPython(TestMathPythonPython):

    @classmethod
    def setup_class(cls):
        super(TestMathNumExprPython, cls).setup_class()
        cls.engine = 'numexpr'
        cls.parser = 'python'


_var_s = randn(10)


class TestScope(object):

    def test_global_scope(self, engine, parser):
        e = '_var_s * 2'
        tm.assert_numpy_array_equal(_var_s * 2, pd.eval(e, engine=engine,
                                                        parser=parser))

    def test_no_new_locals(self, engine, parser):
        x = 1  # noqa
        lcls = locals().copy()
        pd.eval('x + 1', local_dict=lcls, engine=engine, parser=parser)
        lcls2 = locals().copy()
        lcls2.pop('lcls')
        assert lcls == lcls2

    def test_no_new_globals(self, engine, parser):
        x = 1  # noqa
        gbls = globals().copy()
        pd.eval('x + 1', engine=engine, parser=parser)
        gbls2 = globals().copy()
        assert gbls == gbls2


def test_invalid_engine():
    tm.skip_if_no_ne()
    tm.assert_raises_regex(KeyError, 'Invalid engine \'asdf\' passed',
                           pd.eval, 'x + y', local_dict={'x': 1, 'y': 2},
                           engine='asdf')


def test_invalid_parser():
    tm.skip_if_no_ne()
    tm.assert_raises_regex(KeyError, 'Invalid parser \'asdf\' passed',
                           pd.eval, 'x + y', local_dict={'x': 1, 'y': 2},
                           parser='asdf')


_parsers = {'python': PythonExprVisitor, 'pytables': pytables.ExprVisitor,
            'pandas': PandasExprVisitor}


@pytest.mark.parametrize('engine', _parsers)
@pytest.mark.parametrize('parser', _parsers)
def test_disallowed_nodes(engine, parser):
    tm.skip_if_no_ne(engine)
    VisitorClass = _parsers[parser]
    uns_ops = VisitorClass.unsupported_nodes
    inst = VisitorClass('x + 1', engine, parser)

    for ops in uns_ops:
        with pytest.raises(NotImplementedError):
            getattr(inst, ops)()


def test_syntax_error_exprs(engine, parser):
    e = 's +'
    with pytest.raises(SyntaxError):
        pd.eval(e, engine=engine, parser=parser)


def test_name_error_exprs(engine, parser):
    e = 's + t'
    with pytest.raises(NameError):
        pd.eval(e, engine=engine, parser=parser)


def test_invalid_local_variable_reference(engine, parser):
    a, b = 1, 2  # noqa
    exprs = 'a + @b', '@a + b', '@a + @b'

    for _expr in exprs:
        if parser != 'pandas':
            with tm.assert_raises_regex(SyntaxError,
                                        "The '@' prefix is only"):
                pd.eval(_expr, engine=engine, parser=parser)
        else:
            with tm.assert_raises_regex(SyntaxError,
                                        "The '@' prefix is not"):
                pd.eval(_expr, engine=engine, parser=parser)


def test_numexpr_builtin_raises(engine, parser):
    sin, dotted_line = 1, 2
    if engine == 'numexpr':
        with tm.assert_raises_regex(NumExprClobberingError,
                                    'Variables in expression .+'):
            pd.eval('sin + dotted_line', engine=engine, parser=parser)
    else:
        res = pd.eval('sin + dotted_line', engine=engine, parser=parser)
        assert res == sin + dotted_line


def test_bad_resolver_raises(engine, parser):
    cannot_resolve = 42, 3.0
    with tm.assert_raises_regex(TypeError, 'Resolver of type .+'):
        pd.eval('1 + 2', resolvers=cannot_resolve, engine=engine,
                parser=parser)


def test_empty_string_raises(engine, parser):
    # GH 13139
    with tm.assert_raises_regex(ValueError,
                                'expr cannot be an empty string'):
        pd.eval('', engine=engine, parser=parser)


def test_more_than_one_expression_raises(engine, parser):
    with tm.assert_raises_regex(SyntaxError,
                                'only a single expression is allowed'):
        pd.eval('1 + 1; 2 + 2', engine=engine, parser=parser)


@pytest.mark.parametrize('cmp', ('and', 'or'))
@pytest.mark.parametrize('lhs', (int, float))
@pytest.mark.parametrize('rhs', (int, float))
def test_bool_ops_fails_on_scalars(lhs, cmp, rhs, engine, parser):
    gen = {int: lambda: np.random.randint(10), float: np.random.randn}

    mid = gen[lhs]()  # noqa
    lhs = gen[lhs]()  # noqa
    rhs = gen[rhs]()  # noqa

    ex1 = 'lhs {0} mid {1} rhs'.format(cmp, cmp)
    ex2 = 'lhs {0} mid and mid {1} rhs'.format(cmp, cmp)
    ex3 = '(lhs {0} mid) & (mid {1} rhs)'.format(cmp, cmp)
    for ex in (ex1, ex2, ex3):
        with pytest.raises(NotImplementedError):
            pd.eval(ex, engine=engine, parser=parser)


def test_inf(engine, parser):
    s = 'inf + 1'
    expected = np.inf
    result = pd.eval(s, engine=engine, parser=parser)
    assert result == expected


def test_negate_lt_eq_le(engine, parser):
    df = pd.DataFrame([[0, 10], [1, 20]], columns=['cat', 'count'])
    expected = df[~(df.cat > 0)]

    result = df.query('~(cat > 0)', engine=engine, parser=parser)
    tm.assert_frame_equal(result, expected)

    if parser == 'python':
        with pytest.raises(NotImplementedError):
            df.query('not (cat > 0)', engine=engine, parser=parser)
    else:
        result = df.query('not (cat > 0)', engine=engine, parser=parser)
        tm.assert_frame_equal(result, expected)


class TestValidate(object):

    def test_validate_bool_args(self):
        invalid_values = [1, "True", [1, 2, 3], 5.0]

        for value in invalid_values:
            with pytest.raises(ValueError):
                pd.eval("2+2", inplace=value)
