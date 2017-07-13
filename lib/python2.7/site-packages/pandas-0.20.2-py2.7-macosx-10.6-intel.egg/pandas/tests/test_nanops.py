# -*- coding: utf-8 -*-
from __future__ import division, print_function

from functools import partial

import pytest
import warnings
import numpy as np

import pandas as pd
from pandas import Series, isnull, _np_version_under1p9
from pandas.core.dtypes.common import is_integer_dtype
import pandas.core.nanops as nanops
import pandas.util.testing as tm

use_bn = nanops._USE_BOTTLENECK


class TestnanopsDataFrame(object):

    def setup_method(self, method):
        np.random.seed(11235)
        nanops._USE_BOTTLENECK = False

        self.arr_shape = (11, 7, 5)

        self.arr_float = np.random.randn(*self.arr_shape)
        self.arr_float1 = np.random.randn(*self.arr_shape)
        self.arr_complex = self.arr_float + self.arr_float1 * 1j
        self.arr_int = np.random.randint(-10, 10, self.arr_shape)
        self.arr_bool = np.random.randint(0, 2, self.arr_shape) == 0
        self.arr_str = np.abs(self.arr_float).astype('S')
        self.arr_utf = np.abs(self.arr_float).astype('U')
        self.arr_date = np.random.randint(0, 20000,
                                          self.arr_shape).astype('M8[ns]')
        self.arr_tdelta = np.random.randint(0, 20000,
                                            self.arr_shape).astype('m8[ns]')

        self.arr_nan = np.tile(np.nan, self.arr_shape)
        self.arr_float_nan = np.vstack([self.arr_float, self.arr_nan])
        self.arr_float1_nan = np.vstack([self.arr_float1, self.arr_nan])
        self.arr_nan_float1 = np.vstack([self.arr_nan, self.arr_float1])
        self.arr_nan_nan = np.vstack([self.arr_nan, self.arr_nan])

        self.arr_inf = self.arr_float * np.inf
        self.arr_float_inf = np.vstack([self.arr_float, self.arr_inf])
        self.arr_float1_inf = np.vstack([self.arr_float1, self.arr_inf])
        self.arr_inf_float1 = np.vstack([self.arr_inf, self.arr_float1])
        self.arr_inf_inf = np.vstack([self.arr_inf, self.arr_inf])

        self.arr_nan_inf = np.vstack([self.arr_nan, self.arr_inf])
        self.arr_float_nan_inf = np.vstack([self.arr_float, self.arr_nan,
                                            self.arr_inf])
        self.arr_nan_float1_inf = np.vstack([self.arr_float, self.arr_inf,
                                             self.arr_nan])
        self.arr_nan_nan_inf = np.vstack([self.arr_nan, self.arr_nan,
                                          self.arr_inf])
        self.arr_obj = np.vstack([self.arr_float.astype(
            'O'), self.arr_int.astype('O'), self.arr_bool.astype(
                'O'), self.arr_complex.astype('O'), self.arr_str.astype(
                    'O'), self.arr_utf.astype('O'), self.arr_date.astype('O'),
            self.arr_tdelta.astype('O')])

        with np.errstate(invalid='ignore'):
            self.arr_nan_nanj = self.arr_nan + self.arr_nan * 1j
            self.arr_complex_nan = np.vstack([self.arr_complex,
                                              self.arr_nan_nanj])

            self.arr_nan_infj = self.arr_inf * 1j
            self.arr_complex_nan_infj = np.vstack([self.arr_complex,
                                                   self.arr_nan_infj])

        self.arr_float_2d = self.arr_float[:, :, 0]
        self.arr_float1_2d = self.arr_float1[:, :, 0]
        self.arr_complex_2d = self.arr_complex[:, :, 0]
        self.arr_int_2d = self.arr_int[:, :, 0]
        self.arr_bool_2d = self.arr_bool[:, :, 0]
        self.arr_str_2d = self.arr_str[:, :, 0]
        self.arr_utf_2d = self.arr_utf[:, :, 0]
        self.arr_date_2d = self.arr_date[:, :, 0]
        self.arr_tdelta_2d = self.arr_tdelta[:, :, 0]

        self.arr_nan_2d = self.arr_nan[:, :, 0]
        self.arr_float_nan_2d = self.arr_float_nan[:, :, 0]
        self.arr_float1_nan_2d = self.arr_float1_nan[:, :, 0]
        self.arr_nan_float1_2d = self.arr_nan_float1[:, :, 0]
        self.arr_nan_nan_2d = self.arr_nan_nan[:, :, 0]
        self.arr_nan_nanj_2d = self.arr_nan_nanj[:, :, 0]
        self.arr_complex_nan_2d = self.arr_complex_nan[:, :, 0]

        self.arr_inf_2d = self.arr_inf[:, :, 0]
        self.arr_float_inf_2d = self.arr_float_inf[:, :, 0]
        self.arr_nan_inf_2d = self.arr_nan_inf[:, :, 0]
        self.arr_float_nan_inf_2d = self.arr_float_nan_inf[:, :, 0]
        self.arr_nan_nan_inf_2d = self.arr_nan_nan_inf[:, :, 0]

        self.arr_float_1d = self.arr_float[:, 0, 0]
        self.arr_float1_1d = self.arr_float1[:, 0, 0]
        self.arr_complex_1d = self.arr_complex[:, 0, 0]
        self.arr_int_1d = self.arr_int[:, 0, 0]
        self.arr_bool_1d = self.arr_bool[:, 0, 0]
        self.arr_str_1d = self.arr_str[:, 0, 0]
        self.arr_utf_1d = self.arr_utf[:, 0, 0]
        self.arr_date_1d = self.arr_date[:, 0, 0]
        self.arr_tdelta_1d = self.arr_tdelta[:, 0, 0]

        self.arr_nan_1d = self.arr_nan[:, 0, 0]
        self.arr_float_nan_1d = self.arr_float_nan[:, 0, 0]
        self.arr_float1_nan_1d = self.arr_float1_nan[:, 0, 0]
        self.arr_nan_float1_1d = self.arr_nan_float1[:, 0, 0]
        self.arr_nan_nan_1d = self.arr_nan_nan[:, 0, 0]
        self.arr_nan_nanj_1d = self.arr_nan_nanj[:, 0, 0]
        self.arr_complex_nan_1d = self.arr_complex_nan[:, 0, 0]

        self.arr_inf_1d = self.arr_inf.ravel()
        self.arr_float_inf_1d = self.arr_float_inf[:, 0, 0]
        self.arr_nan_inf_1d = self.arr_nan_inf[:, 0, 0]
        self.arr_float_nan_inf_1d = self.arr_float_nan_inf[:, 0, 0]
        self.arr_nan_nan_inf_1d = self.arr_nan_nan_inf[:, 0, 0]

    def teardown_method(self, method):
        nanops._USE_BOTTLENECK = use_bn

    def check_results(self, targ, res, axis, check_dtype=True):
        res = getattr(res, 'asm8', res)
        res = getattr(res, 'values', res)

        # timedeltas are a beast here
        def _coerce_tds(targ, res):
            if hasattr(targ, 'dtype') and targ.dtype == 'm8[ns]':
                if len(targ) == 1:
                    targ = targ[0].item()
                    res = res.item()
                else:
                    targ = targ.view('i8')
            return targ, res

        try:
            if axis != 0 and hasattr(
                    targ, 'shape') and targ.ndim and targ.shape != res.shape:
                res = np.split(res, [targ.shape[0]], axis=0)[0]
        except:
            targ, res = _coerce_tds(targ, res)

        try:
            tm.assert_almost_equal(targ, res, check_dtype=check_dtype)
        except:

            # handle timedelta dtypes
            if hasattr(targ, 'dtype') and targ.dtype == 'm8[ns]':
                targ, res = _coerce_tds(targ, res)
                tm.assert_almost_equal(targ, res, check_dtype=check_dtype)
                return

            # There are sometimes rounding errors with
            # complex and object dtypes.
            # If it isn't one of those, re-raise the error.
            if not hasattr(res, 'dtype') or res.dtype.kind not in ['c', 'O']:
                raise
            # convert object dtypes to something that can be split into
            # real and imaginary parts
            if res.dtype.kind == 'O':
                if targ.dtype.kind != 'O':
                    res = res.astype(targ.dtype)
                else:
                    try:
                        res = res.astype('c16')
                    except:
                        res = res.astype('f8')
                    try:
                        targ = targ.astype('c16')
                    except:
                        targ = targ.astype('f8')
            # there should never be a case where numpy returns an object
            # but nanops doesn't, so make that an exception
            elif targ.dtype.kind == 'O':
                raise
            tm.assert_almost_equal(targ.real, res.real,
                                   check_dtype=check_dtype)
            tm.assert_almost_equal(targ.imag, res.imag,
                                   check_dtype=check_dtype)

    def check_fun_data(self, testfunc, targfunc, testarval, targarval,
                       targarnanval, check_dtype=True, **kwargs):
        for axis in list(range(targarval.ndim)) + [None]:
            for skipna in [False, True]:
                targartempval = targarval if skipna else targarnanval
                try:
                    targ = targfunc(targartempval, axis=axis, **kwargs)
                    res = testfunc(testarval, axis=axis, skipna=skipna,
                                   **kwargs)
                    self.check_results(targ, res, axis,
                                       check_dtype=check_dtype)
                    if skipna:
                        res = testfunc(testarval, axis=axis, **kwargs)
                        self.check_results(targ, res, axis,
                                           check_dtype=check_dtype)
                    if axis is None:
                        res = testfunc(testarval, skipna=skipna, **kwargs)
                        self.check_results(targ, res, axis,
                                           check_dtype=check_dtype)
                    if skipna and axis is None:
                        res = testfunc(testarval, **kwargs)
                        self.check_results(targ, res, axis,
                                           check_dtype=check_dtype)
                except BaseException as exc:
                    exc.args += ('axis: %s of %s' % (axis, testarval.ndim - 1),
                                 'skipna: %s' % skipna, 'kwargs: %s' % kwargs)
                    raise

        if testarval.ndim <= 1:
            return

        try:
            testarval2 = np.take(testarval, 0, axis=-1)
            targarval2 = np.take(targarval, 0, axis=-1)
            targarnanval2 = np.take(targarnanval, 0, axis=-1)
        except ValueError:
            return
        self.check_fun_data(testfunc, targfunc, testarval2, targarval2,
                            targarnanval2, check_dtype=check_dtype, **kwargs)

    def check_fun(self, testfunc, targfunc, testar, targar=None,
                  targarnan=None, **kwargs):
        if targar is None:
            targar = testar
        if targarnan is None:
            targarnan = testar
        testarval = getattr(self, testar)
        targarval = getattr(self, targar)
        targarnanval = getattr(self, targarnan)
        try:
            self.check_fun_data(testfunc, targfunc, testarval, targarval,
                                targarnanval, **kwargs)
        except BaseException as exc:
            exc.args += ('testar: %s' % testar, 'targar: %s' % targar,
                         'targarnan: %s' % targarnan)
            raise

    def check_funs(self, testfunc, targfunc, allow_complex=True,
                   allow_all_nan=True, allow_str=True, allow_date=True,
                   allow_tdelta=True, allow_obj=True, **kwargs):
        self.check_fun(testfunc, targfunc, 'arr_float', **kwargs)
        self.check_fun(testfunc, targfunc, 'arr_float_nan', 'arr_float',
                       **kwargs)
        self.check_fun(testfunc, targfunc, 'arr_int', **kwargs)
        self.check_fun(testfunc, targfunc, 'arr_bool', **kwargs)
        objs = [self.arr_float.astype('O'), self.arr_int.astype('O'),
                self.arr_bool.astype('O')]

        if allow_all_nan:
            self.check_fun(testfunc, targfunc, 'arr_nan', **kwargs)

        if allow_complex:
            self.check_fun(testfunc, targfunc, 'arr_complex', **kwargs)
            self.check_fun(testfunc, targfunc, 'arr_complex_nan',
                           'arr_complex', **kwargs)
            if allow_all_nan:
                self.check_fun(testfunc, targfunc, 'arr_nan_nanj', **kwargs)
            objs += [self.arr_complex.astype('O')]

        if allow_str:
            self.check_fun(testfunc, targfunc, 'arr_str', **kwargs)
            self.check_fun(testfunc, targfunc, 'arr_utf', **kwargs)
            objs += [self.arr_str.astype('O'), self.arr_utf.astype('O')]

        if allow_date:
            try:
                targfunc(self.arr_date)
            except TypeError:
                pass
            else:
                self.check_fun(testfunc, targfunc, 'arr_date', **kwargs)
                objs += [self.arr_date.astype('O')]

        if allow_tdelta:
            try:
                targfunc(self.arr_tdelta)
            except TypeError:
                pass
            else:
                self.check_fun(testfunc, targfunc, 'arr_tdelta', **kwargs)
                objs += [self.arr_tdelta.astype('O')]

        if allow_obj:
            self.arr_obj = np.vstack(objs)
            # some nanops handle object dtypes better than their numpy
            # counterparts, so the numpy functions need to be given something
            # else
            if allow_obj == 'convert':
                targfunc = partial(self._badobj_wrap, func=targfunc,
                                   allow_complex=allow_complex)
            self.check_fun(testfunc, targfunc, 'arr_obj', **kwargs)

    def check_funs_ddof(self,
                        testfunc,
                        targfunc,
                        allow_complex=True,
                        allow_all_nan=True,
                        allow_str=True,
                        allow_date=False,
                        allow_tdelta=False,
                        allow_obj=True, ):
        for ddof in range(3):
            try:
                self.check_funs(testfunc, targfunc, allow_complex,
                                allow_all_nan, allow_str, allow_date,
                                allow_tdelta, allow_obj, ddof=ddof)
            except BaseException as exc:
                exc.args += ('ddof %s' % ddof, )
                raise

    def _badobj_wrap(self, value, func, allow_complex=True, **kwargs):
        if value.dtype.kind == 'O':
            if allow_complex:
                value = value.astype('c16')
            else:
                value = value.astype('f8')
        return func(value, **kwargs)

    def test_nanany(self):
        self.check_funs(nanops.nanany, np.any, allow_all_nan=False,
                        allow_str=False, allow_date=False, allow_tdelta=False)

    def test_nanall(self):
        self.check_funs(nanops.nanall, np.all, allow_all_nan=False,
                        allow_str=False, allow_date=False, allow_tdelta=False)

    def test_nansum(self):
        self.check_funs(nanops.nansum, np.sum, allow_str=False,
                        allow_date=False, allow_tdelta=True, check_dtype=False)

    def test_nanmean(self):
        self.check_funs(nanops.nanmean, np.mean, allow_complex=False,
                        allow_obj=False, allow_str=False, allow_date=False,
                        allow_tdelta=True)

    def test_nanmean_overflow(self):
        # GH 10155
        # In the previous implementation mean can overflow for int dtypes, it
        # is now consistent with numpy

        # numpy < 1.9.0 is not computing this correctly
        if not _np_version_under1p9:
            for a in [2 ** 55, -2 ** 55, 20150515061816532]:
                s = Series(a, index=range(500), dtype=np.int64)
                result = s.mean()
                np_result = s.values.mean()
                assert result == a
                assert result == np_result
                assert result.dtype == np.float64

    def test_returned_dtype(self):

        dtypes = [np.int16, np.int32, np.int64, np.float32, np.float64]
        if hasattr(np, 'float128'):
            dtypes.append(np.float128)

        for dtype in dtypes:
            s = Series(range(10), dtype=dtype)
            group_a = ['mean', 'std', 'var', 'skew', 'kurt']
            group_b = ['min', 'max']
            for method in group_a + group_b:
                result = getattr(s, method)()
                if is_integer_dtype(dtype) and method in group_a:
                    assert result.dtype == np.float64
                else:
                    assert result.dtype == dtype

    def test_nanmedian(self):
        with warnings.catch_warnings(record=True):
            self.check_funs(nanops.nanmedian, np.median, allow_complex=False,
                            allow_str=False, allow_date=False,
                            allow_tdelta=True, allow_obj='convert')

    def test_nanvar(self):
        self.check_funs_ddof(nanops.nanvar, np.var, allow_complex=False,
                             allow_str=False, allow_date=False,
                             allow_tdelta=True, allow_obj='convert')

    def test_nanstd(self):
        self.check_funs_ddof(nanops.nanstd, np.std, allow_complex=False,
                             allow_str=False, allow_date=False,
                             allow_tdelta=True, allow_obj='convert')

    def test_nansem(self):
        tm.skip_if_no_package('scipy', min_version='0.17.0')
        from scipy.stats import sem
        with np.errstate(invalid='ignore'):
            self.check_funs_ddof(nanops.nansem, sem, allow_complex=False,
                                 allow_str=False, allow_date=False,
                                 allow_tdelta=False, allow_obj='convert')

    def _minmax_wrap(self, value, axis=None, func=None):
        res = func(value, axis)
        if res.dtype.kind == 'm':
            res = np.atleast_1d(res)
        return res

    def test_nanmin(self):
        func = partial(self._minmax_wrap, func=np.min)
        self.check_funs(nanops.nanmin, func, allow_str=False, allow_obj=False)

    def test_nanmax(self):
        func = partial(self._minmax_wrap, func=np.max)
        self.check_funs(nanops.nanmax, func, allow_str=False, allow_obj=False)

    def _argminmax_wrap(self, value, axis=None, func=None):
        res = func(value, axis)
        nans = np.min(value, axis)
        nullnan = isnull(nans)
        if res.ndim:
            res[nullnan] = -1
        elif (hasattr(nullnan, 'all') and nullnan.all() or
              not hasattr(nullnan, 'all') and nullnan):
            res = -1
        return res

    def test_nanargmax(self):
        func = partial(self._argminmax_wrap, func=np.argmax)
        self.check_funs(nanops.nanargmax, func, allow_str=False,
                        allow_obj=False, allow_date=True, allow_tdelta=True)

    def test_nanargmin(self):
        func = partial(self._argminmax_wrap, func=np.argmin)
        if tm.sys.version_info[0:2] == (2, 6):
            self.check_funs(nanops.nanargmin, func, allow_date=True,
                            allow_tdelta=True, allow_str=False,
                            allow_obj=False)
        else:
            self.check_funs(nanops.nanargmin, func, allow_str=False,
                            allow_obj=False)

    def _skew_kurt_wrap(self, values, axis=None, func=None):
        if not isinstance(values.dtype.type, np.floating):
            values = values.astype('f8')
        result = func(values, axis=axis, bias=False)
        # fix for handling cases where all elements in an axis are the same
        if isinstance(result, np.ndarray):
            result[np.max(values, axis=axis) == np.min(values, axis=axis)] = 0
            return result
        elif np.max(values) == np.min(values):
            return 0.
        return result

    def test_nanskew(self):
        tm.skip_if_no_package('scipy', min_version='0.17.0')
        from scipy.stats import skew
        func = partial(self._skew_kurt_wrap, func=skew)
        with np.errstate(invalid='ignore'):
            self.check_funs(nanops.nanskew, func, allow_complex=False,
                            allow_str=False, allow_date=False,
                            allow_tdelta=False)

    def test_nankurt(self):
        tm.skip_if_no_package('scipy', min_version='0.17.0')
        from scipy.stats import kurtosis
        func1 = partial(kurtosis, fisher=True)
        func = partial(self._skew_kurt_wrap, func=func1)
        with np.errstate(invalid='ignore'):
            self.check_funs(nanops.nankurt, func, allow_complex=False,
                            allow_str=False, allow_date=False,
                            allow_tdelta=False)

    def test_nanprod(self):
        self.check_funs(nanops.nanprod, np.prod, allow_str=False,
                        allow_date=False, allow_tdelta=False)

    def check_nancorr_nancov_2d(self, checkfun, targ0, targ1, **kwargs):
        res00 = checkfun(self.arr_float_2d, self.arr_float1_2d, **kwargs)
        res01 = checkfun(self.arr_float_2d, self.arr_float1_2d,
                         min_periods=len(self.arr_float_2d) - 1, **kwargs)
        tm.assert_almost_equal(targ0, res00)
        tm.assert_almost_equal(targ0, res01)

        res10 = checkfun(self.arr_float_nan_2d, self.arr_float1_nan_2d,
                         **kwargs)
        res11 = checkfun(self.arr_float_nan_2d, self.arr_float1_nan_2d,
                         min_periods=len(self.arr_float_2d) - 1, **kwargs)
        tm.assert_almost_equal(targ1, res10)
        tm.assert_almost_equal(targ1, res11)

        targ2 = np.nan
        res20 = checkfun(self.arr_nan_2d, self.arr_float1_2d, **kwargs)
        res21 = checkfun(self.arr_float_2d, self.arr_nan_2d, **kwargs)
        res22 = checkfun(self.arr_nan_2d, self.arr_nan_2d, **kwargs)
        res23 = checkfun(self.arr_float_nan_2d, self.arr_nan_float1_2d,
                         **kwargs)
        res24 = checkfun(self.arr_float_nan_2d, self.arr_nan_float1_2d,
                         min_periods=len(self.arr_float_2d) - 1, **kwargs)
        res25 = checkfun(self.arr_float_2d, self.arr_float1_2d,
                         min_periods=len(self.arr_float_2d) + 1, **kwargs)
        tm.assert_almost_equal(targ2, res20)
        tm.assert_almost_equal(targ2, res21)
        tm.assert_almost_equal(targ2, res22)
        tm.assert_almost_equal(targ2, res23)
        tm.assert_almost_equal(targ2, res24)
        tm.assert_almost_equal(targ2, res25)

    def check_nancorr_nancov_1d(self, checkfun, targ0, targ1, **kwargs):
        res00 = checkfun(self.arr_float_1d, self.arr_float1_1d, **kwargs)
        res01 = checkfun(self.arr_float_1d, self.arr_float1_1d,
                         min_periods=len(self.arr_float_1d) - 1, **kwargs)
        tm.assert_almost_equal(targ0, res00)
        tm.assert_almost_equal(targ0, res01)

        res10 = checkfun(self.arr_float_nan_1d, self.arr_float1_nan_1d,
                         **kwargs)
        res11 = checkfun(self.arr_float_nan_1d, self.arr_float1_nan_1d,
                         min_periods=len(self.arr_float_1d) - 1, **kwargs)
        tm.assert_almost_equal(targ1, res10)
        tm.assert_almost_equal(targ1, res11)

        targ2 = np.nan
        res20 = checkfun(self.arr_nan_1d, self.arr_float1_1d, **kwargs)
        res21 = checkfun(self.arr_float_1d, self.arr_nan_1d, **kwargs)
        res22 = checkfun(self.arr_nan_1d, self.arr_nan_1d, **kwargs)
        res23 = checkfun(self.arr_float_nan_1d, self.arr_nan_float1_1d,
                         **kwargs)
        res24 = checkfun(self.arr_float_nan_1d, self.arr_nan_float1_1d,
                         min_periods=len(self.arr_float_1d) - 1, **kwargs)
        res25 = checkfun(self.arr_float_1d, self.arr_float1_1d,
                         min_periods=len(self.arr_float_1d) + 1, **kwargs)
        tm.assert_almost_equal(targ2, res20)
        tm.assert_almost_equal(targ2, res21)
        tm.assert_almost_equal(targ2, res22)
        tm.assert_almost_equal(targ2, res23)
        tm.assert_almost_equal(targ2, res24)
        tm.assert_almost_equal(targ2, res25)

    def test_nancorr(self):
        targ0 = np.corrcoef(self.arr_float_2d, self.arr_float1_2d)[0, 1]
        targ1 = np.corrcoef(self.arr_float_2d.flat,
                            self.arr_float1_2d.flat)[0, 1]
        self.check_nancorr_nancov_2d(nanops.nancorr, targ0, targ1)
        targ0 = np.corrcoef(self.arr_float_1d, self.arr_float1_1d)[0, 1]
        targ1 = np.corrcoef(self.arr_float_1d.flat,
                            self.arr_float1_1d.flat)[0, 1]
        self.check_nancorr_nancov_1d(nanops.nancorr, targ0, targ1,
                                     method='pearson')

    def test_nancorr_pearson(self):
        targ0 = np.corrcoef(self.arr_float_2d, self.arr_float1_2d)[0, 1]
        targ1 = np.corrcoef(self.arr_float_2d.flat,
                            self.arr_float1_2d.flat)[0, 1]
        self.check_nancorr_nancov_2d(nanops.nancorr, targ0, targ1,
                                     method='pearson')
        targ0 = np.corrcoef(self.arr_float_1d, self.arr_float1_1d)[0, 1]
        targ1 = np.corrcoef(self.arr_float_1d.flat,
                            self.arr_float1_1d.flat)[0, 1]
        self.check_nancorr_nancov_1d(nanops.nancorr, targ0, targ1,
                                     method='pearson')

    def test_nancorr_kendall(self):
        tm.skip_if_no_package('scipy.stats')
        from scipy.stats import kendalltau
        targ0 = kendalltau(self.arr_float_2d, self.arr_float1_2d)[0]
        targ1 = kendalltau(self.arr_float_2d.flat, self.arr_float1_2d.flat)[0]
        self.check_nancorr_nancov_2d(nanops.nancorr, targ0, targ1,
                                     method='kendall')
        targ0 = kendalltau(self.arr_float_1d, self.arr_float1_1d)[0]
        targ1 = kendalltau(self.arr_float_1d.flat, self.arr_float1_1d.flat)[0]
        self.check_nancorr_nancov_1d(nanops.nancorr, targ0, targ1,
                                     method='kendall')

    def test_nancorr_spearman(self):
        tm.skip_if_no_package('scipy.stats')
        from scipy.stats import spearmanr
        targ0 = spearmanr(self.arr_float_2d, self.arr_float1_2d)[0]
        targ1 = spearmanr(self.arr_float_2d.flat, self.arr_float1_2d.flat)[0]
        self.check_nancorr_nancov_2d(nanops.nancorr, targ0, targ1,
                                     method='spearman')
        targ0 = spearmanr(self.arr_float_1d, self.arr_float1_1d)[0]
        targ1 = spearmanr(self.arr_float_1d.flat, self.arr_float1_1d.flat)[0]
        self.check_nancorr_nancov_1d(nanops.nancorr, targ0, targ1,
                                     method='spearman')

    def test_nancov(self):
        targ0 = np.cov(self.arr_float_2d, self.arr_float1_2d)[0, 1]
        targ1 = np.cov(self.arr_float_2d.flat, self.arr_float1_2d.flat)[0, 1]
        self.check_nancorr_nancov_2d(nanops.nancov, targ0, targ1)
        targ0 = np.cov(self.arr_float_1d, self.arr_float1_1d)[0, 1]
        targ1 = np.cov(self.arr_float_1d.flat, self.arr_float1_1d.flat)[0, 1]
        self.check_nancorr_nancov_1d(nanops.nancov, targ0, targ1)

    def check_nancomp(self, checkfun, targ0):
        arr_float = self.arr_float
        arr_float1 = self.arr_float1
        arr_nan = self.arr_nan
        arr_nan_nan = self.arr_nan_nan
        arr_float_nan = self.arr_float_nan
        arr_float1_nan = self.arr_float1_nan
        arr_nan_float1 = self.arr_nan_float1

        while targ0.ndim:
            try:
                res0 = checkfun(arr_float, arr_float1)
                tm.assert_almost_equal(targ0, res0)

                if targ0.ndim > 1:
                    targ1 = np.vstack([targ0, arr_nan])
                else:
                    targ1 = np.hstack([targ0, arr_nan])
                res1 = checkfun(arr_float_nan, arr_float1_nan)
                tm.assert_numpy_array_equal(targ1, res1, check_dtype=False)

                targ2 = arr_nan_nan
                res2 = checkfun(arr_float_nan, arr_nan_float1)
                tm.assert_numpy_array_equal(targ2, res2, check_dtype=False)
            except Exception as exc:
                exc.args += ('ndim: %s' % arr_float.ndim, )
                raise

            try:
                arr_float = np.take(arr_float, 0, axis=-1)
                arr_float1 = np.take(arr_float1, 0, axis=-1)
                arr_nan = np.take(arr_nan, 0, axis=-1)
                arr_nan_nan = np.take(arr_nan_nan, 0, axis=-1)
                arr_float_nan = np.take(arr_float_nan, 0, axis=-1)
                arr_float1_nan = np.take(arr_float1_nan, 0, axis=-1)
                arr_nan_float1 = np.take(arr_nan_float1, 0, axis=-1)
                targ0 = np.take(targ0, 0, axis=-1)
            except ValueError:
                break

    def test_nangt(self):
        targ0 = self.arr_float > self.arr_float1
        self.check_nancomp(nanops.nangt, targ0)

    def test_nange(self):
        targ0 = self.arr_float >= self.arr_float1
        self.check_nancomp(nanops.nange, targ0)

    def test_nanlt(self):
        targ0 = self.arr_float < self.arr_float1
        self.check_nancomp(nanops.nanlt, targ0)

    def test_nanle(self):
        targ0 = self.arr_float <= self.arr_float1
        self.check_nancomp(nanops.nanle, targ0)

    def test_naneq(self):
        targ0 = self.arr_float == self.arr_float1
        self.check_nancomp(nanops.naneq, targ0)

    def test_nanne(self):
        targ0 = self.arr_float != self.arr_float1
        self.check_nancomp(nanops.nanne, targ0)

    def check_bool(self, func, value, correct, *args, **kwargs):
        while getattr(value, 'ndim', True):
            try:
                res0 = func(value, *args, **kwargs)
                if correct:
                    assert res0
                else:
                    assert not res0
            except BaseException as exc:
                exc.args += ('dim: %s' % getattr(value, 'ndim', value), )
                raise
            if not hasattr(value, 'ndim'):
                break
            try:
                value = np.take(value, 0, axis=-1)
            except ValueError:
                break

    def test__has_infs(self):
        pairs = [('arr_complex', False), ('arr_int', False),
                 ('arr_bool', False), ('arr_str', False), ('arr_utf', False),
                 ('arr_complex', False), ('arr_complex_nan', False),
                 ('arr_nan_nanj', False), ('arr_nan_infj', True),
                 ('arr_complex_nan_infj', True)]
        pairs_float = [('arr_float', False), ('arr_nan', False),
                       ('arr_float_nan', False), ('arr_nan_nan', False),
                       ('arr_float_inf', True), ('arr_inf', True),
                       ('arr_nan_inf', True), ('arr_float_nan_inf', True),
                       ('arr_nan_nan_inf', True)]

        for arr, correct in pairs:
            val = getattr(self, arr)
            try:
                self.check_bool(nanops._has_infs, val, correct)
            except BaseException as exc:
                exc.args += (arr, )
                raise

        for arr, correct in pairs_float:
            val = getattr(self, arr)
            try:
                self.check_bool(nanops._has_infs, val, correct)
                self.check_bool(nanops._has_infs, val.astype('f4'), correct)
                self.check_bool(nanops._has_infs, val.astype('f2'), correct)
            except BaseException as exc:
                exc.args += (arr, )
                raise

    def test__isfinite(self):
        pairs = [('arr_complex', False), ('arr_int', False),
                 ('arr_bool', False), ('arr_str', False), ('arr_utf', False),
                 ('arr_complex', False), ('arr_complex_nan', True),
                 ('arr_nan_nanj', True), ('arr_nan_infj', True),
                 ('arr_complex_nan_infj', True)]
        pairs_float = [('arr_float', False), ('arr_nan', True),
                       ('arr_float_nan', True), ('arr_nan_nan', True),
                       ('arr_float_inf', True), ('arr_inf', True),
                       ('arr_nan_inf', True), ('arr_float_nan_inf', True),
                       ('arr_nan_nan_inf', True)]

        func1 = lambda x: np.any(nanops._isfinite(x).ravel())

        # TODO: unused?
        # func2 = lambda x: np.any(nanops._isfinite(x).values.ravel())

        for arr, correct in pairs:
            val = getattr(self, arr)
            try:
                self.check_bool(func1, val, correct)
            except BaseException as exc:
                exc.args += (arr, )
                raise

        for arr, correct in pairs_float:
            val = getattr(self, arr)
            try:
                self.check_bool(func1, val, correct)
                self.check_bool(func1, val.astype('f4'), correct)
                self.check_bool(func1, val.astype('f2'), correct)
            except BaseException as exc:
                exc.args += (arr, )
                raise

    def test__bn_ok_dtype(self):
        assert nanops._bn_ok_dtype(self.arr_float.dtype, 'test')
        assert nanops._bn_ok_dtype(self.arr_complex.dtype, 'test')
        assert nanops._bn_ok_dtype(self.arr_int.dtype, 'test')
        assert nanops._bn_ok_dtype(self.arr_bool.dtype, 'test')
        assert nanops._bn_ok_dtype(self.arr_str.dtype, 'test')
        assert nanops._bn_ok_dtype(self.arr_utf.dtype, 'test')
        assert not nanops._bn_ok_dtype(self.arr_date.dtype, 'test')
        assert not nanops._bn_ok_dtype(self.arr_tdelta.dtype, 'test')
        assert not nanops._bn_ok_dtype(self.arr_obj.dtype, 'test')


class TestEnsureNumeric(object):

    def test_numeric_values(self):
        # Test integer
        assert nanops._ensure_numeric(1) == 1

        # Test float
        assert nanops._ensure_numeric(1.1) == 1.1

        # Test complex
        assert nanops._ensure_numeric(1 + 2j) == 1 + 2j

    def test_ndarray(self):
        # Test numeric ndarray
        values = np.array([1, 2, 3])
        assert np.allclose(nanops._ensure_numeric(values), values)

        # Test object ndarray
        o_values = values.astype(object)
        assert np.allclose(nanops._ensure_numeric(o_values), values)

        # Test convertible string ndarray
        s_values = np.array(['1', '2', '3'], dtype=object)
        assert np.allclose(nanops._ensure_numeric(s_values), values)

        # Test non-convertible string ndarray
        s_values = np.array(['foo', 'bar', 'baz'], dtype=object)
        pytest.raises(ValueError, lambda: nanops._ensure_numeric(s_values))

    def test_convertable_values(self):
        assert np.allclose(nanops._ensure_numeric('1'), 1.0)
        assert np.allclose(nanops._ensure_numeric('1.1'), 1.1)
        assert np.allclose(nanops._ensure_numeric('1+1j'), 1 + 1j)

    def test_non_convertable_values(self):
        pytest.raises(TypeError, lambda: nanops._ensure_numeric('foo'))
        pytest.raises(TypeError, lambda: nanops._ensure_numeric({}))
        pytest.raises(TypeError, lambda: nanops._ensure_numeric([]))


class TestNanvarFixedValues(object):

    # xref GH10242

    def setup_method(self, method):
        # Samples from a normal distribution.
        self.variance = variance = 3.0
        self.samples = self.prng.normal(scale=variance ** 0.5, size=100000)

    def test_nanvar_all_finite(self):
        samples = self.samples
        actual_variance = nanops.nanvar(samples)
        tm.assert_almost_equal(actual_variance, self.variance,
                               check_less_precise=2)

    def test_nanvar_nans(self):
        samples = np.nan * np.ones(2 * self.samples.shape[0])
        samples[::2] = self.samples

        actual_variance = nanops.nanvar(samples, skipna=True)
        tm.assert_almost_equal(actual_variance, self.variance,
                               check_less_precise=2)

        actual_variance = nanops.nanvar(samples, skipna=False)
        tm.assert_almost_equal(actual_variance, np.nan, check_less_precise=2)

    def test_nanstd_nans(self):
        samples = np.nan * np.ones(2 * self.samples.shape[0])
        samples[::2] = self.samples

        actual_std = nanops.nanstd(samples, skipna=True)
        tm.assert_almost_equal(actual_std, self.variance ** 0.5,
                               check_less_precise=2)

        actual_std = nanops.nanvar(samples, skipna=False)
        tm.assert_almost_equal(actual_std, np.nan,
                               check_less_precise=2)

    def test_nanvar_axis(self):
        # Generate some sample data.
        samples_norm = self.samples
        samples_unif = self.prng.uniform(size=samples_norm.shape[0])
        samples = np.vstack([samples_norm, samples_unif])

        actual_variance = nanops.nanvar(samples, axis=1)
        tm.assert_almost_equal(actual_variance, np.array(
            [self.variance, 1.0 / 12]), check_less_precise=2)

    def test_nanvar_ddof(self):
        n = 5
        samples = self.prng.uniform(size=(10000, n + 1))
        samples[:, -1] = np.nan  # Force use of our own algorithm.

        variance_0 = nanops.nanvar(samples, axis=1, skipna=True, ddof=0).mean()
        variance_1 = nanops.nanvar(samples, axis=1, skipna=True, ddof=1).mean()
        variance_2 = nanops.nanvar(samples, axis=1, skipna=True, ddof=2).mean()

        # The unbiased estimate.
        var = 1.0 / 12
        tm.assert_almost_equal(variance_1, var,
                               check_less_precise=2)

        # The underestimated variance.
        tm.assert_almost_equal(variance_0, (n - 1.0) / n * var,
                               check_less_precise=2)

        # The overestimated variance.
        tm.assert_almost_equal(variance_2, (n - 1.0) / (n - 2.0) * var,
                               check_less_precise=2)

    def test_ground_truth(self):
        # Test against values that were precomputed with Numpy.
        samples = np.empty((4, 4))
        samples[:3, :3] = np.array([[0.97303362, 0.21869576, 0.55560287
                                     ], [0.72980153, 0.03109364, 0.99155171],
                                    [0.09317602, 0.60078248, 0.15871292]])
        samples[3] = samples[:, 3] = np.nan

        # Actual variances along axis=0, 1 for ddof=0, 1, 2
        variance = np.array([[[0.13762259, 0.05619224, 0.11568816
                               ], [0.20643388, 0.08428837, 0.17353224],
                              [0.41286776, 0.16857673, 0.34706449]],
                             [[0.09519783, 0.16435395, 0.05082054
                               ], [0.14279674, 0.24653093, 0.07623082],
                              [0.28559348, 0.49306186, 0.15246163]]])

        # Test nanvar.
        for axis in range(2):
            for ddof in range(3):
                var = nanops.nanvar(samples, skipna=True, axis=axis, ddof=ddof)
                tm.assert_almost_equal(var[:3], variance[axis, ddof])
                assert np.isnan(var[3])

        # Test nanstd.
        for axis in range(2):
            for ddof in range(3):
                std = nanops.nanstd(samples, skipna=True, axis=axis, ddof=ddof)
                tm.assert_almost_equal(std[:3], variance[axis, ddof] ** 0.5)
                assert np.isnan(std[3])

    def test_nanstd_roundoff(self):
        # Regression test for GH 10242 (test data taken from GH 10489). Ensure
        # that variance is stable.
        data = Series(766897346 * np.ones(10))
        for ddof in range(3):
            result = data.std(ddof=ddof)
            assert result == 0.0

    @property
    def prng(self):
        return np.random.RandomState(1234)


class TestNanskewFixedValues(object):

    # xref GH 11974

    def setup_method(self, method):
        # Test data + skewness value (computed with scipy.stats.skew)
        self.samples = np.sin(np.linspace(0, 1, 200))
        self.actual_skew = -0.1875895205961754

    def test_constant_series(self):
        # xref GH 11974
        for val in [3075.2, 3075.3, 3075.5]:
            data = val * np.ones(300)
            skew = nanops.nanskew(data)
            assert skew == 0.0

    def test_all_finite(self):
        alpha, beta = 0.3, 0.1
        left_tailed = self.prng.beta(alpha, beta, size=100)
        assert nanops.nanskew(left_tailed) < 0

        alpha, beta = 0.1, 0.3
        right_tailed = self.prng.beta(alpha, beta, size=100)
        assert nanops.nanskew(right_tailed) > 0

    def test_ground_truth(self):
        skew = nanops.nanskew(self.samples)
        tm.assert_almost_equal(skew, self.actual_skew)

    def test_axis(self):
        samples = np.vstack([self.samples,
                             np.nan * np.ones(len(self.samples))])
        skew = nanops.nanskew(samples, axis=1)
        tm.assert_almost_equal(skew, np.array([self.actual_skew, np.nan]))

    def test_nans(self):
        samples = np.hstack([self.samples, np.nan])
        skew = nanops.nanskew(samples, skipna=False)
        assert np.isnan(skew)

    def test_nans_skipna(self):
        samples = np.hstack([self.samples, np.nan])
        skew = nanops.nanskew(samples, skipna=True)
        tm.assert_almost_equal(skew, self.actual_skew)

    @property
    def prng(self):
        return np.random.RandomState(1234)


class TestNankurtFixedValues(object):

    # xref GH 11974

    def setup_method(self, method):
        # Test data + kurtosis value (computed with scipy.stats.kurtosis)
        self.samples = np.sin(np.linspace(0, 1, 200))
        self.actual_kurt = -1.2058303433799713

    def test_constant_series(self):
        # xref GH 11974
        for val in [3075.2, 3075.3, 3075.5]:
            data = val * np.ones(300)
            kurt = nanops.nankurt(data)
            assert kurt == 0.0

    def test_all_finite(self):
        alpha, beta = 0.3, 0.1
        left_tailed = self.prng.beta(alpha, beta, size=100)
        assert nanops.nankurt(left_tailed) < 0

        alpha, beta = 0.1, 0.3
        right_tailed = self.prng.beta(alpha, beta, size=100)
        assert nanops.nankurt(right_tailed) > 0

    def test_ground_truth(self):
        kurt = nanops.nankurt(self.samples)
        tm.assert_almost_equal(kurt, self.actual_kurt)

    def test_axis(self):
        samples = np.vstack([self.samples,
                             np.nan * np.ones(len(self.samples))])
        kurt = nanops.nankurt(samples, axis=1)
        tm.assert_almost_equal(kurt, np.array([self.actual_kurt, np.nan]))

    def test_nans(self):
        samples = np.hstack([self.samples, np.nan])
        kurt = nanops.nankurt(samples, skipna=False)
        assert np.isnan(kurt)

    def test_nans_skipna(self):
        samples = np.hstack([self.samples, np.nan])
        kurt = nanops.nankurt(samples, skipna=True)
        tm.assert_almost_equal(kurt, self.actual_kurt)

    @property
    def prng(self):
        return np.random.RandomState(1234)


def test_use_bottleneck():

    if nanops._BOTTLENECK_INSTALLED:

        pd.set_option('use_bottleneck', True)
        assert pd.get_option('use_bottleneck')

        pd.set_option('use_bottleneck', False)
        assert not pd.get_option('use_bottleneck')

        pd.set_option('use_bottleneck', use_bn)
