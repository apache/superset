# coding: utf-8

""" Test cases for DataFrame.plot """

import pytest
import string
import warnings

from datetime import datetime, date

import pandas as pd
from pandas import (Series, DataFrame, MultiIndex, PeriodIndex, date_range,
                    bdate_range)
from pandas.core.dtypes.api import is_list_like
from pandas.compat import range, lrange, lmap, lzip, u, zip, PY3
from pandas.io.formats.printing import pprint_thing
import pandas.util.testing as tm
from pandas.util.testing import slow

from pandas.core.config import set_option

import numpy as np
from numpy.random import rand, randn

import pandas.plotting as plotting
from pandas.tests.plotting.common import (TestPlotBase, _check_plot_works,
                                          _skip_if_no_scipy_gaussian_kde,
                                          _ok_for_gaussian_kde)

tm._skip_module_if_no_mpl()


class TestDataFramePlots(TestPlotBase):

    def setup_method(self, method):
        TestPlotBase.setup_method(self, method)
        import matplotlib as mpl
        mpl.rcdefaults()

        self.tdf = tm.makeTimeDataFrame()
        self.hexbin_df = DataFrame({"A": np.random.uniform(size=20),
                                    "B": np.random.uniform(size=20),
                                    "C": np.arange(20) + np.random.uniform(
                                        size=20)})

    @slow
    def test_plot(self):
        df = self.tdf
        _check_plot_works(df.plot, grid=False)
        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot,
                                     subplots=True)
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot,
                                     subplots=True, layout=(-1, 2))
        self._check_axes_shape(axes, axes_num=4, layout=(2, 2))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot,
                                     subplots=True, use_index=False)
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        df = DataFrame({'x': [1, 2], 'y': [3, 4]})
        # mpl >= 1.5.2 (or slightly below) throw AttributError
        with pytest.raises((TypeError, AttributeError)):
            df.plot.line(blarg=True)

        df = DataFrame(np.random.rand(10, 3),
                       index=list(string.ascii_letters[:10]))

        _check_plot_works(df.plot, use_index=True)
        _check_plot_works(df.plot, sort_columns=False)
        _check_plot_works(df.plot, yticks=[1, 5, 10])
        _check_plot_works(df.plot, xticks=[1, 5, 10])
        _check_plot_works(df.plot, ylim=(-100, 100), xlim=(-100, 100))

        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(df.plot, subplots=True, title='blah')

        # We have to redo it here because _check_plot_works does two plots,
        # once without an ax kwarg and once with an ax kwarg and the new sharex
        # behaviour does not remove the visibility of the latter axis (as ax is
        # present).  see: https://github.com/pandas-dev/pandas/issues/9737

        axes = df.plot(subplots=True, title='blah')
        self._check_axes_shape(axes, axes_num=3, layout=(3, 1))
        # axes[0].figure.savefig("test.png")
        for ax in axes[:2]:
            self._check_visible(ax.xaxis)  # xaxis must be visible for grid
            self._check_visible(ax.get_xticklabels(), visible=False)
            self._check_visible(ax.get_xticklabels(minor=True), visible=False)
            self._check_visible([ax.xaxis.get_label()], visible=False)
        for ax in [axes[2]]:
            self._check_visible(ax.xaxis)
            self._check_visible(ax.get_xticklabels())
            self._check_visible([ax.xaxis.get_label()])
            self._check_ticks_props(ax, xrot=0)

        _check_plot_works(df.plot, title='blah')

        tuples = lzip(string.ascii_letters[:10], range(10))
        df = DataFrame(np.random.rand(10, 3),
                       index=MultiIndex.from_tuples(tuples))
        _check_plot_works(df.plot, use_index=True)

        # unicode
        index = MultiIndex.from_tuples([(u('\u03b1'), 0),
                                        (u('\u03b1'), 1),
                                        (u('\u03b2'), 2),
                                        (u('\u03b2'), 3),
                                        (u('\u03b3'), 4),
                                        (u('\u03b3'), 5),
                                        (u('\u03b4'), 6),
                                        (u('\u03b4'), 7)], names=['i0', 'i1'])
        columns = MultiIndex.from_tuples([('bar', u('\u0394')),
                                          ('bar', u('\u0395'))], names=['c0',
                                                                        'c1'])
        df = DataFrame(np.random.randint(0, 10, (8, 2)),
                       columns=columns,
                       index=index)
        _check_plot_works(df.plot, title=u('\u03A3'))

        # GH 6951
        # Test with single column
        df = DataFrame({'x': np.random.rand(10)})
        axes = _check_plot_works(df.plot.bar, subplots=True)
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))

        axes = _check_plot_works(df.plot.bar, subplots=True, layout=(-1, 1))
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))
        # When ax is supplied and required number of axes is 1,
        # passed ax should be used:
        fig, ax = self.plt.subplots()
        axes = df.plot.bar(subplots=True, ax=ax)
        assert len(axes) == 1
        if self.mpl_ge_1_5_0:
            result = ax.axes
        else:
            result = ax.get_axes()  # deprecated
        assert result is axes[0]

    # GH 15516
    def test_mpl2_color_cycle_str(self):
        # test CN mpl 2.0 color cycle
        if self.mpl_ge_2_0_0:
            colors = ['C' + str(x) for x in range(10)]
            df = DataFrame(randn(10, 3), columns=['a', 'b', 'c'])
            for c in colors:
                _check_plot_works(df.plot, color=c)
        else:
            pytest.skip("not supported in matplotlib < 2.0.0")

    def test_color_single_series_list(self):
        # GH 3486
        df = DataFrame({"A": [1, 2, 3]})
        _check_plot_works(df.plot, color=['red'])

    def test_color_empty_string(self):
        df = DataFrame(randn(10, 2))
        with pytest.raises(ValueError):
            df.plot(color='')

    def test_color_and_style_arguments(self):
        df = DataFrame({'x': [1, 2], 'y': [3, 4]})
        # passing both 'color' and 'style' arguments should be allowed
        # if there is no color symbol in the style strings:
        ax = df.plot(color=['red', 'black'], style=['-', '--'])
        # check that the linestyles are correctly set:
        linestyle = [line.get_linestyle() for line in ax.lines]
        assert linestyle == ['-', '--']
        # check that the colors are correctly set:
        color = [line.get_color() for line in ax.lines]
        assert color == ['red', 'black']
        # passing both 'color' and 'style' arguments should not be allowed
        # if there is a color symbol in the style strings:
        with pytest.raises(ValueError):
            df.plot(color=['red', 'black'], style=['k-', 'r--'])

    def test_nonnumeric_exclude(self):
        df = DataFrame({'A': ["x", "y", "z"], 'B': [1, 2, 3]})
        ax = df.plot()
        assert len(ax.get_lines()) == 1  # B was plotted

    @slow
    def test_implicit_label(self):
        df = DataFrame(randn(10, 3), columns=['a', 'b', 'c'])
        ax = df.plot(x='a', y='b')
        self._check_text_labels(ax.xaxis.get_label(), 'a')

    @slow
    def test_donot_overwrite_index_name(self):
        # GH 8494
        df = DataFrame(randn(2, 2), columns=['a', 'b'])
        df.index.name = 'NAME'
        df.plot(y='b', label='LABEL')
        assert df.index.name == 'NAME'

    @slow
    def test_plot_xy(self):
        # columns.inferred_type == 'string'
        df = self.tdf
        self._check_data(df.plot(x=0, y=1), df.set_index('A')['B'].plot())
        self._check_data(df.plot(x=0), df.set_index('A').plot())
        self._check_data(df.plot(y=0), df.B.plot())
        self._check_data(df.plot(x='A', y='B'), df.set_index('A').B.plot())
        self._check_data(df.plot(x='A'), df.set_index('A').plot())
        self._check_data(df.plot(y='B'), df.B.plot())

        # columns.inferred_type == 'integer'
        df.columns = lrange(1, len(df.columns) + 1)
        self._check_data(df.plot(x=1, y=2), df.set_index(1)[2].plot())
        self._check_data(df.plot(x=1), df.set_index(1).plot())
        self._check_data(df.plot(y=1), df[1].plot())

        # figsize and title
        ax = df.plot(x=1, y=2, title='Test', figsize=(16, 8))
        self._check_text_labels(ax.title, 'Test')
        self._check_axes_shape(ax, axes_num=1, layout=(1, 1),
                               figsize=(16., 8.))

        # columns.inferred_type == 'mixed'
        # TODO add MultiIndex test

    @slow
    def test_logscales(self):
        df = DataFrame({'a': np.arange(100)}, index=np.arange(100))
        ax = df.plot(logy=True)
        self._check_ax_scales(ax, yaxis='log')

        ax = df.plot(logx=True)
        self._check_ax_scales(ax, xaxis='log')

        ax = df.plot(loglog=True)
        self._check_ax_scales(ax, xaxis='log', yaxis='log')

    @slow
    def test_xcompat(self):
        import pandas as pd

        df = self.tdf
        ax = df.plot(x_compat=True)
        lines = ax.get_lines()
        assert not isinstance(lines[0].get_xdata(), PeriodIndex)

        tm.close()
        pd.plotting.plot_params['xaxis.compat'] = True
        ax = df.plot()
        lines = ax.get_lines()
        assert not isinstance(lines[0].get_xdata(), PeriodIndex)

        tm.close()
        pd.plotting.plot_params['x_compat'] = False

        ax = df.plot()
        lines = ax.get_lines()
        assert not isinstance(lines[0].get_xdata(), PeriodIndex)
        assert isinstance(PeriodIndex(lines[0].get_xdata()), PeriodIndex)

        tm.close()
        # useful if you're plotting a bunch together
        with pd.plotting.plot_params.use('x_compat', True):
            ax = df.plot()
            lines = ax.get_lines()
            assert not isinstance(lines[0].get_xdata(), PeriodIndex)

        tm.close()
        ax = df.plot()
        lines = ax.get_lines()
        assert not isinstance(lines[0].get_xdata(), PeriodIndex)
        assert isinstance(PeriodIndex(lines[0].get_xdata()), PeriodIndex)

    def test_period_compat(self):
        # GH 9012
        # period-array conversions
        df = DataFrame(
            np.random.rand(21, 2),
            index=bdate_range(datetime(2000, 1, 1), datetime(2000, 1, 31)),
            columns=['a', 'b'])

        df.plot()
        self.plt.axhline(y=0)
        tm.close()

    def test_unsorted_index(self):
        df = DataFrame({'y': np.arange(100)}, index=np.arange(99, -1, -1),
                       dtype=np.int64)
        ax = df.plot()
        l = ax.get_lines()[0]
        rs = l.get_xydata()
        rs = Series(rs[:, 1], rs[:, 0], dtype=np.int64, name='y')
        tm.assert_series_equal(rs, df.y, check_index_type=False)
        tm.close()

        df.index = pd.Index(np.arange(99, -1, -1), dtype=np.float64)
        ax = df.plot()
        l = ax.get_lines()[0]
        rs = l.get_xydata()
        rs = Series(rs[:, 1], rs[:, 0], dtype=np.int64, name='y')
        tm.assert_series_equal(rs, df.y)

    @slow
    def test_subplots(self):
        df = DataFrame(np.random.rand(10, 3),
                       index=list(string.ascii_letters[:10]))

        for kind in ['bar', 'barh', 'line', 'area']:
            axes = df.plot(kind=kind, subplots=True, sharex=True, legend=True)
            self._check_axes_shape(axes, axes_num=3, layout=(3, 1))
            assert axes.shape == (3, )

            for ax, column in zip(axes, df.columns):
                self._check_legend_labels(ax,
                                          labels=[pprint_thing(column)])

            for ax in axes[:-2]:
                self._check_visible(ax.xaxis)  # xaxis must be visible for grid
                self._check_visible(ax.get_xticklabels(), visible=False)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=False)
                self._check_visible(ax.xaxis.get_label(), visible=False)
                self._check_visible(ax.get_yticklabels())

            self._check_visible(axes[-1].xaxis)
            self._check_visible(axes[-1].get_xticklabels())
            self._check_visible(axes[-1].get_xticklabels(minor=True))
            self._check_visible(axes[-1].xaxis.get_label())
            self._check_visible(axes[-1].get_yticklabels())

            axes = df.plot(kind=kind, subplots=True, sharex=False)
            for ax in axes:
                self._check_visible(ax.xaxis)
                self._check_visible(ax.get_xticklabels())
                self._check_visible(ax.get_xticklabels(minor=True))
                self._check_visible(ax.xaxis.get_label())
                self._check_visible(ax.get_yticklabels())

            axes = df.plot(kind=kind, subplots=True, legend=False)
            for ax in axes:
                assert ax.get_legend() is None

    @slow
    def test_subplots_timeseries(self):
        idx = date_range(start='2014-07-01', freq='M', periods=10)
        df = DataFrame(np.random.rand(10, 3), index=idx)

        for kind in ['line', 'area']:
            axes = df.plot(kind=kind, subplots=True, sharex=True)
            self._check_axes_shape(axes, axes_num=3, layout=(3, 1))

            for ax in axes[:-2]:
                # GH 7801
                self._check_visible(ax.xaxis)  # xaxis must be visible for grid
                self._check_visible(ax.get_xticklabels(), visible=False)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=False)
                self._check_visible(ax.xaxis.get_label(), visible=False)
                self._check_visible(ax.get_yticklabels())

            self._check_visible(axes[-1].xaxis)
            self._check_visible(axes[-1].get_xticklabels())
            self._check_visible(axes[-1].get_xticklabels(minor=True))
            self._check_visible(axes[-1].xaxis.get_label())
            self._check_visible(axes[-1].get_yticklabels())
            self._check_ticks_props(axes, xrot=0)

            axes = df.plot(kind=kind, subplots=True, sharex=False, rot=45,
                           fontsize=7)
            for ax in axes:
                self._check_visible(ax.xaxis)
                self._check_visible(ax.get_xticklabels())
                self._check_visible(ax.get_xticklabels(minor=True))
                self._check_visible(ax.xaxis.get_label())
                self._check_visible(ax.get_yticklabels())
                self._check_ticks_props(ax, xlabelsize=7, xrot=45,
                                        ylabelsize=7)

    @slow
    def test_subplots_layout(self):
        # GH 6667
        df = DataFrame(np.random.rand(10, 3),
                       index=list(string.ascii_letters[:10]))

        axes = df.plot(subplots=True, layout=(2, 2))
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))
        assert axes.shape == (2, 2)

        axes = df.plot(subplots=True, layout=(-1, 2))
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))
        assert axes.shape == (2, 2)

        axes = df.plot(subplots=True, layout=(2, -1))
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))
        assert axes.shape == (2, 2)

        axes = df.plot(subplots=True, layout=(1, 4))
        self._check_axes_shape(axes, axes_num=3, layout=(1, 4))
        assert axes.shape == (1, 4)

        axes = df.plot(subplots=True, layout=(-1, 4))
        self._check_axes_shape(axes, axes_num=3, layout=(1, 4))
        assert axes.shape == (1, 4)

        axes = df.plot(subplots=True, layout=(4, -1))
        self._check_axes_shape(axes, axes_num=3, layout=(4, 1))
        assert axes.shape == (4, 1)

        with pytest.raises(ValueError):
            df.plot(subplots=True, layout=(1, 1))
        with pytest.raises(ValueError):
            df.plot(subplots=True, layout=(-1, -1))

        # single column
        df = DataFrame(np.random.rand(10, 1),
                       index=list(string.ascii_letters[:10]))
        axes = df.plot(subplots=True)
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))
        assert axes.shape == (1, )

        axes = df.plot(subplots=True, layout=(3, 3))
        self._check_axes_shape(axes, axes_num=1, layout=(3, 3))
        assert axes.shape == (3, 3)

    @slow
    def test_subplots_warnings(self):
        # GH 9464
        warnings.simplefilter('error')
        try:
            df = DataFrame(np.random.randn(100, 4))
            df.plot(subplots=True, layout=(3, 2))

            df = DataFrame(np.random.randn(100, 4),
                           index=date_range('1/1/2000', periods=100))
            df.plot(subplots=True, layout=(3, 2))
        except Warning as w:
            self.fail(w)
        warnings.simplefilter('default')

    @slow
    def test_subplots_multiple_axes(self):
        # GH 5353, 6970, GH 7069
        fig, axes = self.plt.subplots(2, 3)
        df = DataFrame(np.random.rand(10, 3),
                       index=list(string.ascii_letters[:10]))

        returned = df.plot(subplots=True, ax=axes[0], sharex=False,
                           sharey=False)
        self._check_axes_shape(returned, axes_num=3, layout=(1, 3))
        assert returned.shape == (3, )
        assert returned[0].figure is fig
        # draw on second row
        returned = df.plot(subplots=True, ax=axes[1], sharex=False,
                           sharey=False)
        self._check_axes_shape(returned, axes_num=3, layout=(1, 3))
        assert returned.shape == (3, )
        assert returned[0].figure is fig
        self._check_axes_shape(axes, axes_num=6, layout=(2, 3))
        tm.close()

        with pytest.raises(ValueError):
            fig, axes = self.plt.subplots(2, 3)
            # pass different number of axes from required
            df.plot(subplots=True, ax=axes)

        # pass 2-dim axes and invalid layout
        # invalid lauout should not affect to input and return value
        # (show warning is tested in
        # TestDataFrameGroupByPlots.test_grouped_box_multiple_axes
        fig, axes = self.plt.subplots(2, 2)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            df = DataFrame(np.random.rand(10, 4),
                           index=list(string.ascii_letters[:10]))

            returned = df.plot(subplots=True, ax=axes, layout=(2, 1),
                               sharex=False, sharey=False)
            self._check_axes_shape(returned, axes_num=4, layout=(2, 2))
            assert returned.shape == (4, )

            returned = df.plot(subplots=True, ax=axes, layout=(2, -1),
                               sharex=False, sharey=False)
            self._check_axes_shape(returned, axes_num=4, layout=(2, 2))
            assert returned.shape == (4, )

            returned = df.plot(subplots=True, ax=axes, layout=(-1, 2),
                               sharex=False, sharey=False)
        self._check_axes_shape(returned, axes_num=4, layout=(2, 2))
        assert returned.shape == (4, )

        # single column
        fig, axes = self.plt.subplots(1, 1)
        df = DataFrame(np.random.rand(10, 1),
                       index=list(string.ascii_letters[:10]))

        axes = df.plot(subplots=True, ax=[axes], sharex=False, sharey=False)
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))
        assert axes.shape == (1, )

    def test_subplots_ts_share_axes(self):
        # GH 3964
        fig, axes = self.plt.subplots(3, 3, sharex=True, sharey=True)
        self.plt.subplots_adjust(left=0.05, right=0.95, hspace=0.3, wspace=0.3)
        df = DataFrame(
            np.random.randn(10, 9),
            index=date_range(start='2014-07-01', freq='M', periods=10))
        for i, ax in enumerate(axes.ravel()):
            df[i].plot(ax=ax, fontsize=5)

        # Rows other than bottom should not be visible
        for ax in axes[0:-1].ravel():
            self._check_visible(ax.get_xticklabels(), visible=False)

        # Bottom row should be visible
        for ax in axes[-1].ravel():
            self._check_visible(ax.get_xticklabels(), visible=True)

        # First column should be visible
        for ax in axes[[0, 1, 2], [0]].ravel():
            self._check_visible(ax.get_yticklabels(), visible=True)

        # Other columns should not be visible
        for ax in axes[[0, 1, 2], [1]].ravel():
            self._check_visible(ax.get_yticklabels(), visible=False)
        for ax in axes[[0, 1, 2], [2]].ravel():
            self._check_visible(ax.get_yticklabels(), visible=False)

    def test_subplots_sharex_axes_existing_axes(self):
        # GH 9158
        d = {'A': [1., 2., 3., 4.], 'B': [4., 3., 2., 1.], 'C': [5, 1, 3, 4]}
        df = DataFrame(d, index=date_range('2014 10 11', '2014 10 14'))

        axes = df[['A', 'B']].plot(subplots=True)
        df['C'].plot(ax=axes[0], secondary_y=True)

        self._check_visible(axes[0].get_xticklabels(), visible=False)
        self._check_visible(axes[1].get_xticklabels(), visible=True)
        for ax in axes.ravel():
            self._check_visible(ax.get_yticklabels(), visible=True)

    @slow
    def test_subplots_dup_columns(self):
        # GH 10962
        df = DataFrame(np.random.rand(5, 5), columns=list('aaaaa'))
        axes = df.plot(subplots=True)
        for ax in axes:
            self._check_legend_labels(ax, labels=['a'])
            assert len(ax.lines) == 1
        tm.close()

        axes = df.plot(subplots=True, secondary_y='a')
        for ax in axes:
            # (right) is only attached when subplots=False
            self._check_legend_labels(ax, labels=['a'])
            assert len(ax.lines) == 1
        tm.close()

        ax = df.plot(secondary_y='a')
        self._check_legend_labels(ax, labels=['a (right)'] * 5)
        assert len(ax.lines) == 0
        assert len(ax.right_ax.lines) == 5

    def test_negative_log(self):
        df = - DataFrame(rand(6, 4),
                         index=list(string.ascii_letters[:6]),
                         columns=['x', 'y', 'z', 'four'])

        with pytest.raises(ValueError):
            df.plot.area(logy=True)
        with pytest.raises(ValueError):
            df.plot.area(loglog=True)

    def _compare_stacked_y_cood(self, normal_lines, stacked_lines):
        base = np.zeros(len(normal_lines[0].get_data()[1]))
        for nl, sl in zip(normal_lines, stacked_lines):
            base += nl.get_data()[1]  # get y coodinates
            sy = sl.get_data()[1]
            tm.assert_numpy_array_equal(base, sy)

    def test_line_area_stacked(self):
        with tm.RNGContext(42):
            df = DataFrame(rand(6, 4), columns=['w', 'x', 'y', 'z'])
            neg_df = -df
            # each column has either positive or negative value
            sep_df = DataFrame({'w': rand(6),
                                'x': rand(6),
                                'y': -rand(6),
                                'z': -rand(6)})
            # each column has positive-negative mixed value
            mixed_df = DataFrame(randn(6, 4),
                                 index=list(string.ascii_letters[:6]),
                                 columns=['w', 'x', 'y', 'z'])

            for kind in ['line', 'area']:
                ax1 = _check_plot_works(df.plot, kind=kind, stacked=False)
                ax2 = _check_plot_works(df.plot, kind=kind, stacked=True)
                self._compare_stacked_y_cood(ax1.lines, ax2.lines)

                ax1 = _check_plot_works(neg_df.plot, kind=kind, stacked=False)
                ax2 = _check_plot_works(neg_df.plot, kind=kind, stacked=True)
                self._compare_stacked_y_cood(ax1.lines, ax2.lines)

                ax1 = _check_plot_works(sep_df.plot, kind=kind, stacked=False)
                ax2 = _check_plot_works(sep_df.plot, kind=kind, stacked=True)
                self._compare_stacked_y_cood(ax1.lines[:2], ax2.lines[:2])
                self._compare_stacked_y_cood(ax1.lines[2:], ax2.lines[2:])

                _check_plot_works(mixed_df.plot, stacked=False)
                with pytest.raises(ValueError):
                    mixed_df.plot(stacked=True)

                _check_plot_works(df.plot, kind=kind, logx=True, stacked=True)

    def test_line_area_nan_df(self):
        values1 = [1, 2, np.nan, 3]
        values2 = [3, np.nan, 2, 1]
        df = DataFrame({'a': values1, 'b': values2})
        tdf = DataFrame({'a': values1,
                         'b': values2}, index=tm.makeDateIndex(k=4))

        for d in [df, tdf]:
            ax = _check_plot_works(d.plot)
            masked1 = ax.lines[0].get_ydata()
            masked2 = ax.lines[1].get_ydata()
            # remove nan for comparison purpose

            exp = np.array([1, 2, 3], dtype=np.float64)
            tm.assert_numpy_array_equal(np.delete(masked1.data, 2), exp)

            exp = np.array([3, 2, 1], dtype=np.float64)
            tm.assert_numpy_array_equal(np.delete(masked2.data, 1), exp)
            tm.assert_numpy_array_equal(
                masked1.mask, np.array([False, False, True, False]))
            tm.assert_numpy_array_equal(
                masked2.mask, np.array([False, True, False, False]))

            expected1 = np.array([1, 2, 0, 3], dtype=np.float64)
            expected2 = np.array([3, 0, 2, 1], dtype=np.float64)

            ax = _check_plot_works(d.plot, stacked=True)
            tm.assert_numpy_array_equal(ax.lines[0].get_ydata(), expected1)
            tm.assert_numpy_array_equal(ax.lines[1].get_ydata(),
                                        expected1 + expected2)

            ax = _check_plot_works(d.plot.area)
            tm.assert_numpy_array_equal(ax.lines[0].get_ydata(), expected1)
            tm.assert_numpy_array_equal(ax.lines[1].get_ydata(),
                                        expected1 + expected2)

            ax = _check_plot_works(d.plot.area, stacked=False)
            tm.assert_numpy_array_equal(ax.lines[0].get_ydata(), expected1)
            tm.assert_numpy_array_equal(ax.lines[1].get_ydata(), expected2)

    def test_line_lim(self):
        df = DataFrame(rand(6, 3), columns=['x', 'y', 'z'])
        ax = df.plot()
        xmin, xmax = ax.get_xlim()
        lines = ax.get_lines()
        assert xmin == lines[0].get_data()[0][0]
        assert xmax == lines[0].get_data()[0][-1]

        ax = df.plot(secondary_y=True)
        xmin, xmax = ax.get_xlim()
        lines = ax.get_lines()
        assert xmin == lines[0].get_data()[0][0]
        assert xmax == lines[0].get_data()[0][-1]

        axes = df.plot(secondary_y=True, subplots=True)
        self._check_axes_shape(axes, axes_num=3, layout=(3, 1))
        for ax in axes:
            assert hasattr(ax, 'left_ax')
            assert not hasattr(ax, 'right_ax')
            xmin, xmax = ax.get_xlim()
            lines = ax.get_lines()
            assert xmin == lines[0].get_data()[0][0]
            assert xmax == lines[0].get_data()[0][-1]

    def test_area_lim(self):
        df = DataFrame(rand(6, 4), columns=['x', 'y', 'z', 'four'])

        neg_df = -df
        for stacked in [True, False]:
            ax = _check_plot_works(df.plot.area, stacked=stacked)
            xmin, xmax = ax.get_xlim()
            ymin, ymax = ax.get_ylim()
            lines = ax.get_lines()
            assert xmin == lines[0].get_data()[0][0]
            assert xmax == lines[0].get_data()[0][-1]
            assert ymin == 0

            ax = _check_plot_works(neg_df.plot.area, stacked=stacked)
            ymin, ymax = ax.get_ylim()
            assert ymax == 0

    @slow
    def test_bar_colors(self):
        import matplotlib.pyplot as plt
        default_colors = self._maybe_unpack_cycler(plt.rcParams)

        df = DataFrame(randn(5, 5))
        ax = df.plot.bar()
        self._check_colors(ax.patches[::5], facecolors=default_colors[:5])
        tm.close()

        custom_colors = 'rgcby'
        ax = df.plot.bar(color=custom_colors)
        self._check_colors(ax.patches[::5], facecolors=custom_colors)
        tm.close()

        from matplotlib import cm
        # Test str -> colormap functionality
        ax = df.plot.bar(colormap='jet')
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, 5))
        self._check_colors(ax.patches[::5], facecolors=rgba_colors)
        tm.close()

        # Test colormap functionality
        ax = df.plot.bar(colormap=cm.jet)
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, 5))
        self._check_colors(ax.patches[::5], facecolors=rgba_colors)
        tm.close()

        ax = df.loc[:, [0]].plot.bar(color='DodgerBlue')
        self._check_colors([ax.patches[0]], facecolors=['DodgerBlue'])
        tm.close()

        ax = df.plot(kind='bar', color='green')
        self._check_colors(ax.patches[::5], facecolors=['green'] * 5)
        tm.close()

    @slow
    def test_bar_linewidth(self):
        df = DataFrame(randn(5, 5))

        # regular
        ax = df.plot.bar(linewidth=2)
        for r in ax.patches:
            assert r.get_linewidth() == 2

        # stacked
        ax = df.plot.bar(stacked=True, linewidth=2)
        for r in ax.patches:
            assert r.get_linewidth() == 2

        # subplots
        axes = df.plot.bar(linewidth=2, subplots=True)
        self._check_axes_shape(axes, axes_num=5, layout=(5, 1))
        for ax in axes:
            for r in ax.patches:
                assert r.get_linewidth() == 2

    @slow
    def test_bar_barwidth(self):
        df = DataFrame(randn(5, 5))

        width = 0.9

        # regular
        ax = df.plot.bar(width=width)
        for r in ax.patches:
            assert r.get_width() == width / len(df.columns)

        # stacked
        ax = df.plot.bar(stacked=True, width=width)
        for r in ax.patches:
            assert r.get_width() == width

        # horizontal regular
        ax = df.plot.barh(width=width)
        for r in ax.patches:
            assert r.get_height() == width / len(df.columns)

        # horizontal stacked
        ax = df.plot.barh(stacked=True, width=width)
        for r in ax.patches:
            assert r.get_height() == width

        # subplots
        axes = df.plot.bar(width=width, subplots=True)
        for ax in axes:
            for r in ax.patches:
                assert r.get_width() == width

        # horizontal subplots
        axes = df.plot.barh(width=width, subplots=True)
        for ax in axes:
            for r in ax.patches:
                assert r.get_height() == width

    @slow
    def test_bar_barwidth_position(self):
        df = DataFrame(randn(5, 5))
        self._check_bar_alignment(df, kind='bar', stacked=False, width=0.9,
                                  position=0.2)
        self._check_bar_alignment(df, kind='bar', stacked=True, width=0.9,
                                  position=0.2)
        self._check_bar_alignment(df, kind='barh', stacked=False, width=0.9,
                                  position=0.2)
        self._check_bar_alignment(df, kind='barh', stacked=True, width=0.9,
                                  position=0.2)
        self._check_bar_alignment(df, kind='bar', subplots=True, width=0.9,
                                  position=0.2)
        self._check_bar_alignment(df, kind='barh', subplots=True, width=0.9,
                                  position=0.2)

    @slow
    def test_bar_barwidth_position_int(self):
        # GH 12979
        df = DataFrame(randn(5, 5))

        for w in [1, 1.]:
            ax = df.plot.bar(stacked=True, width=w)
            ticks = ax.xaxis.get_ticklocs()
            tm.assert_numpy_array_equal(ticks, np.array([0, 1, 2, 3, 4]))
            assert ax.get_xlim() == (-0.75, 4.75)
            # check left-edge of bars
            assert ax.patches[0].get_x() == -0.5
            assert ax.patches[-1].get_x() == 3.5

        self._check_bar_alignment(df, kind='bar', stacked=True, width=1)
        self._check_bar_alignment(df, kind='barh', stacked=False, width=1)
        self._check_bar_alignment(df, kind='barh', stacked=True, width=1)
        self._check_bar_alignment(df, kind='bar', subplots=True, width=1)
        self._check_bar_alignment(df, kind='barh', subplots=True, width=1)

    @slow
    def test_bar_bottom_left(self):
        df = DataFrame(rand(5, 5))
        ax = df.plot.bar(stacked=False, bottom=1)
        result = [p.get_y() for p in ax.patches]
        assert result == [1] * 25

        ax = df.plot.bar(stacked=True, bottom=[-1, -2, -3, -4, -5])
        result = [p.get_y() for p in ax.patches[:5]]
        assert result == [-1, -2, -3, -4, -5]

        ax = df.plot.barh(stacked=False, left=np.array([1, 1, 1, 1, 1]))
        result = [p.get_x() for p in ax.patches]
        assert result == [1] * 25

        ax = df.plot.barh(stacked=True, left=[1, 2, 3, 4, 5])
        result = [p.get_x() for p in ax.patches[:5]]
        assert result == [1, 2, 3, 4, 5]

        axes = df.plot.bar(subplots=True, bottom=-1)
        for ax in axes:
            result = [p.get_y() for p in ax.patches]
            assert result == [-1] * 5

        axes = df.plot.barh(subplots=True, left=np.array([1, 1, 1, 1, 1]))
        for ax in axes:
            result = [p.get_x() for p in ax.patches]
            assert result == [1] * 5

    @slow
    def test_bar_nan(self):
        df = DataFrame({'A': [10, np.nan, 20],
                        'B': [5, 10, 20],
                        'C': [1, 2, 3]})
        ax = df.plot.bar()
        expected = [10, 0, 20, 5, 10, 20, 1, 2, 3]
        result = [p.get_height() for p in ax.patches]
        assert result == expected

        ax = df.plot.bar(stacked=True)
        result = [p.get_height() for p in ax.patches]
        assert result == expected

        result = [p.get_y() for p in ax.patches]
        expected = [0.0, 0.0, 0.0, 10.0, 0.0, 20.0, 15.0, 10.0, 40.0]
        assert result == expected

    @slow
    def test_bar_categorical(self):
        # GH 13019
        df1 = pd.DataFrame(np.random.randn(6, 5),
                           index=pd.Index(list('ABCDEF')),
                           columns=pd.Index(list('abcde')))
        # categorical index must behave the same
        df2 = pd.DataFrame(np.random.randn(6, 5),
                           index=pd.CategoricalIndex(list('ABCDEF')),
                           columns=pd.CategoricalIndex(list('abcde')))

        for df in [df1, df2]:
            ax = df.plot.bar()
            ticks = ax.xaxis.get_ticklocs()
            tm.assert_numpy_array_equal(ticks, np.array([0, 1, 2, 3, 4, 5]))
            assert ax.get_xlim() == (-0.5, 5.5)
            # check left-edge of bars
            assert ax.patches[0].get_x() == -0.25
            assert ax.patches[-1].get_x() == 5.15

            ax = df.plot.bar(stacked=True)
            tm.assert_numpy_array_equal(ticks, np.array([0, 1, 2, 3, 4, 5]))
            assert ax.get_xlim() == (-0.5, 5.5)
            assert ax.patches[0].get_x() == -0.25
            assert ax.patches[-1].get_x() == 4.75

    @slow
    def test_plot_scatter(self):
        df = DataFrame(randn(6, 4),
                       index=list(string.ascii_letters[:6]),
                       columns=['x', 'y', 'z', 'four'])

        _check_plot_works(df.plot.scatter, x='x', y='y')
        _check_plot_works(df.plot.scatter, x=1, y=2)

        with pytest.raises(TypeError):
            df.plot.scatter(x='x')
        with pytest.raises(TypeError):
            df.plot.scatter(y='y')

        # GH 6951
        axes = df.plot(x='x', y='y', kind='scatter', subplots=True)
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))

    @slow
    def test_plot_scatter_with_c(self):
        df = DataFrame(randn(6, 4),
                       index=list(string.ascii_letters[:6]),
                       columns=['x', 'y', 'z', 'four'])

        axes = [df.plot.scatter(x='x', y='y', c='z'),
                df.plot.scatter(x=0, y=1, c=2)]
        for ax in axes:
            # default to Greys
            assert ax.collections[0].cmap.name == 'Greys'

            if self.mpl_ge_1_3_1:

                # n.b. there appears to be no public method to get the colorbar
                # label
                assert ax.collections[0].colorbar._label == 'z'

        cm = 'cubehelix'
        ax = df.plot.scatter(x='x', y='y', c='z', colormap=cm)
        assert ax.collections[0].cmap.name == cm

        # verify turning off colorbar works
        ax = df.plot.scatter(x='x', y='y', c='z', colorbar=False)
        assert ax.collections[0].colorbar is None

        # verify that we can still plot a solid color
        ax = df.plot.scatter(x=0, y=1, c='red')
        assert ax.collections[0].colorbar is None
        self._check_colors(ax.collections, facecolors=['r'])

        # Ensure that we can pass an np.array straight through to matplotlib,
        # this functionality was accidentally removed previously.
        # See https://github.com/pandas-dev/pandas/issues/8852 for bug report
        #
        # Exercise colormap path and non-colormap path as they are independent
        #
        df = DataFrame({'A': [1, 2], 'B': [3, 4]})
        red_rgba = [1.0, 0.0, 0.0, 1.0]
        green_rgba = [0.0, 1.0, 0.0, 1.0]
        rgba_array = np.array([red_rgba, green_rgba])
        ax = df.plot.scatter(x='A', y='B', c=rgba_array)
        # expect the face colors of the points in the non-colormap path to be
        # identical to the values we supplied, normally we'd be on shaky ground
        # comparing floats for equality but here we expect them to be
        # identical.
        tm.assert_numpy_array_equal(ax.collections[0]
                                    .get_facecolor(), rgba_array)
        # we don't test the colors of the faces in this next plot because they
        # are dependent on the spring colormap, which may change its colors
        # later.
        float_array = np.array([0.0, 1.0])
        df.plot.scatter(x='A', y='B', c=float_array, cmap='spring')

    def test_scatter_colors(self):
        df = DataFrame({'a': [1, 2, 3], 'b': [1, 2, 3], 'c': [1, 2, 3]})
        with pytest.raises(TypeError):
            df.plot.scatter(x='a', y='b', c='c', color='green')

        default_colors = self._maybe_unpack_cycler(self.plt.rcParams)

        ax = df.plot.scatter(x='a', y='b', c='c')
        tm.assert_numpy_array_equal(
            ax.collections[0].get_facecolor()[0],
            np.array(self.colorconverter.to_rgba(default_colors[0])))

        ax = df.plot.scatter(x='a', y='b', color='white')
        tm.assert_numpy_array_equal(ax.collections[0].get_facecolor()[0],
                                    np.array([1, 1, 1, 1], dtype=np.float64))

    @slow
    def test_plot_bar(self):
        df = DataFrame(randn(6, 4),
                       index=list(string.ascii_letters[:6]),
                       columns=['one', 'two', 'three', 'four'])

        _check_plot_works(df.plot.bar)
        _check_plot_works(df.plot.bar, legend=False)
        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(df.plot.bar, subplots=True)
        _check_plot_works(df.plot.bar, stacked=True)

        df = DataFrame(randn(10, 15),
                       index=list(string.ascii_letters[:10]),
                       columns=lrange(15))
        _check_plot_works(df.plot.bar)

        df = DataFrame({'a': [0, 1], 'b': [1, 0]})
        ax = _check_plot_works(df.plot.bar)
        self._check_ticks_props(ax, xrot=90)

        ax = df.plot.bar(rot=35, fontsize=10)
        self._check_ticks_props(ax, xrot=35, xlabelsize=10, ylabelsize=10)

        ax = _check_plot_works(df.plot.barh)
        self._check_ticks_props(ax, yrot=0)

        ax = df.plot.barh(rot=55, fontsize=11)
        self._check_ticks_props(ax, yrot=55, ylabelsize=11, xlabelsize=11)

    def _check_bar_alignment(self, df, kind='bar', stacked=False,
                             subplots=False, align='center', width=0.5,
                             position=0.5):

        axes = df.plot(kind=kind, stacked=stacked, subplots=subplots,
                       align=align, width=width, position=position, grid=True)

        axes = self._flatten_visible(axes)

        for ax in axes:
            if kind == 'bar':
                axis = ax.xaxis
                ax_min, ax_max = ax.get_xlim()
                min_edge = min([p.get_x() for p in ax.patches])
                max_edge = max([p.get_x() + p.get_width() for p in ax.patches])
            elif kind == 'barh':
                axis = ax.yaxis
                ax_min, ax_max = ax.get_ylim()
                min_edge = min([p.get_y() for p in ax.patches])
                max_edge = max([p.get_y() + p.get_height() for p in ax.patches
                                ])
            else:
                raise ValueError

            # GH 7498
            # compare margins between lim and bar edges
            tm.assert_almost_equal(ax_min, min_edge - 0.25)
            tm.assert_almost_equal(ax_max, max_edge + 0.25)

            p = ax.patches[0]
            if kind == 'bar' and (stacked is True or subplots is True):
                edge = p.get_x()
                center = edge + p.get_width() * position
            elif kind == 'bar' and stacked is False:
                center = p.get_x() + p.get_width() * len(df.columns) * position
                edge = p.get_x()
            elif kind == 'barh' and (stacked is True or subplots is True):
                center = p.get_y() + p.get_height() * position
                edge = p.get_y()
            elif kind == 'barh' and stacked is False:
                center = p.get_y() + p.get_height() * len(
                    df.columns) * position
                edge = p.get_y()
            else:
                raise ValueError

            # Check the ticks locates on integer
            assert (axis.get_ticklocs() == np.arange(len(df))).all()

            if align == 'center':
                # Check whether the bar locates on center
                tm.assert_almost_equal(axis.get_ticklocs()[0], center)
            elif align == 'edge':
                # Check whether the bar's edge starts from the tick
                tm.assert_almost_equal(axis.get_ticklocs()[0], edge)
            else:
                raise ValueError

        return axes

    @slow
    def test_bar_stacked_center(self):
        # GH2157
        df = DataFrame({'A': [3] * 5, 'B': lrange(5)}, index=lrange(5))
        self._check_bar_alignment(df, kind='bar', stacked=True)
        self._check_bar_alignment(df, kind='bar', stacked=True, width=0.9)
        self._check_bar_alignment(df, kind='barh', stacked=True)
        self._check_bar_alignment(df, kind='barh', stacked=True, width=0.9)

    @slow
    def test_bar_center(self):
        df = DataFrame({'A': [3] * 5, 'B': lrange(5)}, index=lrange(5))
        self._check_bar_alignment(df, kind='bar', stacked=False)
        self._check_bar_alignment(df, kind='bar', stacked=False, width=0.9)
        self._check_bar_alignment(df, kind='barh', stacked=False)
        self._check_bar_alignment(df, kind='barh', stacked=False, width=0.9)

    @slow
    def test_bar_subplots_center(self):
        df = DataFrame({'A': [3] * 5, 'B': lrange(5)}, index=lrange(5))
        self._check_bar_alignment(df, kind='bar', subplots=True)
        self._check_bar_alignment(df, kind='bar', subplots=True, width=0.9)
        self._check_bar_alignment(df, kind='barh', subplots=True)
        self._check_bar_alignment(df, kind='barh', subplots=True, width=0.9)

    @slow
    def test_bar_align_single_column(self):
        df = DataFrame(randn(5))
        self._check_bar_alignment(df, kind='bar', stacked=False)
        self._check_bar_alignment(df, kind='bar', stacked=True)
        self._check_bar_alignment(df, kind='barh', stacked=False)
        self._check_bar_alignment(df, kind='barh', stacked=True)
        self._check_bar_alignment(df, kind='bar', subplots=True)
        self._check_bar_alignment(df, kind='barh', subplots=True)

    @slow
    def test_bar_edge(self):
        df = DataFrame({'A': [3] * 5, 'B': lrange(5)}, index=lrange(5))

        self._check_bar_alignment(df, kind='bar', stacked=True, align='edge')
        self._check_bar_alignment(df, kind='bar', stacked=True, width=0.9,
                                  align='edge')
        self._check_bar_alignment(df, kind='barh', stacked=True, align='edge')
        self._check_bar_alignment(df, kind='barh', stacked=True, width=0.9,
                                  align='edge')

        self._check_bar_alignment(df, kind='bar', stacked=False, align='edge')
        self._check_bar_alignment(df, kind='bar', stacked=False, width=0.9,
                                  align='edge')
        self._check_bar_alignment(df, kind='barh', stacked=False, align='edge')
        self._check_bar_alignment(df, kind='barh', stacked=False, width=0.9,
                                  align='edge')

        self._check_bar_alignment(df, kind='bar', subplots=True, align='edge')
        self._check_bar_alignment(df, kind='bar', subplots=True, width=0.9,
                                  align='edge')
        self._check_bar_alignment(df, kind='barh', subplots=True, align='edge')
        self._check_bar_alignment(df, kind='barh', subplots=True, width=0.9,
                                  align='edge')

    @slow
    def test_bar_log_no_subplots(self):
        # GH3254, GH3298 matplotlib/matplotlib#1882, #1892
        # regressions in 1.2.1
        expected = np.array([1., 10.])

        if not self.mpl_le_1_2_1:
            expected = np.hstack((.1, expected, 100))

        # no subplots
        df = DataFrame({'A': [3] * 5, 'B': lrange(1, 6)}, index=lrange(5))
        ax = df.plot.bar(grid=True, log=True)
        tm.assert_numpy_array_equal(ax.yaxis.get_ticklocs(), expected)

    @slow
    def test_bar_log_subplots(self):
        expected = np.array([1., 10., 100., 1000.])
        if not self.mpl_le_1_2_1:
            expected = np.hstack((.1, expected, 1e4))

        ax = DataFrame([Series([200, 300]), Series([300, 500])]).plot.bar(
            log=True, subplots=True)

        tm.assert_numpy_array_equal(ax[0].yaxis.get_ticklocs(), expected)
        tm.assert_numpy_array_equal(ax[1].yaxis.get_ticklocs(), expected)

    @slow
    def test_boxplot(self):
        df = self.hist_df
        series = df['height']
        numeric_cols = df._get_numeric_data().columns
        labels = [pprint_thing(c) for c in numeric_cols]

        ax = _check_plot_works(df.plot.box)
        self._check_text_labels(ax.get_xticklabels(), labels)
        tm.assert_numpy_array_equal(ax.xaxis.get_ticklocs(),
                                    np.arange(1, len(numeric_cols) + 1))
        assert len(ax.lines) == self.bp_n_objects * len(numeric_cols)

        # different warning on py3
        if not PY3:
            with tm.assert_produces_warning(UserWarning):
                axes = _check_plot_works(df.plot.box, subplots=True, logy=True)

            self._check_axes_shape(axes, axes_num=3, layout=(1, 3))
            self._check_ax_scales(axes, yaxis='log')
            for ax, label in zip(axes, labels):
                self._check_text_labels(ax.get_xticklabels(), [label])
                assert len(ax.lines) == self.bp_n_objects

        axes = series.plot.box(rot=40)
        self._check_ticks_props(axes, xrot=40, yrot=0)
        tm.close()

        ax = _check_plot_works(series.plot.box)

        positions = np.array([1, 6, 7])
        ax = df.plot.box(positions=positions)
        numeric_cols = df._get_numeric_data().columns
        labels = [pprint_thing(c) for c in numeric_cols]
        self._check_text_labels(ax.get_xticklabels(), labels)
        tm.assert_numpy_array_equal(ax.xaxis.get_ticklocs(), positions)
        assert len(ax.lines) == self.bp_n_objects * len(numeric_cols)

    @slow
    def test_boxplot_vertical(self):
        df = self.hist_df
        numeric_cols = df._get_numeric_data().columns
        labels = [pprint_thing(c) for c in numeric_cols]

        # if horizontal, yticklabels are rotated
        ax = df.plot.box(rot=50, fontsize=8, vert=False)
        self._check_ticks_props(ax, xrot=0, yrot=50, ylabelsize=8)
        self._check_text_labels(ax.get_yticklabels(), labels)
        assert len(ax.lines) == self.bp_n_objects * len(numeric_cols)

        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot.box,
                                     subplots=True, vert=False, logx=True)
        self._check_axes_shape(axes, axes_num=3, layout=(1, 3))
        self._check_ax_scales(axes, xaxis='log')
        for ax, label in zip(axes, labels):
            self._check_text_labels(ax.get_yticklabels(), [label])
            assert len(ax.lines) == self.bp_n_objects

        positions = np.array([3, 2, 8])
        ax = df.plot.box(positions=positions, vert=False)
        self._check_text_labels(ax.get_yticklabels(), labels)
        tm.assert_numpy_array_equal(ax.yaxis.get_ticklocs(), positions)
        assert len(ax.lines) == self.bp_n_objects * len(numeric_cols)

    @slow
    def test_boxplot_return_type(self):
        df = DataFrame(randn(6, 4),
                       index=list(string.ascii_letters[:6]),
                       columns=['one', 'two', 'three', 'four'])
        with pytest.raises(ValueError):
            df.plot.box(return_type='NOTATYPE')

        result = df.plot.box(return_type='dict')
        self._check_box_return_type(result, 'dict')

        result = df.plot.box(return_type='axes')
        self._check_box_return_type(result, 'axes')

        result = df.plot.box()  # default axes
        self._check_box_return_type(result, 'axes')

        result = df.plot.box(return_type='both')
        self._check_box_return_type(result, 'both')

    @slow
    def test_boxplot_subplots_return_type(self):
        df = self.hist_df

        # normal style: return_type=None
        result = df.plot.box(subplots=True)
        assert isinstance(result, Series)
        self._check_box_return_type(result, None, expected_keys=[
                                    'height', 'weight', 'category'])

        for t in ['dict', 'axes', 'both']:
            returned = df.plot.box(return_type=t, subplots=True)
            self._check_box_return_type(
                returned, t,
                expected_keys=['height', 'weight', 'category'],
                check_ax_title=False)

    @slow
    def test_kde_df(self):
        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()
        df = DataFrame(randn(100, 4))
        ax = _check_plot_works(df.plot, kind='kde')
        expected = [pprint_thing(c) for c in df.columns]
        self._check_legend_labels(ax, labels=expected)
        self._check_ticks_props(ax, xrot=0)

        ax = df.plot(kind='kde', rot=20, fontsize=5)
        self._check_ticks_props(ax, xrot=20, xlabelsize=5, ylabelsize=5)

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot, kind='kde',
                                     subplots=True)
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        axes = df.plot(kind='kde', logy=True, subplots=True)
        self._check_ax_scales(axes, yaxis='log')

    @slow
    def test_kde_missing_vals(self):
        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()
        df = DataFrame(np.random.uniform(size=(100, 4)))
        df.loc[0, 0] = np.nan
        _check_plot_works(df.plot, kind='kde')

    @slow
    def test_hist_df(self):
        from matplotlib.patches import Rectangle
        if self.mpl_le_1_2_1:
            pytest.skip("not supported in matplotlib <= 1.2.x")

        df = DataFrame(randn(100, 4))
        series = df[0]

        ax = _check_plot_works(df.plot.hist)
        expected = [pprint_thing(c) for c in df.columns]
        self._check_legend_labels(ax, labels=expected)

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot.hist,
                                     subplots=True, logy=True)
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))
        self._check_ax_scales(axes, yaxis='log')

        axes = series.plot.hist(rot=40)
        self._check_ticks_props(axes, xrot=40, yrot=0)
        tm.close()

        ax = series.plot.hist(normed=True, cumulative=True, bins=4)
        # height of last bin (index 5) must be 1.0
        rects = [x for x in ax.get_children() if isinstance(x, Rectangle)]
        tm.assert_almost_equal(rects[-1].get_height(), 1.0)
        tm.close()

        ax = series.plot.hist(cumulative=True, bins=4)
        rects = [x for x in ax.get_children() if isinstance(x, Rectangle)]

        tm.assert_almost_equal(rects[-2].get_height(), 100.0)
        tm.close()

        # if horizontal, yticklabels are rotated
        axes = df.plot.hist(rot=50, fontsize=8, orientation='horizontal')
        self._check_ticks_props(axes, xrot=0, yrot=50, ylabelsize=8)

    def _check_box_coord(self, patches, expected_y=None, expected_h=None,
                         expected_x=None, expected_w=None):
        result_y = np.array([p.get_y() for p in patches])
        result_height = np.array([p.get_height() for p in patches])
        result_x = np.array([p.get_x() for p in patches])
        result_width = np.array([p.get_width() for p in patches])
        # dtype is depending on above values, no need to check

        if expected_y is not None:
            tm.assert_numpy_array_equal(result_y, expected_y,
                                        check_dtype=False)
        if expected_h is not None:
            tm.assert_numpy_array_equal(result_height, expected_h,
                                        check_dtype=False)
        if expected_x is not None:
            tm.assert_numpy_array_equal(result_x, expected_x,
                                        check_dtype=False)
        if expected_w is not None:
            tm.assert_numpy_array_equal(result_width, expected_w,
                                        check_dtype=False)

    @slow
    def test_hist_df_coord(self):
        normal_df = DataFrame({'A': np.repeat(np.array([1, 2, 3, 4, 5]),
                                              np.array([10, 9, 8, 7, 6])),
                               'B': np.repeat(np.array([1, 2, 3, 4, 5]),
                                              np.array([8, 8, 8, 8, 8])),
                               'C': np.repeat(np.array([1, 2, 3, 4, 5]),
                                              np.array([6, 7, 8, 9, 10]))},
                              columns=['A', 'B', 'C'])

        nan_df = DataFrame({'A': np.repeat(np.array([np.nan, 1, 2, 3, 4, 5]),
                                           np.array([3, 10, 9, 8, 7, 6])),
                            'B': np.repeat(np.array([1, np.nan, 2, 3, 4, 5]),
                                           np.array([8, 3, 8, 8, 8, 8])),
                            'C': np.repeat(np.array([1, 2, 3, np.nan, 4, 5]),
                                           np.array([6, 7, 8, 3, 9, 10]))},
                           columns=['A', 'B', 'C'])

        for df in [normal_df, nan_df]:
            ax = df.plot.hist(bins=5)
            self._check_box_coord(ax.patches[:5],
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([10, 9, 8, 7, 6]))
            self._check_box_coord(ax.patches[5:10],
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([8, 8, 8, 8, 8]))
            self._check_box_coord(ax.patches[10:],
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([6, 7, 8, 9, 10]))

            ax = df.plot.hist(bins=5, stacked=True)
            self._check_box_coord(ax.patches[:5],
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([10, 9, 8, 7, 6]))
            self._check_box_coord(ax.patches[5:10],
                                  expected_y=np.array([10, 9, 8, 7, 6]),
                                  expected_h=np.array([8, 8, 8, 8, 8]))
            self._check_box_coord(ax.patches[10:],
                                  expected_y=np.array([18, 17, 16, 15, 14]),
                                  expected_h=np.array([6, 7, 8, 9, 10]))

            axes = df.plot.hist(bins=5, stacked=True, subplots=True)
            self._check_box_coord(axes[0].patches,
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([10, 9, 8, 7, 6]))
            self._check_box_coord(axes[1].patches,
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([8, 8, 8, 8, 8]))
            self._check_box_coord(axes[2].patches,
                                  expected_y=np.array([0, 0, 0, 0, 0]),
                                  expected_h=np.array([6, 7, 8, 9, 10]))

            if self.mpl_ge_1_3_1:

                # horizontal
                ax = df.plot.hist(bins=5, orientation='horizontal')
                self._check_box_coord(ax.patches[:5],
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([10, 9, 8, 7, 6]))
                self._check_box_coord(ax.patches[5:10],
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([8, 8, 8, 8, 8]))
                self._check_box_coord(ax.patches[10:],
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([6, 7, 8, 9, 10]))

                ax = df.plot.hist(bins=5, stacked=True,
                                  orientation='horizontal')
                self._check_box_coord(ax.patches[:5],
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([10, 9, 8, 7, 6]))
                self._check_box_coord(ax.patches[5:10],
                                      expected_x=np.array([10, 9, 8, 7, 6]),
                                      expected_w=np.array([8, 8, 8, 8, 8]))
                self._check_box_coord(
                    ax.patches[10:],
                    expected_x=np.array([18, 17, 16, 15, 14]),
                    expected_w=np.array([6, 7, 8, 9, 10]))

                axes = df.plot.hist(bins=5, stacked=True, subplots=True,
                                    orientation='horizontal')
                self._check_box_coord(axes[0].patches,
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([10, 9, 8, 7, 6]))
                self._check_box_coord(axes[1].patches,
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([8, 8, 8, 8, 8]))
                self._check_box_coord(axes[2].patches,
                                      expected_x=np.array([0, 0, 0, 0, 0]),
                                      expected_w=np.array([6, 7, 8, 9, 10]))

    @slow
    def test_plot_int_columns(self):
        df = DataFrame(randn(100, 4)).cumsum()
        _check_plot_works(df.plot, legend=True)

    @slow
    def test_df_legend_labels(self):
        kinds = ['line', 'bar', 'barh', 'kde', 'area', 'hist']
        df = DataFrame(rand(3, 3), columns=['a', 'b', 'c'])
        df2 = DataFrame(rand(3, 3), columns=['d', 'e', 'f'])
        df3 = DataFrame(rand(3, 3), columns=['g', 'h', 'i'])
        df4 = DataFrame(rand(3, 3), columns=['j', 'k', 'l'])

        for kind in kinds:
            if not _ok_for_gaussian_kde(kind):
                continue

            ax = df.plot(kind=kind, legend=True)
            self._check_legend_labels(ax, labels=df.columns)

            ax = df2.plot(kind=kind, legend=False, ax=ax)
            self._check_legend_labels(ax, labels=df.columns)

            ax = df3.plot(kind=kind, legend=True, ax=ax)
            self._check_legend_labels(ax, labels=df.columns.union(df3.columns))

            ax = df4.plot(kind=kind, legend='reverse', ax=ax)
            expected = list(df.columns.union(df3.columns)) + list(reversed(
                df4.columns))
            self._check_legend_labels(ax, labels=expected)

        # Secondary Y
        ax = df.plot(legend=True, secondary_y='b')
        self._check_legend_labels(ax, labels=['a', 'b (right)', 'c'])
        ax = df2.plot(legend=False, ax=ax)
        self._check_legend_labels(ax, labels=['a', 'b (right)', 'c'])
        ax = df3.plot(kind='bar', legend=True, secondary_y='h', ax=ax)
        self._check_legend_labels(
            ax, labels=['a', 'b (right)', 'c', 'g', 'h (right)', 'i'])

        # Time Series
        ind = date_range('1/1/2014', periods=3)
        df = DataFrame(randn(3, 3), columns=['a', 'b', 'c'], index=ind)
        df2 = DataFrame(randn(3, 3), columns=['d', 'e', 'f'], index=ind)
        df3 = DataFrame(randn(3, 3), columns=['g', 'h', 'i'], index=ind)
        ax = df.plot(legend=True, secondary_y='b')
        self._check_legend_labels(ax, labels=['a', 'b (right)', 'c'])
        ax = df2.plot(legend=False, ax=ax)
        self._check_legend_labels(ax, labels=['a', 'b (right)', 'c'])
        ax = df3.plot(legend=True, ax=ax)
        self._check_legend_labels(
            ax, labels=['a', 'b (right)', 'c', 'g', 'h', 'i'])

        # scatter
        ax = df.plot.scatter(x='a', y='b', label='data1')
        self._check_legend_labels(ax, labels=['data1'])
        ax = df2.plot.scatter(x='d', y='e', legend=False, label='data2', ax=ax)
        self._check_legend_labels(ax, labels=['data1'])
        ax = df3.plot.scatter(x='g', y='h', label='data3', ax=ax)
        self._check_legend_labels(ax, labels=['data1', 'data3'])

        # ensure label args pass through and
        # index name does not mutate
        # column names don't mutate
        df5 = df.set_index('a')
        ax = df5.plot(y='b')
        self._check_legend_labels(ax, labels=['b'])
        ax = df5.plot(y='b', label='LABEL_b')
        self._check_legend_labels(ax, labels=['LABEL_b'])
        self._check_text_labels(ax.xaxis.get_label(), 'a')
        ax = df5.plot(y='c', label='LABEL_c', ax=ax)
        self._check_legend_labels(ax, labels=['LABEL_b', 'LABEL_c'])
        assert df5.columns.tolist() == ['b', 'c']

    def test_legend_name(self):
        multi = DataFrame(randn(4, 4),
                          columns=[np.array(['a', 'a', 'b', 'b']),
                                   np.array(['x', 'y', 'x', 'y'])])
        multi.columns.names = ['group', 'individual']

        ax = multi.plot()
        leg_title = ax.legend_.get_title()
        self._check_text_labels(leg_title, 'group,individual')

        df = DataFrame(randn(5, 5))
        ax = df.plot(legend=True, ax=ax)
        leg_title = ax.legend_.get_title()
        self._check_text_labels(leg_title, 'group,individual')

        df.columns.name = 'new'
        ax = df.plot(legend=False, ax=ax)
        leg_title = ax.legend_.get_title()
        self._check_text_labels(leg_title, 'group,individual')

        ax = df.plot(legend=True, ax=ax)
        leg_title = ax.legend_.get_title()
        self._check_text_labels(leg_title, 'new')

    @slow
    def test_no_legend(self):
        kinds = ['line', 'bar', 'barh', 'kde', 'area', 'hist']
        df = DataFrame(rand(3, 3), columns=['a', 'b', 'c'])

        for kind in kinds:
            if not _ok_for_gaussian_kde(kind):
                continue

            ax = df.plot(kind=kind, legend=False)
            self._check_legend_labels(ax, visible=False)

    @slow
    def test_style_by_column(self):
        import matplotlib.pyplot as plt
        fig = plt.gcf()

        df = DataFrame(randn(100, 3))
        for markers in [{0: '^',
                         1: '+',
                         2: 'o'}, {0: '^',
                                   1: '+'}, ['^', '+', 'o'], ['^', '+']]:
            fig.clf()
            fig.add_subplot(111)
            ax = df.plot(style=markers)
            for i, l in enumerate(ax.get_lines()[:len(markers)]):
                assert l.get_marker() == markers[i]

    @slow
    def test_line_label_none(self):
        s = Series([1, 2])
        ax = s.plot()
        assert ax.get_legend() is None

        ax = s.plot(legend=True)
        assert ax.get_legend().get_texts()[0].get_text() == 'None'

    @slow
    @tm.capture_stdout
    def test_line_colors(self):
        from matplotlib import cm

        custom_colors = 'rgcby'
        df = DataFrame(randn(5, 5))

        ax = df.plot(color=custom_colors)
        self._check_colors(ax.get_lines(), linecolors=custom_colors)

        tm.close()

        ax2 = df.plot(colors=custom_colors)
        lines2 = ax2.get_lines()

        for l1, l2 in zip(ax.get_lines(), lines2):
            assert l1.get_color() == l2.get_color()

        tm.close()

        ax = df.plot(colormap='jet')
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        self._check_colors(ax.get_lines(), linecolors=rgba_colors)
        tm.close()

        ax = df.plot(colormap=cm.jet)
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        self._check_colors(ax.get_lines(), linecolors=rgba_colors)
        tm.close()

        # make color a list if plotting one column frame
        # handles cases like df.plot(color='DodgerBlue')
        ax = df.loc[:, [0]].plot(color='DodgerBlue')
        self._check_colors(ax.lines, linecolors=['DodgerBlue'])

        ax = df.plot(color='red')
        self._check_colors(ax.get_lines(), linecolors=['red'] * 5)
        tm.close()

        # GH 10299
        custom_colors = ['#FF0000', '#0000FF', '#FFFF00', '#000000', '#FFFFFF']
        ax = df.plot(color=custom_colors)
        self._check_colors(ax.get_lines(), linecolors=custom_colors)
        tm.close()

        with pytest.raises(ValueError):
            # Color contains shorthand hex value results in ValueError
            custom_colors = ['#F00', '#00F', '#FF0', '#000', '#FFF']
            # Forced show plot
            _check_plot_works(df.plot, color=custom_colors)

    @slow
    def test_dont_modify_colors(self):
        colors = ['r', 'g', 'b']
        pd.DataFrame(np.random.rand(10, 2)).plot(color=colors)
        assert len(colors) == 3

    @slow
    def test_line_colors_and_styles_subplots(self):
        # GH 9894
        from matplotlib import cm
        default_colors = self._maybe_unpack_cycler(self.plt.rcParams)

        df = DataFrame(randn(5, 5))

        axes = df.plot(subplots=True)
        for ax, c in zip(axes, list(default_colors)):
            if self.mpl_ge_2_0_0:
                c = [c]
            self._check_colors(ax.get_lines(), linecolors=c)
        tm.close()

        # single color char
        axes = df.plot(subplots=True, color='k')
        for ax in axes:
            self._check_colors(ax.get_lines(), linecolors=['k'])
        tm.close()

        # single color str
        axes = df.plot(subplots=True, color='green')
        for ax in axes:
            self._check_colors(ax.get_lines(), linecolors=['green'])
        tm.close()

        custom_colors = 'rgcby'
        axes = df.plot(color=custom_colors, subplots=True)
        for ax, c in zip(axes, list(custom_colors)):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

        axes = df.plot(color=list(custom_colors), subplots=True)
        for ax, c in zip(axes, list(custom_colors)):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

        # GH 10299
        custom_colors = ['#FF0000', '#0000FF', '#FFFF00', '#000000', '#FFFFFF']
        axes = df.plot(color=custom_colors, subplots=True)
        for ax, c in zip(axes, list(custom_colors)):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

        with pytest.raises(ValueError):
            # Color contains shorthand hex value results in ValueError
            custom_colors = ['#F00', '#00F', '#FF0', '#000', '#FFF']
            # Forced show plot
            # _check_plot_works adds an ax so catch warning. see GH #13188
            with tm.assert_produces_warning(UserWarning):
                _check_plot_works(df.plot, color=custom_colors, subplots=True)

        rgba_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        for cmap in ['jet', cm.jet]:
            axes = df.plot(colormap=cmap, subplots=True)
            for ax, c in zip(axes, rgba_colors):
                self._check_colors(ax.get_lines(), linecolors=[c])
            tm.close()

        # make color a list if plotting one column frame
        # handles cases like df.plot(color='DodgerBlue')
        axes = df.loc[:, [0]].plot(color='DodgerBlue', subplots=True)
        self._check_colors(axes[0].lines, linecolors=['DodgerBlue'])

        # single character style
        axes = df.plot(style='r', subplots=True)
        for ax in axes:
            self._check_colors(ax.get_lines(), linecolors=['r'])
        tm.close()

        # list of styles
        styles = list('rgcby')
        axes = df.plot(style=styles, subplots=True)
        for ax, c in zip(axes, styles):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

    @slow
    def test_area_colors(self):
        from matplotlib import cm
        from matplotlib.collections import PolyCollection

        custom_colors = 'rgcby'
        df = DataFrame(rand(5, 5))

        ax = df.plot.area(color=custom_colors)
        self._check_colors(ax.get_lines(), linecolors=custom_colors)
        poly = [o for o in ax.get_children() if isinstance(o, PolyCollection)]
        self._check_colors(poly, facecolors=custom_colors)

        handles, labels = ax.get_legend_handles_labels()
        if self.mpl_ge_1_5_0:
            self._check_colors(handles, facecolors=custom_colors)
        else:
            # legend is stored as Line2D, thus check linecolors
            linehandles = [x for x in handles
                           if not isinstance(x, PolyCollection)]
            self._check_colors(linehandles, linecolors=custom_colors)

        for h in handles:
            assert h.get_alpha() is None
        tm.close()

        ax = df.plot.area(colormap='jet')
        jet_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        self._check_colors(ax.get_lines(), linecolors=jet_colors)
        poly = [o for o in ax.get_children() if isinstance(o, PolyCollection)]
        self._check_colors(poly, facecolors=jet_colors)

        handles, labels = ax.get_legend_handles_labels()
        if self.mpl_ge_1_5_0:
            self._check_colors(handles, facecolors=jet_colors)
        else:
            linehandles = [x for x in handles
                           if not isinstance(x, PolyCollection)]
            self._check_colors(linehandles, linecolors=jet_colors)
        for h in handles:
            assert h.get_alpha() is None
        tm.close()

        # When stacked=False, alpha is set to 0.5
        ax = df.plot.area(colormap=cm.jet, stacked=False)
        self._check_colors(ax.get_lines(), linecolors=jet_colors)
        poly = [o for o in ax.get_children() if isinstance(o, PolyCollection)]
        jet_with_alpha = [(c[0], c[1], c[2], 0.5) for c in jet_colors]
        self._check_colors(poly, facecolors=jet_with_alpha)

        handles, labels = ax.get_legend_handles_labels()
        if self.mpl_ge_1_5_0:
            linecolors = jet_with_alpha
        else:
            # Line2D can't have alpha in its linecolor
            linecolors = jet_colors
        self._check_colors(handles[:len(jet_colors)], linecolors=linecolors)
        for h in handles:
            assert h.get_alpha() == 0.5

    @slow
    def test_hist_colors(self):
        default_colors = self._maybe_unpack_cycler(self.plt.rcParams)

        df = DataFrame(randn(5, 5))
        ax = df.plot.hist()
        self._check_colors(ax.patches[::10], facecolors=default_colors[:5])
        tm.close()

        custom_colors = 'rgcby'
        ax = df.plot.hist(color=custom_colors)
        self._check_colors(ax.patches[::10], facecolors=custom_colors)
        tm.close()

        from matplotlib import cm
        # Test str -> colormap functionality
        ax = df.plot.hist(colormap='jet')
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, 5))
        self._check_colors(ax.patches[::10], facecolors=rgba_colors)
        tm.close()

        # Test colormap functionality
        ax = df.plot.hist(colormap=cm.jet)
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, 5))
        self._check_colors(ax.patches[::10], facecolors=rgba_colors)
        tm.close()

        ax = df.loc[:, [0]].plot.hist(color='DodgerBlue')
        self._check_colors([ax.patches[0]], facecolors=['DodgerBlue'])

        ax = df.plot(kind='hist', color='green')
        self._check_colors(ax.patches[::10], facecolors=['green'] * 5)
        tm.close()

    @slow
    def test_kde_colors(self):
        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()

        from matplotlib import cm

        custom_colors = 'rgcby'
        df = DataFrame(rand(5, 5))

        ax = df.plot.kde(color=custom_colors)
        self._check_colors(ax.get_lines(), linecolors=custom_colors)
        tm.close()

        ax = df.plot.kde(colormap='jet')
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        self._check_colors(ax.get_lines(), linecolors=rgba_colors)
        tm.close()

        ax = df.plot.kde(colormap=cm.jet)
        rgba_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        self._check_colors(ax.get_lines(), linecolors=rgba_colors)

    @slow
    def test_kde_colors_and_styles_subplots(self):
        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()

        from matplotlib import cm
        default_colors = self._maybe_unpack_cycler(self.plt.rcParams)

        df = DataFrame(randn(5, 5))

        axes = df.plot(kind='kde', subplots=True)
        for ax, c in zip(axes, list(default_colors)):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

        # single color char
        axes = df.plot(kind='kde', color='k', subplots=True)
        for ax in axes:
            self._check_colors(ax.get_lines(), linecolors=['k'])
        tm.close()

        # single color str
        axes = df.plot(kind='kde', color='red', subplots=True)
        for ax in axes:
            self._check_colors(ax.get_lines(), linecolors=['red'])
        tm.close()

        custom_colors = 'rgcby'
        axes = df.plot(kind='kde', color=custom_colors, subplots=True)
        for ax, c in zip(axes, list(custom_colors)):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

        rgba_colors = lmap(cm.jet, np.linspace(0, 1, len(df)))
        for cmap in ['jet', cm.jet]:
            axes = df.plot(kind='kde', colormap=cmap, subplots=True)
            for ax, c in zip(axes, rgba_colors):
                self._check_colors(ax.get_lines(), linecolors=[c])
            tm.close()

        # make color a list if plotting one column frame
        # handles cases like df.plot(color='DodgerBlue')
        axes = df.loc[:, [0]].plot(kind='kde', color='DodgerBlue',
                                   subplots=True)
        self._check_colors(axes[0].lines, linecolors=['DodgerBlue'])

        # single character style
        axes = df.plot(kind='kde', style='r', subplots=True)
        for ax in axes:
            self._check_colors(ax.get_lines(), linecolors=['r'])
        tm.close()

        # list of styles
        styles = list('rgcby')
        axes = df.plot(kind='kde', style=styles, subplots=True)
        for ax, c in zip(axes, styles):
            self._check_colors(ax.get_lines(), linecolors=[c])
        tm.close()

    @slow
    def test_boxplot_colors(self):
        def _check_colors(bp, box_c, whiskers_c, medians_c, caps_c='k',
                          fliers_c=None):
            # TODO: outside this func?
            if fliers_c is None:
                fliers_c = 'k' if self.mpl_ge_2_0_0 else 'b'
            self._check_colors(bp['boxes'],
                               linecolors=[box_c] * len(bp['boxes']))
            self._check_colors(bp['whiskers'],
                               linecolors=[whiskers_c] * len(bp['whiskers']))
            self._check_colors(bp['medians'],
                               linecolors=[medians_c] * len(bp['medians']))
            self._check_colors(bp['fliers'],
                               linecolors=[fliers_c] * len(bp['fliers']))
            self._check_colors(bp['caps'],
                               linecolors=[caps_c] * len(bp['caps']))

        default_colors = self._maybe_unpack_cycler(self.plt.rcParams)

        df = DataFrame(randn(5, 5))
        bp = df.plot.box(return_type='dict')
        _check_colors(bp, default_colors[0], default_colors[0],
                      default_colors[2])
        tm.close()

        dict_colors = dict(boxes='#572923', whiskers='#982042',
                           medians='#804823', caps='#123456')
        bp = df.plot.box(color=dict_colors, sym='r+', return_type='dict')
        _check_colors(bp, dict_colors['boxes'], dict_colors['whiskers'],
                      dict_colors['medians'], dict_colors['caps'], 'r')
        tm.close()

        # partial colors
        dict_colors = dict(whiskers='c', medians='m')
        bp = df.plot.box(color=dict_colors, return_type='dict')
        _check_colors(bp, default_colors[0], 'c', 'm')
        tm.close()

        from matplotlib import cm
        # Test str -> colormap functionality
        bp = df.plot.box(colormap='jet', return_type='dict')
        jet_colors = lmap(cm.jet, np.linspace(0, 1, 3))
        _check_colors(bp, jet_colors[0], jet_colors[0], jet_colors[2])
        tm.close()

        # Test colormap functionality
        bp = df.plot.box(colormap=cm.jet, return_type='dict')
        _check_colors(bp, jet_colors[0], jet_colors[0], jet_colors[2])
        tm.close()

        # string color is applied to all artists except fliers
        bp = df.plot.box(color='DodgerBlue', return_type='dict')
        _check_colors(bp, 'DodgerBlue', 'DodgerBlue', 'DodgerBlue',
                      'DodgerBlue')

        # tuple is also applied to all artists except fliers
        bp = df.plot.box(color=(0, 1, 0), sym='#123456', return_type='dict')
        _check_colors(bp, (0, 1, 0), (0, 1, 0), (0, 1, 0),
                      (0, 1, 0), '#123456')

        with pytest.raises(ValueError):
            # Color contains invalid key results in ValueError
            df.plot.box(color=dict(boxes='red', xxxx='blue'))

    def test_default_color_cycle(self):
        import matplotlib.pyplot as plt
        colors = list('rgbk')
        if self.mpl_ge_1_5_0:
            import cycler
            plt.rcParams['axes.prop_cycle'] = cycler.cycler('color', colors)
        else:
            plt.rcParams['axes.color_cycle'] = colors

        df = DataFrame(randn(5, 3))
        ax = df.plot()

        expected = self._maybe_unpack_cycler(plt.rcParams)[:3]
        self._check_colors(ax.get_lines(), linecolors=expected)

    def test_unordered_ts(self):
        df = DataFrame(np.array([3.0, 2.0, 1.0]),
                       index=[date(2012, 10, 1),
                              date(2012, 9, 1),
                              date(2012, 8, 1)],
                       columns=['test'])
        ax = df.plot()
        xticks = ax.lines[0].get_xdata()
        assert xticks[0] < xticks[1]
        ydata = ax.lines[0].get_ydata()
        tm.assert_numpy_array_equal(ydata, np.array([1.0, 2.0, 3.0]))

    def test_kind_both_ways(self):
        df = DataFrame({'x': [1, 2, 3]})
        for kind in plotting._core._common_kinds:
            if not _ok_for_gaussian_kde(kind):
                continue
            df.plot(kind=kind)
            getattr(df.plot, kind)()
        for kind in ['scatter', 'hexbin']:
            df.plot('x', 'x', kind=kind)
            getattr(df.plot, kind)('x', 'x')

    def test_all_invalid_plot_data(self):
        df = DataFrame(list('abcd'))
        for kind in plotting._core._common_kinds:
            if not _ok_for_gaussian_kde(kind):
                continue
            with pytest.raises(TypeError):
                df.plot(kind=kind)

    @slow
    def test_partially_invalid_plot_data(self):
        with tm.RNGContext(42):
            df = DataFrame(randn(10, 2), dtype=object)
            df[np.random.rand(df.shape[0]) > 0.5] = 'a'
            for kind in plotting._core._common_kinds:
                if not _ok_for_gaussian_kde(kind):
                    continue
                with pytest.raises(TypeError):
                    df.plot(kind=kind)

        with tm.RNGContext(42):
            # area plot doesn't support positive/negative mixed data
            kinds = ['area']
            df = DataFrame(rand(10, 2), dtype=object)
            df[np.random.rand(df.shape[0]) > 0.5] = 'a'
            for kind in kinds:
                with pytest.raises(TypeError):
                    df.plot(kind=kind)

    def test_invalid_kind(self):
        df = DataFrame(randn(10, 2))
        with pytest.raises(ValueError):
            df.plot(kind='aasdf')

    @slow
    def test_hexbin_basic(self):
        df = self.hexbin_df

        ax = df.plot.hexbin(x='A', y='B', gridsize=10)
        # TODO: need better way to test. This just does existence.
        assert len(ax.collections) == 1

        # GH 6951
        axes = df.plot.hexbin(x='A', y='B', subplots=True)
        # hexbin should have 2 axes in the figure, 1 for plotting and another
        # is colorbar
        assert len(axes[0].figure.axes) == 2
        # return value is single axes
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))

    @slow
    def test_hexbin_with_c(self):
        df = self.hexbin_df

        ax = df.plot.hexbin(x='A', y='B', C='C')
        assert len(ax.collections) == 1

        ax = df.plot.hexbin(x='A', y='B', C='C', reduce_C_function=np.std)
        assert len(ax.collections) == 1

    @slow
    def test_hexbin_cmap(self):
        df = self.hexbin_df

        # Default to BuGn
        ax = df.plot.hexbin(x='A', y='B')
        assert ax.collections[0].cmap.name == 'BuGn'

        cm = 'cubehelix'
        ax = df.plot.hexbin(x='A', y='B', colormap=cm)
        assert ax.collections[0].cmap.name == cm

    @slow
    def test_no_color_bar(self):
        df = self.hexbin_df

        ax = df.plot.hexbin(x='A', y='B', colorbar=None)
        assert ax.collections[0].colorbar is None

    @slow
    def test_allow_cmap(self):
        df = self.hexbin_df

        ax = df.plot.hexbin(x='A', y='B', cmap='YlGn')
        assert ax.collections[0].cmap.name == 'YlGn'

        with pytest.raises(TypeError):
            df.plot.hexbin(x='A', y='B', cmap='YlGn', colormap='BuGn')

    @slow
    def test_pie_df(self):
        df = DataFrame(np.random.rand(5, 3), columns=['X', 'Y', 'Z'],
                       index=['a', 'b', 'c', 'd', 'e'])
        with pytest.raises(ValueError):
            df.plot.pie()

        ax = _check_plot_works(df.plot.pie, y='Y')
        self._check_text_labels(ax.texts, df.index)

        ax = _check_plot_works(df.plot.pie, y=2)
        self._check_text_labels(ax.texts, df.index)

        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot.pie,
                                     subplots=True)
        assert len(axes) == len(df.columns)
        for ax in axes:
            self._check_text_labels(ax.texts, df.index)
        for ax, ylabel in zip(axes, df.columns):
            assert ax.get_ylabel() == ylabel

        labels = ['A', 'B', 'C', 'D', 'E']
        color_args = ['r', 'g', 'b', 'c', 'm']
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.plot.pie,
                                     subplots=True, labels=labels,
                                     colors=color_args)
        assert len(axes) == len(df.columns)

        for ax in axes:
            self._check_text_labels(ax.texts, labels)
            self._check_colors(ax.patches, facecolors=color_args)

    def test_pie_df_nan(self):
        df = DataFrame(np.random.rand(4, 4))
        for i in range(4):
            df.iloc[i, i] = np.nan
        fig, axes = self.plt.subplots(ncols=4)
        df.plot.pie(subplots=True, ax=axes, legend=True)

        base_expected = ['0', '1', '2', '3']
        for i, ax in enumerate(axes):
            expected = list(base_expected)  # force copy
            expected[i] = ''
            result = [x.get_text() for x in ax.texts]
            assert result == expected
            # legend labels
            # NaN's not included in legend with subplots
            # see https://github.com/pandas-dev/pandas/issues/8390
            assert ([x.get_text() for x in ax.get_legend().get_texts()] ==
                    base_expected[:i] + base_expected[i + 1:])

    @slow
    def test_errorbar_plot(self):
        d = {'x': np.arange(12), 'y': np.arange(12, 0, -1)}
        df = DataFrame(d)
        d_err = {'x': np.ones(12) * 0.2, 'y': np.ones(12) * 0.4}
        df_err = DataFrame(d_err)

        # check line plots
        ax = _check_plot_works(df.plot, yerr=df_err, logy=True)
        self._check_has_errorbars(ax, xerr=0, yerr=2)
        ax = _check_plot_works(df.plot, yerr=df_err, logx=True, logy=True)
        self._check_has_errorbars(ax, xerr=0, yerr=2)
        ax = _check_plot_works(df.plot, yerr=df_err, loglog=True)
        self._check_has_errorbars(ax, xerr=0, yerr=2)

        kinds = ['line', 'bar', 'barh']
        for kind in kinds:
            ax = _check_plot_works(df.plot, yerr=df_err['x'], kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=2)
            ax = _check_plot_works(df.plot, yerr=d_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=2)
            ax = _check_plot_works(df.plot, yerr=df_err, xerr=df_err,
                                   kind=kind)
            self._check_has_errorbars(ax, xerr=2, yerr=2)
            ax = _check_plot_works(df.plot, yerr=df_err['x'], xerr=df_err['x'],
                                   kind=kind)
            self._check_has_errorbars(ax, xerr=2, yerr=2)
            ax = _check_plot_works(df.plot, xerr=0.2, yerr=0.2, kind=kind)
            self._check_has_errorbars(ax, xerr=2, yerr=2)
            # _check_plot_works adds an ax so catch warning. see GH #13188
            with tm.assert_produces_warning(UserWarning):
                axes = _check_plot_works(df.plot,
                                         yerr=df_err, xerr=df_err,
                                         subplots=True,
                                         kind=kind)
            self._check_has_errorbars(axes, xerr=1, yerr=1)

        ax = _check_plot_works((df + 1).plot, yerr=df_err,
                               xerr=df_err, kind='bar', log=True)
        self._check_has_errorbars(ax, xerr=2, yerr=2)

        # yerr is raw error values
        ax = _check_plot_works(df['y'].plot, yerr=np.ones(12) * 0.4)
        self._check_has_errorbars(ax, xerr=0, yerr=1)
        ax = _check_plot_works(df.plot, yerr=np.ones((2, 12)) * 0.4)
        self._check_has_errorbars(ax, xerr=0, yerr=2)

        # yerr is iterator
        import itertools
        ax = _check_plot_works(df.plot, yerr=itertools.repeat(0.1, len(df)))
        self._check_has_errorbars(ax, xerr=0, yerr=2)

        # yerr is column name
        for yerr in ['yerr', u('誤差')]:
            s_df = df.copy()
            s_df[yerr] = np.ones(12) * 0.2
            ax = _check_plot_works(s_df.plot, yerr=yerr)
            self._check_has_errorbars(ax, xerr=0, yerr=2)
            ax = _check_plot_works(s_df.plot, y='y', x='x', yerr=yerr)
            self._check_has_errorbars(ax, xerr=0, yerr=1)

        with pytest.raises(ValueError):
            df.plot(yerr=np.random.randn(11))

        df_err = DataFrame({'x': ['zzz'] * 12, 'y': ['zzz'] * 12})
        with pytest.raises((ValueError, TypeError)):
            df.plot(yerr=df_err)

    @slow
    def test_errorbar_with_integer_column_names(self):
        # test with integer column names
        df = DataFrame(np.random.randn(10, 2))
        df_err = DataFrame(np.random.randn(10, 2))
        ax = _check_plot_works(df.plot, yerr=df_err)
        self._check_has_errorbars(ax, xerr=0, yerr=2)
        ax = _check_plot_works(df.plot, y=0, yerr=1)
        self._check_has_errorbars(ax, xerr=0, yerr=1)

    @slow
    def test_errorbar_with_partial_columns(self):
        df = DataFrame(np.random.randn(10, 3))
        df_err = DataFrame(np.random.randn(10, 2), columns=[0, 2])
        kinds = ['line', 'bar']
        for kind in kinds:
            ax = _check_plot_works(df.plot, yerr=df_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=2)

        ix = date_range('1/1/2000', periods=10, freq='M')
        df.set_index(ix, inplace=True)
        df_err.set_index(ix, inplace=True)
        ax = _check_plot_works(df.plot, yerr=df_err, kind='line')
        self._check_has_errorbars(ax, xerr=0, yerr=2)

        d = {'x': np.arange(12), 'y': np.arange(12, 0, -1)}
        df = DataFrame(d)
        d_err = {'x': np.ones(12) * 0.2, 'z': np.ones(12) * 0.4}
        df_err = DataFrame(d_err)
        for err in [d_err, df_err]:
            ax = _check_plot_works(df.plot, yerr=err)
            self._check_has_errorbars(ax, xerr=0, yerr=1)

    @slow
    def test_errorbar_timeseries(self):

        d = {'x': np.arange(12), 'y': np.arange(12, 0, -1)}
        d_err = {'x': np.ones(12) * 0.2, 'y': np.ones(12) * 0.4}

        # check time-series plots
        ix = date_range('1/1/2000', '1/1/2001', freq='M')
        tdf = DataFrame(d, index=ix)
        tdf_err = DataFrame(d_err, index=ix)

        kinds = ['line', 'bar', 'barh']
        for kind in kinds:
            ax = _check_plot_works(tdf.plot, yerr=tdf_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=2)
            ax = _check_plot_works(tdf.plot, yerr=d_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=2)
            ax = _check_plot_works(tdf.plot, y='y', yerr=tdf_err['x'],
                                   kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=1)
            ax = _check_plot_works(tdf.plot, y='y', yerr='x', kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=1)
            ax = _check_plot_works(tdf.plot, yerr=tdf_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=2)
            # _check_plot_works adds an ax so catch warning. see GH #13188
            with tm.assert_produces_warning(UserWarning):
                axes = _check_plot_works(tdf.plot,
                                         kind=kind, yerr=tdf_err,
                                         subplots=True)
            self._check_has_errorbars(axes, xerr=0, yerr=1)

    def test_errorbar_asymmetrical(self):

        np.random.seed(0)
        err = np.random.rand(3, 2, 5)

        # each column is [0, 1, 2, 3, 4], [3, 4, 5, 6, 7]...
        df = DataFrame(np.arange(15).reshape(3, 5)).T
        data = df.values

        ax = df.plot(yerr=err, xerr=err / 2)

        if self.mpl_ge_2_0_0:
            yerr_0_0 = ax.collections[1].get_paths()[0].vertices[:, 1]
            expected_0_0 = err[0, :, 0] * np.array([-1, 1])
            tm.assert_almost_equal(yerr_0_0, expected_0_0)
        else:
            assert ax.lines[7].get_ydata()[0] == data[0, 1] - err[1, 0, 0]
            assert ax.lines[8].get_ydata()[0] == data[0, 1] + err[1, 1, 0]
            assert ax.lines[5].get_xdata()[0] == -err[1, 0, 0] / 2
            assert ax.lines[6].get_xdata()[0] == err[1, 1, 0] / 2

        with pytest.raises(ValueError):
            df.plot(yerr=err.T)

        tm.close()

    def test_table(self):
        df = DataFrame(np.random.rand(10, 3),
                       index=list(string.ascii_letters[:10]))
        _check_plot_works(df.plot, table=True)
        _check_plot_works(df.plot, table=df)

        ax = df.plot()
        assert len(ax.tables) == 0
        plotting.table(ax, df.T)
        assert len(ax.tables) == 1

    def test_errorbar_scatter(self):
        df = DataFrame(
            np.random.randn(5, 2), index=range(5), columns=['x', 'y'])
        df_err = DataFrame(np.random.randn(5, 2) / 5,
                           index=range(5), columns=['x', 'y'])

        ax = _check_plot_works(df.plot.scatter, x='x', y='y')
        self._check_has_errorbars(ax, xerr=0, yerr=0)
        ax = _check_plot_works(df.plot.scatter, x='x', y='y', xerr=df_err)
        self._check_has_errorbars(ax, xerr=1, yerr=0)

        ax = _check_plot_works(df.plot.scatter, x='x', y='y', yerr=df_err)
        self._check_has_errorbars(ax, xerr=0, yerr=1)
        ax = _check_plot_works(df.plot.scatter, x='x', y='y', xerr=df_err,
                               yerr=df_err)
        self._check_has_errorbars(ax, xerr=1, yerr=1)

        def _check_errorbar_color(containers, expected, has_err='has_xerr'):
            lines = []
            errs = [c.lines
                    for c in ax.containers if getattr(c, has_err, False)][0]
            for el in errs:
                if is_list_like(el):
                    lines.extend(el)
                else:
                    lines.append(el)
            err_lines = [x for x in lines if x in ax.collections]
            self._check_colors(
                err_lines, linecolors=np.array([expected] * len(err_lines)))

        # GH 8081
        df = DataFrame(
            np.random.randn(10, 5), columns=['a', 'b', 'c', 'd', 'e'])
        ax = df.plot.scatter(x='a', y='b', xerr='d', yerr='e', c='red')
        self._check_has_errorbars(ax, xerr=1, yerr=1)
        _check_errorbar_color(ax.containers, 'red', has_err='has_xerr')
        _check_errorbar_color(ax.containers, 'red', has_err='has_yerr')

        ax = df.plot.scatter(x='a', y='b', yerr='e', color='green')
        self._check_has_errorbars(ax, xerr=0, yerr=1)
        _check_errorbar_color(ax.containers, 'green', has_err='has_yerr')

    @slow
    def test_sharex_and_ax(self):
        # https://github.com/pandas-dev/pandas/issues/9737 using gridspec,
        # the axis in fig.get_axis() are sorted differently than pandas
        # expected them, so make sure that only the right ones are removed
        import matplotlib.pyplot as plt
        plt.close('all')
        gs, axes = _generate_4_axes_via_gridspec()

        df = DataFrame({"a": [1, 2, 3, 4, 5, 6],
                        "b": [1, 2, 3, 4, 5, 6],
                        "c": [1, 2, 3, 4, 5, 6],
                        "d": [1, 2, 3, 4, 5, 6]})

        def _check(axes):
            for ax in axes:
                assert len(ax.lines) == 1
                self._check_visible(ax.get_yticklabels(), visible=True)
            for ax in [axes[0], axes[2]]:
                self._check_visible(ax.get_xticklabels(), visible=False)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=False)
            for ax in [axes[1], axes[3]]:
                self._check_visible(ax.get_xticklabels(), visible=True)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=True)

        for ax in axes:
            df.plot(x="a", y="b", title="title", ax=ax, sharex=True)
        gs.tight_layout(plt.gcf())
        _check(axes)
        tm.close()

        gs, axes = _generate_4_axes_via_gridspec()
        with tm.assert_produces_warning(UserWarning):
            axes = df.plot(subplots=True, ax=axes, sharex=True)
        _check(axes)
        tm.close()

        gs, axes = _generate_4_axes_via_gridspec()
        # without sharex, no labels should be touched!
        for ax in axes:
            df.plot(x="a", y="b", title="title", ax=ax)

        gs.tight_layout(plt.gcf())
        for ax in axes:
            assert len(ax.lines) == 1
            self._check_visible(ax.get_yticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(minor=True), visible=True)
        tm.close()

    @slow
    def test_sharey_and_ax(self):
        # https://github.com/pandas-dev/pandas/issues/9737 using gridspec,
        # the axis in fig.get_axis() are sorted differently than pandas
        # expected them, so make sure that only the right ones are removed
        import matplotlib.pyplot as plt

        gs, axes = _generate_4_axes_via_gridspec()

        df = DataFrame({"a": [1, 2, 3, 4, 5, 6],
                        "b": [1, 2, 3, 4, 5, 6],
                        "c": [1, 2, 3, 4, 5, 6],
                        "d": [1, 2, 3, 4, 5, 6]})

        def _check(axes):
            for ax in axes:
                assert len(ax.lines) == 1
                self._check_visible(ax.get_xticklabels(), visible=True)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=True)
            for ax in [axes[0], axes[1]]:
                self._check_visible(ax.get_yticklabels(), visible=True)
            for ax in [axes[2], axes[3]]:
                self._check_visible(ax.get_yticklabels(), visible=False)

        for ax in axes:
            df.plot(x="a", y="b", title="title", ax=ax, sharey=True)
        gs.tight_layout(plt.gcf())
        _check(axes)
        tm.close()

        gs, axes = _generate_4_axes_via_gridspec()
        with tm.assert_produces_warning(UserWarning):
            axes = df.plot(subplots=True, ax=axes, sharey=True)

        gs.tight_layout(plt.gcf())
        _check(axes)
        tm.close()

        gs, axes = _generate_4_axes_via_gridspec()
        # without sharex, no labels should be touched!
        for ax in axes:
            df.plot(x="a", y="b", title="title", ax=ax)

        gs.tight_layout(plt.gcf())
        for ax in axes:
            assert len(ax.lines) == 1
            self._check_visible(ax.get_yticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(minor=True), visible=True)

    def test_memory_leak(self):
        """ Check that every plot type gets properly collected. """
        import weakref
        import gc

        results = {}
        for kind in plotting._core._plot_klass.keys():
            if not _ok_for_gaussian_kde(kind):
                continue
            args = {}
            if kind in ['hexbin', 'scatter', 'pie']:
                df = self.hexbin_df
                args = {'x': 'A', 'y': 'B'}
            elif kind == 'area':
                df = self.tdf.abs()
            else:
                df = self.tdf

            # Use a weakref so we can see if the object gets collected without
            # also preventing it from being collected
            results[kind] = weakref.proxy(df.plot(kind=kind, **args))

        # have matplotlib delete all the figures
        tm.close()
        # force a garbage collection
        gc.collect()
        for key in results:
            # check that every plot was collected
            with pytest.raises(ReferenceError):
                # need to actually access something to get an error
                results[key].lines

    @slow
    def test_df_subplots_patterns_minorticks(self):
        # GH 10657
        import matplotlib.pyplot as plt

        df = DataFrame(np.random.randn(10, 2),
                       index=date_range('1/1/2000', periods=10),
                       columns=list('AB'))

        # shared subplots
        fig, axes = plt.subplots(2, 1, sharex=True)
        axes = df.plot(subplots=True, ax=axes)
        for ax in axes:
            assert len(ax.lines) == 1
            self._check_visible(ax.get_yticklabels(), visible=True)
        # xaxis of 1st ax must be hidden
        self._check_visible(axes[0].get_xticklabels(), visible=False)
        self._check_visible(axes[0].get_xticklabels(minor=True), visible=False)
        self._check_visible(axes[1].get_xticklabels(), visible=True)
        self._check_visible(axes[1].get_xticklabels(minor=True), visible=True)
        tm.close()

        fig, axes = plt.subplots(2, 1)
        with tm.assert_produces_warning(UserWarning):
            axes = df.plot(subplots=True, ax=axes, sharex=True)
        for ax in axes:
            assert len(ax.lines) == 1
            self._check_visible(ax.get_yticklabels(), visible=True)
        # xaxis of 1st ax must be hidden
        self._check_visible(axes[0].get_xticklabels(), visible=False)
        self._check_visible(axes[0].get_xticklabels(minor=True), visible=False)
        self._check_visible(axes[1].get_xticklabels(), visible=True)
        self._check_visible(axes[1].get_xticklabels(minor=True), visible=True)
        tm.close()

        # not shared
        fig, axes = plt.subplots(2, 1)
        axes = df.plot(subplots=True, ax=axes)
        for ax in axes:
            assert len(ax.lines) == 1
            self._check_visible(ax.get_yticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(minor=True), visible=True)
        tm.close()

    @slow
    def test_df_gridspec_patterns(self):
        # GH 10819
        import matplotlib.pyplot as plt
        import matplotlib.gridspec as gridspec

        ts = Series(np.random.randn(10),
                    index=date_range('1/1/2000', periods=10))

        df = DataFrame(np.random.randn(10, 2), index=ts.index,
                       columns=list('AB'))

        def _get_vertical_grid():
            gs = gridspec.GridSpec(3, 1)
            fig = plt.figure()
            ax1 = fig.add_subplot(gs[:2, :])
            ax2 = fig.add_subplot(gs[2, :])
            return ax1, ax2

        def _get_horizontal_grid():
            gs = gridspec.GridSpec(1, 3)
            fig = plt.figure()
            ax1 = fig.add_subplot(gs[:, :2])
            ax2 = fig.add_subplot(gs[:, 2])
            return ax1, ax2

        for ax1, ax2 in [_get_vertical_grid(), _get_horizontal_grid()]:
            ax1 = ts.plot(ax=ax1)
            assert len(ax1.lines) == 1
            ax2 = df.plot(ax=ax2)
            assert len(ax2.lines) == 2
            for ax in [ax1, ax2]:
                self._check_visible(ax.get_yticklabels(), visible=True)
                self._check_visible(ax.get_xticklabels(), visible=True)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=True)
            tm.close()

        # subplots=True
        for ax1, ax2 in [_get_vertical_grid(), _get_horizontal_grid()]:
            axes = df.plot(subplots=True, ax=[ax1, ax2])
            assert len(ax1.lines) == 1
            assert len(ax2.lines) == 1
            for ax in axes:
                self._check_visible(ax.get_yticklabels(), visible=True)
                self._check_visible(ax.get_xticklabels(), visible=True)
                self._check_visible(
                    ax.get_xticklabels(minor=True), visible=True)
            tm.close()

        # vertical / subplots / sharex=True / sharey=True
        ax1, ax2 = _get_vertical_grid()
        with tm.assert_produces_warning(UserWarning):
            axes = df.plot(subplots=True, ax=[ax1, ax2], sharex=True,
                           sharey=True)
        assert len(axes[0].lines) == 1
        assert len(axes[1].lines) == 1
        for ax in [ax1, ax2]:
            # yaxis are visible because there is only one column
            self._check_visible(ax.get_yticklabels(), visible=True)
        # xaxis of axes0 (top) are hidden
        self._check_visible(axes[0].get_xticklabels(), visible=False)
        self._check_visible(axes[0].get_xticklabels(minor=True), visible=False)
        self._check_visible(axes[1].get_xticklabels(), visible=True)
        self._check_visible(axes[1].get_xticklabels(minor=True), visible=True)
        tm.close()

        # horizontal / subplots / sharex=True / sharey=True
        ax1, ax2 = _get_horizontal_grid()
        with tm.assert_produces_warning(UserWarning):
            axes = df.plot(subplots=True, ax=[ax1, ax2], sharex=True,
                           sharey=True)
        assert len(axes[0].lines) == 1
        assert len(axes[1].lines) == 1
        self._check_visible(axes[0].get_yticklabels(), visible=True)
        # yaxis of axes1 (right) are hidden
        self._check_visible(axes[1].get_yticklabels(), visible=False)
        for ax in [ax1, ax2]:
            # xaxis are visible because there is only one column
            self._check_visible(ax.get_xticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(minor=True), visible=True)
        tm.close()

        # boxed
        def _get_boxed_grid():
            gs = gridspec.GridSpec(3, 3)
            fig = plt.figure()
            ax1 = fig.add_subplot(gs[:2, :2])
            ax2 = fig.add_subplot(gs[:2, 2])
            ax3 = fig.add_subplot(gs[2, :2])
            ax4 = fig.add_subplot(gs[2, 2])
            return ax1, ax2, ax3, ax4

        axes = _get_boxed_grid()
        df = DataFrame(np.random.randn(10, 4),
                       index=ts.index, columns=list('ABCD'))
        axes = df.plot(subplots=True, ax=axes)
        for ax in axes:
            assert len(ax.lines) == 1
            # axis are visible because these are not shared
            self._check_visible(ax.get_yticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(minor=True), visible=True)
        tm.close()

        # subplots / sharex=True / sharey=True
        axes = _get_boxed_grid()
        with tm.assert_produces_warning(UserWarning):
            axes = df.plot(subplots=True, ax=axes, sharex=True, sharey=True)
        for ax in axes:
            assert len(ax.lines) == 1
        for ax in [axes[0], axes[2]]:  # left column
            self._check_visible(ax.get_yticklabels(), visible=True)
        for ax in [axes[1], axes[3]]:  # right column
            self._check_visible(ax.get_yticklabels(), visible=False)
        for ax in [axes[0], axes[1]]:  # top row
            self._check_visible(ax.get_xticklabels(), visible=False)
            self._check_visible(ax.get_xticklabels(minor=True), visible=False)
        for ax in [axes[2], axes[3]]:  # bottom row
            self._check_visible(ax.get_xticklabels(), visible=True)
            self._check_visible(ax.get_xticklabels(minor=True), visible=True)
        tm.close()

    @slow
    def test_df_grid_settings(self):
        # Make sure plot defaults to rcParams['axes.grid'] setting, GH 9792
        self._check_grid_settings(
            DataFrame({'a': [1, 2, 3], 'b': [2, 3, 4]}),
            plotting._core._dataframe_kinds, kws={'x': 'a', 'y': 'b'})

    def test_option_mpl_style(self):
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            set_option('display.mpl_style', 'default')
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            set_option('display.mpl_style', None)
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            set_option('display.mpl_style', False)

        with pytest.raises(ValueError):
            set_option('display.mpl_style', 'default2')

    def test_invalid_colormap(self):
        df = DataFrame(randn(3, 2), columns=['A', 'B'])

        with pytest.raises(ValueError):
            df.plot(colormap='invalid_colormap')

    def test_plain_axes(self):

        # supplied ax itself is a SubplotAxes, but figure contains also
        # a plain Axes object (GH11556)
        fig, ax = self.plt.subplots()
        fig.add_axes([0.2, 0.2, 0.2, 0.2])
        Series(rand(10)).plot(ax=ax)

        # suppliad ax itself is a plain Axes, but because the cmap keyword
        # a new ax is created for the colorbar -> also multiples axes (GH11520)
        df = DataFrame({'a': randn(8), 'b': randn(8)})
        fig = self.plt.figure()
        ax = fig.add_axes((0, 0, 1, 1))
        df.plot(kind='scatter', ax=ax, x='a', y='b', c='a', cmap='hsv')

        # other examples
        fig, ax = self.plt.subplots()
        from mpl_toolkits.axes_grid1 import make_axes_locatable
        divider = make_axes_locatable(ax)
        cax = divider.append_axes("right", size="5%", pad=0.05)
        Series(rand(10)).plot(ax=ax)
        Series(rand(10)).plot(ax=cax)

        fig, ax = self.plt.subplots()
        from mpl_toolkits.axes_grid.inset_locator import inset_axes
        iax = inset_axes(ax, width="30%", height=1., loc=3)
        Series(rand(10)).plot(ax=ax)
        Series(rand(10)).plot(ax=iax)

    def test_passed_bar_colors(self):
        import matplotlib as mpl
        color_tuples = [(0.9, 0, 0, 1), (0, 0.9, 0, 1), (0, 0, 0.9, 1)]
        colormap = mpl.colors.ListedColormap(color_tuples)
        barplot = pd.DataFrame([[1, 2, 3]]).plot(kind="bar", cmap=colormap)
        assert color_tuples == [c.get_facecolor() for c in barplot.patches]

    def test_rcParams_bar_colors(self):
        import matplotlib as mpl
        color_tuples = [(0.9, 0, 0, 1), (0, 0.9, 0, 1), (0, 0, 0.9, 1)]
        try:  # mpl 1.5
            with mpl.rc_context(
                    rc={'axes.prop_cycle': mpl.cycler("color", color_tuples)}):
                barplot = pd.DataFrame([[1, 2, 3]]).plot(kind="bar")
        except (AttributeError, KeyError):  # mpl 1.4
            with mpl.rc_context(rc={'axes.color_cycle': color_tuples}):
                barplot = pd.DataFrame([[1, 2, 3]]).plot(kind="bar")
        assert color_tuples == [c.get_facecolor() for c in barplot.patches]


def _generate_4_axes_via_gridspec():
    import matplotlib.pyplot as plt
    import matplotlib as mpl
    import matplotlib.gridspec  # noqa

    gs = mpl.gridspec.GridSpec(2, 2)
    ax_tl = plt.subplot(gs[0, 0])
    ax_ll = plt.subplot(gs[1, 0])
    ax_tr = plt.subplot(gs[0, 1])
    ax_lr = plt.subplot(gs[1, 1])

    return gs, [ax_tl, ax_ll, ax_tr, ax_lr]
