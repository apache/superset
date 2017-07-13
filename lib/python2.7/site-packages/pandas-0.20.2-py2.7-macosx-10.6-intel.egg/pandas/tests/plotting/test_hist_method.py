# coding: utf-8

""" Test cases for .hist method """

import pytest

from pandas import Series, DataFrame
import pandas.util.testing as tm
from pandas.util.testing import slow

import numpy as np
from numpy.random import randn

from pandas.plotting._core import grouped_hist
from pandas.tests.plotting.common import (TestPlotBase, _check_plot_works)


tm._skip_module_if_no_mpl()


class TestSeriesPlots(TestPlotBase):

    def setup_method(self, method):
        TestPlotBase.setup_method(self, method)
        import matplotlib as mpl
        mpl.rcdefaults()

        self.ts = tm.makeTimeSeries()
        self.ts.name = 'ts'

    @slow
    def test_hist_legacy(self):
        _check_plot_works(self.ts.hist)
        _check_plot_works(self.ts.hist, grid=False)
        _check_plot_works(self.ts.hist, figsize=(8, 10))
        # _check_plot_works adds an ax so catch warning. see GH #13188
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(self.ts.hist, by=self.ts.index.month)
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(self.ts.hist, by=self.ts.index.month, bins=5)

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

        # _check_plot_works adds an `ax` kwarg to the method call
        # so we get a warning about an axis being cleared, even
        # though we don't explicing pass one, see GH #13188
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist, by=df.gender,
                                     layout=(2, 1))
        self._check_axes_shape(axes, axes_num=2, layout=(2, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist, by=df.gender,
                                     layout=(3, -1))
        self._check_axes_shape(axes, axes_num=2, layout=(3, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.height.hist, by=df.category,
                                     layout=(4, 1))
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(
                df.height.hist, by=df.category, layout=(2, -1))
        self._check_axes_shape(axes, axes_num=4, layout=(2, 2))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(
                df.height.hist, by=df.category, layout=(3, -1))
        self._check_axes_shape(axes, axes_num=4, layout=(3, 2))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(
                df.height.hist, by=df.category, layout=(-1, 4))
        self._check_axes_shape(axes, axes_num=4, layout=(1, 4))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(
                df.height.hist, by=df.classroom, layout=(2, 2))
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))

        axes = df.height.hist(by=df.category, layout=(4, 2), figsize=(12, 7))
        self._check_axes_shape(
            axes, axes_num=4, layout=(4, 2), figsize=(12, 7))

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
    def test_hist_by_no_extra_plots(self):
        df = self.hist_df
        axes = df.height.hist(by=df.gender)  # noqa
        assert len(self.plt.get_fignums()) == 1

    @slow
    def test_plot_fails_when_ax_differs_from_figure(self):
        from pylab import figure
        fig1 = figure()
        fig2 = figure()
        ax1 = fig1.add_subplot(111)
        with pytest.raises(AssertionError):
            self.ts.hist(ax=ax1, figure=fig2)


class TestDataFramePlots(TestPlotBase):

    @slow
    def test_hist_df_legacy(self):
        from matplotlib.patches import Rectangle
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(self.hist_df.hist)

        # make sure layout is handled
        df = DataFrame(randn(100, 3))
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.hist, grid=False)
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))
        assert not axes[1, 1].get_visible()

        df = DataFrame(randn(100, 1))
        _check_plot_works(df.hist)

        # make sure layout is handled
        df = DataFrame(randn(100, 6))
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.hist, layout=(4, 2))
        self._check_axes_shape(axes, axes_num=6, layout=(4, 2))

        # make sure sharex, sharey is handled
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(df.hist, sharex=True, sharey=True)

        # handle figsize arg
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(df.hist, figsize=(8, 10))

        # check bins argument
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(df.hist, bins=5)

        # make sure xlabelsize and xrot are handled
        ser = df[0]
        xf, yf = 20, 18
        xrot, yrot = 30, 40
        axes = ser.hist(xlabelsize=xf, xrot=xrot, ylabelsize=yf, yrot=yrot)
        self._check_ticks_props(axes, xlabelsize=xf, xrot=xrot,
                                ylabelsize=yf, yrot=yrot)

        xf, yf = 20, 18
        xrot, yrot = 30, 40
        axes = df.hist(xlabelsize=xf, xrot=xrot, ylabelsize=yf, yrot=yrot)
        self._check_ticks_props(axes, xlabelsize=xf, xrot=xrot,
                                ylabelsize=yf, yrot=yrot)

        tm.close()
        # make sure kwargs to hist are handled
        ax = ser.hist(normed=True, cumulative=True, bins=4)
        # height of last bin (index 5) must be 1.0
        rects = [x for x in ax.get_children() if isinstance(x, Rectangle)]
        tm.assert_almost_equal(rects[-1].get_height(), 1.0)

        tm.close()
        ax = ser.hist(log=True)
        # scale of y must be 'log'
        self._check_ax_scales(ax, yaxis='log')

        tm.close()

        # propagate attr exception from matplotlib.Axes.hist
        with pytest.raises(AttributeError):
            ser.hist(foo='bar')

    @slow
    def test_hist_layout(self):
        df = DataFrame(randn(100, 3))

        layout_to_expected_size = (
            {'layout': None, 'expected_size': (2, 2)},  # default is 2x2
            {'layout': (2, 2), 'expected_size': (2, 2)},
            {'layout': (4, 1), 'expected_size': (4, 1)},
            {'layout': (1, 4), 'expected_size': (1, 4)},
            {'layout': (3, 3), 'expected_size': (3, 3)},
            {'layout': (-1, 4), 'expected_size': (1, 4)},
            {'layout': (4, -1), 'expected_size': (4, 1)},
            {'layout': (-1, 2), 'expected_size': (2, 2)},
            {'layout': (2, -1), 'expected_size': (2, 2)}
        )

        for layout_test in layout_to_expected_size:
            axes = df.hist(layout=layout_test['layout'])
            expected = layout_test['expected_size']
            self._check_axes_shape(axes, axes_num=3, layout=expected)

        # layout too small for all 4 plots
        with pytest.raises(ValueError):
            df.hist(layout=(1, 1))

        # invalid format for layout
        with pytest.raises(ValueError):
            df.hist(layout=(1,))
        with pytest.raises(ValueError):
            df.hist(layout=(-1, -1))

    @slow
    # GH 9351
    def test_tight_layout(self):
        if self.mpl_ge_2_0_1:
            df = DataFrame(randn(100, 3))
            _check_plot_works(df.hist)
            self.plt.tight_layout()

            tm.close()


class TestDataFrameGroupByPlots(TestPlotBase):

    @slow
    def test_grouped_hist_legacy(self):
        from matplotlib.patches import Rectangle

        df = DataFrame(randn(500, 2), columns=['A', 'B'])
        df['C'] = np.random.randint(0, 4, 500)
        df['D'] = ['X'] * 500

        axes = grouped_hist(df.A, by=df.C)
        self._check_axes_shape(axes, axes_num=4, layout=(2, 2))

        tm.close()
        axes = df.hist(by=df.C)
        self._check_axes_shape(axes, axes_num=4, layout=(2, 2))

        tm.close()
        # group by a key with single value
        axes = df.hist(by='D', rot=30)
        self._check_axes_shape(axes, axes_num=1, layout=(1, 1))
        self._check_ticks_props(axes, xrot=30)

        tm.close()
        # make sure kwargs to hist are handled
        xf, yf = 20, 18
        xrot, yrot = 30, 40
        axes = grouped_hist(df.A, by=df.C, normed=True, cumulative=True,
                            bins=4, xlabelsize=xf, xrot=xrot,
                            ylabelsize=yf, yrot=yrot)
        # height of last bin (index 5) must be 1.0
        for ax in axes.ravel():
            rects = [x for x in ax.get_children() if isinstance(x, Rectangle)]
            height = rects[-1].get_height()
            tm.assert_almost_equal(height, 1.0)
        self._check_ticks_props(axes, xlabelsize=xf, xrot=xrot,
                                ylabelsize=yf, yrot=yrot)

        tm.close()
        axes = grouped_hist(df.A, by=df.C, log=True)
        # scale of y must be 'log'
        self._check_ax_scales(axes, yaxis='log')

        tm.close()
        # propagate attr exception from matplotlib.Axes.hist
        with pytest.raises(AttributeError):
            grouped_hist(df.A, by=df.C, foo='bar')

        with tm.assert_produces_warning(FutureWarning):
            df.hist(by='C', figsize='default')

    @slow
    def test_grouped_hist_legacy2(self):
        n = 10
        weight = Series(np.random.normal(166, 20, size=n))
        height = Series(np.random.normal(60, 10, size=n))
        with tm.RNGContext(42):
            gender_int = np.random.choice([0, 1], size=n)
        df_int = DataFrame({'height': height, 'weight': weight,
                            'gender': gender_int})
        gb = df_int.groupby('gender')
        axes = gb.hist()
        assert len(axes) == 2
        assert len(self.plt.get_fignums()) == 2
        tm.close()

    @slow
    def test_grouped_hist_layout(self):
        df = self.hist_df
        pytest.raises(ValueError, df.hist, column='weight', by=df.gender,
                      layout=(1, 1))
        pytest.raises(ValueError, df.hist, column='height', by=df.category,
                      layout=(1, 3))
        pytest.raises(ValueError, df.hist, column='height', by=df.category,
                      layout=(-1, -1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.hist, column='height', by=df.gender,
                                     layout=(2, 1))
        self._check_axes_shape(axes, axes_num=2, layout=(2, 1))

        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.hist, column='height', by=df.gender,
                                     layout=(2, -1))
        self._check_axes_shape(axes, axes_num=2, layout=(2, 1))

        axes = df.hist(column='height', by=df.category, layout=(4, 1))
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        axes = df.hist(column='height', by=df.category, layout=(-1, 1))
        self._check_axes_shape(axes, axes_num=4, layout=(4, 1))

        axes = df.hist(column='height', by=df.category,
                       layout=(4, 2), figsize=(12, 8))
        self._check_axes_shape(
            axes, axes_num=4, layout=(4, 2), figsize=(12, 8))
        tm.close()

        # GH 6769
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(
                df.hist, column='height', by='classroom', layout=(2, 2))
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))

        # without column
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(df.hist, by='classroom')
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))

        axes = df.hist(by='gender', layout=(3, 5))
        self._check_axes_shape(axes, axes_num=2, layout=(3, 5))

        axes = df.hist(column=['height', 'weight', 'category'])
        self._check_axes_shape(axes, axes_num=3, layout=(2, 2))

    @slow
    def test_grouped_hist_multiple_axes(self):
        # GH 6970, GH 7069
        df = self.hist_df

        fig, axes = self.plt.subplots(2, 3)
        returned = df.hist(column=['height', 'weight', 'category'], ax=axes[0])
        self._check_axes_shape(returned, axes_num=3, layout=(1, 3))
        tm.assert_numpy_array_equal(returned, axes[0])
        assert returned[0].figure is fig
        returned = df.hist(by='classroom', ax=axes[1])
        self._check_axes_shape(returned, axes_num=3, layout=(1, 3))
        tm.assert_numpy_array_equal(returned, axes[1])
        assert returned[0].figure is fig

        with pytest.raises(ValueError):
            fig, axes = self.plt.subplots(2, 3)
            # pass different number of axes from required
            axes = df.hist(column='height', ax=axes)

    @slow
    def test_axis_share_x(self):
        df = self.hist_df
        # GH4089
        ax1, ax2 = df.hist(column='height', by=df.gender, sharex=True)

        # share x
        assert ax1._shared_x_axes.joined(ax1, ax2)
        assert ax2._shared_x_axes.joined(ax1, ax2)

        # don't share y
        assert not ax1._shared_y_axes.joined(ax1, ax2)
        assert not ax2._shared_y_axes.joined(ax1, ax2)

    @slow
    def test_axis_share_y(self):
        df = self.hist_df
        ax1, ax2 = df.hist(column='height', by=df.gender, sharey=True)

        # share y
        assert ax1._shared_y_axes.joined(ax1, ax2)
        assert ax2._shared_y_axes.joined(ax1, ax2)

        # don't share x
        assert not ax1._shared_x_axes.joined(ax1, ax2)
        assert not ax2._shared_x_axes.joined(ax1, ax2)

    @slow
    def test_axis_share_xy(self):
        df = self.hist_df
        ax1, ax2 = df.hist(column='height', by=df.gender, sharex=True,
                           sharey=True)

        # share both x and y
        assert ax1._shared_x_axes.joined(ax1, ax2)
        assert ax2._shared_x_axes.joined(ax1, ax2)

        assert ax1._shared_y_axes.joined(ax1, ax2)
        assert ax2._shared_y_axes.joined(ax1, ax2)
