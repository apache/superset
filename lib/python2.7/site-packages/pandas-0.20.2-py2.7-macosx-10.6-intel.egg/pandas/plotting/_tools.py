# being a bit too dynamic
# pylint: disable=E1101
from __future__ import division

import warnings
from math import ceil

import numpy as np

from pandas.core.dtypes.common import is_list_like
from pandas.core.index import Index
from pandas.core.series import Series
from pandas.compat import range


def format_date_labels(ax, rot):
    # mini version of autofmt_xdate
    try:
        for label in ax.get_xticklabels():
            label.set_ha('right')
            label.set_rotation(rot)
        fig = ax.get_figure()
        fig.subplots_adjust(bottom=0.2)
    except Exception:  # pragma: no cover
        pass


def table(ax, data, rowLabels=None, colLabels=None,
          **kwargs):
    """
    Helper function to convert DataFrame and Series to matplotlib.table

    Parameters
    ----------
    `ax`: Matplotlib axes object
    `data`: DataFrame or Series
        data for table contents
    `kwargs`: keywords, optional
        keyword arguments which passed to matplotlib.table.table.
        If `rowLabels` or `colLabels` is not specified, data index or column
        name will be used.

    Returns
    -------
    matplotlib table object
    """
    from pandas import DataFrame
    if isinstance(data, Series):
        data = DataFrame(data, columns=[data.name])
    elif isinstance(data, DataFrame):
        pass
    else:
        raise ValueError('Input data must be DataFrame or Series')

    if rowLabels is None:
        rowLabels = data.index

    if colLabels is None:
        colLabels = data.columns

    cellText = data.values

    import matplotlib.table
    table = matplotlib.table.table(ax, cellText=cellText,
                                   rowLabels=rowLabels,
                                   colLabels=colLabels, **kwargs)
    return table


def _get_layout(nplots, layout=None, layout_type='box'):
    if layout is not None:
        if not isinstance(layout, (tuple, list)) or len(layout) != 2:
            raise ValueError('Layout must be a tuple of (rows, columns)')

        nrows, ncols = layout

        # Python 2 compat
        ceil_ = lambda x: int(ceil(x))
        if nrows == -1 and ncols > 0:
            layout = nrows, ncols = (ceil_(float(nplots) / ncols), ncols)
        elif ncols == -1 and nrows > 0:
            layout = nrows, ncols = (nrows, ceil_(float(nplots) / nrows))
        elif ncols <= 0 and nrows <= 0:
            msg = "At least one dimension of layout must be positive"
            raise ValueError(msg)

        if nrows * ncols < nplots:
            raise ValueError('Layout of %sx%s must be larger than '
                             'required size %s' % (nrows, ncols, nplots))

        return layout

    if layout_type == 'single':
        return (1, 1)
    elif layout_type == 'horizontal':
        return (1, nplots)
    elif layout_type == 'vertical':
        return (nplots, 1)

    layouts = {1: (1, 1), 2: (1, 2), 3: (2, 2), 4: (2, 2)}
    try:
        return layouts[nplots]
    except KeyError:
        k = 1
        while k ** 2 < nplots:
            k += 1

        if (k - 1) * k >= nplots:
            return k, (k - 1)
        else:
            return k, k

# copied from matplotlib/pyplot.py and modified for pandas.plotting


def _subplots(naxes=None, sharex=False, sharey=False, squeeze=True,
              subplot_kw=None, ax=None, layout=None, layout_type='box',
              **fig_kw):
    """Create a figure with a set of subplots already made.

    This utility wrapper makes it convenient to create common layouts of
    subplots, including the enclosing figure object, in a single call.

    Keyword arguments:

    naxes : int
      Number of required axes. Exceeded axes are set invisible. Default is
      nrows * ncols.

    sharex : bool
      If True, the X axis will be shared amongst all subplots.

    sharey : bool
      If True, the Y axis will be shared amongst all subplots.

    squeeze : bool

      If True, extra dimensions are squeezed out from the returned axis object:
        - if only one subplot is constructed (nrows=ncols=1), the resulting
        single Axis object is returned as a scalar.
        - for Nx1 or 1xN subplots, the returned object is a 1-d numpy object
        array of Axis objects are returned as numpy 1-d arrays.
        - for NxM subplots with N>1 and M>1 are returned as a 2d array.

      If False, no squeezing at all is done: the returned axis object is always
      a 2-d array containing Axis instances, even if it ends up being 1x1.

    subplot_kw : dict
      Dict with keywords passed to the add_subplot() call used to create each
      subplots.

    ax : Matplotlib axis object, optional

    layout : tuple
      Number of rows and columns of the subplot grid.
      If not specified, calculated from naxes and layout_type

    layout_type : {'box', 'horziontal', 'vertical'}, default 'box'
      Specify how to layout the subplot grid.

    fig_kw : Other keyword arguments to be passed to the figure() call.
        Note that all keywords not recognized above will be
        automatically included here.

    Returns:

    fig, ax : tuple
      - fig is the Matplotlib Figure object
      - ax can be either a single axis object or an array of axis objects if
      more than one subplot was created.  The dimensions of the resulting array
      can be controlled with the squeeze keyword, see above.

    **Examples:**

    x = np.linspace(0, 2*np.pi, 400)
    y = np.sin(x**2)

    # Just a figure and one subplot
    f, ax = plt.subplots()
    ax.plot(x, y)
    ax.set_title('Simple plot')

    # Two subplots, unpack the output array immediately
    f, (ax1, ax2) = plt.subplots(1, 2, sharey=True)
    ax1.plot(x, y)
    ax1.set_title('Sharing Y axis')
    ax2.scatter(x, y)

    # Four polar axes
    plt.subplots(2, 2, subplot_kw=dict(polar=True))
    """
    import matplotlib.pyplot as plt

    if subplot_kw is None:
        subplot_kw = {}

    if ax is None:
        fig = plt.figure(**fig_kw)
    else:
        if is_list_like(ax):
            ax = _flatten(ax)
            if layout is not None:
                warnings.warn("When passing multiple axes, layout keyword is "
                              "ignored", UserWarning)
            if sharex or sharey:
                warnings.warn("When passing multiple axes, sharex and sharey "
                              "are ignored. These settings must be specified "
                              "when creating axes", UserWarning,
                              stacklevel=4)
            if len(ax) == naxes:
                fig = ax[0].get_figure()
                return fig, ax
            else:
                raise ValueError("The number of passed axes must be {0}, the "
                                 "same as the output plot".format(naxes))

        fig = ax.get_figure()
        # if ax is passed and a number of subplots is 1, return ax as it is
        if naxes == 1:
            if squeeze:
                return fig, ax
            else:
                return fig, _flatten(ax)
        else:
            warnings.warn("To output multiple subplots, the figure containing "
                          "the passed axes is being cleared", UserWarning,
                          stacklevel=4)
            fig.clear()

    nrows, ncols = _get_layout(naxes, layout=layout, layout_type=layout_type)
    nplots = nrows * ncols

    # Create empty object array to hold all axes.  It's easiest to make it 1-d
    # so we can just append subplots upon creation, and then
    axarr = np.empty(nplots, dtype=object)

    # Create first subplot separately, so we can share it if requested
    ax0 = fig.add_subplot(nrows, ncols, 1, **subplot_kw)

    if sharex:
        subplot_kw['sharex'] = ax0
    if sharey:
        subplot_kw['sharey'] = ax0
    axarr[0] = ax0

    # Note off-by-one counting because add_subplot uses the MATLAB 1-based
    # convention.
    for i in range(1, nplots):
        kwds = subplot_kw.copy()
        # Set sharex and sharey to None for blank/dummy axes, these can
        # interfere with proper axis limits on the visible axes if
        # they share axes e.g. issue #7528
        if i >= naxes:
            kwds['sharex'] = None
            kwds['sharey'] = None
        ax = fig.add_subplot(nrows, ncols, i + 1, **kwds)
        axarr[i] = ax

    if naxes != nplots:
        for ax in axarr[naxes:]:
            ax.set_visible(False)

    _handle_shared_axes(axarr, nplots, naxes, nrows, ncols, sharex, sharey)

    if squeeze:
        # Reshape the array to have the final desired dimension (nrow,ncol),
        # though discarding unneeded dimensions that equal 1.  If we only have
        # one subplot, just return it instead of a 1-element array.
        if nplots == 1:
            axes = axarr[0]
        else:
            axes = axarr.reshape(nrows, ncols).squeeze()
    else:
        # returned axis array will be always 2-d, even if nrows=ncols=1
        axes = axarr.reshape(nrows, ncols)

    return fig, axes


def _remove_labels_from_axis(axis):
    for t in axis.get_majorticklabels():
        t.set_visible(False)

    try:
        # set_visible will not be effective if
        # minor axis has NullLocator and NullFormattor (default)
        import matplotlib.ticker as ticker
        if isinstance(axis.get_minor_locator(), ticker.NullLocator):
            axis.set_minor_locator(ticker.AutoLocator())
        if isinstance(axis.get_minor_formatter(), ticker.NullFormatter):
            axis.set_minor_formatter(ticker.FormatStrFormatter(''))
        for t in axis.get_minorticklabels():
            t.set_visible(False)
    except Exception:   # pragma no cover
        raise
    axis.get_label().set_visible(False)


def _handle_shared_axes(axarr, nplots, naxes, nrows, ncols, sharex, sharey):
    if nplots > 1:

        if nrows > 1:
            try:
                # first find out the ax layout,
                # so that we can correctly handle 'gaps"
                layout = np.zeros((nrows + 1, ncols + 1), dtype=np.bool)
                for ax in axarr:
                    layout[ax.rowNum, ax.colNum] = ax.get_visible()

                for ax in axarr:
                    # only the last row of subplots should get x labels -> all
                    # other off layout handles the case that the subplot is
                    # the last in the column, because below is no subplot/gap.
                    if not layout[ax.rowNum + 1, ax.colNum]:
                        continue
                    if sharex or len(ax.get_shared_x_axes()
                                     .get_siblings(ax)) > 1:
                        _remove_labels_from_axis(ax.xaxis)

            except IndexError:
                # if gridspec is used, ax.rowNum and ax.colNum may different
                # from layout shape. in this case, use last_row logic
                for ax in axarr:
                    if ax.is_last_row():
                        continue
                    if sharex or len(ax.get_shared_x_axes()
                                     .get_siblings(ax)) > 1:
                        _remove_labels_from_axis(ax.xaxis)

        if ncols > 1:
            for ax in axarr:
                # only the first column should get y labels -> set all other to
                # off as we only have labels in teh first column and we always
                # have a subplot there, we can skip the layout test
                if ax.is_first_col():
                    continue
                if sharey or len(ax.get_shared_y_axes().get_siblings(ax)) > 1:
                    _remove_labels_from_axis(ax.yaxis)


def _flatten(axes):
    if not is_list_like(axes):
        return np.array([axes])
    elif isinstance(axes, (np.ndarray, Index)):
        return axes.ravel()
    return np.array(axes)


def _get_all_lines(ax):
    lines = ax.get_lines()

    if hasattr(ax, 'right_ax'):
        lines += ax.right_ax.get_lines()

    if hasattr(ax, 'left_ax'):
        lines += ax.left_ax.get_lines()

    return lines


def _get_xlim(lines):
    left, right = np.inf, -np.inf
    for l in lines:
        x = l.get_xdata(orig=False)
        left = min(x[0], left)
        right = max(x[-1], right)
    return left, right


def _set_ticks_props(axes, xlabelsize=None, xrot=None,
                     ylabelsize=None, yrot=None):
    import matplotlib.pyplot as plt

    for ax in _flatten(axes):
        if xlabelsize is not None:
            plt.setp(ax.get_xticklabels(), fontsize=xlabelsize)
        if xrot is not None:
            plt.setp(ax.get_xticklabels(), rotation=xrot)
        if ylabelsize is not None:
            plt.setp(ax.get_yticklabels(), fontsize=ylabelsize)
        if yrot is not None:
            plt.setp(ax.get_yticklabels(), rotation=yrot)
    return axes
