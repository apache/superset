# coding: utf-8

""" Test cases for misc plot functions """

import pytest

from pandas import Series, DataFrame
from pandas.compat import lmap
import pandas.util.testing as tm
from pandas.util.testing import slow

import numpy as np
from numpy import random
from numpy.random import randn

import pandas.plotting as plotting
from pandas.tests.plotting.common import (TestPlotBase, _check_plot_works,
                                          _ok_for_gaussian_kde)

tm._skip_module_if_no_mpl()


class TestSeriesPlots(TestPlotBase):

    def setup_method(self, method):
        TestPlotBase.setup_method(self, method)
        import matplotlib as mpl
        mpl.rcdefaults()

        self.ts = tm.makeTimeSeries()
        self.ts.name = 'ts'

    @slow
    def test_autocorrelation_plot(self):
        from pandas.plotting import autocorrelation_plot
        _check_plot_works(autocorrelation_plot, series=self.ts)
        _check_plot_works(autocorrelation_plot, series=self.ts.values)

        ax = autocorrelation_plot(self.ts, label='Test')
        self._check_legend_labels(ax, labels=['Test'])

    @slow
    def test_lag_plot(self):
        from pandas.plotting import lag_plot
        _check_plot_works(lag_plot, series=self.ts)
        _check_plot_works(lag_plot, series=self.ts, lag=5)

    @slow
    def test_bootstrap_plot(self):
        from pandas.plotting import bootstrap_plot
        _check_plot_works(bootstrap_plot, series=self.ts, size=10)


class TestDataFramePlots(TestPlotBase):

    @slow
    def test_scatter_plot_legacy(self):
        tm._skip_if_no_scipy()

        df = DataFrame(randn(100, 2))

        def scat(**kwds):
            return plotting.scatter_matrix(df, **kwds)

        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat)
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, marker='+')
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, vmin=0)
        if _ok_for_gaussian_kde('kde'):
            with tm.assert_produces_warning(UserWarning):
                _check_plot_works(scat, diagonal='kde')
        if _ok_for_gaussian_kde('density'):
            with tm.assert_produces_warning(UserWarning):
                _check_plot_works(scat, diagonal='density')
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, diagonal='hist')
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, range_padding=.1)
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, color='rgb')
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, c='rgb')
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat, facecolor='rgb')

        def scat2(x, y, by=None, ax=None, figsize=None):
            return plotting._core.scatter_plot(df, x, y, by, ax, figsize=None)

        _check_plot_works(scat2, x=0, y=1)
        grouper = Series(np.repeat([1, 2, 3, 4, 5], 20), df.index)
        with tm.assert_produces_warning(UserWarning):
            _check_plot_works(scat2, x=0, y=1, by=grouper)

    def test_scatter_matrix_axis(self):
        tm._skip_if_no_scipy()
        scatter_matrix = plotting.scatter_matrix

        with tm.RNGContext(42):
            df = DataFrame(randn(100, 3))

        # we are plotting multiples on a sub-plot
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(scatter_matrix, filterwarnings='always',
                                     frame=df, range_padding=.1)
        axes0_labels = axes[0][0].yaxis.get_majorticklabels()

        # GH 5662
        if self.mpl_ge_2_0_0:
            expected = ['-2', '0', '2']
        else:
            expected = ['-2', '-1', '0', '1', '2']
        self._check_text_labels(axes0_labels, expected)
        self._check_ticks_props(
            axes, xlabelsize=8, xrot=90, ylabelsize=8, yrot=0)

        df[0] = ((df[0] - 2) / 3)

        # we are plotting multiples on a sub-plot
        with tm.assert_produces_warning(UserWarning):
            axes = _check_plot_works(scatter_matrix, filterwarnings='always',
                                     frame=df, range_padding=.1)
        axes0_labels = axes[0][0].yaxis.get_majorticklabels()
        if self.mpl_ge_2_0_0:
            expected = ['-1.0', '-0.5', '0.0']
        else:
            expected = ['-1.2', '-1.0', '-0.8', '-0.6', '-0.4', '-0.2', '0.0']
        self._check_text_labels(axes0_labels, expected)
        self._check_ticks_props(
            axes, xlabelsize=8, xrot=90, ylabelsize=8, yrot=0)

    @slow
    def test_andrews_curves(self):
        from pandas.plotting import andrews_curves
        from matplotlib import cm

        df = self.iris

        _check_plot_works(andrews_curves, frame=df, class_column='Name')

        rgba = ('#556270', '#4ECDC4', '#C7F464')
        ax = _check_plot_works(andrews_curves, frame=df,
                               class_column='Name', color=rgba)
        self._check_colors(
            ax.get_lines()[:10], linecolors=rgba, mapping=df['Name'][:10])

        cnames = ['dodgerblue', 'aquamarine', 'seagreen']
        ax = _check_plot_works(andrews_curves, frame=df,
                               class_column='Name', color=cnames)
        self._check_colors(
            ax.get_lines()[:10], linecolors=cnames, mapping=df['Name'][:10])

        ax = _check_plot_works(andrews_curves, frame=df,
                               class_column='Name', colormap=cm.jet)
        cmaps = lmap(cm.jet, np.linspace(0, 1, df['Name'].nunique()))
        self._check_colors(
            ax.get_lines()[:10], linecolors=cmaps, mapping=df['Name'][:10])

        length = 10
        df = DataFrame({"A": random.rand(length),
                        "B": random.rand(length),
                        "C": random.rand(length),
                        "Name": ["A"] * length})

        _check_plot_works(andrews_curves, frame=df, class_column='Name')

        rgba = ('#556270', '#4ECDC4', '#C7F464')
        ax = _check_plot_works(andrews_curves, frame=df,
                               class_column='Name', color=rgba)
        self._check_colors(
            ax.get_lines()[:10], linecolors=rgba, mapping=df['Name'][:10])

        cnames = ['dodgerblue', 'aquamarine', 'seagreen']
        ax = _check_plot_works(andrews_curves, frame=df,
                               class_column='Name', color=cnames)
        self._check_colors(
            ax.get_lines()[:10], linecolors=cnames, mapping=df['Name'][:10])

        ax = _check_plot_works(andrews_curves, frame=df,
                               class_column='Name', colormap=cm.jet)
        cmaps = lmap(cm.jet, np.linspace(0, 1, df['Name'].nunique()))
        self._check_colors(
            ax.get_lines()[:10], linecolors=cmaps, mapping=df['Name'][:10])

        colors = ['b', 'g', 'r']
        df = DataFrame({"A": [1, 2, 3],
                        "B": [1, 2, 3],
                        "C": [1, 2, 3],
                        "Name": colors})
        ax = andrews_curves(df, 'Name', color=colors)
        handles, labels = ax.get_legend_handles_labels()
        self._check_colors(handles, linecolors=colors)

        with tm.assert_produces_warning(FutureWarning):
            andrews_curves(data=df, class_column='Name')

    @slow
    def test_parallel_coordinates(self):
        from pandas.plotting import parallel_coordinates
        from matplotlib import cm

        df = self.iris

        ax = _check_plot_works(parallel_coordinates,
                               frame=df, class_column='Name')
        nlines = len(ax.get_lines())
        nxticks = len(ax.xaxis.get_ticklabels())

        rgba = ('#556270', '#4ECDC4', '#C7F464')
        ax = _check_plot_works(parallel_coordinates,
                               frame=df, class_column='Name', color=rgba)
        self._check_colors(
            ax.get_lines()[:10], linecolors=rgba, mapping=df['Name'][:10])

        cnames = ['dodgerblue', 'aquamarine', 'seagreen']
        ax = _check_plot_works(parallel_coordinates,
                               frame=df, class_column='Name', color=cnames)
        self._check_colors(
            ax.get_lines()[:10], linecolors=cnames, mapping=df['Name'][:10])

        ax = _check_plot_works(parallel_coordinates,
                               frame=df, class_column='Name', colormap=cm.jet)
        cmaps = lmap(cm.jet, np.linspace(0, 1, df['Name'].nunique()))
        self._check_colors(
            ax.get_lines()[:10], linecolors=cmaps, mapping=df['Name'][:10])

        ax = _check_plot_works(parallel_coordinates,
                               frame=df, class_column='Name', axvlines=False)
        assert len(ax.get_lines()) == (nlines - nxticks)

        colors = ['b', 'g', 'r']
        df = DataFrame({"A": [1, 2, 3],
                        "B": [1, 2, 3],
                        "C": [1, 2, 3],
                        "Name": colors})
        ax = parallel_coordinates(df, 'Name', color=colors)
        handles, labels = ax.get_legend_handles_labels()
        self._check_colors(handles, linecolors=colors)

        with tm.assert_produces_warning(FutureWarning):
            parallel_coordinates(data=df, class_column='Name')
        with tm.assert_produces_warning(FutureWarning):
            parallel_coordinates(df, 'Name', colors=colors)

    def test_parallel_coordinates_with_sorted_labels(self):
        """ For #15908 """
        from pandas.plotting import parallel_coordinates

        df = DataFrame({"feat": [i for i in range(30)],
                        "class": [2 for _ in range(10)] +
                        [3 for _ in range(10)] +
                        [1 for _ in range(10)]})
        ax = parallel_coordinates(df, 'class', sort_labels=True)
        polylines, labels = ax.get_legend_handles_labels()
        color_label_tuples = \
            zip([polyline.get_color() for polyline in polylines], labels)
        ordered_color_label_tuples = sorted(color_label_tuples,
                                            key=lambda x: x[1])
        prev_next_tupels = zip([i for i in ordered_color_label_tuples[0:-1]],
                               [i for i in ordered_color_label_tuples[1:]])
        for prev, nxt in prev_next_tupels:
            # lables and colors are ordered strictly increasing
            assert prev[1] < nxt[1] and prev[0] < nxt[0]

    @slow
    def test_radviz(self):
        from pandas.plotting import radviz
        from matplotlib import cm

        df = self.iris
        _check_plot_works(radviz, frame=df, class_column='Name')

        rgba = ('#556270', '#4ECDC4', '#C7F464')
        ax = _check_plot_works(
            radviz, frame=df, class_column='Name', color=rgba)
        # skip Circle drawn as ticks
        patches = [p for p in ax.patches[:20] if p.get_label() != '']
        self._check_colors(
            patches[:10], facecolors=rgba, mapping=df['Name'][:10])

        cnames = ['dodgerblue', 'aquamarine', 'seagreen']
        _check_plot_works(radviz, frame=df, class_column='Name', color=cnames)
        patches = [p for p in ax.patches[:20] if p.get_label() != '']
        self._check_colors(patches, facecolors=cnames, mapping=df['Name'][:10])

        _check_plot_works(radviz, frame=df,
                          class_column='Name', colormap=cm.jet)
        cmaps = lmap(cm.jet, np.linspace(0, 1, df['Name'].nunique()))
        patches = [p for p in ax.patches[:20] if p.get_label() != '']
        self._check_colors(patches, facecolors=cmaps, mapping=df['Name'][:10])

        colors = [[0., 0., 1., 1.],
                  [0., 0.5, 1., 1.],
                  [1., 0., 0., 1.]]
        df = DataFrame({"A": [1, 2, 3],
                        "B": [2, 1, 3],
                        "C": [3, 2, 1],
                        "Name": ['b', 'g', 'r']})
        ax = radviz(df, 'Name', color=colors)
        handles, labels = ax.get_legend_handles_labels()
        self._check_colors(handles, facecolors=colors)

    @slow
    def test_subplot_titles(self):
        df = self.iris.drop('Name', axis=1).head()
        # Use the column names as the subplot titles
        title = list(df.columns)

        # Case len(title) == len(df)
        plot = df.plot(subplots=True, title=title)
        assert [p.get_title() for p in plot] == title

        # Case len(title) > len(df)
        pytest.raises(ValueError, df.plot, subplots=True,
                      title=title + ["kittens > puppies"])

        # Case len(title) < len(df)
        pytest.raises(ValueError, df.plot, subplots=True, title=title[:2])

        # Case subplots=False and title is of type list
        pytest.raises(ValueError, df.plot, subplots=False, title=title)

        # Case df with 3 numeric columns but layout of (2,2)
        plot = df.drop('SepalWidth', axis=1).plot(subplots=True, layout=(2, 2),
                                                  title=title[:-1])
        title_list = [ax.get_title() for sublist in plot for ax in sublist]
        assert title_list == title[:3] + ['']
