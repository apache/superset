# coding: utf-8

""" Test cases for Series.plot """


import itertools
import pytest

from datetime import datetime

import pandas as pd
from pandas import Series, DataFrame, date_range
from pandas.compat import range, lrange
import pandas.util.testing as tm
from pandas.util.testing import slow

import numpy as np
from numpy.random import randn

import pandas.plotting as plotting
from pandas.tests.plotting.common import (TestPlotBase, _check_plot_works,
                                          _skip_if_no_scipy_gaussian_kde,
                                          _ok_for_gaussian_kde)

tm._skip_module_if_no_mpl()


class TestSeriesPlots(TestPlotBase):

    def setup_method(self, method):
        TestPlotBase.setup_method(self, method)
        import matplotlib as mpl
        mpl.rcdefaults()

        self.ts = tm.makeTimeSeries()
        self.ts.name = 'ts'

        self.series = tm.makeStringSeries()
        self.series.name = 'series'

        self.iseries = tm.makePeriodSeries()
        self.iseries.name = 'iseries'

    @slow
    def test_plot(self):
        _check_plot_works(self.ts.plot, label='foo')
        _check_plot_works(self.ts.plot, use_index=False)
        axes = _check_plot_works(self.ts.plot, rot=0)
        self._check_ticks_props(axes, xrot=0)

        ax = _check_plot_works(self.ts.plot, style='.', logy=True)
        self._check_ax_scales(ax, yaxis='log')

        ax = _check_plot_works(self.ts.plot, style='.', logx=True)
        self._check_ax_scales(ax, xaxis='log')

        ax = _check_plot_works(self.ts.plot, style='.', loglog=True)
        self._check_ax_scales(ax, xaxis='log', yaxis='log')

        _check_plot_works(self.ts[:10].plot.bar)
        _check_plot_works(self.ts.plot.area, stacked=False)
        _check_plot_works(self.iseries.plot)

        for kind in ['line', 'bar', 'barh', 'kde', 'hist', 'box']:
            if not _ok_for_gaussian_kde(kind):
                continue
            _check_plot_works(self.series[:5].plot, kind=kind)

        _check_plot_works(self.series[:10].plot.barh)
        ax = _check_plot_works(Series(randn(10)).plot.bar, color='black')
        self._check_colors([ax.patches[0]], facecolors=['black'])

        # GH 6951
        ax = _check_plot_works(self.ts.plot, subplots=True)
        self._check_axes_shape(ax, axes_num=1, layout=(1, 1))

        ax = _check_plot_works(self.ts.plot, subplots=True, layout=(-1, 1))
        self._check_axes_shape(ax, axes_num=1, layout=(1, 1))
        ax = _check_plot_works(self.ts.plot, subplots=True, layout=(1, -1))
        self._check_axes_shape(ax, axes_num=1, layout=(1, 1))

    @slow
    def test_plot_figsize_and_title(self):
        # figsize and title
        ax = self.series.plot(title='Test', figsize=(16, 8))
        self._check_text_labels(ax.title, 'Test')
        self._check_axes_shape(ax, axes_num=1, layout=(1, 1), figsize=(16, 8))

    def test_dont_modify_rcParams(self):
        # GH 8242
        if self.mpl_ge_1_5_0:
            key = 'axes.prop_cycle'
        else:
            key = 'axes.color_cycle'
        colors = self.plt.rcParams[key]
        Series([1, 2, 3]).plot()
        assert colors == self.plt.rcParams[key]

    def test_ts_line_lim(self):
        ax = self.ts.plot()
        xmin, xmax = ax.get_xlim()
        lines = ax.get_lines()
        assert xmin == lines[0].get_data(orig=False)[0][0]
        assert xmax == lines[0].get_data(orig=False)[0][-1]
        tm.close()

        ax = self.ts.plot(secondary_y=True)
        xmin, xmax = ax.get_xlim()
        lines = ax.get_lines()
        assert xmin == lines[0].get_data(orig=False)[0][0]
        assert xmax == lines[0].get_data(orig=False)[0][-1]

    def test_ts_area_lim(self):
        ax = self.ts.plot.area(stacked=False)
        xmin, xmax = ax.get_xlim()
        line = ax.get_lines()[0].get_data(orig=False)[0]
        assert xmin == line[0]
        assert xmax == line[-1]
        tm.close()

        # GH 7471
        ax = self.ts.plot.area(stacked=False, x_compat=True)
        xmin, xmax = ax.get_xlim()
        line = ax.get_lines()[0].get_data(orig=False)[0]
        assert xmin == line[0]
        assert xmax == line[-1]
        tm.close()

        tz_ts = self.ts.copy()
        tz_ts.index = tz_ts.tz_localize('GMT').tz_convert('CET')
        ax = tz_ts.plot.area(stacked=False, x_compat=True)
        xmin, xmax = ax.get_xlim()
        line = ax.get_lines()[0].get_data(orig=False)[0]
        assert xmin == line[0]
        assert xmax == line[-1]
        tm.close()

        ax = tz_ts.plot.area(stacked=False, secondary_y=True)
        xmin, xmax = ax.get_xlim()
        line = ax.get_lines()[0].get_data(orig=False)[0]
        assert xmin == line[0]
        assert xmax == line[-1]

    def test_label(self):
        s = Series([1, 2])
        ax = s.plot(label='LABEL', legend=True)
        self._check_legend_labels(ax, labels=['LABEL'])
        self.plt.close()
        ax = s.plot(legend=True)
        self._check_legend_labels(ax, labels=['None'])
        self.plt.close()
        # get name from index
        s.name = 'NAME'
        ax = s.plot(legend=True)
        self._check_legend_labels(ax, labels=['NAME'])
        self.plt.close()
        # override the default
        ax = s.plot(legend=True, label='LABEL')
        self._check_legend_labels(ax, labels=['LABEL'])
        self.plt.close()
        # Add lebel info, but don't draw
        ax = s.plot(legend=False, label='LABEL')
        assert ax.get_legend() is None  # Hasn't been drawn
        ax.legend()  # draw it
        self._check_legend_labels(ax, labels=['LABEL'])

    def test_line_area_nan_series(self):
        values = [1, 2, np.nan, 3]
        s = Series(values)
        ts = Series(values, index=tm.makeDateIndex(k=4))

        for d in [s, ts]:
            ax = _check_plot_works(d.plot)
            masked = ax.lines[0].get_ydata()
            # remove nan for comparison purpose
            exp = np.array([1, 2, 3], dtype=np.float64)
            tm.assert_numpy_array_equal(np.delete(masked.data, 2), exp)
            tm.assert_numpy_array_equal(
                masked.mask, np.array([False, False, True, False]))

            expected = np.array([1, 2, 0, 3], dtype=np.float64)
            ax = _check_plot_works(d.plot, stacked=True)
            tm.assert_numpy_array_equal(ax.lines[0].get_ydata(), expected)
            ax = _check_plot_works(d.plot.area)
            tm.assert_numpy_array_equal(ax.lines[0].get_ydata(), expected)
            ax = _check_plot_works(d.plot.area, stacked=False)
            tm.assert_numpy_array_equal(ax.lines[0].get_ydata(), expected)

    def test_line_use_index_false(self):
        s = Series([1, 2, 3], index=['a', 'b', 'c'])
        s.index.name = 'The Index'
        ax = s.plot(use_index=False)
        label = ax.get_xlabel()
        assert label == ''
        ax2 = s.plot.bar(use_index=False)
        label2 = ax2.get_xlabel()
        assert label2 == ''

    @slow
    def test_bar_log(self):
        expected = np.array([1., 10., 100., 1000.])

        if not self.mpl_le_1_2_1:
            expected = np.hstack((.1, expected, 1e4))

        ax = Series([200, 500]).plot.bar(log=True)
        tm.assert_numpy_array_equal(ax.yaxis.get_ticklocs(), expected)
        tm.close()

        ax = Series([200, 500]).plot.barh(log=True)
        tm.assert_numpy_array_equal(ax.xaxis.get_ticklocs(), expected)
        tm.close()

        # GH 9905
        expected = np.array([1.0e-03, 1.0e-02, 1.0e-01, 1.0e+00])

        if not self.mpl_le_1_2_1:
            expected = np.hstack((1.0e-04, expected, 1.0e+01))
        if self.mpl_ge_2_0_0:
            expected = np.hstack((1.0e-05, expected))

        ax = Series([0.1, 0.01, 0.001]).plot(log=True, kind='bar')
        ymin = 0.0007943282347242822 if self.mpl_ge_2_0_0 else 0.001
        ymax = 0.12589254117941673 if self.mpl_ge_2_0_0 else .10000000000000001
        res = ax.get_ylim()
        tm.assert_almost_equal(res[0], ymin)
        tm.assert_almost_equal(res[1], ymax)
        tm.assert_numpy_array_equal(ax.yaxis.get_ticklocs(), expected)
        tm.close()

        ax = Series([0.1, 0.01, 0.001]).plot(log=True, kind='barh')
        res = ax.get_xlim()
        tm.assert_almost_equal(res[0], ymin)
        tm.assert_almost_equal(res[1], ymax)
        tm.assert_numpy_array_equal(ax.xaxis.get_ticklocs(), expected)

    @slow
    def test_bar_ignore_index(self):
        df = Series([1, 2, 3, 4], index=['a', 'b', 'c', 'd'])
        ax = df.plot.bar(use_index=False)
        self._check_text_labels(ax.get_xticklabels(), ['0', '1', '2', '3'])

    def test_rotation(self):
        df = DataFrame(randn(5, 5))
        # Default rot 0
        axes = df.plot()
        self._check_ticks_props(axes, xrot=0)

        axes = df.plot(rot=30)
        self._check_ticks_props(axes, xrot=30)

    def test_irregular_datetime(self):
        rng = date_range('1/1/2000', '3/1/2000')
        rng = rng[[0, 1, 2, 3, 5, 9, 10, 11, 12]]
        ser = Series(randn(len(rng)), rng)
        ax = ser.plot()
        xp = datetime(1999, 1, 1).toordinal()
        ax.set_xlim('1/1/1999', '1/1/2001')
        assert xp == ax.get_xlim()[0]

    @slow
    def test_pie_series(self):
        # if sum of values is less than 1.0, pie handle them as rate and draw
        # semicircle.
        series = Series(np.random.randint(1, 5),
                        index=['a', 'b', 'c', 'd', 'e'], name='YLABEL')
        ax = _check_plot_works(series.plot.pie)
        self._check_text_labels(ax.texts, series.index)
        assert ax.get_ylabel() == 'YLABEL'

        # without wedge labels
        ax = _check_plot_works(series.plot.pie, labels=None)
        self._check_text_labels(ax.texts, [''] * 5)

        # with less colors than elements
        color_args = ['r', 'g', 'b']
        ax = _check_plot_works(series.plot.pie, colors=color_args)

        color_expected = ['r', 'g', 'b', 'r', 'g']
        self._check_colors(ax.patches, facecolors=color_expected)

        # with labels and colors
        labels = ['A', 'B', 'C', 'D', 'E']
        color_args = ['r', 'g', 'b', 'c', 'm']
        ax = _check_plot_works(series.plot.pie, labels=labels,
                               colors=color_args)
        self._check_text_labels(ax.texts, labels)
        self._check_colors(ax.patches, facecolors=color_args)

        # with autopct and fontsize
        ax = _check_plot_works(series.plot.pie, colors=color_args,
                               autopct='%.2f', fontsize=7)
        pcts = ['{0:.2f}'.format(s * 100)
                for s in series.values / float(series.sum())]
        iters = [iter(series.index), iter(pcts)]
        expected_texts = list(next(it) for it in itertools.cycle(iters))
        self._check_text_labels(ax.texts, expected_texts)
        for t in ax.texts:
            assert t.get_fontsize() == 7

        # includes negative value
        with pytest.raises(ValueError):
            series = Series([1, 2, 0, 4, -1], index=['a', 'b', 'c', 'd', 'e'])
            series.plot.pie()

        # includes nan
        series = Series([1, 2, np.nan, 4], index=['a', 'b', 'c', 'd'],
                        name='YLABEL')
        ax = _check_plot_works(series.plot.pie)
        self._check_text_labels(ax.texts, ['a', 'b', '', 'd'])

    def test_pie_nan(self):
        s = Series([1, np.nan, 1, 1])
        ax = s.plot.pie(legend=True)
        expected = ['0', '', '2', '3']
        result = [x.get_text() for x in ax.texts]
        assert result == expected

    @slow
    def test_hist_df_kwargs(self):
        df = DataFrame(np.random.randn(10, 2))
        ax = df.plot.hist(bins=5)
        assert len(ax.patches) == 10

    @slow
    def test_hist_df_with_nonnumerics(self):
        # GH 9853
        with tm.RNGContext(1):
            df = DataFrame(
                np.random.randn(10, 4), columns=['A', 'B', 'C', 'D'])
        df['E'] = ['x', 'y'] * 5
        ax = df.plot.hist(bins=5)
        assert len(ax.patches) == 20

        ax = df.plot.hist()  # bins=10
        assert len(ax.patches) == 40

    @slow
    def test_hist_legacy(self):
        _check_plot_works(self.ts.hist)
        _check_plot_works(self.ts.hist, grid=False)
        _check_plot_works(self.ts.hist, figsize=(8, 10))
        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(self.ts.hist,
                              by=self.ts.index.month)
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(self.ts.hist,
                              by=self.ts.index.month, bins=5)

        fig, ax = self.plt.subplots(1, 1)
        _check_plot_works(self.ts.hist, ax=ax)
        _check_plot_works(self.ts.hist, ax=ax, figure=fig)
        _check_plot_works(self.ts.hist, figure=fig)
        tm.close()

        fig, (ax1, ax2) = self.plt.subplots(1, 2)
        _check_plot_works(self.ts.hist, figure=fig, ax=ax1)
        _check_plot_works(self.ts.hist, figure=fig, ax=ax2)

        with pytest.raises(ValueError):
            self.ts.hist(by=self.ts.index, figure=fig)

    @slow
    def test_hist_bins_legacy(self):
        df = DataFrame(np.random.randn(10, 2))
        ax = df.hist(bins=2)[0][0]
        assert len(ax.patches) == 2

    @slow
    def test_hist_layout(self):
        df = self.hist_df
        with pytest.raises(ValueError):
            df.height.hist(layout=(1, 1))

        with pytest.raises(ValueError):
            df.height.hist(layout=[1, 1])

    @slow
    def test_hist_layout_with_by(self):
        df = self.hist_df

        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.gender, layout=(2, 1))
        self._check_axes_shape(axes, axes_num=2, layout=(2, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.gender, layout=(3, -1))
        self._check_axes_shape(axes, axes_num=2, layout=(3, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.category, layout=(4, 1))
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.category, layout=(2, -1))
        self._check_axes_shape(axes, axes_num=4, layout=(2, 2))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.category, layout=(3, -1))
        self._check_axes_shape(axes, axes_num=4, layout=(3, 2))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.category, layout=(-1, 4))
        self._check_axes_shape(axes, axes_num=4, layout=(1, 4))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist,
                                     by=df.classroom, layout=(2, 2))
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))

        axes = df.height.hist(by=df.category, layout=(4, 2), figsize=(12, 7))
        self._check_axes_shape(axes, axes_num=4, layout=(4, 2),
                               figsize=(12, 7))

    @slow
    def test_hist_no_overlap(self):
        from matplotlib.pyplot import subplot, gcf
        x = Series(randn(2))
        y = Series(randn(2))
        subplot(121)
        x.hist()
        subplot(122)
        y.hist()
        fig = gcf()
        axes = fig.axes if self.mpl_ge_1_5_0 else fig.get_axes()
        assert len(axes) == 2

    @slow
    def test_hist_secondary_legend(self):
        # GH 9610
        df = DataFrame(np.random.randn(30, 4), columns=list('abcd'))

        # primary -> secondary
        ax = df['a'].plot.hist(legend=True)
        df['b'].plot.hist(ax=ax, legend=True, secondary_y=True)
        # both legends are dran on left ax
        # left and right axis must be visible
        self._check_legend_labels(ax, labels=['a', 'b (right)'])
        assert ax.get_yaxis().get_visible()
        assert ax.right_ax.get_yaxis().get_visible()
        tm.close()

        # secondary -> secondary
        ax = df['a'].plot.hist(legend=True, secondary_y=True)
        df['b'].plot.hist(ax=ax, legend=True, secondary_y=True)
        # both legends are draw on left ax
        # left axis must be invisible, right axis must be visible
        self._check_legend_labels(ax.left_ax,
                                  labels=['a (right)', 'b (right)'])
        assert not ax.left_ax.get_yaxis().get_visible()
        assert ax.get_yaxis().get_visible()
        tm.close()

        # secondary -> primary
        ax = df['a'].plot.hist(legend=True, secondary_y=True)
        # right axes is returned
        df['b'].plot.hist(ax=ax, legend=True)
        # both legends are draw on left ax
        # left and right axis must be visible
        self._check_legend_labels(ax.left_ax, labels=['a (right)', 'b'])
        assert ax.left_ax.get_yaxis().get_visible()
        assert ax.get_yaxis().get_visible()
        tm.close()

    @slow
    def test_df_series_secondary_legend(self):
        # GH 9779
        df = DataFrame(np.random.randn(30, 3), columns=list('abc'))
        s = Series(np.random.randn(30), name='x')

        # primary -> secondary (without passing ax)
        ax = df.plot()
        s.plot(legend=True, secondary_y=True)
        # both legends are dran on left ax
        # left and right axis must be visible
        self._check_legend_labels(ax, labels=['a', 'b', 'c', 'x (right)'])
        assert ax.get_yaxis().get_visible()
        assert ax.right_ax.get_yaxis().get_visible()
        tm.close()

        # primary -> secondary (with passing ax)
        ax = df.plot()
        s.plot(ax=ax, legend=True, secondary_y=True)
        # both legends are dran on left ax
        # left and right axis must be visible
        self._check_legend_labels(ax, labels=['a', 'b', 'c', 'x (right)'])
        assert ax.get_yaxis().get_visible()
        assert ax.right_ax.get_yaxis().get_visible()
        tm.close()

        # seconcary -> secondary (without passing ax)
        ax = df.plot(secondary_y=True)
        s.plot(legend=True, secondary_y=True)
        # both legends are dran on left ax
        # left axis must be invisible and right axis must be visible
        expected = ['a (right)', 'b (right)', 'c (right)', 'x (right)']
        self._check_legend_labels(ax.left_ax, labels=expected)
        assert not ax.left_ax.get_yaxis().get_visible()
        assert ax.get_yaxis().get_visible()
        tm.close()

        # secondary -> secondary (with passing ax)
        ax = df.plot(secondary_y=True)
        s.plot(ax=ax, legend=True, secondary_y=True)
        # both legends are dran on left ax
        # left axis must be invisible and right axis must be visible
        expected = ['a (right)', 'b (right)', 'c (right)', 'x (right)']
        self._check_legend_labels(ax.left_ax, expected)
        assert not ax.left_ax.get_yaxis().get_visible()
        assert ax.get_yaxis().get_visible()
        tm.close()

        # secondary -> secondary (with passing ax)
        ax = df.plot(secondary_y=True, mark_right=False)
        s.plot(ax=ax, legend=True, secondary_y=True)
        # both legends are dran on left ax
        # left axis must be invisible and right axis must be visible
        expected = ['a', 'b', 'c', 'x (right)']
        self._check_legend_labels(ax.left_ax, expected)
        assert not ax.left_ax.get_yaxis().get_visible()
        assert ax.get_yaxis().get_visible()
        tm.close()

    @slow
    def test_plot_fails_with_dupe_color_and_style(self):
        x = Series(randn(2))
        with pytest.raises(ValueError):
            x.plot(style='k--', color='k')

    @slow
    def test_hist_kde(self):
        ax = self.ts.plot.hist(logy=True)
        self._check_ax_scales(ax, yaxis='log')
        xlabels = ax.get_xticklabels()
        # ticks are values, thus ticklabels are blank
        self._check_text_labels(xlabels, [''] * len(xlabels))
        ylabels = ax.get_yticklabels()
        self._check_text_labels(ylabels, [''] * len(ylabels))

        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()
        _check_plot_works(self.ts.plot.kde)
        _check_plot_works(self.ts.plot.density)
        ax = self.ts.plot.kde(logy=True)
        self._check_ax_scales(ax, yaxis='log')
        xlabels = ax.get_xticklabels()
        self._check_text_labels(xlabels, [''] * len(xlabels))
        ylabels = ax.get_yticklabels()
        self._check_text_labels(ylabels, [''] * len(ylabels))

    @slow
    def test_kde_kwargs(self):
        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()
        from numpy import linspace
        _check_plot_works(self.ts.plot.kde, bw_method=.5,
                          ind=linspace(-100, 100, 20))
        _check_plot_works(self.ts.plot.density, bw_method=.5,
                          ind=linspace(-100, 100, 20))
        ax = self.ts.plot.kde(logy=True, bw_method=.5,
                              ind=linspace(-100, 100, 20))
        self._check_ax_scales(ax, yaxis='log')
        self._check_text_labels(ax.yaxis.get_label(), 'Density')

    @slow
    def test_kde_missing_vals(self):
        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()
        s = Series(np.random.uniform(size=50))
        s[0] = np.nan
        axes = _check_plot_works(s.plot.kde)

        # gh-14821: check if the values have any missing values
        assert any(~np.isnan(axes.lines[0].get_xdata()))

    @slow
    def test_hist_kwargs(self):
        ax = self.ts.plot.hist(bins=5)
        assert len(ax.patches) == 5
        self._check_text_labels(ax.yaxis.get_label(), 'Frequency')
        tm.close()

        if self.mpl_ge_1_3_1:
            ax = self.ts.plot.hist(orientation='horizontal')
            self._check_text_labels(ax.xaxis.get_label(), 'Frequency')
            tm.close()

            ax = self.ts.plot.hist(align='left', stacked=True)
            tm.close()

    @slow
    def test_hist_kde_color(self):
        ax = self.ts.plot.hist(logy=True, bins=10, color='b')
        self._check_ax_scales(ax, yaxis='log')
        assert len(ax.patches) == 10
        self._check_colors(ax.patches, facecolors=['b'] * 10)

        tm._skip_if_no_scipy()
        _skip_if_no_scipy_gaussian_kde()
        ax = self.ts.plot.kde(logy=True, color='r')
        self._check_ax_scales(ax, yaxis='log')
        lines = ax.get_lines()
        assert len(lines) == 1
        self._check_colors(lines, ['r'])

    @slow
    def test_boxplot_series(self):
        ax = self.ts.plot.box(logy=True)
        self._check_ax_scales(ax, yaxis='log')
        xlabels = ax.get_xticklabels()
        self._check_text_labels(xlabels, [self.ts.name])
        ylabels = ax.get_yticklabels()
        self._check_text_labels(ylabels, [''] * len(ylabels))

    @slow
    def test_kind_both_ways(self):
        s = Series(range(3))
        kinds = (plotting._core._common_kinds +
                 plotting._core._series_kinds)
        for kind in kinds:
            if not _ok_for_gaussian_kde(kind):
                continue
            s.plot(kind=kind)
            getattr(s.plot, kind)()

    @slow
    def test_invalid_plot_data(self):
        s = Series(list('abcd'))
        for kind in plotting._core._common_kinds:
            if not _ok_for_gaussian_kde(kind):
                continue
            with pytest.raises(TypeError):
                s.plot(kind=kind)

    @slow
    def test_valid_object_plot(self):
        s = Series(lrange(10), dtype=object)
        for kind in plotting._core._common_kinds:
            if not _ok_for_gaussian_kde(kind):
                continue
            _check_plot_works(s.plot, kind=kind)

    def test_partially_invalid_plot_data(self):
        s = Series(['a', 'b', 1.0, 2])
        for kind in plotting._core._common_kinds:
            if not _ok_for_gaussian_kde(kind):
                continue
            with pytest.raises(TypeError):
                s.plot(kind=kind)

    def test_invalid_kind(self):
        s = Series([1, 2])
        with pytest.raises(ValueError):
            s.plot(kind='aasdf')

    @slow
    def test_dup_datetime_index_plot(self):
        dr1 = date_range('1/1/2009', periods=4)
        dr2 = date_range('1/2/2009', periods=4)
        index = dr1.append(dr2)
        values = randn(index.size)
        s = Series(values, index=index)
        _check_plot_works(s.plot)

    @slow
    def test_errorbar_plot(self):

        s = Series(np.arange(10), name='x')
        s_err = np.random.randn(10)
        d_err = DataFrame(randn(10, 2), index=s.index, columns=['x', 'y'])
        # test line and bar plots
        kinds = ['line', 'bar']
        for kind in kinds:
            ax = _check_plot_works(s.plot, yerr=Series(s_err), kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=1)
            ax = _check_plot_works(s.plot, yerr=s_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=1)
            ax = _check_plot_works(s.plot, yerr=s_err.tolist(), kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=1)
            ax = _check_plot_works(s.plot, yerr=d_err, kind=kind)
            self._check_has_errorbars(ax, xerr=0, yerr=1)
            ax = _check_plot_works(s.plot, xerr=0.2, yerr=0.2, kind=kind)
            self._check_has_errorbars(ax, xerr=1, yerr=1)

        ax = _check_plot_works(s.plot, xerr=s_err)
        self._check_has_errorbars(ax, xerr=1, yerr=0)

        # test time series plotting
        ix = date_range('1/1/2000', '1/1/2001', freq='M')
        ts = Series(np.arange(12), index=ix, name='x')
        ts_err = Series(np.random.randn(12), index=ix)
        td_err = DataFrame(randn(12, 2), index=ix, columns=['x', 'y'])

        ax = _check_plot_works(ts.plot, yerr=ts_err)
        self._check_has_errorbars(ax, xerr=0, yerr=1)
        ax = _check_plot_works(ts.plot, yerr=td_err)
        self._check_has_errorbars(ax, xerr=0, yerr=1)

        # check incorrect lengths and types
        with pytest.raises(ValueError):
            s.plot(yerr=np.arange(11))

        s_err = ['zzz'] * 10
        # in mpl 1.5+ this is a TypeError
        with pytest.raises((ValueError, TypeError)):
            s.plot(yerr=s_err)

    def test_table(self):
        _check_plot_works(self.series.plot, table=True)
        _check_plot_works(self.series.plot, table=self.series)

    @slow
    def test_series_grid_settings(self):
        # Make sure plot defaults to rcParams['axes.grid'] setting, GH 9792
        self._check_grid_settings(Series([1, 2, 3]),
                                  plotting._core._series_kinds +
                                  plotting._core._common_kinds)

    @slow
    def test_standard_colors(self):
        from pandas.plotting._style import _get_standard_colors

        for c in ['r', 'red', 'green', '#FF0000']:
            result = _get_standard_colors(1, color=c)
            assert result == [c]

            result = _get_standard_colors(1, color=[c])
            assert result == [c]

            result = _get_standard_colors(3, color=c)
            assert result == [c] * 3

            result = _get_standard_colors(3, color=[c])
            assert result == [c] * 3

    @slow
    def test_standard_colors_all(self):
        import matplotlib.colors as colors
        from pandas.plotting._style import _get_standard_colors

        # multiple colors like mediumaquamarine
        for c in colors.cnames:
            result = _get_standard_colors(num_colors=1, color=c)
            assert result == [c]

            result = _get_standard_colors(num_colors=1, color=[c])
            assert result == [c]

            result = _get_standard_colors(num_colors=3, color=c)
            assert result == [c] * 3

            result = _get_standard_colors(num_colors=3, color=[c])
            assert result == [c] * 3

        # single letter colors like k
        for c in colors.ColorConverter.colors:
            result = _get_standard_colors(num_colors=1, color=c)
            assert result == [c]

            result = _get_standard_colors(num_colors=1, color=[c])
            assert result == [c]

            result = _get_standard_colors(num_colors=3, color=c)
            assert result == [c] * 3

            result = _get_standard_colors(num_colors=3, color=[c])
            assert result == [c] * 3

    def test_series_plot_color_kwargs(self):
        # GH1890
        ax = Series(np.arange(12) + 1).plot(color='green')
        self._check_colors(ax.get_lines(), linecolors=['green'])

    def test_time_series_plot_color_kwargs(self):
        # #1890
        ax = Series(np.arange(12) + 1, index=date_range(
            '1/1/2000', periods=12)).plot(color='green')
        self._check_colors(ax.get_lines(), linecolors=['green'])

    def test_time_series_plot_color_with_empty_kwargs(self):
        import matplotlib as mpl

        if self.mpl_ge_1_5_0:
            def_colors = self._maybe_unpack_cycler(mpl.rcParams)
        else:
            def_colors = mpl.rcParams['axes.color_cycle']
        index = date_range('1/1/2000', periods=12)
        s = Series(np.arange(1, 13), index=index)

        ncolors = 3

        for i in range(ncolors):
            ax = s.plot()
        self._check_colors(ax.get_lines(), linecolors=def_colors[:ncolors])

    def test_xticklabels(self):
        # GH11529
        s = Series(np.arange(10), index=['P%02d' % i for i in range(10)])
        ax = s.plot(xticks=[0, 3, 5, 9])
        exp = ['P%02d' % i for i in [0, 3, 5, 9]]
        self._check_text_labels(ax.get_xticklabels(), exp)

    def test_custom_business_day_freq(self):
        # GH7222
        from pandas.tseries.offsets import CustomBusinessDay
        s = Series(range(100, 121), index=pd.bdate_range(
            start='2014-05-01', end='2014-06-01',
            freq=CustomBusinessDay(holidays=['2014-05-26'])))

        _check_plot_works(s.plot)
