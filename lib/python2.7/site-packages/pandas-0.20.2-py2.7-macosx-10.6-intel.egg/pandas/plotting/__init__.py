"""
Plotting api
"""

# flake8: noqa

try:  # mpl optional
    from pandas.plotting import _converter
    _converter.register()  # needs to override so set_xlim works with str/number
except ImportError:
    pass

from pandas.plotting._misc import (scatter_matrix, radviz,
                                   andrews_curves, bootstrap_plot,
                                   parallel_coordinates, lag_plot,
                                   autocorrelation_plot)
from pandas.plotting._core import boxplot
from pandas.plotting._style import plot_params
from pandas.plotting._tools import table
