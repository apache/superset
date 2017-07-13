# -*- coding: utf-8 -*-
from datetime import datetime
from pandas.compat import range, lrange
import operator
import pytest
from warnings import catch_warnings
import numpy as np

from pandas.core.dtypes.common import is_float_dtype
from pandas import Series, Index, isnull, notnull
from pandas.core.panel import Panel
from pandas.core.panel4d import Panel4D
from pandas.core.series import remove_na
from pandas.tseries.offsets import BDay

from pandas.util.testing import (assert_frame_equal, assert_series_equal,
                                 assert_almost_equal)
import pandas.util.testing as tm


def add_nans(panel4d):
    for l, label in enumerate(panel4d.labels):
        panel = panel4d[label]
        tm.add_nans(panel)


class SafeForLongAndSparse(object):

    def test_repr(self):
        repr(self.panel4d)

    def test_iter(self):
        tm.equalContents(list(self.panel4d), self.panel4d.labels)

    def test_count(self):
        f = lambda s: notnull(s).sum()
        self._check_stat_op('count', f, obj=self.panel4d, has_skipna=False)

    def test_sum(self):
        self._check_stat_op('sum', np.sum)

    def test_mean(self):
        self._check_stat_op('mean', np.mean)

    def test_prod(self):
        self._check_stat_op('prod', np.prod)

    def test_median(self):
        def wrapper(x):
            if isnull(x).any():
                return np.nan
            return np.median(x)

        self._check_stat_op('median', wrapper)

    def test_min(self):
        self._check_stat_op('min', np.min)

    def test_max(self):
        self._check_stat_op('max', np.max)

    def test_skew(self):
        try:
            from scipy.stats import skew
        except ImportError:
            pytest.skip("no scipy.stats.skew")

        def this_skew(x):
            if len(x) < 3:
                return np.nan
            return skew(x, bias=False)
        self._check_stat_op('skew', this_skew)

    # def test_mad(self):
    #     f = lambda x: np.abs(x - x.mean()).mean()
    #     self._check_stat_op('mad', f)

    def test_var(self):
        def alt(x):
            if len(x) < 2:
                return np.nan
            return np.var(x, ddof=1)
        self._check_stat_op('var', alt)

    def test_std(self):
        def alt(x):
            if len(x) < 2:
                return np.nan
            return np.std(x, ddof=1)
        self._check_stat_op('std', alt)

    def test_sem(self):
        def alt(x):
            if len(x) < 2:
                return np.nan
            return np.std(x, ddof=1) / np.sqrt(len(x))
        self._check_stat_op('sem', alt)

    # def test_skew(self):
    #     from scipy.stats import skew

    #     def alt(x):
    #         if len(x) < 3:
    #             return np.nan
    #         return skew(x, bias=False)

    #     self._check_stat_op('skew', alt)

    def _check_stat_op(self, name, alternative, obj=None, has_skipna=True):
        if obj is None:
            obj = self.panel4d

            # # set some NAs
            # obj.loc[5:10] = np.nan
            # obj.loc[15:20, -2:] = np.nan

        f = getattr(obj, name)

        if has_skipna:
            def skipna_wrapper(x):
                nona = remove_na(x)
                if len(nona) == 0:
                    return np.nan
                return alternative(nona)

            def wrapper(x):
                return alternative(np.asarray(x))

            with catch_warnings(record=True):
                for i in range(obj.ndim):
                    result = f(axis=i, skipna=False)
                    expected = obj.apply(wrapper, axis=i)
                    tm.assert_panel_equal(result, expected)
        else:
            skipna_wrapper = alternative
            wrapper = alternative

        with catch_warnings(record=True):
            for i in range(obj.ndim):
                result = f(axis=i)
                if not tm._incompat_bottleneck_version(name):
                    expected = obj.apply(skipna_wrapper, axis=i)
                    tm.assert_panel_equal(result, expected)

        pytest.raises(Exception, f, axis=obj.ndim)


class SafeForSparse(object):

    def test_get_axis(self):
        assert self.panel4d._get_axis(0) is self.panel4d.labels
        assert self.panel4d._get_axis(1) is self.panel4d.items
        assert self.panel4d._get_axis(2) is self.panel4d.major_axis
        assert self.panel4d._get_axis(3) is self.panel4d.minor_axis

    def test_set_axis(self):
        with catch_warnings(record=True):
            new_labels = Index(np.arange(len(self.panel4d.labels)))

            # TODO: unused?
            # new_items = Index(np.arange(len(self.panel4d.items)))

            new_major = Index(np.arange(len(self.panel4d.major_axis)))
            new_minor = Index(np.arange(len(self.panel4d.minor_axis)))

            # ensure propagate to potentially prior-cached items too

            # TODO: unused?
            # label = self.panel4d['l1']

            self.panel4d.labels = new_labels

            if hasattr(self.panel4d, '_item_cache'):
                assert 'l1' not in self.panel4d._item_cache
            assert self.panel4d.labels is new_labels

            self.panel4d.major_axis = new_major
            assert self.panel4d[0].major_axis is new_major
            assert self.panel4d.major_axis is new_major

            self.panel4d.minor_axis = new_minor
            assert self.panel4d[0].minor_axis is new_minor
            assert self.panel4d.minor_axis is new_minor

    def test_get_axis_number(self):
        assert self.panel4d._get_axis_number('labels') == 0
        assert self.panel4d._get_axis_number('items') == 1
        assert self.panel4d._get_axis_number('major') == 2
        assert self.panel4d._get_axis_number('minor') == 3

    def test_get_axis_name(self):
        assert self.panel4d._get_axis_name(0) == 'labels'
        assert self.panel4d._get_axis_name(1) == 'items'
        assert self.panel4d._get_axis_name(2) == 'major_axis'
        assert self.panel4d._get_axis_name(3) == 'minor_axis'

    def test_arith(self):
        with catch_warnings(record=True):
            self._test_op(self.panel4d, operator.add)
            self._test_op(self.panel4d, operator.sub)
            self._test_op(self.panel4d, operator.mul)
            self._test_op(self.panel4d, operator.truediv)
            self._test_op(self.panel4d, operator.floordiv)
            self._test_op(self.panel4d, operator.pow)

            self._test_op(self.panel4d, lambda x, y: y + x)
            self._test_op(self.panel4d, lambda x, y: y - x)
            self._test_op(self.panel4d, lambda x, y: y * x)
            self._test_op(self.panel4d, lambda x, y: y / x)
            self._test_op(self.panel4d, lambda x, y: y ** x)

            pytest.raises(Exception, self.panel4d.__add__,
                          self.panel4d['l1'])

    @staticmethod
    def _test_op(panel4d, op):
        result = op(panel4d, 1)
        tm.assert_panel_equal(result['l1'], op(panel4d['l1'], 1))

    def test_keys(self):
        tm.equalContents(list(self.panel4d.keys()), self.panel4d.labels)

    def test_iteritems(self):
        """Test panel4d.iteritems()"""

        assert (len(list(self.panel4d.iteritems())) ==
                len(self.panel4d.labels))

    def test_combinePanel4d(self):
        with catch_warnings(record=True):
            result = self.panel4d.add(self.panel4d)
            tm.assert_panel4d_equal(result, self.panel4d * 2)

    def test_neg(self):
        with catch_warnings(record=True):
            tm.assert_panel4d_equal(-self.panel4d, self.panel4d * -1)

    def test_select(self):
        with catch_warnings(record=True):

            p = self.panel4d

            # select labels
            result = p.select(lambda x: x in ('l1', 'l3'), axis='labels')
            expected = p.reindex(labels=['l1', 'l3'])
            tm.assert_panel4d_equal(result, expected)

            # select items
            result = p.select(lambda x: x in ('ItemA', 'ItemC'), axis='items')
            expected = p.reindex(items=['ItemA', 'ItemC'])
            tm.assert_panel4d_equal(result, expected)

            # select major_axis
            result = p.select(lambda x: x >= datetime(2000, 1, 15),
                              axis='major')
            new_major = p.major_axis[p.major_axis >= datetime(2000, 1, 15)]
            expected = p.reindex(major=new_major)
            tm.assert_panel4d_equal(result, expected)

            # select minor_axis
            result = p.select(lambda x: x in ('D', 'A'), axis=3)
            expected = p.reindex(minor=['A', 'D'])
            tm.assert_panel4d_equal(result, expected)

            # corner case, empty thing
            result = p.select(lambda x: x in ('foo',), axis='items')
            tm.assert_panel4d_equal(result, p.reindex(items=[]))

    def test_get_value(self):

        for item in self.panel.items:
            for mjr in self.panel.major_axis[::2]:
                for mnr in self.panel.minor_axis:
                    result = self.panel.get_value(item, mjr, mnr)
                    expected = self.panel[item][mnr][mjr]
                    assert_almost_equal(result, expected)

    def test_abs(self):

        with catch_warnings(record=True):
            result = self.panel4d.abs()
            expected = np.abs(self.panel4d)
            tm.assert_panel4d_equal(result, expected)

            p = self.panel4d['l1']
            result = p.abs()
            expected = np.abs(p)
            tm.assert_panel_equal(result, expected)

            df = p['ItemA']
            result = df.abs()
            expected = np.abs(df)
            assert_frame_equal(result, expected)


class CheckIndexing(object):

    def test_getitem(self):
        pytest.raises(Exception, self.panel4d.__getitem__, 'ItemQ')

    def test_delitem_and_pop(self):

        with catch_warnings(record=True):
            expected = self.panel4d['l2']
            result = self.panel4d.pop('l2')
            tm.assert_panel_equal(expected, result)
            assert 'l2' not in self.panel4d.labels

            del self.panel4d['l3']
            assert 'l3' not in self.panel4d.labels
            pytest.raises(Exception, self.panel4d.__delitem__, 'l3')

            values = np.empty((4, 4, 4, 4))
            values[0] = 0
            values[1] = 1
            values[2] = 2
            values[3] = 3

            panel4d = Panel4D(values, lrange(4), lrange(4),
                              lrange(4), lrange(4))

            # did we delete the right row?
            panel4dc = panel4d.copy()
            del panel4dc[0]
            tm.assert_panel_equal(panel4dc[1], panel4d[1])
            tm.assert_panel_equal(panel4dc[2], panel4d[2])
            tm.assert_panel_equal(panel4dc[3], panel4d[3])

            panel4dc = panel4d.copy()
            del panel4dc[1]
            tm.assert_panel_equal(panel4dc[0], panel4d[0])
            tm.assert_panel_equal(panel4dc[2], panel4d[2])
            tm.assert_panel_equal(panel4dc[3], panel4d[3])

            panel4dc = panel4d.copy()
            del panel4dc[2]
            tm.assert_panel_equal(panel4dc[1], panel4d[1])
            tm.assert_panel_equal(panel4dc[0], panel4d[0])
            tm.assert_panel_equal(panel4dc[3], panel4d[3])

            panel4dc = panel4d.copy()
            del panel4dc[3]
            tm.assert_panel_equal(panel4dc[1], panel4d[1])
            tm.assert_panel_equal(panel4dc[2], panel4d[2])
            tm.assert_panel_equal(panel4dc[0], panel4d[0])

    def test_setitem(self):
        with catch_warnings(record=True):

            # Panel
            p = Panel(dict(
                ItemA=self.panel4d['l1']['ItemA'][2:].filter(
                    items=['A', 'B'])))
            self.panel4d['l4'] = p
            self.panel4d['l5'] = p

            p2 = self.panel4d['l4']

            tm.assert_panel_equal(p, p2.reindex(items=p.items,
                                                major_axis=p.major_axis,
                                                minor_axis=p.minor_axis))

            # scalar
            self.panel4d['lG'] = 1
            self.panel4d['lE'] = True
            assert self.panel4d['lG'].values.dtype == np.int64
            assert self.panel4d['lE'].values.dtype == np.bool_

            # object dtype
            self.panel4d['lQ'] = 'foo'
            assert self.panel4d['lQ'].values.dtype == np.object_

            # boolean dtype
            self.panel4d['lP'] = self.panel4d['l1'] > 0
            assert self.panel4d['lP'].values.dtype == np.bool_

    def test_setitem_by_indexer(self):

        with catch_warnings(record=True):

            # Panel
            panel4dc = self.panel4d.copy()
            p = panel4dc.iloc[0]

            def func():
                self.panel4d.iloc[0] = p
            pytest.raises(NotImplementedError, func)

            # DataFrame
            panel4dc = self.panel4d.copy()
            df = panel4dc.iloc[0, 0]
            df.iloc[:] = 1
            panel4dc.iloc[0, 0] = df
            assert (panel4dc.iloc[0, 0].values == 1).all()

            # Series
            panel4dc = self.panel4d.copy()
            s = panel4dc.iloc[0, 0, :, 0]
            s.iloc[:] = 1
            panel4dc.iloc[0, 0, :, 0] = s
            assert (panel4dc.iloc[0, 0, :, 0].values == 1).all()

            # scalar
            panel4dc = self.panel4d.copy()
            panel4dc.iloc[0] = 1
            panel4dc.iloc[1] = True
            panel4dc.iloc[2] = 'foo'
            assert (panel4dc.iloc[0].values == 1).all()
            assert panel4dc.iloc[1].values.all()
            assert (panel4dc.iloc[2].values == 'foo').all()

    def test_setitem_by_indexer_mixed_type(self):

        with catch_warnings(record=True):
            # GH 8702
            self.panel4d['foo'] = 'bar'

            # scalar
            panel4dc = self.panel4d.copy()
            panel4dc.iloc[0] = 1
            panel4dc.iloc[1] = True
            panel4dc.iloc[2] = 'foo'
            assert (panel4dc.iloc[0].values == 1).all()
            assert panel4dc.iloc[1].values.all()
            assert (panel4dc.iloc[2].values == 'foo').all()

    def test_comparisons(self):
        with catch_warnings(record=True):
            p1 = tm.makePanel4D()
            p2 = tm.makePanel4D()

            tp = p1.reindex(labels=p1.labels.tolist() + ['foo'])
            p = p1[p1.labels[0]]

            def test_comp(func):
                result = func(p1, p2)
                tm.assert_numpy_array_equal(result.values,
                                            func(p1.values, p2.values))

                # versus non-indexed same objs
                pytest.raises(Exception, func, p1, tp)

                # versus different objs
                pytest.raises(Exception, func, p1, p)

                result3 = func(self.panel4d, 0)
                tm.assert_numpy_array_equal(result3.values,
                                            func(self.panel4d.values, 0))

            with np.errstate(invalid='ignore'):
                test_comp(operator.eq)
                test_comp(operator.ne)
                test_comp(operator.lt)
                test_comp(operator.gt)
                test_comp(operator.ge)
                test_comp(operator.le)

    def test_major_xs(self):
        ref = self.panel4d['l1']['ItemA']

        idx = self.panel4d.major_axis[5]
        with catch_warnings(record=True):
            xs = self.panel4d.major_xs(idx)

        assert_series_equal(xs['l1'].T['ItemA'],
                            ref.xs(idx), check_names=False)

        # not contained
        idx = self.panel4d.major_axis[0] - BDay()
        pytest.raises(Exception, self.panel4d.major_xs, idx)

    def test_major_xs_mixed(self):
        self.panel4d['l4'] = 'foo'
        with catch_warnings(record=True):
            xs = self.panel4d.major_xs(self.panel4d.major_axis[0])
        assert xs['l1']['A'].dtype == np.float64
        assert xs['l4']['A'].dtype == np.object_

    def test_minor_xs(self):
        ref = self.panel4d['l1']['ItemA']

        with catch_warnings(record=True):
            idx = self.panel4d.minor_axis[1]
            xs = self.panel4d.minor_xs(idx)

        assert_series_equal(xs['l1'].T['ItemA'], ref[idx], check_names=False)

        # not contained
        pytest.raises(Exception, self.panel4d.minor_xs, 'E')

    def test_minor_xs_mixed(self):
        self.panel4d['l4'] = 'foo'

        with catch_warnings(record=True):
            xs = self.panel4d.minor_xs('D')
        assert xs['l1'].T['ItemA'].dtype == np.float64
        assert xs['l4'].T['ItemA'].dtype == np.object_

    def test_xs(self):
        l1 = self.panel4d.xs('l1', axis=0)
        expected = self.panel4d['l1']
        tm.assert_panel_equal(l1, expected)

        # View if possible
        l1_view = self.panel4d.xs('l1', axis=0)
        l1_view.values[:] = np.nan
        assert np.isnan(self.panel4d['l1'].values).all()

        # Mixed-type
        self.panel4d['strings'] = 'foo'
        with catch_warnings(record=True):
            result = self.panel4d.xs('D', axis=3)

        assert result.is_copy is not None

    def test_getitem_fancy_labels(self):
        with catch_warnings(record=True):
            panel4d = self.panel4d

            labels = panel4d.labels[[1, 0]]
            items = panel4d.items[[1, 0]]
            dates = panel4d.major_axis[::2]
            cols = ['D', 'C', 'F']

            # all 4 specified
            tm.assert_panel4d_equal(panel4d.loc[labels, items, dates, cols],
                                    panel4d.reindex(labels=labels, items=items,
                                                    major=dates, minor=cols))

            # 3 specified
            tm.assert_panel4d_equal(panel4d.loc[:, items, dates, cols],
                                    panel4d.reindex(items=items, major=dates,
                                                    minor=cols))

            # 2 specified
            tm.assert_panel4d_equal(panel4d.loc[:, :, dates, cols],
                                    panel4d.reindex(major=dates, minor=cols))

            tm.assert_panel4d_equal(panel4d.loc[:, items, :, cols],
                                    panel4d.reindex(items=items, minor=cols))

            tm.assert_panel4d_equal(panel4d.loc[:, items, dates, :],
                                    panel4d.reindex(items=items, major=dates))

            # only 1
            tm.assert_panel4d_equal(panel4d.loc[:, items, :, :],
                                    panel4d.reindex(items=items))

            tm.assert_panel4d_equal(panel4d.loc[:, :, dates, :],
                                    panel4d.reindex(major=dates))

            tm.assert_panel4d_equal(panel4d.loc[:, :, :, cols],
                                    panel4d.reindex(minor=cols))

    def test_getitem_fancy_slice(self):
        pass

    def test_getitem_fancy_ints(self):
        pass

    def test_get_value(self):
        for label in self.panel4d.labels:
            for item in self.panel4d.items:
                for mjr in self.panel4d.major_axis[::2]:
                    for mnr in self.panel4d.minor_axis:
                        result = self.panel4d.get_value(
                            label, item, mjr, mnr)
                        expected = self.panel4d[label][item][mnr][mjr]
                        assert_almost_equal(result, expected)

    def test_set_value(self):

        with catch_warnings(record=True):

            for label in self.panel4d.labels:
                for item in self.panel4d.items:
                    for mjr in self.panel4d.major_axis[::2]:
                        for mnr in self.panel4d.minor_axis:
                            self.panel4d.set_value(label, item, mjr, mnr, 1.)
                            tm.assert_almost_equal(
                                self.panel4d[label][item][mnr][mjr], 1.)

            res3 = self.panel4d.set_value('l4', 'ItemE', 'foobar', 'baz', 5)
            assert is_float_dtype(res3['l4'].values)

            # resize
            res = self.panel4d.set_value('l4', 'ItemE', 'foo', 'bar', 1.5)
            assert isinstance(res, Panel4D)
            assert res is not self.panel4d
            assert res.get_value('l4', 'ItemE', 'foo', 'bar') == 1.5

            res3 = self.panel4d.set_value('l4', 'ItemE', 'foobar', 'baz', 5)
            assert is_float_dtype(res3['l4'].values)


class TestPanel4d(CheckIndexing, SafeForSparse,
                  SafeForLongAndSparse):

    def setup_method(self, method):
        with catch_warnings(record=True):
            self.panel4d = tm.makePanel4D(nper=8)
            add_nans(self.panel4d)

    def test_constructor(self):

        with catch_warnings(record=True):
            panel4d = Panel4D(self.panel4d._data)
            assert panel4d._data is self.panel4d._data

            panel4d = Panel4D(self.panel4d._data, copy=True)
            assert panel4d._data is not self.panel4d._data
            tm.assert_panel4d_equal(panel4d, self.panel4d)

            vals = self.panel4d.values

            # no copy
            panel4d = Panel4D(vals)
            assert panel4d.values is vals

            # copy
            panel4d = Panel4D(vals, copy=True)
            assert panel4d.values is not vals

            # GH #8285, test when scalar data is used to construct a Panel4D
            # if dtype is not passed, it should be inferred
            value_and_dtype = [(1, 'int64'), (3.14, 'float64'),
                               ('foo', np.object_)]
            for (val, dtype) in value_and_dtype:
                panel4d = Panel4D(val, labels=range(2), items=range(
                    3), major_axis=range(4), minor_axis=range(5))
                vals = np.empty((2, 3, 4, 5), dtype=dtype)
                vals.fill(val)
                expected = Panel4D(vals, dtype=dtype)
                tm.assert_panel4d_equal(panel4d, expected)

            # test the case when dtype is passed
            panel4d = Panel4D(1, labels=range(2), items=range(
                3), major_axis=range(4), minor_axis=range(5), dtype='float32')
            vals = np.empty((2, 3, 4, 5), dtype='float32')
            vals.fill(1)

            expected = Panel4D(vals, dtype='float32')
            tm.assert_panel4d_equal(panel4d, expected)

    def test_constructor_cast(self):
        with catch_warnings(record=True):
            zero_filled = self.panel4d.fillna(0)

            casted = Panel4D(zero_filled._data, dtype=int)
            casted2 = Panel4D(zero_filled.values, dtype=int)

            exp_values = zero_filled.values.astype(int)
            assert_almost_equal(casted.values, exp_values)
            assert_almost_equal(casted2.values, exp_values)

            casted = Panel4D(zero_filled._data, dtype=np.int32)
            casted2 = Panel4D(zero_filled.values, dtype=np.int32)

            exp_values = zero_filled.values.astype(np.int32)
            assert_almost_equal(casted.values, exp_values)
            assert_almost_equal(casted2.values, exp_values)

            # can't cast
            data = [[['foo', 'bar', 'baz']]]
            pytest.raises(ValueError, Panel, data, dtype=float)

    def test_consolidate(self):
        with catch_warnings(record=True):
            assert self.panel4d._data.is_consolidated()

            self.panel4d['foo'] = 1.
            assert not self.panel4d._data.is_consolidated()

            panel4d = self.panel4d._consolidate()
            assert panel4d._data.is_consolidated()

    def test_ctor_dict(self):
        with catch_warnings(record=True):
            l1 = self.panel4d['l1']
            l2 = self.panel4d['l2']

            d = {'A': l1, 'B': l2.loc[['ItemB'], :, :]}
            panel4d = Panel4D(d)

            tm.assert_panel_equal(panel4d['A'], self.panel4d['l1'])
            tm.assert_frame_equal(panel4d.loc['B', 'ItemB', :, :],
                                  self.panel4d.loc['l2', ['ItemB'],
                                                   :, :]['ItemB'])

    def test_constructor_dict_mixed(self):
        with catch_warnings(record=True):
            data = dict((k, v.values) for k, v in self.panel4d.iteritems())
            result = Panel4D(data)

            exp_major = Index(np.arange(len(self.panel4d.major_axis)))
            tm.assert_index_equal(result.major_axis, exp_major)

            result = Panel4D(data,
                             labels=self.panel4d.labels,
                             items=self.panel4d.items,
                             major_axis=self.panel4d.major_axis,
                             minor_axis=self.panel4d.minor_axis)
            tm.assert_panel4d_equal(result, self.panel4d)

            data['l2'] = self.panel4d['l2']

            result = Panel4D(data)
            tm.assert_panel4d_equal(result, self.panel4d)

            # corner, blow up
            data['l2'] = data['l2']['ItemB']
            pytest.raises(Exception, Panel4D, data)

            data['l2'] = self.panel4d['l2'].values[:, :, :-1]
            pytest.raises(Exception, Panel4D, data)

    def test_constructor_resize(self):
        with catch_warnings(record=True):
            data = self.panel4d._data
            labels = self.panel4d.labels[:-1]
            items = self.panel4d.items[:-1]
            major = self.panel4d.major_axis[:-1]
            minor = self.panel4d.minor_axis[:-1]

            result = Panel4D(data, labels=labels, items=items,
                             major_axis=major, minor_axis=minor)
            expected = self.panel4d.reindex(
                labels=labels, items=items, major=major, minor=minor)
            tm.assert_panel4d_equal(result, expected)

            result = Panel4D(data, items=items, major_axis=major)
            expected = self.panel4d.reindex(items=items, major=major)
            tm.assert_panel4d_equal(result, expected)

            result = Panel4D(data, items=items)
            expected = self.panel4d.reindex(items=items)
            tm.assert_panel4d_equal(result, expected)

            result = Panel4D(data, minor_axis=minor)
            expected = self.panel4d.reindex(minor=minor)
            tm.assert_panel4d_equal(result, expected)

    def test_conform(self):
        with catch_warnings(record=True):

            p = self.panel4d['l1'].filter(items=['ItemA', 'ItemB'])
            conformed = self.panel4d.conform(p)

            tm.assert_index_equal(conformed.items, self.panel4d.labels)
            tm.assert_index_equal(conformed.major_axis,
                                  self.panel4d.major_axis)
            tm.assert_index_equal(conformed.minor_axis,
                                  self.panel4d.minor_axis)

    def test_reindex(self):
        with catch_warnings(record=True):
            ref = self.panel4d['l2']

            # labels
            result = self.panel4d.reindex(labels=['l1', 'l2'])
            tm.assert_panel_equal(result['l2'], ref)

            # items
            result = self.panel4d.reindex(items=['ItemA', 'ItemB'])
            assert_frame_equal(result['l2']['ItemB'], ref['ItemB'])

            # major
            new_major = list(self.panel4d.major_axis[:10])
            result = self.panel4d.reindex(major=new_major)
            assert_frame_equal(
                result['l2']['ItemB'], ref['ItemB'].reindex(index=new_major))

            # raise exception put both major and major_axis
            pytest.raises(Exception, self.panel4d.reindex,
                          major_axis=new_major, major=new_major)

            # minor
            new_minor = list(self.panel4d.minor_axis[:2])
            result = self.panel4d.reindex(minor=new_minor)
            assert_frame_equal(
                result['l2']['ItemB'], ref['ItemB'].reindex(columns=new_minor))

            result = self.panel4d.reindex(labels=self.panel4d.labels,
                                          items=self.panel4d.items,
                                          major=self.panel4d.major_axis,
                                          minor=self.panel4d.minor_axis)

            # don't necessarily copy
            result = self.panel4d.reindex()
            tm.assert_panel4d_equal(result, self.panel4d)
            assert result is not self.panel4d

            # with filling
            smaller_major = self.panel4d.major_axis[::5]
            smaller = self.panel4d.reindex(major=smaller_major)

            larger = smaller.reindex(major=self.panel4d.major_axis,
                                     method='pad')

            tm.assert_panel_equal(larger.loc[:, :,
                                             self.panel4d.major_axis[1], :],
                                  smaller.loc[:, :, smaller_major[0], :])

            # don't necessarily copy
            result = self.panel4d.reindex(
                major=self.panel4d.major_axis, copy=False)
            tm.assert_panel4d_equal(result, self.panel4d)
            assert result is self.panel4d

    def test_not_hashable(self):
        with catch_warnings(record=True):
            p4D_empty = Panel4D()
            pytest.raises(TypeError, hash, p4D_empty)
            pytest.raises(TypeError, hash, self.panel4d)

    def test_reindex_like(self):
        # reindex_like
        with catch_warnings(record=True):
            smaller = self.panel4d.reindex(labels=self.panel4d.labels[:-1],
                                           items=self.panel4d.items[:-1],
                                           major=self.panel4d.major_axis[:-1],
                                           minor=self.panel4d.minor_axis[:-1])
            smaller_like = self.panel4d.reindex_like(smaller)
            tm.assert_panel4d_equal(smaller, smaller_like)

    def test_sort_index(self):
        with catch_warnings(record=True):
            import random

            rlabels = list(self.panel4d.labels)
            ritems = list(self.panel4d.items)
            rmajor = list(self.panel4d.major_axis)
            rminor = list(self.panel4d.minor_axis)
            random.shuffle(rlabels)
            random.shuffle(ritems)
            random.shuffle(rmajor)
            random.shuffle(rminor)

            random_order = self.panel4d.reindex(labels=rlabels)
            sorted_panel4d = random_order.sort_index(axis=0)
            tm.assert_panel4d_equal(sorted_panel4d, self.panel4d)

    def test_fillna(self):

        with catch_warnings(record=True):
            assert not np.isfinite(self.panel4d.values).all()
            filled = self.panel4d.fillna(0)
            assert np.isfinite(filled.values).all()

            pytest.raises(NotImplementedError,
                          self.panel4d.fillna, method='pad')

    def test_swapaxes(self):
        with catch_warnings(record=True):
            result = self.panel4d.swapaxes('labels', 'items')
            assert result.items is self.panel4d.labels

            result = self.panel4d.swapaxes('labels', 'minor')
            assert result.labels is self.panel4d.minor_axis

            result = self.panel4d.swapaxes('items', 'minor')
            assert result.items is self.panel4d.minor_axis

            result = self.panel4d.swapaxes('items', 'major')
            assert result.items is self.panel4d.major_axis

            result = self.panel4d.swapaxes('major', 'minor')
            assert result.major_axis is self.panel4d.minor_axis

            # this should also work
            result = self.panel4d.swapaxes(0, 1)
            assert result.labels is self.panel4d.items

            # this works, but return a copy
            result = self.panel4d.swapaxes('items', 'items')
            tm.assert_panel4d_equal(self.panel4d, result)
            assert id(self.panel4d) != id(result)

    def test_update(self):

        with catch_warnings(record=True):
            p4d = Panel4D([[[[1.5, np.nan, 3.],
                             [1.5, np.nan, 3.],
                             [1.5, np.nan, 3.],
                             [1.5, np.nan, 3.]],
                            [[1.5, np.nan, 3.],
                             [1.5, np.nan, 3.],
                             [1.5, np.nan, 3.],
                             [1.5, np.nan, 3.]]]])

            other = Panel4D([[[[3.6, 2., np.nan]],
                              [[np.nan, np.nan, 7]]]])

            p4d.update(other)

            expected = Panel4D([[[[3.6, 2, 3.],
                                  [1.5, np.nan, 3.],
                                  [1.5, np.nan, 3.],
                                  [1.5, np.nan, 3.]],
                                 [[1.5, np.nan, 7],
                                  [1.5, np.nan, 3.],
                                  [1.5, np.nan, 3.],
                                  [1.5, np.nan, 3.]]]])

            tm.assert_panel4d_equal(p4d, expected)

    def test_dtypes(self):

        result = self.panel4d.dtypes
        expected = Series(np.dtype('float64'), index=self.panel4d.labels)
        assert_series_equal(result, expected)

    def test_repr_empty(self):
        with catch_warnings(record=True):
            empty = Panel4D()
            repr(empty)

    def test_rename(self):
        with catch_warnings(record=True):

            mapper = {'l1': 'foo',
                      'l2': 'bar',
                      'l3': 'baz'}

            renamed = self.panel4d.rename_axis(mapper, axis=0)
            exp = Index(['foo', 'bar', 'baz'])
            tm.assert_index_equal(renamed.labels, exp)

            renamed = self.panel4d.rename_axis(str.lower, axis=3)
            exp = Index(['a', 'b', 'c', 'd'])
            tm.assert_index_equal(renamed.minor_axis, exp)

            # don't copy
            renamed_nocopy = self.panel4d.rename_axis(mapper,
                                                      axis=0,
                                                      copy=False)
            renamed_nocopy['foo'] = 3.
            assert (self.panel4d['l1'].values == 3).all()

    def test_get_attr(self):
        tm.assert_panel_equal(self.panel4d['l1'], self.panel4d.l1)
