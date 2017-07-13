# -*- coding: utf-8 -*-
# pylint: disable=W0612,E1101

from warnings import catch_warnings
from datetime import datetime
import operator
import pytest

import numpy as np
import pandas as pd

from pandas.core.dtypes.common import is_float_dtype
from pandas import (Series, DataFrame, Index, date_range, isnull, notnull,
                    pivot, MultiIndex)
from pandas.core.nanops import nanall, nanany
from pandas.core.panel import Panel
from pandas.core.series import remove_na

from pandas.io.formats.printing import pprint_thing
from pandas import compat
from pandas.compat import range, lrange, StringIO, OrderedDict, signature

from pandas.tseries.offsets import BDay, MonthEnd
from pandas.util.testing import (assert_panel_equal, assert_frame_equal,
                                 assert_series_equal, assert_almost_equal,
                                 ensure_clean, makeMixedDataFrame,
                                 makeCustomDataframe as mkdf)
import pandas.core.panel as panelm
import pandas.util.testing as tm


def make_test_panel():
    with catch_warnings(record=True):
        _panel = tm.makePanel()
        tm.add_nans(_panel)
        _panel = _panel.copy()
    return _panel


class PanelTests(object):
    panel = None

    def test_pickle(self):
        with catch_warnings(record=True):
            unpickled = tm.round_trip_pickle(self.panel)
            assert_frame_equal(unpickled['ItemA'], self.panel['ItemA'])

    def test_rank(self):
        with catch_warnings(record=True):
            pytest.raises(NotImplementedError, lambda: self.panel.rank())

    def test_cumsum(self):
        with catch_warnings(record=True):
            cumsum = self.panel.cumsum()
            assert_frame_equal(cumsum['ItemA'], self.panel['ItemA'].cumsum())

    def not_hashable(self):
        with catch_warnings(record=True):
            c_empty = Panel()
            c = Panel(Panel([[[1]]]))
            pytest.raises(TypeError, hash, c_empty)
            pytest.raises(TypeError, hash, c)


class SafeForLongAndSparse(object):

    def test_repr(self):
        repr(self.panel)

    def test_copy_names(self):
        with catch_warnings(record=True):
            for attr in ('major_axis', 'minor_axis'):
                getattr(self.panel, attr).name = None
                cp = self.panel.copy()
                getattr(cp, attr).name = 'foo'
                assert getattr(self.panel, attr).name is None

    def test_iter(self):
        tm.equalContents(list(self.panel), self.panel.items)

    def test_count(self):
        f = lambda s: notnull(s).sum()
        self._check_stat_op('count', f, obj=self.panel, has_skipna=False)

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

    def _check_stat_op(self, name, alternative, obj=None, has_skipna=True):
        if obj is None:
            obj = self.panel

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

            for i in range(obj.ndim):
                result = f(axis=i, skipna=False)
                assert_frame_equal(result, obj.apply(wrapper, axis=i))
        else:
            skipna_wrapper = alternative
            wrapper = alternative

        for i in range(obj.ndim):
            result = f(axis=i)
            if not tm._incompat_bottleneck_version(name):
                assert_frame_equal(result, obj.apply(skipna_wrapper, axis=i))

        pytest.raises(Exception, f, axis=obj.ndim)

        # Unimplemented numeric_only parameter.
        if 'numeric_only' in signature(f).args:
            tm.assert_raises_regex(NotImplementedError, name, f,
                                   numeric_only=True)


class SafeForSparse(object):

    @classmethod
    def assert_panel_equal(cls, x, y):
        assert_panel_equal(x, y)

    def test_get_axis(self):
        assert (self.panel._get_axis(0) is self.panel.items)
        assert (self.panel._get_axis(1) is self.panel.major_axis)
        assert (self.panel._get_axis(2) is self.panel.minor_axis)

    def test_set_axis(self):
        new_items = Index(np.arange(len(self.panel.items)))
        new_major = Index(np.arange(len(self.panel.major_axis)))
        new_minor = Index(np.arange(len(self.panel.minor_axis)))

        # ensure propagate to potentially prior-cached items too
        item = self.panel['ItemA']
        self.panel.items = new_items

        if hasattr(self.panel, '_item_cache'):
            assert 'ItemA' not in self.panel._item_cache
        assert self.panel.items is new_items

        # TODO: unused?
        item = self.panel[0]  # noqa

        self.panel.major_axis = new_major
        assert self.panel[0].index is new_major
        assert self.panel.major_axis is new_major

        # TODO: unused?
        item = self.panel[0]  # noqa

        self.panel.minor_axis = new_minor
        assert self.panel[0].columns is new_minor
        assert self.panel.minor_axis is new_minor

    def test_get_axis_number(self):
        assert self.panel._get_axis_number('items') == 0
        assert self.panel._get_axis_number('major') == 1
        assert self.panel._get_axis_number('minor') == 2

        with tm.assert_raises_regex(ValueError, "No axis named foo"):
            self.panel._get_axis_number('foo')

        with tm.assert_raises_regex(ValueError, "No axis named foo"):
            self.panel.__ge__(self.panel, axis='foo')

    def test_get_axis_name(self):
        assert self.panel._get_axis_name(0) == 'items'
        assert self.panel._get_axis_name(1) == 'major_axis'
        assert self.panel._get_axis_name(2) == 'minor_axis'

    def test_get_plane_axes(self):
        # what to do here?

        index, columns = self.panel._get_plane_axes('items')
        index, columns = self.panel._get_plane_axes('major_axis')
        index, columns = self.panel._get_plane_axes('minor_axis')
        index, columns = self.panel._get_plane_axes(0)

    def test_truncate(self):
        with catch_warnings(record=True):
            dates = self.panel.major_axis
            start, end = dates[1], dates[5]

            trunced = self.panel.truncate(start, end, axis='major')
            expected = self.panel['ItemA'].truncate(start, end)

            assert_frame_equal(trunced['ItemA'], expected)

            trunced = self.panel.truncate(before=start, axis='major')
            expected = self.panel['ItemA'].truncate(before=start)

            assert_frame_equal(trunced['ItemA'], expected)

            trunced = self.panel.truncate(after=end, axis='major')
            expected = self.panel['ItemA'].truncate(after=end)

            assert_frame_equal(trunced['ItemA'], expected)

    def test_arith(self):
        with catch_warnings(record=True):
            self._test_op(self.panel, operator.add)
            self._test_op(self.panel, operator.sub)
            self._test_op(self.panel, operator.mul)
            self._test_op(self.panel, operator.truediv)
            self._test_op(self.panel, operator.floordiv)
            self._test_op(self.panel, operator.pow)

            self._test_op(self.panel, lambda x, y: y + x)
            self._test_op(self.panel, lambda x, y: y - x)
            self._test_op(self.panel, lambda x, y: y * x)
            self._test_op(self.panel, lambda x, y: y / x)
            self._test_op(self.panel, lambda x, y: y ** x)

            self._test_op(self.panel, lambda x, y: x + y)  # panel + 1
            self._test_op(self.panel, lambda x, y: x - y)  # panel - 1
            self._test_op(self.panel, lambda x, y: x * y)  # panel * 1
            self._test_op(self.panel, lambda x, y: x / y)  # panel / 1
            self._test_op(self.panel, lambda x, y: x ** y)  # panel ** 1

            pytest.raises(Exception, self.panel.__add__,
                          self.panel['ItemA'])

    @staticmethod
    def _test_op(panel, op):
        result = op(panel, 1)
        assert_frame_equal(result['ItemA'], op(panel['ItemA'], 1))

    def test_keys(self):
        tm.equalContents(list(self.panel.keys()), self.panel.items)

    def test_iteritems(self):
        # Test panel.iteritems(), aka panel.iteritems()
        # just test that it works
        for k, v in self.panel.iteritems():
            pass

        assert len(list(self.panel.iteritems())) == len(self.panel.items)

    def test_combineFrame(self):
        with catch_warnings(record=True):
            def check_op(op, name):
                # items
                df = self.panel['ItemA']

                func = getattr(self.panel, name)

                result = func(df, axis='items')

                assert_frame_equal(
                    result['ItemB'], op(self.panel['ItemB'], df))

                # major
                xs = self.panel.major_xs(self.panel.major_axis[0])
                result = func(xs, axis='major')

                idx = self.panel.major_axis[1]

                assert_frame_equal(result.major_xs(idx),
                                   op(self.panel.major_xs(idx), xs))

                # minor
                xs = self.panel.minor_xs(self.panel.minor_axis[0])
                result = func(xs, axis='minor')

                idx = self.panel.minor_axis[1]

                assert_frame_equal(result.minor_xs(idx),
                                   op(self.panel.minor_xs(idx), xs))

            ops = ['add', 'sub', 'mul', 'truediv', 'floordiv', 'pow', 'mod']
            if not compat.PY3:
                ops.append('div')

            for op in ops:
                try:
                    check_op(getattr(operator, op), op)
                except:
                    pprint_thing("Failing operation: %r" % op)
                    raise
            if compat.PY3:
                try:
                    check_op(operator.truediv, 'div')
                except:
                    pprint_thing("Failing operation: %r" % 'div')
                    raise

    def test_combinePanel(self):
        with catch_warnings(record=True):
            result = self.panel.add(self.panel)
            assert_panel_equal(result, self.panel * 2)

    def test_neg(self):
        with catch_warnings(record=True):
            assert_panel_equal(-self.panel, self.panel * -1)

    # issue 7692
    def test_raise_when_not_implemented(self):
        with catch_warnings(record=True):
            p = Panel(np.arange(3 * 4 * 5).reshape(3, 4, 5),
                      items=['ItemA', 'ItemB', 'ItemC'],
                      major_axis=pd.date_range('20130101', periods=4),
                      minor_axis=list('ABCDE'))
            d = p.sum(axis=1).iloc[0]
            ops = ['add', 'sub', 'mul', 'truediv',
                   'floordiv', 'div', 'mod', 'pow']
            for op in ops:
                with pytest.raises(NotImplementedError):
                    getattr(p, op)(d, axis=0)

    def test_select(self):
        with catch_warnings(record=True):
            p = self.panel

            # select items
            result = p.select(lambda x: x in ('ItemA', 'ItemC'), axis='items')
            expected = p.reindex(items=['ItemA', 'ItemC'])
            assert_panel_equal(result, expected)

            # select major_axis
            result = p.select(lambda x: x >= datetime(
                2000, 1, 15), axis='major')
            new_major = p.major_axis[p.major_axis >= datetime(2000, 1, 15)]
            expected = p.reindex(major=new_major)
            assert_panel_equal(result, expected)

            # select minor_axis
            result = p.select(lambda x: x in ('D', 'A'), axis=2)
            expected = p.reindex(minor=['A', 'D'])
            assert_panel_equal(result, expected)

            # corner case, empty thing
            result = p.select(lambda x: x in ('foo', ), axis='items')
            assert_panel_equal(result, p.reindex(items=[]))

    def test_get_value(self):
        for item in self.panel.items:
            for mjr in self.panel.major_axis[::2]:
                for mnr in self.panel.minor_axis:
                    result = self.panel.get_value(item, mjr, mnr)
                    expected = self.panel[item][mnr][mjr]
                    assert_almost_equal(result, expected)

    def test_abs(self):

        with catch_warnings(record=True):
            result = self.panel.abs()
            result2 = abs(self.panel)
            expected = np.abs(self.panel)
            assert_panel_equal(result, expected)
            assert_panel_equal(result2, expected)

            df = self.panel['ItemA']
            result = df.abs()
            result2 = abs(df)
            expected = np.abs(df)
            assert_frame_equal(result, expected)
            assert_frame_equal(result2, expected)

            s = df['A']
            result = s.abs()
            result2 = abs(s)
            expected = np.abs(s)
            assert_series_equal(result, expected)
            assert_series_equal(result2, expected)
            assert result.name == 'A'
            assert result2.name == 'A'


class CheckIndexing(object):

    def test_getitem(self):
        pytest.raises(Exception, self.panel.__getitem__, 'ItemQ')

    def test_delitem_and_pop(self):
        with catch_warnings(record=True):
            expected = self.panel['ItemA']
            result = self.panel.pop('ItemA')
            assert_frame_equal(expected, result)
            assert 'ItemA' not in self.panel.items

            del self.panel['ItemB']
            assert 'ItemB' not in self.panel.items
            pytest.raises(Exception, self.panel.__delitem__, 'ItemB')

            values = np.empty((3, 3, 3))
            values[0] = 0
            values[1] = 1
            values[2] = 2

            panel = Panel(values, lrange(3), lrange(3), lrange(3))

            # did we delete the right row?

            panelc = panel.copy()
            del panelc[0]
            tm.assert_frame_equal(panelc[1], panel[1])
            tm.assert_frame_equal(panelc[2], panel[2])

            panelc = panel.copy()
            del panelc[1]
            tm.assert_frame_equal(panelc[0], panel[0])
            tm.assert_frame_equal(panelc[2], panel[2])

            panelc = panel.copy()
            del panelc[2]
            tm.assert_frame_equal(panelc[1], panel[1])
            tm.assert_frame_equal(panelc[0], panel[0])

    def test_setitem(self):
        with catch_warnings(record=True):

            # LongPanel with one item
            lp = self.panel.filter(['ItemA', 'ItemB']).to_frame()
            with pytest.raises(ValueError):
                self.panel['ItemE'] = lp

            # DataFrame
            df = self.panel['ItemA'][2:].filter(items=['A', 'B'])
            self.panel['ItemF'] = df
            self.panel['ItemE'] = df

            df2 = self.panel['ItemF']

            assert_frame_equal(df, df2.reindex(
                index=df.index, columns=df.columns))

            # scalar
            self.panel['ItemG'] = 1
            self.panel['ItemE'] = True
            assert self.panel['ItemG'].values.dtype == np.int64
            assert self.panel['ItemE'].values.dtype == np.bool_

            # object dtype
            self.panel['ItemQ'] = 'foo'
            assert self.panel['ItemQ'].values.dtype == np.object_

            # boolean dtype
            self.panel['ItemP'] = self.panel['ItemA'] > 0
            assert self.panel['ItemP'].values.dtype == np.bool_

            pytest.raises(TypeError, self.panel.__setitem__, 'foo',
                          self.panel.loc[['ItemP']])

            # bad shape
            p = Panel(np.random.randn(4, 3, 2))
            with tm.assert_raises_regex(ValueError,
                                        r"shape of value must be "
                                        r"\(3, 2\), shape of given "
                                        r"object was \(4, 2\)"):
                p[0] = np.random.randn(4, 2)

    def test_setitem_ndarray(self):
        with catch_warnings(record=True):
            timeidx = date_range(start=datetime(2009, 1, 1),
                                 end=datetime(2009, 12, 31),
                                 freq=MonthEnd())
            lons_coarse = np.linspace(-177.5, 177.5, 72)
            lats_coarse = np.linspace(-87.5, 87.5, 36)
            P = Panel(items=timeidx, major_axis=lons_coarse,
                      minor_axis=lats_coarse)
            data = np.random.randn(72 * 36).reshape((72, 36))
            key = datetime(2009, 2, 28)
            P[key] = data

            assert_almost_equal(P[key].values, data)

    def test_set_minor_major(self):
        with catch_warnings(record=True):
            # GH 11014
            df1 = DataFrame(['a', 'a', 'a', np.nan, 'a', np.nan])
            df2 = DataFrame([1.0, np.nan, 1.0, np.nan, 1.0, 1.0])
            panel = Panel({'Item1': df1, 'Item2': df2})

            newminor = notnull(panel.iloc[:, :, 0])
            panel.loc[:, :, 'NewMinor'] = newminor
            assert_frame_equal(panel.loc[:, :, 'NewMinor'],
                               newminor.astype(object))

            newmajor = notnull(panel.iloc[:, 0, :])
            panel.loc[:, 'NewMajor', :] = newmajor
            assert_frame_equal(panel.loc[:, 'NewMajor', :],
                               newmajor.astype(object))

    def test_major_xs(self):
        with catch_warnings(record=True):
            ref = self.panel['ItemA']

            idx = self.panel.major_axis[5]
            xs = self.panel.major_xs(idx)

            result = xs['ItemA']
            assert_series_equal(result, ref.xs(idx), check_names=False)
            assert result.name == 'ItemA'

            # not contained
            idx = self.panel.major_axis[0] - BDay()
            pytest.raises(Exception, self.panel.major_xs, idx)

    def test_major_xs_mixed(self):
        with catch_warnings(record=True):
            self.panel['ItemD'] = 'foo'
            xs = self.panel.major_xs(self.panel.major_axis[0])
            assert xs['ItemA'].dtype == np.float64
            assert xs['ItemD'].dtype == np.object_

    def test_minor_xs(self):
        with catch_warnings(record=True):
            ref = self.panel['ItemA']

            idx = self.panel.minor_axis[1]
            xs = self.panel.minor_xs(idx)

            assert_series_equal(xs['ItemA'], ref[idx], check_names=False)

            # not contained
            pytest.raises(Exception, self.panel.minor_xs, 'E')

    def test_minor_xs_mixed(self):
        with catch_warnings(record=True):
            self.panel['ItemD'] = 'foo'

            xs = self.panel.minor_xs('D')
            assert xs['ItemA'].dtype == np.float64
            assert xs['ItemD'].dtype == np.object_

    def test_xs(self):
        with catch_warnings(record=True):
            itemA = self.panel.xs('ItemA', axis=0)
            expected = self.panel['ItemA']
            tm.assert_frame_equal(itemA, expected)

            # Get a view by default.
            itemA_view = self.panel.xs('ItemA', axis=0)
            itemA_view.values[:] = np.nan

            assert np.isnan(self.panel['ItemA'].values).all()

            # Mixed-type yields a copy.
            self.panel['strings'] = 'foo'
            result = self.panel.xs('D', axis=2)
            assert result.is_copy is not None

    def test_getitem_fancy_labels(self):
        with catch_warnings(record=True):
            p = self.panel

            items = p.items[[1, 0]]
            dates = p.major_axis[::2]
            cols = ['D', 'C', 'F']

            # all 3 specified
            assert_panel_equal(p.loc[items, dates, cols],
                               p.reindex(items=items, major=dates, minor=cols))

            # 2 specified
            assert_panel_equal(p.loc[:, dates, cols],
                               p.reindex(major=dates, minor=cols))

            assert_panel_equal(p.loc[items, :, cols],
                               p.reindex(items=items, minor=cols))

            assert_panel_equal(p.loc[items, dates, :],
                               p.reindex(items=items, major=dates))

            # only 1
            assert_panel_equal(p.loc[items, :, :], p.reindex(items=items))

            assert_panel_equal(p.loc[:, dates, :], p.reindex(major=dates))

            assert_panel_equal(p.loc[:, :, cols], p.reindex(minor=cols))

    def test_getitem_fancy_slice(self):
        pass

    def test_getitem_fancy_ints(self):
        p = self.panel

        # #1603
        result = p.iloc[:, -1, :]
        expected = p.loc[:, p.major_axis[-1], :]
        assert_frame_equal(result, expected)

    def test_getitem_fancy_xs(self):
        p = self.panel
        item = 'ItemB'

        date = p.major_axis[5]
        col = 'C'

        # get DataFrame
        # item
        assert_frame_equal(p.loc[item], p[item])
        assert_frame_equal(p.loc[item, :], p[item])
        assert_frame_equal(p.loc[item, :, :], p[item])

        # major axis, axis=1
        assert_frame_equal(p.loc[:, date], p.major_xs(date))
        assert_frame_equal(p.loc[:, date, :], p.major_xs(date))

        # minor axis, axis=2
        assert_frame_equal(p.loc[:, :, 'C'], p.minor_xs('C'))

        # get Series
        assert_series_equal(p.loc[item, date], p[item].loc[date])
        assert_series_equal(p.loc[item, date, :], p[item].loc[date])
        assert_series_equal(p.loc[item, :, col], p[item][col])
        assert_series_equal(p.loc[:, date, col], p.major_xs(date).loc[col])

    def test_getitem_fancy_xs_check_view(self):
        with catch_warnings(record=True):
            item = 'ItemB'
            date = self.panel.major_axis[5]

            # make sure it's always a view
            NS = slice(None, None)

            # DataFrames
            comp = assert_frame_equal
            self._check_view(item, comp)
            self._check_view((item, NS), comp)
            self._check_view((item, NS, NS), comp)
            self._check_view((NS, date), comp)
            self._check_view((NS, date, NS), comp)
            self._check_view((NS, NS, 'C'), comp)

            # Series
            comp = assert_series_equal
            self._check_view((item, date), comp)
            self._check_view((item, date, NS), comp)
            self._check_view((item, NS, 'C'), comp)
            self._check_view((NS, date, 'C'), comp)

    def test_getitem_callable(self):
        with catch_warnings(record=True):
            p = self.panel
            # GH 12533

            assert_frame_equal(p[lambda x: 'ItemB'], p.loc['ItemB'])
            assert_panel_equal(p[lambda x: ['ItemB', 'ItemC']],
                               p.loc[['ItemB', 'ItemC']])

    def test_ix_setitem_slice_dataframe(self):
        with catch_warnings(record=True):
            a = Panel(items=[1, 2, 3], major_axis=[11, 22, 33],
                      minor_axis=[111, 222, 333])
            b = DataFrame(np.random.randn(2, 3), index=[111, 333],
                          columns=[1, 2, 3])

            a.loc[:, 22, [111, 333]] = b

            assert_frame_equal(a.loc[:, 22, [111, 333]], b)

    def test_ix_align(self):
        with catch_warnings(record=True):
            from pandas import Series
            b = Series(np.random.randn(10), name=0)
            b.sort_values()
            df_orig = Panel(np.random.randn(3, 10, 2))
            df = df_orig.copy()

            df.loc[0, :, 0] = b
            assert_series_equal(df.loc[0, :, 0].reindex(b.index), b)

            df = df_orig.swapaxes(0, 1)
            df.loc[:, 0, 0] = b
            assert_series_equal(df.loc[:, 0, 0].reindex(b.index), b)

            df = df_orig.swapaxes(1, 2)
            df.loc[0, 0, :] = b
            assert_series_equal(df.loc[0, 0, :].reindex(b.index), b)

    def test_ix_frame_align(self):
        with catch_warnings(record=True):
            p_orig = tm.makePanel()
            df = p_orig.iloc[0].copy()
            assert_frame_equal(p_orig['ItemA'], df)

            p = p_orig.copy()
            p.iloc[0, :, :] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p.iloc[0] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p.iloc[0, :, :] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p.iloc[0] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p.loc['ItemA'] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p.loc['ItemA', :, :] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p['ItemA'] = df
            assert_panel_equal(p, p_orig)

            p = p_orig.copy()
            p.iloc[0, [0, 1, 3, 5], -2:] = df
            out = p.iloc[0, [0, 1, 3, 5], -2:]
            assert_frame_equal(out, df.iloc[[0, 1, 3, 5], [2, 3]])

            # GH3830, panel assignent by values/frame
            for dtype in ['float64', 'int64']:

                panel = Panel(np.arange(40).reshape((2, 4, 5)),
                              items=['a1', 'a2'], dtype=dtype)
                df1 = panel.iloc[0]
                df2 = panel.iloc[1]

                tm.assert_frame_equal(panel.loc['a1'], df1)
                tm.assert_frame_equal(panel.loc['a2'], df2)

                # Assignment by Value Passes for 'a2'
                panel.loc['a2'] = df1.values
                tm.assert_frame_equal(panel.loc['a1'], df1)
                tm.assert_frame_equal(panel.loc['a2'], df1)

                # Assignment by DataFrame Ok w/o loc 'a2'
                panel['a2'] = df2
                tm.assert_frame_equal(panel.loc['a1'], df1)
                tm.assert_frame_equal(panel.loc['a2'], df2)

                # Assignment by DataFrame Fails for 'a2'
                panel.loc['a2'] = df2
                tm.assert_frame_equal(panel.loc['a1'], df1)
                tm.assert_frame_equal(panel.loc['a2'], df2)

    def _check_view(self, indexer, comp):
        cp = self.panel.copy()
        obj = cp.loc[indexer]
        obj.values[:] = 0
        assert (obj.values == 0).all()
        comp(cp.loc[indexer].reindex_like(obj), obj)

    def test_logical_with_nas(self):
        with catch_warnings(record=True):
            d = Panel({'ItemA': {'a': [np.nan, False]},
                       'ItemB': {'a': [True, True]}})

            result = d['ItemA'] | d['ItemB']
            expected = DataFrame({'a': [np.nan, True]})
            assert_frame_equal(result, expected)

            # this is autodowncasted here
            result = d['ItemA'].fillna(False) | d['ItemB']
            expected = DataFrame({'a': [True, True]})
            assert_frame_equal(result, expected)

    def test_neg(self):
        with catch_warnings(record=True):
            assert_panel_equal(-self.panel, -1 * self.panel)

    def test_invert(self):
        with catch_warnings(record=True):
            assert_panel_equal(-(self.panel < 0), ~(self.panel < 0))

    def test_comparisons(self):
        with catch_warnings(record=True):
            p1 = tm.makePanel()
            p2 = tm.makePanel()

            tp = p1.reindex(items=p1.items + ['foo'])
            df = p1[p1.items[0]]

            def test_comp(func):

                # versus same index
                result = func(p1, p2)
                tm.assert_numpy_array_equal(result.values,
                                            func(p1.values, p2.values))

                # versus non-indexed same objs
                pytest.raises(Exception, func, p1, tp)

                # versus different objs
                pytest.raises(Exception, func, p1, df)

                # versus scalar
                result3 = func(self.panel, 0)
                tm.assert_numpy_array_equal(result3.values,
                                            func(self.panel.values, 0))

            with np.errstate(invalid='ignore'):
                test_comp(operator.eq)
                test_comp(operator.ne)
                test_comp(operator.lt)
                test_comp(operator.gt)
                test_comp(operator.ge)
                test_comp(operator.le)

    def test_get_value(self):
        for item in self.panel.items:
            for mjr in self.panel.major_axis[::2]:
                for mnr in self.panel.minor_axis:
                    result = self.panel.get_value(item, mjr, mnr)
                    expected = self.panel[item][mnr][mjr]
                    assert_almost_equal(result, expected)
        with tm.assert_raises_regex(TypeError,
                                    "There must be an argument "
                                    "for each axis"):
            self.panel.get_value('a')

    def test_set_value(self):
        with catch_warnings(record=True):
            for item in self.panel.items:
                for mjr in self.panel.major_axis[::2]:
                    for mnr in self.panel.minor_axis:
                        self.panel.set_value(item, mjr, mnr, 1.)
                        tm.assert_almost_equal(self.panel[item][mnr][mjr], 1.)

            # resize
            res = self.panel.set_value('ItemE', 'foo', 'bar', 1.5)
            assert isinstance(res, Panel)
            assert res is not self.panel
            assert res.get_value('ItemE', 'foo', 'bar') == 1.5

            res3 = self.panel.set_value('ItemE', 'foobar', 'baz', 5)
            assert is_float_dtype(res3['ItemE'].values)

            msg = ("There must be an argument for each "
                   "axis plus the value provided")
            with tm.assert_raises_regex(TypeError, msg):
                self.panel.set_value('a')


class TestPanel(PanelTests, CheckIndexing, SafeForLongAndSparse,
                SafeForSparse):

    @classmethod
    def assert_panel_equal(cls, x, y):
        assert_panel_equal(x, y)

    def setup_method(self, method):
        self.panel = make_test_panel()
        self.panel.major_axis.name = None
        self.panel.minor_axis.name = None
        self.panel.items.name = None

    def test_constructor(self):
        with catch_warnings(record=True):
            # with BlockManager
            wp = Panel(self.panel._data)
            assert wp._data is self.panel._data

            wp = Panel(self.panel._data, copy=True)
            assert wp._data is not self.panel._data
            tm.assert_panel_equal(wp, self.panel)

            # strings handled prop
            wp = Panel([[['foo', 'foo', 'foo', ], ['foo', 'foo', 'foo']]])
            assert wp.values.dtype == np.object_

            vals = self.panel.values

            # no copy
            wp = Panel(vals)
            assert wp.values is vals

            # copy
            wp = Panel(vals, copy=True)
            assert wp.values is not vals

            # GH #8285, test when scalar data is used to construct a Panel
            # if dtype is not passed, it should be inferred
            value_and_dtype = [(1, 'int64'), (3.14, 'float64'),
                               ('foo', np.object_)]
            for (val, dtype) in value_and_dtype:
                wp = Panel(val, items=range(2), major_axis=range(3),
                           minor_axis=range(4))
                vals = np.empty((2, 3, 4), dtype=dtype)
                vals.fill(val)

                tm.assert_panel_equal(wp, Panel(vals, dtype=dtype))

            # test the case when dtype is passed
            wp = Panel(1, items=range(2), major_axis=range(3),
                       minor_axis=range(4),
                       dtype='float32')
            vals = np.empty((2, 3, 4), dtype='float32')
            vals.fill(1)

            tm.assert_panel_equal(wp, Panel(vals, dtype='float32'))

    def test_constructor_cast(self):
        with catch_warnings(record=True):
            zero_filled = self.panel.fillna(0)

            casted = Panel(zero_filled._data, dtype=int)
            casted2 = Panel(zero_filled.values, dtype=int)

            exp_values = zero_filled.values.astype(int)
            assert_almost_equal(casted.values, exp_values)
            assert_almost_equal(casted2.values, exp_values)

            casted = Panel(zero_filled._data, dtype=np.int32)
            casted2 = Panel(zero_filled.values, dtype=np.int32)

            exp_values = zero_filled.values.astype(np.int32)
            assert_almost_equal(casted.values, exp_values)
            assert_almost_equal(casted2.values, exp_values)

            # can't cast
            data = [[['foo', 'bar', 'baz']]]
            pytest.raises(ValueError, Panel, data, dtype=float)

    def test_constructor_empty_panel(self):
        with catch_warnings(record=True):
            empty = Panel()
            assert len(empty.items) == 0
            assert len(empty.major_axis) == 0
            assert len(empty.minor_axis) == 0

    def test_constructor_observe_dtype(self):
        with catch_warnings(record=True):
            # GH #411
            panel = Panel(items=lrange(3), major_axis=lrange(3),
                          minor_axis=lrange(3), dtype='O')
            assert panel.values.dtype == np.object_

    def test_constructor_dtypes(self):
        with catch_warnings(record=True):
            # GH #797

            def _check_dtype(panel, dtype):
                for i in panel.items:
                    assert panel[i].values.dtype.name == dtype

            # only nan holding types allowed here
            for dtype in ['float64', 'float32', 'object']:
                panel = Panel(items=lrange(2), major_axis=lrange(10),
                              minor_axis=lrange(5), dtype=dtype)
                _check_dtype(panel, dtype)

            for dtype in ['float64', 'float32', 'int64', 'int32', 'object']:
                panel = Panel(np.array(np.random.randn(2, 10, 5), dtype=dtype),
                              items=lrange(2),
                              major_axis=lrange(10),
                              minor_axis=lrange(5), dtype=dtype)
                _check_dtype(panel, dtype)

            for dtype in ['float64', 'float32', 'int64', 'int32', 'object']:
                panel = Panel(np.array(np.random.randn(2, 10, 5), dtype='O'),
                              items=lrange(2),
                              major_axis=lrange(10),
                              minor_axis=lrange(5), dtype=dtype)
                _check_dtype(panel, dtype)

            for dtype in ['float64', 'float32', 'int64', 'int32', 'object']:
                panel = Panel(
                    np.random.randn(2, 10, 5),
                    items=lrange(2), major_axis=lrange(10),
                    minor_axis=lrange(5),
                    dtype=dtype)
                _check_dtype(panel, dtype)

            for dtype in ['float64', 'float32', 'int64', 'int32', 'object']:
                df1 = DataFrame(np.random.randn(2, 5),
                                index=lrange(2), columns=lrange(5))
                df2 = DataFrame(np.random.randn(2, 5),
                                index=lrange(2), columns=lrange(5))
                panel = Panel.from_dict({'a': df1, 'b': df2}, dtype=dtype)
                _check_dtype(panel, dtype)

    def test_constructor_fails_with_not_3d_input(self):
        with catch_warnings(record=True):
            with tm.assert_raises_regex(ValueError, "The number of dimensions required is 3"):  # noqa
                    Panel(np.random.randn(10, 2))

    def test_consolidate(self):
        with catch_warnings(record=True):
            assert self.panel._data.is_consolidated()

            self.panel['foo'] = 1.
            assert not self.panel._data.is_consolidated()

            panel = self.panel._consolidate()
            assert panel._data.is_consolidated()

    def test_ctor_dict(self):
        with catch_warnings(record=True):
            itema = self.panel['ItemA']
            itemb = self.panel['ItemB']

            d = {'A': itema, 'B': itemb[5:]}
            d2 = {'A': itema._series, 'B': itemb[5:]._series}
            d3 = {'A': None,
                  'B': DataFrame(itemb[5:]._series),
                  'C': DataFrame(itema._series)}

            wp = Panel.from_dict(d)
            wp2 = Panel.from_dict(d2)  # nested Dict

            # TODO: unused?
            wp3 = Panel.from_dict(d3)  # noqa

            tm.assert_index_equal(wp.major_axis, self.panel.major_axis)
            assert_panel_equal(wp, wp2)

            # intersect
            wp = Panel.from_dict(d, intersect=True)
            tm.assert_index_equal(wp.major_axis, itemb.index[5:])

            # use constructor
            assert_panel_equal(Panel(d), Panel.from_dict(d))
            assert_panel_equal(Panel(d2), Panel.from_dict(d2))
            assert_panel_equal(Panel(d3), Panel.from_dict(d3))

            # a pathological case
            d4 = {'A': None, 'B': None}

            # TODO: unused?
            wp4 = Panel.from_dict(d4)  # noqa

            assert_panel_equal(Panel(d4), Panel(items=['A', 'B']))

            # cast
            dcasted = dict((k, v.reindex(wp.major_axis).fillna(0))
                           for k, v in compat.iteritems(d))
            result = Panel(dcasted, dtype=int)
            expected = Panel(dict((k, v.astype(int))
                                  for k, v in compat.iteritems(dcasted)))
            assert_panel_equal(result, expected)

            result = Panel(dcasted, dtype=np.int32)
            expected = Panel(dict((k, v.astype(np.int32))
                                  for k, v in compat.iteritems(dcasted)))
            assert_panel_equal(result, expected)

    def test_constructor_dict_mixed(self):
        with catch_warnings(record=True):
            data = dict((k, v.values) for k, v in self.panel.iteritems())
            result = Panel(data)
            exp_major = Index(np.arange(len(self.panel.major_axis)))
            tm.assert_index_equal(result.major_axis, exp_major)

            result = Panel(data, items=self.panel.items,
                           major_axis=self.panel.major_axis,
                           minor_axis=self.panel.minor_axis)
            assert_panel_equal(result, self.panel)

            data['ItemC'] = self.panel['ItemC']
            result = Panel(data)
            assert_panel_equal(result, self.panel)

            # corner, blow up
            data['ItemB'] = data['ItemB'][:-1]
            pytest.raises(Exception, Panel, data)

            data['ItemB'] = self.panel['ItemB'].values[:, :-1]
            pytest.raises(Exception, Panel, data)

    def test_ctor_orderedDict(self):
        with catch_warnings(record=True):
            keys = list(set(np.random.randint(0, 5000, 100)))[
                :50]  # unique random int  keys
            d = OrderedDict([(k, mkdf(10, 5)) for k in keys])
            p = Panel(d)
            assert list(p.items) == keys

            p = Panel.from_dict(d)
            assert list(p.items) == keys

    def test_constructor_resize(self):
        with catch_warnings(record=True):
            data = self.panel._data
            items = self.panel.items[:-1]
            major = self.panel.major_axis[:-1]
            minor = self.panel.minor_axis[:-1]

            result = Panel(data, items=items,
                           major_axis=major, minor_axis=minor)
            expected = self.panel.reindex(
                items=items, major=major, minor=minor)
            assert_panel_equal(result, expected)

            result = Panel(data, items=items, major_axis=major)
            expected = self.panel.reindex(items=items, major=major)
            assert_panel_equal(result, expected)

            result = Panel(data, items=items)
            expected = self.panel.reindex(items=items)
            assert_panel_equal(result, expected)

            result = Panel(data, minor_axis=minor)
            expected = self.panel.reindex(minor=minor)
            assert_panel_equal(result, expected)

    def test_from_dict_mixed_orient(self):
        with catch_warnings(record=True):
            df = tm.makeDataFrame()
            df['foo'] = 'bar'

            data = {'k1': df, 'k2': df}

            panel = Panel.from_dict(data, orient='minor')

            assert panel['foo'].values.dtype == np.object_
            assert panel['A'].values.dtype == np.float64

    def test_constructor_error_msgs(self):
        with catch_warnings(record=True):
            def testit():
                Panel(np.random.randn(3, 4, 5),
                      lrange(4), lrange(5), lrange(5))

            tm.assert_raises_regex(ValueError,
                                   r"Shape of passed values is "
                                   r"\(3, 4, 5\), indices imply "
                                   r"\(4, 5, 5\)",
                                   testit)

            def testit():
                Panel(np.random.randn(3, 4, 5),
                      lrange(5), lrange(4), lrange(5))

            tm.assert_raises_regex(ValueError,
                                   r"Shape of passed values is "
                                   r"\(3, 4, 5\), indices imply "
                                   r"\(5, 4, 5\)",
                                   testit)

            def testit():
                Panel(np.random.randn(3, 4, 5),
                      lrange(5), lrange(5), lrange(4))

            tm.assert_raises_regex(ValueError,
                                   r"Shape of passed values is "
                                   r"\(3, 4, 5\), indices imply "
                                   r"\(5, 5, 4\)",
                                   testit)

    def test_conform(self):
        with catch_warnings(record=True):
            df = self.panel['ItemA'][:-5].filter(items=['A', 'B'])
            conformed = self.panel.conform(df)

            tm.assert_index_equal(conformed.index, self.panel.major_axis)
            tm.assert_index_equal(conformed.columns, self.panel.minor_axis)

    def test_convert_objects(self):
        with catch_warnings(record=True):

            # GH 4937
            p = Panel(dict(A=dict(a=['1', '1.0'])))
            expected = Panel(dict(A=dict(a=[1, 1.0])))
            result = p._convert(numeric=True, coerce=True)
            assert_panel_equal(result, expected)

    def test_dtypes(self):

        result = self.panel.dtypes
        expected = Series(np.dtype('float64'), index=self.panel.items)
        assert_series_equal(result, expected)

    def test_astype(self):
        with catch_warnings(record=True):
            # GH7271
            data = np.array([[[1, 2], [3, 4]], [[5, 6], [7, 8]]])
            panel = Panel(data, ['a', 'b'], ['c', 'd'], ['e', 'f'])

            str_data = np.array([[['1', '2'], ['3', '4']],
                                 [['5', '6'], ['7', '8']]])
            expected = Panel(str_data, ['a', 'b'], ['c', 'd'], ['e', 'f'])
            assert_panel_equal(panel.astype(str), expected)

            pytest.raises(NotImplementedError, panel.astype, {0: str})

    def test_apply(self):
        with catch_warnings(record=True):
            # GH1148

            # ufunc
            applied = self.panel.apply(np.sqrt)
            with np.errstate(invalid='ignore'):
                expected = np.sqrt(self.panel.values)
            assert_almost_equal(applied.values, expected)

            # ufunc same shape
            result = self.panel.apply(lambda x: x * 2, axis='items')
            expected = self.panel * 2
            assert_panel_equal(result, expected)
            result = self.panel.apply(lambda x: x * 2, axis='major_axis')
            expected = self.panel * 2
            assert_panel_equal(result, expected)
            result = self.panel.apply(lambda x: x * 2, axis='minor_axis')
            expected = self.panel * 2
            assert_panel_equal(result, expected)

            # reduction to DataFrame
            result = self.panel.apply(lambda x: x.dtype, axis='items')
            expected = DataFrame(np.dtype('float64'),
                                 index=self.panel.major_axis,
                                 columns=self.panel.minor_axis)
            assert_frame_equal(result, expected)
            result = self.panel.apply(lambda x: x.dtype, axis='major_axis')
            expected = DataFrame(np.dtype('float64'),
                                 index=self.panel.minor_axis,
                                 columns=self.panel.items)
            assert_frame_equal(result, expected)
            result = self.panel.apply(lambda x: x.dtype, axis='minor_axis')
            expected = DataFrame(np.dtype('float64'),
                                 index=self.panel.major_axis,
                                 columns=self.panel.items)
            assert_frame_equal(result, expected)

            # reductions via other dims
            expected = self.panel.sum(0)
            result = self.panel.apply(lambda x: x.sum(), axis='items')
            assert_frame_equal(result, expected)
            expected = self.panel.sum(1)
            result = self.panel.apply(lambda x: x.sum(), axis='major_axis')
            assert_frame_equal(result, expected)
            expected = self.panel.sum(2)
            result = self.panel.apply(lambda x: x.sum(), axis='minor_axis')
            assert_frame_equal(result, expected)

            # pass kwargs
            result = self.panel.apply(
                lambda x, y: x.sum() + y, axis='items', y=5)
            expected = self.panel.sum(0) + 5
            assert_frame_equal(result, expected)

    def test_apply_slabs(self):
        with catch_warnings(record=True):

            # same shape as original
            result = self.panel.apply(lambda x: x * 2,
                                      axis=['items', 'major_axis'])
            expected = (self.panel * 2).transpose('minor_axis', 'major_axis',
                                                  'items')
            assert_panel_equal(result, expected)
            result = self.panel.apply(lambda x: x * 2,
                                      axis=['major_axis', 'items'])
            assert_panel_equal(result, expected)

            result = self.panel.apply(lambda x: x * 2,
                                      axis=['items', 'minor_axis'])
            expected = (self.panel * 2).transpose('major_axis', 'minor_axis',
                                                  'items')
            assert_panel_equal(result, expected)
            result = self.panel.apply(lambda x: x * 2,
                                      axis=['minor_axis', 'items'])
            assert_panel_equal(result, expected)

            result = self.panel.apply(lambda x: x * 2,
                                      axis=['major_axis', 'minor_axis'])
            expected = self.panel * 2
            assert_panel_equal(result, expected)
            result = self.panel.apply(lambda x: x * 2,
                                      axis=['minor_axis', 'major_axis'])
            assert_panel_equal(result, expected)

            # reductions
            result = self.panel.apply(lambda x: x.sum(0), axis=[
                'items', 'major_axis'
            ])
            expected = self.panel.sum(1).T
            assert_frame_equal(result, expected)

        # make sure that we don't trigger any warnings
        with catch_warnings(record=True):
            result = self.panel.apply(lambda x: x.sum(1), axis=[
                'items', 'major_axis'
            ])
            expected = self.panel.sum(0)
            assert_frame_equal(result, expected)

            # transforms
            f = lambda x: ((x.T - x.mean(1)) / x.std(1)).T

            # make sure that we don't trigger any warnings
            result = self.panel.apply(f, axis=['items', 'major_axis'])
            expected = Panel(dict([(ax, f(self.panel.loc[:, :, ax]))
                                   for ax in self.panel.minor_axis]))
            assert_panel_equal(result, expected)

            result = self.panel.apply(f, axis=['major_axis', 'minor_axis'])
            expected = Panel(dict([(ax, f(self.panel.loc[ax]))
                                   for ax in self.panel.items]))
            assert_panel_equal(result, expected)

            result = self.panel.apply(f, axis=['minor_axis', 'items'])
            expected = Panel(dict([(ax, f(self.panel.loc[:, ax]))
                                   for ax in self.panel.major_axis]))
            assert_panel_equal(result, expected)

            # with multi-indexes
            # GH7469
            index = MultiIndex.from_tuples([('one', 'a'), ('one', 'b'), (
                'two', 'a'), ('two', 'b')])
            dfa = DataFrame(np.array(np.arange(12, dtype='int64')).reshape(
                4, 3), columns=list("ABC"), index=index)
            dfb = DataFrame(np.array(np.arange(10, 22, dtype='int64')).reshape(
                4, 3), columns=list("ABC"), index=index)
            p = Panel({'f': dfa, 'g': dfb})
            result = p.apply(lambda x: x.sum(), axis=0)

            # on windows this will be in32
            result = result.astype('int64')
            expected = p.sum(0)
            assert_frame_equal(result, expected)

    def test_apply_no_or_zero_ndim(self):
        with catch_warnings(record=True):
            # GH10332
            self.panel = Panel(np.random.rand(5, 5, 5))

            result_int = self.panel.apply(lambda df: 0, axis=[1, 2])
            result_float = self.panel.apply(lambda df: 0.0, axis=[1, 2])
            result_int64 = self.panel.apply(
                lambda df: np.int64(0), axis=[1, 2])
            result_float64 = self.panel.apply(lambda df: np.float64(0.0),
                                              axis=[1, 2])

            expected_int = expected_int64 = Series([0] * 5)
            expected_float = expected_float64 = Series([0.0] * 5)

            assert_series_equal(result_int, expected_int)
            assert_series_equal(result_int64, expected_int64)
            assert_series_equal(result_float, expected_float)
            assert_series_equal(result_float64, expected_float64)

    def test_reindex(self):
        with catch_warnings(record=True):
            ref = self.panel['ItemB']

            # items
            result = self.panel.reindex(items=['ItemA', 'ItemB'])
            assert_frame_equal(result['ItemB'], ref)

            # major
            new_major = list(self.panel.major_axis[:10])
            result = self.panel.reindex(major=new_major)
            assert_frame_equal(result['ItemB'], ref.reindex(index=new_major))

            # raise exception put both major and major_axis
            pytest.raises(Exception, self.panel.reindex,
                          major_axis=new_major,
                          major=new_major)

            # minor
            new_minor = list(self.panel.minor_axis[:2])
            result = self.panel.reindex(minor=new_minor)
            assert_frame_equal(result['ItemB'], ref.reindex(columns=new_minor))

            # this ok
            result = self.panel.reindex()
            assert_panel_equal(result, self.panel)
            assert result is not self.panel

            # with filling
            smaller_major = self.panel.major_axis[::5]
            smaller = self.panel.reindex(major=smaller_major)

            larger = smaller.reindex(major=self.panel.major_axis, method='pad')

            assert_frame_equal(larger.major_xs(self.panel.major_axis[1]),
                               smaller.major_xs(smaller_major[0]))

            # don't necessarily copy
            result = self.panel.reindex(
                major=self.panel.major_axis, copy=False)
            assert_panel_equal(result, self.panel)
            assert result is self.panel

    def test_reindex_multi(self):
        with catch_warnings(record=True):

            # with and without copy full reindexing
            result = self.panel.reindex(
                items=self.panel.items,
                major=self.panel.major_axis,
                minor=self.panel.minor_axis, copy=False)

            assert result.items is self.panel.items
            assert result.major_axis is self.panel.major_axis
            assert result.minor_axis is self.panel.minor_axis

            result = self.panel.reindex(
                items=self.panel.items,
                major=self.panel.major_axis,
                minor=self.panel.minor_axis, copy=False)
            assert_panel_equal(result, self.panel)

            # multi-axis indexing consistency
            # GH 5900
            df = DataFrame(np.random.randn(4, 3))
            p = Panel({'Item1': df})
            expected = Panel({'Item1': df})
            expected['Item2'] = np.nan

            items = ['Item1', 'Item2']
            major_axis = np.arange(4)
            minor_axis = np.arange(3)

            results = []
            results.append(p.reindex(items=items, major_axis=major_axis,
                                     copy=True))
            results.append(p.reindex(items=items, major_axis=major_axis,
                                     copy=False))
            results.append(p.reindex(items=items, minor_axis=minor_axis,
                                     copy=True))
            results.append(p.reindex(items=items, minor_axis=minor_axis,
                                     copy=False))
            results.append(p.reindex(items=items, major_axis=major_axis,
                                     minor_axis=minor_axis, copy=True))
            results.append(p.reindex(items=items, major_axis=major_axis,
                                     minor_axis=minor_axis, copy=False))

            for i, r in enumerate(results):
                assert_panel_equal(expected, r)

    def test_reindex_like(self):
        with catch_warnings(record=True):
            # reindex_like
            smaller = self.panel.reindex(items=self.panel.items[:-1],
                                         major=self.panel.major_axis[:-1],
                                         minor=self.panel.minor_axis[:-1])
            smaller_like = self.panel.reindex_like(smaller)
            assert_panel_equal(smaller, smaller_like)

    def test_take(self):
        with catch_warnings(record=True):
            # axis == 0
            result = self.panel.take([2, 0, 1], axis=0)
            expected = self.panel.reindex(items=['ItemC', 'ItemA', 'ItemB'])
            assert_panel_equal(result, expected)

            # axis >= 1
            result = self.panel.take([3, 0, 1, 2], axis=2)
            expected = self.panel.reindex(minor=['D', 'A', 'B', 'C'])
            assert_panel_equal(result, expected)

            # neg indicies ok
            expected = self.panel.reindex(minor=['D', 'D', 'B', 'C'])
            result = self.panel.take([3, -1, 1, 2], axis=2)
            assert_panel_equal(result, expected)

            pytest.raises(Exception, self.panel.take, [4, 0, 1, 2], axis=2)

    def test_sort_index(self):
        with catch_warnings(record=True):
            import random

            ritems = list(self.panel.items)
            rmajor = list(self.panel.major_axis)
            rminor = list(self.panel.minor_axis)
            random.shuffle(ritems)
            random.shuffle(rmajor)
            random.shuffle(rminor)

            random_order = self.panel.reindex(items=ritems)
            sorted_panel = random_order.sort_index(axis=0)
            assert_panel_equal(sorted_panel, self.panel)

            # descending
            random_order = self.panel.reindex(items=ritems)
            sorted_panel = random_order.sort_index(axis=0, ascending=False)
            assert_panel_equal(
                sorted_panel,
                self.panel.reindex(items=self.panel.items[::-1]))

            random_order = self.panel.reindex(major=rmajor)
            sorted_panel = random_order.sort_index(axis=1)
            assert_panel_equal(sorted_panel, self.panel)

            random_order = self.panel.reindex(minor=rminor)
            sorted_panel = random_order.sort_index(axis=2)
            assert_panel_equal(sorted_panel, self.panel)

    def test_fillna(self):
        with catch_warnings(record=True):
            filled = self.panel.fillna(0)
            assert np.isfinite(filled.values).all()

            filled = self.panel.fillna(method='backfill')
            assert_frame_equal(filled['ItemA'],
                               self.panel['ItemA'].fillna(method='backfill'))

            panel = self.panel.copy()
            panel['str'] = 'foo'

            filled = panel.fillna(method='backfill')
            assert_frame_equal(filled['ItemA'],
                               panel['ItemA'].fillna(method='backfill'))

            empty = self.panel.reindex(items=[])
            filled = empty.fillna(0)
            assert_panel_equal(filled, empty)

            pytest.raises(ValueError, self.panel.fillna)
            pytest.raises(ValueError, self.panel.fillna, 5, method='ffill')

            pytest.raises(TypeError, self.panel.fillna, [1, 2])
            pytest.raises(TypeError, self.panel.fillna, (1, 2))

            # limit not implemented when only value is specified
            p = Panel(np.random.randn(3, 4, 5))
            p.iloc[0:2, 0:2, 0:2] = np.nan
            pytest.raises(NotImplementedError,
                          lambda: p.fillna(999, limit=1))

            # Test in place fillNA
            # Expected result
            expected = Panel([[[0, 1], [2, 1]], [[10, 11], [12, 11]]],
                             items=['a', 'b'], minor_axis=['x', 'y'],
                             dtype=np.float64)
            # method='ffill'
            p1 = Panel([[[0, 1], [2, np.nan]], [[10, 11], [12, np.nan]]],
                       items=['a', 'b'], minor_axis=['x', 'y'],
                       dtype=np.float64)
            p1.fillna(method='ffill', inplace=True)
            assert_panel_equal(p1, expected)

            # method='bfill'
            p2 = Panel([[[0, np.nan], [2, 1]], [[10, np.nan], [12, 11]]],
                       items=['a', 'b'], minor_axis=['x', 'y'],
                       dtype=np.float64)
            p2.fillna(method='bfill', inplace=True)
            assert_panel_equal(p2, expected)

    def test_ffill_bfill(self):
        with catch_warnings(record=True):
            assert_panel_equal(self.panel.ffill(),
                               self.panel.fillna(method='ffill'))
            assert_panel_equal(self.panel.bfill(),
                               self.panel.fillna(method='bfill'))

    def test_truncate_fillna_bug(self):
        with catch_warnings(record=True):
            # #1823
            result = self.panel.truncate(before=None, after=None, axis='items')

            # it works!
            result.fillna(value=0.0)

    def test_swapaxes(self):
        with catch_warnings(record=True):
            result = self.panel.swapaxes('items', 'minor')
            assert result.items is self.panel.minor_axis

            result = self.panel.swapaxes('items', 'major')
            assert result.items is self.panel.major_axis

            result = self.panel.swapaxes('major', 'minor')
            assert result.major_axis is self.panel.minor_axis

            panel = self.panel.copy()
            result = panel.swapaxes('major', 'minor')
            panel.values[0, 0, 1] = np.nan
            expected = panel.swapaxes('major', 'minor')
            assert_panel_equal(result, expected)

            # this should also work
            result = self.panel.swapaxes(0, 1)
            assert result.items is self.panel.major_axis

            # this works, but return a copy
            result = self.panel.swapaxes('items', 'items')
            assert_panel_equal(self.panel, result)
            assert id(self.panel) != id(result)

    def test_transpose(self):
        with catch_warnings(record=True):
            result = self.panel.transpose('minor', 'major', 'items')
            expected = self.panel.swapaxes('items', 'minor')
            assert_panel_equal(result, expected)

            # test kwargs
            result = self.panel.transpose(items='minor', major='major',
                                          minor='items')
            expected = self.panel.swapaxes('items', 'minor')
            assert_panel_equal(result, expected)

            # text mixture of args
            result = self.panel.transpose(
                'minor', major='major', minor='items')
            expected = self.panel.swapaxes('items', 'minor')
            assert_panel_equal(result, expected)

            result = self.panel.transpose('minor',
                                          'major',
                                          minor='items')
            expected = self.panel.swapaxes('items', 'minor')
            assert_panel_equal(result, expected)

            # duplicate axes
            with tm.assert_raises_regex(TypeError,
                                        'not enough/duplicate arguments'):
                self.panel.transpose('minor', maj='major', minor='items')

            with tm.assert_raises_regex(ValueError,
                                        'repeated axis in transpose'):
                self.panel.transpose('minor', 'major', major='minor',
                                     minor='items')

            result = self.panel.transpose(2, 1, 0)
            assert_panel_equal(result, expected)

            result = self.panel.transpose('minor', 'items', 'major')
            expected = self.panel.swapaxes('items', 'minor')
            expected = expected.swapaxes('major', 'minor')
            assert_panel_equal(result, expected)

            result = self.panel.transpose(2, 0, 1)
            assert_panel_equal(result, expected)

            pytest.raises(ValueError, self.panel.transpose, 0, 0, 1)

    def test_transpose_copy(self):
        with catch_warnings(record=True):
            panel = self.panel.copy()
            result = panel.transpose(2, 0, 1, copy=True)
            expected = panel.swapaxes('items', 'minor')
            expected = expected.swapaxes('major', 'minor')
            assert_panel_equal(result, expected)

            panel.values[0, 1, 1] = np.nan
            assert notnull(result.values[1, 0, 1])

    def test_to_frame(self):
        with catch_warnings(record=True):
            # filtered
            filtered = self.panel.to_frame()
            expected = self.panel.to_frame().dropna(how='any')
            assert_frame_equal(filtered, expected)

            # unfiltered
            unfiltered = self.panel.to_frame(filter_observations=False)
            assert_panel_equal(unfiltered.to_panel(), self.panel)

            # names
            assert unfiltered.index.names == ('major', 'minor')

            # unsorted, round trip
            df = self.panel.to_frame(filter_observations=False)
            unsorted = df.take(np.random.permutation(len(df)))
            pan = unsorted.to_panel()
            assert_panel_equal(pan, self.panel)

            # preserve original index names
            df = DataFrame(np.random.randn(6, 2),
                           index=[['a', 'a', 'b', 'b', 'c', 'c'],
                                  [0, 1, 0, 1, 0, 1]],
                           columns=['one', 'two'])
            df.index.names = ['foo', 'bar']
            df.columns.name = 'baz'

            rdf = df.to_panel().to_frame()
            assert rdf.index.names == df.index.names
            assert rdf.columns.names == df.columns.names

    def test_to_frame_mixed(self):
        with catch_warnings(record=True):
            panel = self.panel.fillna(0)
            panel['str'] = 'foo'
            panel['bool'] = panel['ItemA'] > 0

            lp = panel.to_frame()
            wp = lp.to_panel()
            assert wp['bool'].values.dtype == np.bool_
            # Previously, this was mutating the underlying
            # index and changing its name
            assert_frame_equal(wp['bool'], panel['bool'], check_names=False)

            # GH 8704
            # with categorical
            df = panel.to_frame()
            df['category'] = df['str'].astype('category')

            # to_panel
            # TODO: this converts back to object
            p = df.to_panel()
            expected = panel.copy()
            expected['category'] = 'foo'
            assert_panel_equal(p, expected)

    def test_to_frame_multi_major(self):
        with catch_warnings(record=True):
            idx = MultiIndex.from_tuples(
                [(1, 'one'), (1, 'two'), (2, 'one'), (2, 'two')])
            df = DataFrame([[1, 'a', 1], [2, 'b', 1],
                            [3, 'c', 1], [4, 'd', 1]],
                           columns=['A', 'B', 'C'], index=idx)
            wp = Panel({'i1': df, 'i2': df})
            expected_idx = MultiIndex.from_tuples(
                [
                    (1, 'one', 'A'), (1, 'one', 'B'),
                    (1, 'one', 'C'), (1, 'two', 'A'),
                    (1, 'two', 'B'), (1, 'two', 'C'),
                    (2, 'one', 'A'), (2, 'one', 'B'),
                    (2, 'one', 'C'), (2, 'two', 'A'),
                    (2, 'two', 'B'), (2, 'two', 'C')
                ],
                names=[None, None, 'minor'])
            expected = DataFrame({'i1': [1, 'a', 1, 2, 'b', 1, 3,
                                         'c', 1, 4, 'd', 1],
                                  'i2': [1, 'a', 1, 2, 'b',
                                         1, 3, 'c', 1, 4, 'd', 1]},
                                 index=expected_idx)
            result = wp.to_frame()
            assert_frame_equal(result, expected)

            wp.iloc[0, 0].iloc[0] = np.nan  # BUG on setting. GH #5773
            result = wp.to_frame()
            assert_frame_equal(result, expected[1:])

            idx = MultiIndex.from_tuples(
                [(1, 'two'), (1, 'one'), (2, 'one'), (np.nan, 'two')])
            df = DataFrame([[1, 'a', 1], [2, 'b', 1],
                            [3, 'c', 1], [4, 'd', 1]],
                           columns=['A', 'B', 'C'], index=idx)
            wp = Panel({'i1': df, 'i2': df})
            ex_idx = MultiIndex.from_tuples([(1, 'two', 'A'), (1, 'two', 'B'),
                                             (1, 'two', 'C'),
                                             (1, 'one', 'A'),
                                             (1, 'one', 'B'),
                                             (1, 'one', 'C'),
                                             (2, 'one', 'A'),
                                             (2, 'one', 'B'),
                                             (2, 'one', 'C'),
                                             (np.nan, 'two', 'A'),
                                             (np.nan, 'two', 'B'),
                                             (np.nan, 'two', 'C')],
                                            names=[None, None, 'minor'])
            expected.index = ex_idx
            result = wp.to_frame()
            assert_frame_equal(result, expected)

    def test_to_frame_multi_major_minor(self):
        with catch_warnings(record=True):
            cols = MultiIndex(levels=[['C_A', 'C_B'], ['C_1', 'C_2']],
                              labels=[[0, 0, 1, 1], [0, 1, 0, 1]])
            idx = MultiIndex.from_tuples([(1, 'one'), (1, 'two'), (2, 'one'), (
                2, 'two'), (3, 'three'), (4, 'four')])
            df = DataFrame([[1, 2, 11, 12], [3, 4, 13, 14],
                            ['a', 'b', 'w', 'x'],
                            ['c', 'd', 'y', 'z'], [-1, -2, -3, -4],
                            [-5, -6, -7, -8]], columns=cols, index=idx)
            wp = Panel({'i1': df, 'i2': df})

            exp_idx = MultiIndex.from_tuples(
                [(1, 'one', 'C_A', 'C_1'), (1, 'one', 'C_A', 'C_2'),
                 (1, 'one', 'C_B', 'C_1'), (1, 'one', 'C_B', 'C_2'),
                 (1, 'two', 'C_A', 'C_1'), (1, 'two', 'C_A', 'C_2'),
                 (1, 'two', 'C_B', 'C_1'), (1, 'two', 'C_B', 'C_2'),
                 (2, 'one', 'C_A', 'C_1'), (2, 'one', 'C_A', 'C_2'),
                 (2, 'one', 'C_B', 'C_1'), (2, 'one', 'C_B', 'C_2'),
                 (2, 'two', 'C_A', 'C_1'), (2, 'two', 'C_A', 'C_2'),
                 (2, 'two', 'C_B', 'C_1'), (2, 'two', 'C_B', 'C_2'),
                 (3, 'three', 'C_A', 'C_1'), (3, 'three', 'C_A', 'C_2'),
                 (3, 'three', 'C_B', 'C_1'), (3, 'three', 'C_B', 'C_2'),
                 (4, 'four', 'C_A', 'C_1'), (4, 'four', 'C_A', 'C_2'),
                 (4, 'four', 'C_B', 'C_1'), (4, 'four', 'C_B', 'C_2')],
                names=[None, None, None, None])
            exp_val = [[1, 1], [2, 2], [11, 11], [12, 12],
                       [3, 3], [4, 4],
                       [13, 13], [14, 14], ['a', 'a'],
                       ['b', 'b'], ['w', 'w'],
                       ['x', 'x'], ['c', 'c'], ['d', 'd'], [
                           'y', 'y'], ['z', 'z'],
                       [-1, -1], [-2, -2], [-3, -3], [-4, -4],
                       [-5, -5], [-6, -6],
                       [-7, -7], [-8, -8]]
            result = wp.to_frame()
            expected = DataFrame(exp_val, columns=['i1', 'i2'], index=exp_idx)
            assert_frame_equal(result, expected)

    def test_to_frame_multi_drop_level(self):
        with catch_warnings(record=True):
            idx = MultiIndex.from_tuples([(1, 'one'), (2, 'one'), (2, 'two')])
            df = DataFrame({'A': [np.nan, 1, 2]}, index=idx)
            wp = Panel({'i1': df, 'i2': df})
            result = wp.to_frame()
            exp_idx = MultiIndex.from_tuples(
                [(2, 'one', 'A'), (2, 'two', 'A')],
                names=[None, None, 'minor'])
            expected = DataFrame({'i1': [1., 2], 'i2': [1., 2]}, index=exp_idx)
            assert_frame_equal(result, expected)

    def test_to_panel_na_handling(self):
        with catch_warnings(record=True):
            df = DataFrame(np.random.randint(0, 10, size=20).reshape((10, 2)),
                           index=[[0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
                                  [0, 1, 2, 3, 4, 5, 2, 3, 4, 5]])

            panel = df.to_panel()
            assert isnull(panel[0].loc[1, [0, 1]]).all()

    def test_to_panel_duplicates(self):
        # #2441
        with catch_warnings(record=True):
            df = DataFrame({'a': [0, 0, 1], 'b': [1, 1, 1], 'c': [1, 2, 3]})
            idf = df.set_index(['a', 'b'])
            tm.assert_raises_regex(
                ValueError, 'non-uniquely indexed', idf.to_panel)

    def test_panel_dups(self):
        with catch_warnings(record=True):

            # GH 4960
            # duplicates in an index

            # items
            data = np.random.randn(5, 100, 5)
            no_dup_panel = Panel(data, items=list("ABCDE"))
            panel = Panel(data, items=list("AACDE"))

            expected = no_dup_panel['A']
            result = panel.iloc[0]
            assert_frame_equal(result, expected)

            expected = no_dup_panel['E']
            result = panel.loc['E']
            assert_frame_equal(result, expected)

            expected = no_dup_panel.loc[['A', 'B']]
            expected.items = ['A', 'A']
            result = panel.loc['A']
            assert_panel_equal(result, expected)

            # major
            data = np.random.randn(5, 5, 5)
            no_dup_panel = Panel(data, major_axis=list("ABCDE"))
            panel = Panel(data, major_axis=list("AACDE"))

            expected = no_dup_panel.loc[:, 'A']
            result = panel.iloc[:, 0]
            assert_frame_equal(result, expected)

            expected = no_dup_panel.loc[:, 'E']
            result = panel.loc[:, 'E']
            assert_frame_equal(result, expected)

            expected = no_dup_panel.loc[:, ['A', 'B']]
            expected.major_axis = ['A', 'A']
            result = panel.loc[:, 'A']
            assert_panel_equal(result, expected)

            # minor
            data = np.random.randn(5, 100, 5)
            no_dup_panel = Panel(data, minor_axis=list("ABCDE"))
            panel = Panel(data, minor_axis=list("AACDE"))

            expected = no_dup_panel.loc[:, :, 'A']
            result = panel.iloc[:, :, 0]
            assert_frame_equal(result, expected)

            expected = no_dup_panel.loc[:, :, 'E']
            result = panel.loc[:, :, 'E']
            assert_frame_equal(result, expected)

            expected = no_dup_panel.loc[:, :, ['A', 'B']]
            expected.minor_axis = ['A', 'A']
            result = panel.loc[:, :, 'A']
            assert_panel_equal(result, expected)

    def test_filter(self):
        pass

    def test_compound(self):
        with catch_warnings(record=True):
            compounded = self.panel.compound()

            assert_series_equal(compounded['ItemA'],
                                (1 + self.panel['ItemA']).product(0) - 1,
                                check_names=False)

    def test_shift(self):
        with catch_warnings(record=True):
            # major
            idx = self.panel.major_axis[0]
            idx_lag = self.panel.major_axis[1]
            shifted = self.panel.shift(1)
            assert_frame_equal(self.panel.major_xs(idx),
                               shifted.major_xs(idx_lag))

            # minor
            idx = self.panel.minor_axis[0]
            idx_lag = self.panel.minor_axis[1]
            shifted = self.panel.shift(1, axis='minor')
            assert_frame_equal(self.panel.minor_xs(idx),
                               shifted.minor_xs(idx_lag))

            # items
            idx = self.panel.items[0]
            idx_lag = self.panel.items[1]
            shifted = self.panel.shift(1, axis='items')
            assert_frame_equal(self.panel[idx], shifted[idx_lag])

            # negative numbers, #2164
            result = self.panel.shift(-1)
            expected = Panel(dict((i, f.shift(-1)[:-1])
                                  for i, f in self.panel.iteritems()))
            assert_panel_equal(result, expected)

            # mixed dtypes #6959
            data = [('item ' + ch, makeMixedDataFrame())
                    for ch in list('abcde')]
            data = dict(data)
            mixed_panel = Panel.from_dict(data, orient='minor')
            shifted = mixed_panel.shift(1)
            assert_series_equal(mixed_panel.dtypes, shifted.dtypes)

    def test_tshift(self):
        # PeriodIndex
        with catch_warnings(record=True):
            ps = tm.makePeriodPanel()
            shifted = ps.tshift(1)
            unshifted = shifted.tshift(-1)

            assert_panel_equal(unshifted, ps)

            shifted2 = ps.tshift(freq='B')
            assert_panel_equal(shifted, shifted2)

            shifted3 = ps.tshift(freq=BDay())
            assert_panel_equal(shifted, shifted3)

            tm.assert_raises_regex(ValueError, 'does not match',
                                   ps.tshift, freq='M')

            # DatetimeIndex
            panel = make_test_panel()
            shifted = panel.tshift(1)
            unshifted = shifted.tshift(-1)

            assert_panel_equal(panel, unshifted)

            shifted2 = panel.tshift(freq=panel.major_axis.freq)
            assert_panel_equal(shifted, shifted2)

            inferred_ts = Panel(panel.values, items=panel.items,
                                major_axis=Index(np.asarray(panel.major_axis)),
                                minor_axis=panel.minor_axis)
            shifted = inferred_ts.tshift(1)
            unshifted = shifted.tshift(-1)
            assert_panel_equal(shifted, panel.tshift(1))
            assert_panel_equal(unshifted, inferred_ts)

            no_freq = panel.iloc[:, [0, 5, 7], :]
            pytest.raises(ValueError, no_freq.tshift)

    def test_pct_change(self):
        with catch_warnings(record=True):
            df1 = DataFrame({'c1': [1, 2, 5], 'c2': [3, 4, 6]})
            df2 = df1 + 1
            df3 = DataFrame({'c1': [3, 4, 7], 'c2': [5, 6, 8]})
            wp = Panel({'i1': df1, 'i2': df2, 'i3': df3})
            # major, 1
            result = wp.pct_change()  # axis='major'
            expected = Panel({'i1': df1.pct_change(),
                              'i2': df2.pct_change(),
                              'i3': df3.pct_change()})
            assert_panel_equal(result, expected)
            result = wp.pct_change(axis=1)
            assert_panel_equal(result, expected)
            # major, 2
            result = wp.pct_change(periods=2)
            expected = Panel({'i1': df1.pct_change(2),
                              'i2': df2.pct_change(2),
                              'i3': df3.pct_change(2)})
            assert_panel_equal(result, expected)
            # minor, 1
            result = wp.pct_change(axis='minor')
            expected = Panel({'i1': df1.pct_change(axis=1),
                              'i2': df2.pct_change(axis=1),
                              'i3': df3.pct_change(axis=1)})
            assert_panel_equal(result, expected)
            result = wp.pct_change(axis=2)
            assert_panel_equal(result, expected)
            # minor, 2
            result = wp.pct_change(periods=2, axis='minor')
            expected = Panel({'i1': df1.pct_change(periods=2, axis=1),
                              'i2': df2.pct_change(periods=2, axis=1),
                              'i3': df3.pct_change(periods=2, axis=1)})
            assert_panel_equal(result, expected)
            # items, 1
            result = wp.pct_change(axis='items')
            expected = Panel(
                {'i1': DataFrame({'c1': [np.nan, np.nan, np.nan],
                                  'c2': [np.nan, np.nan, np.nan]}),
                 'i2': DataFrame({'c1': [1, 0.5, .2],
                                  'c2': [1. / 3, 0.25, 1. / 6]}),
                 'i3': DataFrame({'c1': [.5, 1. / 3, 1. / 6],
                                  'c2': [.25, .2, 1. / 7]})})
            assert_panel_equal(result, expected)
            result = wp.pct_change(axis=0)
            assert_panel_equal(result, expected)
            # items, 2
            result = wp.pct_change(periods=2, axis='items')
            expected = Panel(
                {'i1': DataFrame({'c1': [np.nan, np.nan, np.nan],
                                  'c2': [np.nan, np.nan, np.nan]}),
                 'i2': DataFrame({'c1': [np.nan, np.nan, np.nan],
                                  'c2': [np.nan, np.nan, np.nan]}),
                 'i3': DataFrame({'c1': [2, 1, .4],
                                  'c2': [2. / 3, .5, 1. / 3]})})
            assert_panel_equal(result, expected)

    def test_round(self):
        with catch_warnings(record=True):
            values = [[[-3.2, 2.2], [0, -4.8213], [3.123, 123.12],
                       [-1566.213, 88.88], [-12, 94.5]],
                      [[-5.82, 3.5], [6.21, -73.272], [-9.087, 23.12],
                       [272.212, -99.99], [23, -76.5]]]
            evalues = [[[float(np.around(i)) for i in j] for j in k]
                       for k in values]
            p = Panel(values, items=['Item1', 'Item2'],
                      major_axis=pd.date_range('1/1/2000', periods=5),
                      minor_axis=['A', 'B'])
            expected = Panel(evalues, items=['Item1', 'Item2'],
                             major_axis=pd.date_range('1/1/2000', periods=5),
                             minor_axis=['A', 'B'])
            result = p.round()
            assert_panel_equal(expected, result)

    def test_numpy_round(self):
        with catch_warnings(record=True):
            values = [[[-3.2, 2.2], [0, -4.8213], [3.123, 123.12],
                       [-1566.213, 88.88], [-12, 94.5]],
                      [[-5.82, 3.5], [6.21, -73.272], [-9.087, 23.12],
                       [272.212, -99.99], [23, -76.5]]]
            evalues = [[[float(np.around(i)) for i in j] for j in k]
                       for k in values]
            p = Panel(values, items=['Item1', 'Item2'],
                      major_axis=pd.date_range('1/1/2000', periods=5),
                      minor_axis=['A', 'B'])
            expected = Panel(evalues, items=['Item1', 'Item2'],
                             major_axis=pd.date_range('1/1/2000', periods=5),
                             minor_axis=['A', 'B'])
            result = np.round(p)
            assert_panel_equal(expected, result)

            msg = "the 'out' parameter is not supported"
            tm.assert_raises_regex(ValueError, msg, np.round, p, out=p)

    def test_multiindex_get(self):
        with catch_warnings(record=True):
            ind = MultiIndex.from_tuples(
                [('a', 1), ('a', 2), ('b', 1), ('b', 2)],
                names=['first', 'second'])
            wp = Panel(np.random.random((4, 5, 5)),
                       items=ind,
                       major_axis=np.arange(5),
                       minor_axis=np.arange(5))
            f1 = wp['a']
            f2 = wp.loc['a']
            assert_panel_equal(f1, f2)

            assert (f1.items == [1, 2]).all()
            assert (f2.items == [1, 2]).all()

            ind = MultiIndex.from_tuples([('a', 1), ('a', 2), ('b', 1)],
                                         names=['first', 'second'])

    def test_multiindex_blocks(self):
        with catch_warnings(record=True):
            ind = MultiIndex.from_tuples([('a', 1), ('a', 2), ('b', 1)],
                                         names=['first', 'second'])
            wp = Panel(self.panel._data)
            wp.items = ind
            f1 = wp['a']
            assert (f1.items == [1, 2]).all()

            f1 = wp[('b', 1)]
            assert (f1.columns == ['A', 'B', 'C', 'D']).all()

    def test_repr_empty(self):
        with catch_warnings(record=True):
            empty = Panel()
            repr(empty)

    def test_rename(self):
        with catch_warnings(record=True):
            mapper = {'ItemA': 'foo', 'ItemB': 'bar', 'ItemC': 'baz'}

            renamed = self.panel.rename_axis(mapper, axis=0)
            exp = Index(['foo', 'bar', 'baz'])
            tm.assert_index_equal(renamed.items, exp)

            renamed = self.panel.rename_axis(str.lower, axis=2)
            exp = Index(['a', 'b', 'c', 'd'])
            tm.assert_index_equal(renamed.minor_axis, exp)

            # don't copy
            renamed_nocopy = self.panel.rename_axis(mapper, axis=0, copy=False)
            renamed_nocopy['foo'] = 3.
            assert (self.panel['ItemA'].values == 3).all()

    def test_get_attr(self):
        assert_frame_equal(self.panel['ItemA'], self.panel.ItemA)

        # specific cases from #3440
        self.panel['a'] = self.panel['ItemA']
        assert_frame_equal(self.panel['a'], self.panel.a)
        self.panel['i'] = self.panel['ItemA']
        assert_frame_equal(self.panel['i'], self.panel.i)

    def test_from_frame_level1_unsorted(self):
        with catch_warnings(record=True):
            tuples = [('MSFT', 3), ('MSFT', 2), ('AAPL', 2), ('AAPL', 1),
                      ('MSFT', 1)]
            midx = MultiIndex.from_tuples(tuples)
            df = DataFrame(np.random.rand(5, 4), index=midx)
            p = df.to_panel()
            assert_frame_equal(p.minor_xs(2), df.xs(2, level=1).sort_index())

    def test_to_excel(self):
        try:
            import xlwt  # noqa
            import xlrd  # noqa
            import openpyxl  # noqa
            from pandas.io.excel import ExcelFile
        except ImportError:
            pytest.skip("need xlwt xlrd openpyxl")

        for ext in ['xls', 'xlsx']:
            with ensure_clean('__tmp__.' + ext) as path:
                self.panel.to_excel(path)
                try:
                    reader = ExcelFile(path)
                except ImportError:
                    pytest.skip("need xlwt xlrd openpyxl")

                for item, df in self.panel.iteritems():
                    recdf = reader.parse(str(item), index_col=0)
                    assert_frame_equal(df, recdf)

    def test_to_excel_xlsxwriter(self):
        try:
            import xlrd  # noqa
            import xlsxwriter  # noqa
            from pandas.io.excel import ExcelFile
        except ImportError:
            pytest.skip("Requires xlrd and xlsxwriter. Skipping test.")

        with ensure_clean('__tmp__.xlsx') as path:
            self.panel.to_excel(path, engine='xlsxwriter')
            try:
                reader = ExcelFile(path)
            except ImportError as e:
                pytest.skip("cannot write excel file: %s" % e)

            for item, df in self.panel.iteritems():
                recdf = reader.parse(str(item), index_col=0)
                assert_frame_equal(df, recdf)

    def test_dropna(self):
        with catch_warnings(record=True):
            p = Panel(np.random.randn(4, 5, 6), major_axis=list('abcde'))
            p.loc[:, ['b', 'd'], 0] = np.nan

            result = p.dropna(axis=1)
            exp = p.loc[:, ['a', 'c', 'e'], :]
            assert_panel_equal(result, exp)
            inp = p.copy()
            inp.dropna(axis=1, inplace=True)
            assert_panel_equal(inp, exp)

            result = p.dropna(axis=1, how='all')
            assert_panel_equal(result, p)

            p.loc[:, ['b', 'd'], :] = np.nan
            result = p.dropna(axis=1, how='all')
            exp = p.loc[:, ['a', 'c', 'e'], :]
            assert_panel_equal(result, exp)

            p = Panel(np.random.randn(4, 5, 6), items=list('abcd'))
            p.loc[['b'], :, 0] = np.nan

            result = p.dropna()
            exp = p.loc[['a', 'c', 'd']]
            assert_panel_equal(result, exp)

            result = p.dropna(how='all')
            assert_panel_equal(result, p)

            p.loc['b'] = np.nan
            result = p.dropna(how='all')
            exp = p.loc[['a', 'c', 'd']]
            assert_panel_equal(result, exp)

    def test_drop(self):
        with catch_warnings(record=True):
            df = DataFrame({"A": [1, 2], "B": [3, 4]})
            panel = Panel({"One": df, "Two": df})

            def check_drop(drop_val, axis_number, aliases, expected):
                try:
                    actual = panel.drop(drop_val, axis=axis_number)
                    assert_panel_equal(actual, expected)
                    for alias in aliases:
                        actual = panel.drop(drop_val, axis=alias)
                        assert_panel_equal(actual, expected)
                except AssertionError:
                    pprint_thing("Failed with axis_number %d and aliases: %s" %
                                 (axis_number, aliases))
                    raise
            # Items
            expected = Panel({"One": df})
            check_drop('Two', 0, ['items'], expected)

            pytest.raises(ValueError, panel.drop, 'Three')

            # errors = 'ignore'
            dropped = panel.drop('Three', errors='ignore')
            assert_panel_equal(dropped, panel)
            dropped = panel.drop(['Two', 'Three'], errors='ignore')
            expected = Panel({"One": df})
            assert_panel_equal(dropped, expected)

            # Major
            exp_df = DataFrame({"A": [2], "B": [4]}, index=[1])
            expected = Panel({"One": exp_df, "Two": exp_df})
            check_drop(0, 1, ['major_axis', 'major'], expected)

            exp_df = DataFrame({"A": [1], "B": [3]}, index=[0])
            expected = Panel({"One": exp_df, "Two": exp_df})
            check_drop([1], 1, ['major_axis', 'major'], expected)

            # Minor
            exp_df = df[['B']]
            expected = Panel({"One": exp_df, "Two": exp_df})
            check_drop(["A"], 2, ['minor_axis', 'minor'], expected)

            exp_df = df[['A']]
            expected = Panel({"One": exp_df, "Two": exp_df})
            check_drop("B", 2, ['minor_axis', 'minor'], expected)

    def test_update(self):
        with catch_warnings(record=True):
            pan = Panel([[[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]],
                         [[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]]])

            other = Panel(
                [[[3.6, 2., np.nan], [np.nan, np.nan, 7]]], items=[1])

            pan.update(other)

            expected = Panel([[[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                               [1.5, np.nan, 3.], [1.5, np.nan, 3.]],
                              [[3.6, 2., 3], [1.5, np.nan, 7],
                               [1.5, np.nan, 3.],
                               [1.5, np.nan, 3.]]])

            assert_panel_equal(pan, expected)

    def test_update_from_dict(self):
        with catch_warnings(record=True):
            pan = Panel({'one': DataFrame([[1.5, np.nan, 3],
                                           [1.5, np.nan, 3],
                                           [1.5, np.nan, 3.],
                                           [1.5, np.nan, 3.]]),
                         'two': DataFrame([[1.5, np.nan, 3.],
                                           [1.5, np.nan, 3.],
                                           [1.5, np.nan, 3.],
                                           [1.5, np.nan, 3.]])})

            other = {'two': DataFrame(
                [[3.6, 2., np.nan], [np.nan, np.nan, 7]])}

            pan.update(other)

            expected = Panel(
                {'two': DataFrame([[3.6, 2., 3],
                                   [1.5, np.nan, 7],
                                   [1.5, np.nan, 3.],
                                   [1.5, np.nan, 3.]]),
                 'one': DataFrame([[1.5, np.nan, 3.],
                                   [1.5, np.nan, 3.],
                                   [1.5, np.nan, 3.],
                                   [1.5, np.nan, 3.]])})

            assert_panel_equal(pan, expected)

    def test_update_nooverwrite(self):
        with catch_warnings(record=True):
            pan = Panel([[[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]],
                         [[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]]])

            other = Panel(
                [[[3.6, 2., np.nan], [np.nan, np.nan, 7]]], items=[1])

            pan.update(other, overwrite=False)

            expected = Panel([[[1.5, np.nan, 3], [1.5, np.nan, 3],
                               [1.5, np.nan, 3.], [1.5, np.nan, 3.]],
                              [[1.5, 2., 3.], [1.5, np.nan, 3.],
                               [1.5, np.nan, 3.],
                               [1.5, np.nan, 3.]]])

            assert_panel_equal(pan, expected)

    def test_update_filtered(self):
        with catch_warnings(record=True):
            pan = Panel([[[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]],
                         [[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]]])

            other = Panel(
                [[[3.6, 2., np.nan], [np.nan, np.nan, 7]]], items=[1])

            pan.update(other, filter_func=lambda x: x > 2)

            expected = Panel([[[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                               [1.5, np.nan, 3.], [1.5, np.nan, 3.]],
                              [[1.5, np.nan, 3], [1.5, np.nan, 7],
                               [1.5, np.nan, 3.], [1.5, np.nan, 3.]]])

            assert_panel_equal(pan, expected)

    def test_update_raise(self):
        with catch_warnings(record=True):
            pan = Panel([[[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]],
                         [[1.5, np.nan, 3.], [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.],
                          [1.5, np.nan, 3.]]])

            pytest.raises(Exception, pan.update, *(pan, ),
                          **{'raise_conflict': True})

    def test_all_any(self):
        assert (self.panel.all(axis=0).values == nanall(
            self.panel, axis=0)).all()
        assert (self.panel.all(axis=1).values == nanall(
            self.panel, axis=1).T).all()
        assert (self.panel.all(axis=2).values == nanall(
            self.panel, axis=2).T).all()
        assert (self.panel.any(axis=0).values == nanany(
            self.panel, axis=0)).all()
        assert (self.panel.any(axis=1).values == nanany(
            self.panel, axis=1).T).all()
        assert (self.panel.any(axis=2).values == nanany(
            self.panel, axis=2).T).all()

    def test_all_any_unhandled(self):
        pytest.raises(NotImplementedError, self.panel.all, bool_only=True)
        pytest.raises(NotImplementedError, self.panel.any, bool_only=True)


class TestLongPanel(object):
    """
    LongPanel no longer exists, but...
    """

    def setup_method(self, method):
        panel = make_test_panel()
        self.panel = panel.to_frame()
        self.unfiltered_panel = panel.to_frame(filter_observations=False)

    def test_ops_differently_indexed(self):
        with catch_warnings(record=True):
            # trying to set non-identically indexed panel
            wp = self.panel.to_panel()
            wp2 = wp.reindex(major=wp.major_axis[:-1])
            lp2 = wp2.to_frame()

            result = self.panel + lp2
            assert_frame_equal(result.reindex(lp2.index), lp2 * 2)

            # careful, mutation
            self.panel['foo'] = lp2['ItemA']
            assert_series_equal(self.panel['foo'].reindex(lp2.index),
                                lp2['ItemA'],
                                check_names=False)

    def test_ops_scalar(self):
        with catch_warnings(record=True):
            result = self.panel.mul(2)
            expected = DataFrame.__mul__(self.panel, 2)
            assert_frame_equal(result, expected)

    def test_combineFrame(self):
        with catch_warnings(record=True):
            wp = self.panel.to_panel()
            result = self.panel.add(wp['ItemA'].stack(), axis=0)
            assert_frame_equal(result.to_panel()['ItemA'], wp['ItemA'] * 2)

    def test_combinePanel(self):
        with catch_warnings(record=True):
            wp = self.panel.to_panel()
            result = self.panel.add(self.panel)
            wide_result = result.to_panel()
            assert_frame_equal(wp['ItemA'] * 2, wide_result['ItemA'])

            # one item
            result = self.panel.add(self.panel.filter(['ItemA']))

    def test_combine_scalar(self):
        with catch_warnings(record=True):
            result = self.panel.mul(2)
            expected = DataFrame(self.panel._data) * 2
            assert_frame_equal(result, expected)

    def test_combine_series(self):
        with catch_warnings(record=True):
            s = self.panel['ItemA'][:10]
            result = self.panel.add(s, axis=0)
            expected = DataFrame.add(self.panel, s, axis=0)
            assert_frame_equal(result, expected)

            s = self.panel.iloc[5]
            result = self.panel + s
            expected = DataFrame.add(self.panel, s, axis=1)
            assert_frame_equal(result, expected)

    def test_operators(self):
        with catch_warnings(record=True):
            wp = self.panel.to_panel()
            result = (self.panel + 1).to_panel()
            assert_frame_equal(wp['ItemA'] + 1, result['ItemA'])

    def test_arith_flex_panel(self):
        with catch_warnings(record=True):
            ops = ['add', 'sub', 'mul', 'div',
                   'truediv', 'pow', 'floordiv', 'mod']
            if not compat.PY3:
                aliases = {}
            else:
                aliases = {'div': 'truediv'}
            self.panel = self.panel.to_panel()

            for n in [np.random.randint(-50, -1), np.random.randint(1, 50), 0]:
                for op in ops:
                    alias = aliases.get(op, op)
                    f = getattr(operator, alias)
                    exp = f(self.panel, n)
                    result = getattr(self.panel, op)(n)
                    assert_panel_equal(result, exp, check_panel_type=True)

                    # rops
                    r_f = lambda x, y: f(y, x)
                    exp = r_f(self.panel, n)
                    result = getattr(self.panel, 'r' + op)(n)
                    assert_panel_equal(result, exp)

    def test_sort(self):
        def is_sorted(arr):
            return (arr[1:] > arr[:-1]).any()

        sorted_minor = self.panel.sort_index(level=1)
        assert is_sorted(sorted_minor.index.labels[1])

        sorted_major = sorted_minor.sort_index(level=0)
        assert is_sorted(sorted_major.index.labels[0])

    def test_to_string(self):
        buf = StringIO()
        self.panel.to_string(buf)

    def test_to_sparse(self):
        if isinstance(self.panel, Panel):
            msg = 'sparsifying is not supported'
            tm.assert_raises_regex(NotImplementedError, msg,
                                   self.panel.to_sparse)

    def test_truncate(self):
        with catch_warnings(record=True):
            dates = self.panel.index.levels[0]
            start, end = dates[1], dates[5]

            trunced = self.panel.truncate(start, end).to_panel()
            expected = self.panel.to_panel()['ItemA'].truncate(start, end)

            # TODO trucate drops index.names
            assert_frame_equal(trunced['ItemA'], expected, check_names=False)

            trunced = self.panel.truncate(before=start).to_panel()
            expected = self.panel.to_panel()['ItemA'].truncate(before=start)

            # TODO trucate drops index.names
            assert_frame_equal(trunced['ItemA'], expected, check_names=False)

            trunced = self.panel.truncate(after=end).to_panel()
            expected = self.panel.to_panel()['ItemA'].truncate(after=end)

            # TODO trucate drops index.names
            assert_frame_equal(trunced['ItemA'], expected, check_names=False)

            # truncate on dates that aren't in there
            wp = self.panel.to_panel()
            new_index = wp.major_axis[::5]

            wp2 = wp.reindex(major=new_index)

            lp2 = wp2.to_frame()
            lp_trunc = lp2.truncate(wp.major_axis[2], wp.major_axis[-2])

            wp_trunc = wp2.truncate(wp.major_axis[2], wp.major_axis[-2])

            assert_panel_equal(wp_trunc, lp_trunc.to_panel())

            # throw proper exception
            pytest.raises(Exception, lp2.truncate, wp.major_axis[-2],
                          wp.major_axis[2])

    def test_axis_dummies(self):
        from pandas.core.reshape.reshape import make_axis_dummies

        minor_dummies = make_axis_dummies(self.panel, 'minor').astype(np.uint8)
        assert len(minor_dummies.columns) == len(self.panel.index.levels[1])

        major_dummies = make_axis_dummies(self.panel, 'major').astype(np.uint8)
        assert len(major_dummies.columns) == len(self.panel.index.levels[0])

        mapping = {'A': 'one', 'B': 'one', 'C': 'two', 'D': 'two'}

        transformed = make_axis_dummies(self.panel, 'minor',
                                        transform=mapping.get).astype(np.uint8)
        assert len(transformed.columns) == 2
        tm.assert_index_equal(transformed.columns, Index(['one', 'two']))

        # TODO: test correctness

    def test_get_dummies(self):
        from pandas.core.reshape.reshape import get_dummies, make_axis_dummies

        self.panel['Label'] = self.panel.index.labels[1]
        minor_dummies = make_axis_dummies(self.panel, 'minor').astype(np.uint8)
        dummies = get_dummies(self.panel['Label'])
        tm.assert_numpy_array_equal(dummies.values, minor_dummies.values)

    def test_mean(self):
        with catch_warnings(record=True):
            means = self.panel.mean(level='minor')

            # test versus Panel version
            wide_means = self.panel.to_panel().mean('major')
            assert_frame_equal(means, wide_means)

    def test_sum(self):
        with catch_warnings(record=True):
            sums = self.panel.sum(level='minor')

            # test versus Panel version
            wide_sums = self.panel.to_panel().sum('major')
            assert_frame_equal(sums, wide_sums)

    def test_count(self):
        with catch_warnings(record=True):
            index = self.panel.index

            major_count = self.panel.count(level=0)['ItemA']
            labels = index.labels[0]
            for i, idx in enumerate(index.levels[0]):
                assert major_count[i] == (labels == i).sum()

            minor_count = self.panel.count(level=1)['ItemA']
            labels = index.labels[1]
            for i, idx in enumerate(index.levels[1]):
                assert minor_count[i] == (labels == i).sum()

    def test_join(self):
        with catch_warnings(record=True):
            lp1 = self.panel.filter(['ItemA', 'ItemB'])
            lp2 = self.panel.filter(['ItemC'])

            joined = lp1.join(lp2)

            assert len(joined.columns) == 3

            pytest.raises(Exception, lp1.join,
                          self.panel.filter(['ItemB', 'ItemC']))

    def test_pivot(self):
        with catch_warnings(record=True):
            from pandas.core.reshape.reshape import _slow_pivot

            one, two, three = (np.array([1, 2, 3, 4, 5]),
                               np.array(['a', 'b', 'c', 'd', 'e']),
                               np.array([1, 2, 3, 5, 4.]))
            df = pivot(one, two, three)
            assert df['a'][1] == 1
            assert df['b'][2] == 2
            assert df['c'][3] == 3
            assert df['d'][4] == 5
            assert df['e'][5] == 4
            assert_frame_equal(df, _slow_pivot(one, two, three))

            # weird overlap, TODO: test?
            a, b, c = (np.array([1, 2, 3, 4, 4]),
                       np.array(['a', 'a', 'a', 'a', 'a']),
                       np.array([1., 2., 3., 4., 5.]))
            pytest.raises(Exception, pivot, a, b, c)

            # corner case, empty
            df = pivot(np.array([]), np.array([]), np.array([]))


def test_panel_index():
    index = panelm.panel_index([1, 2, 3, 4], [1, 2, 3])
    expected = MultiIndex.from_arrays([np.tile([1, 2, 3, 4], 3),
                                       np.repeat([1, 2, 3], 4)],
                                      names=['time', 'panel'])
    tm.assert_index_equal(index, expected)
