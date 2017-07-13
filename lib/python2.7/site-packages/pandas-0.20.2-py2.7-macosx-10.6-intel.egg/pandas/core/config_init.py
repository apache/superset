"""
This module is imported from the pandas package __init__.py file
in order to ensure that the core.config options registered here will
be available as soon as the user loads the package. if register_option
is invoked inside specific modules, they will not be registered until that
module is imported, which may or may not be a problem.

If you need to make sure options are available even before a certain
module is imported, register them here rather then in the module.

"""
import warnings

import pandas.core.config as cf
from pandas.core.config import (is_int, is_bool, is_text, is_instance_factory,
                                is_one_of_factory, get_default_val,
                                is_callable)
from pandas.io.formats.console import detect_console_encoding

# compute

use_bottleneck_doc = """
: bool
    Use the bottleneck library to accelerate if it is installed,
    the default is True
    Valid values: False,True
"""


def use_bottleneck_cb(key):
    from pandas.core import nanops
    nanops.set_use_bottleneck(cf.get_option(key))


use_numexpr_doc = """
: bool
    Use the numexpr library to accelerate computation if it is installed,
    the default is True
    Valid values: False,True
"""


def use_numexpr_cb(key):
    from pandas.core.computation import expressions
    expressions.set_use_numexpr(cf.get_option(key))


with cf.config_prefix('compute'):
    cf.register_option('use_bottleneck', True, use_bottleneck_doc,
                       validator=is_bool, cb=use_bottleneck_cb)
    cf.register_option('use_numexpr', True, use_numexpr_doc,
                       validator=is_bool, cb=use_numexpr_cb)
#
# options from the "display" namespace

pc_precision_doc = """
: int
    Floating point output precision (number of significant digits). This is
    only a suggestion
"""

pc_colspace_doc = """
: int
    Default space for DataFrame columns.
"""

pc_max_rows_doc = """
: int
    If max_rows is exceeded, switch to truncate view. Depending on
    `large_repr`, objects are either centrally truncated or printed as
    a summary view. 'None' value means unlimited.

    In case python/IPython is running in a terminal and `large_repr`
    equals 'truncate' this can be set to 0 and pandas will auto-detect
    the height of the terminal and print a truncated object which fits
    the screen height. The IPython notebook, IPython qtconsole, or
    IDLE do not run in a terminal and hence it is not possible to do
    correct auto-detection.
"""

pc_max_cols_doc = """
: int
    If max_cols is exceeded, switch to truncate view. Depending on
    `large_repr`, objects are either centrally truncated or printed as
    a summary view. 'None' value means unlimited.

    In case python/IPython is running in a terminal and `large_repr`
    equals 'truncate' this can be set to 0 and pandas will auto-detect
    the width of the terminal and print a truncated object which fits
    the screen width. The IPython notebook, IPython qtconsole, or IDLE
    do not run in a terminal and hence it is not possible to do
    correct auto-detection.
"""

pc_max_categories_doc = """
: int
    This sets the maximum number of categories pandas should output when
    printing out a `Categorical` or a Series of dtype "category".
"""

pc_max_info_cols_doc = """
: int
    max_info_columns is used in DataFrame.info method to decide if
    per column information will be printed.
"""

pc_nb_repr_h_doc = """
: boolean
    When True, IPython notebook will use html representation for
    pandas objects (if it is available).
"""

pc_date_dayfirst_doc = """
: boolean
    When True, prints and parses dates with the day first, eg 20/01/2005
"""

pc_date_yearfirst_doc = """
: boolean
    When True, prints and parses dates with the year first, eg 2005/01/20
"""

pc_pprint_nest_depth = """
: int
    Controls the number of nested levels to process when pretty-printing
"""

pc_multi_sparse_doc = """
: boolean
    "sparsify" MultiIndex display (don't display repeated
    elements in outer levels within groups)
"""

pc_encoding_doc = """
: str/unicode
    Defaults to the detected encoding of the console.
    Specifies the encoding to be used for strings returned by to_string,
    these are generally strings meant to be displayed on the console.
"""

float_format_doc = """
: callable
    The callable should accept a floating point number and return
    a string with the desired format of the number. This is used
    in some places like SeriesFormatter.
    See formats.format.EngFormatter for an example.
"""

max_colwidth_doc = """
: int
    The maximum width in characters of a column in the repr of
    a pandas data structure. When the column overflows, a "..."
    placeholder is embedded in the output.
"""

colheader_justify_doc = """
: 'left'/'right'
    Controls the justification of column headers. used by DataFrameFormatter.
"""

pc_expand_repr_doc = """
: boolean
    Whether to print out the full DataFrame repr for wide DataFrames across
    multiple lines, `max_columns` is still respected, but the output will
    wrap-around across multiple "pages" if its width exceeds `display.width`.
"""

pc_show_dimensions_doc = """
: boolean or 'truncate'
    Whether to print out dimensions at the end of DataFrame repr.
    If 'truncate' is specified, only print out the dimensions if the
    frame is truncated (e.g. not display all rows and/or columns)
"""

pc_line_width_doc = """
: int
    Deprecated.
"""

pc_east_asian_width_doc = """
: boolean
    Whether to use the Unicode East Asian Width to calculate the display text
    width.
    Enabling this may affect to the performance (default: False)
"""

pc_ambiguous_as_wide_doc = """
: boolean
    Whether to handle Unicode characters belong to Ambiguous as Wide (width=2)
    (default: False)
"""

pc_latex_repr_doc = """
: boolean
    Whether to produce a latex DataFrame representation for jupyter
    environments that support it.
    (default: False)
"""

pc_table_schema_doc = """
: boolean
    Whether to publish a Table Schema representation for frontends
    that support it.
    (default: False)
"""

pc_line_width_deprecation_warning = """\
line_width has been deprecated, use display.width instead (currently both are
identical)
"""

pc_height_deprecation_warning = """\
height has been deprecated.
"""

pc_width_doc = """
: int
    Width of the display in characters. In case python/IPython is running in
    a terminal this can be set to None and pandas will correctly auto-detect
    the width.
    Note that the IPython notebook, IPython qtconsole, or IDLE do not run in a
    terminal and hence it is not possible to correctly detect the width.
"""

pc_height_doc = """
: int
    Deprecated.
"""

pc_chop_threshold_doc = """
: float or None
    if set to a float value, all float values smaller then the given threshold
    will be displayed as exactly 0 by repr and friends.
"""

pc_max_seq_items = """
: int or None
    when pretty-printing a long sequence, no more then `max_seq_items`
    will be printed. If items are omitted, they will be denoted by the
    addition of "..." to the resulting string.

    If set to None, the number of items to be printed is unlimited.
"""

pc_max_info_rows_doc = """
: int or None
    df.info() will usually show null-counts for each column.
    For large frames this can be quite slow. max_info_rows and max_info_cols
    limit this null check only to frames with smaller dimensions than
    specified.
"""

pc_large_repr_doc = """
: 'truncate'/'info'
    For DataFrames exceeding max_rows/max_cols, the repr (and HTML repr) can
    show a truncated table (the default from 0.13), or switch to the view from
    df.info() (the behaviour in earlier versions of pandas).
"""

pc_mpl_style_doc = """
: bool
    Setting this to 'default' will modify the rcParams used by matplotlib
    to give plots a more pleasing visual style by default.
    Setting this to None/False restores the values to their initial value.
"""

pc_mpl_style_deprecation_warning = """
mpl_style had been deprecated and will be removed in a future version.
Use `matplotlib.pyplot.style.use` instead.
"""

pc_memory_usage_doc = """
: bool, string or None
    This specifies if the memory usage of a DataFrame should be displayed when
    df.info() is called. Valid values True,False,'deep'
"""

pc_latex_escape = """
: bool
    This specifies if the to_latex method of a Dataframe uses escapes special
    characters.
    Valid values: False,True
"""

pc_latex_longtable = """
:bool
    This specifies if the to_latex method of a Dataframe uses the longtable
    format.
    Valid values: False,True
"""

pc_latex_multicolumn = """
: bool
    This specifies if the to_latex method of a Dataframe uses multicolumns
    to pretty-print MultiIndex columns.
    Valid values: False,True
"""

pc_latex_multicolumn_format = """
: string
    This specifies the format for multicolumn headers.
    Can be surrounded with '|'.
    Valid values: 'l', 'c', 'r', 'p{<width>}'
"""

pc_latex_multirow = """
: bool
    This specifies if the to_latex method of a Dataframe uses multirows
    to pretty-print MultiIndex rows.
    Valid values: False,True
"""

style_backup = dict()


def mpl_style_cb(key):
    warnings.warn(pc_mpl_style_deprecation_warning, FutureWarning,
                  stacklevel=5)

    import sys
    from pandas.plotting._style import mpl_stylesheet
    global style_backup

    val = cf.get_option(key)

    if 'matplotlib' not in sys.modules.keys():
        if not val:  # starting up, we get reset to None
            return val
        raise Exception("matplotlib has not been imported. aborting")

    import matplotlib.pyplot as plt

    if val == 'default':
        style_backup = dict([(k, plt.rcParams[k]) for k in mpl_stylesheet])
        plt.rcParams.update(mpl_stylesheet)
    elif not val:
        if style_backup:
            plt.rcParams.update(style_backup)

    return val


def table_schema_cb(key):
    from pandas.io.formats.printing import _enable_data_resource_formatter
    _enable_data_resource_formatter(cf.get_option(key))


with cf.config_prefix('display'):
    cf.register_option('precision', 6, pc_precision_doc, validator=is_int)
    cf.register_option('float_format', None, float_format_doc,
                       validator=is_one_of_factory([None, is_callable]))
    cf.register_option('column_space', 12, validator=is_int)
    cf.register_option('max_info_rows', 1690785, pc_max_info_rows_doc,
                       validator=is_instance_factory((int, type(None))))
    cf.register_option('max_rows', 60, pc_max_rows_doc,
                       validator=is_instance_factory([type(None), int]))
    cf.register_option('max_categories', 8, pc_max_categories_doc,
                       validator=is_int)
    cf.register_option('max_colwidth', 50, max_colwidth_doc, validator=is_int)
    cf.register_option('max_columns', 20, pc_max_cols_doc,
                       validator=is_instance_factory([type(None), int]))
    cf.register_option('large_repr', 'truncate', pc_large_repr_doc,
                       validator=is_one_of_factory(['truncate', 'info']))
    cf.register_option('max_info_columns', 100, pc_max_info_cols_doc,
                       validator=is_int)
    cf.register_option('colheader_justify', 'right', colheader_justify_doc,
                       validator=is_text)
    cf.register_option('notebook_repr_html', True, pc_nb_repr_h_doc,
                       validator=is_bool)
    cf.register_option('date_dayfirst', False, pc_date_dayfirst_doc,
                       validator=is_bool)
    cf.register_option('date_yearfirst', False, pc_date_yearfirst_doc,
                       validator=is_bool)
    cf.register_option('pprint_nest_depth', 3, pc_pprint_nest_depth,
                       validator=is_int)
    cf.register_option('multi_sparse', True, pc_multi_sparse_doc,
                       validator=is_bool)
    cf.register_option('encoding', detect_console_encoding(), pc_encoding_doc,
                       validator=is_text)
    cf.register_option('expand_frame_repr', True, pc_expand_repr_doc)
    cf.register_option('show_dimensions', 'truncate', pc_show_dimensions_doc,
                       validator=is_one_of_factory([True, False, 'truncate']))
    cf.register_option('chop_threshold', None, pc_chop_threshold_doc)
    cf.register_option('max_seq_items', 100, pc_max_seq_items)
    cf.register_option('mpl_style', None, pc_mpl_style_doc,
                       validator=is_one_of_factory([None, False, 'default']),
                       cb=mpl_style_cb)
    cf.register_option('height', 60, pc_height_doc,
                       validator=is_instance_factory([type(None), int]))
    cf.register_option('width', 80, pc_width_doc,
                       validator=is_instance_factory([type(None), int]))
    # redirected to width, make defval identical
    cf.register_option('line_width', get_default_val('display.width'),
                       pc_line_width_doc)
    cf.register_option('memory_usage', True, pc_memory_usage_doc,
                       validator=is_one_of_factory([None, True,
                                                    False, 'deep']))
    cf.register_option('unicode.east_asian_width', False,
                       pc_east_asian_width_doc, validator=is_bool)
    cf.register_option('unicode.ambiguous_as_wide', False,
                       pc_east_asian_width_doc, validator=is_bool)
    cf.register_option('latex.repr', False,
                       pc_latex_repr_doc, validator=is_bool)
    cf.register_option('latex.escape', True, pc_latex_escape,
                       validator=is_bool)
    cf.register_option('latex.longtable', False, pc_latex_longtable,
                       validator=is_bool)
    cf.register_option('latex.multicolumn', True, pc_latex_multicolumn,
                       validator=is_bool)
    cf.register_option('latex.multicolumn_format', 'l', pc_latex_multicolumn,
                       validator=is_text)
    cf.register_option('latex.multirow', False, pc_latex_multirow,
                       validator=is_bool)
    cf.register_option('html.table_schema', False, pc_table_schema_doc,
                       validator=is_bool, cb=table_schema_cb)


cf.deprecate_option('display.line_width',
                    msg=pc_line_width_deprecation_warning,
                    rkey='display.width')

cf.deprecate_option('display.height', msg=pc_height_deprecation_warning,
                    rkey='display.max_rows')

pc_html_border_doc = """
: int
    A ``border=value`` attribute is inserted in the ``<table>`` tag
    for the DataFrame HTML repr.
"""

with cf.config_prefix('html'):
    cf.register_option('border', 1, pc_html_border_doc,
                       validator=is_int)


tc_sim_interactive_doc = """
: boolean
    Whether to simulate interactive mode for purposes of testing
"""

with cf.config_prefix('mode'):
    cf.register_option('sim_interactive', False, tc_sim_interactive_doc)

use_inf_as_null_doc = """
: boolean
    True means treat None, NaN, INF, -INF as null (old way),
    False means None and NaN are null, but INF, -INF are not null
    (new way).
"""

# We don't want to start importing everything at the global context level
# or we'll hit circular deps.


def use_inf_as_null_cb(key):
    from pandas.core.dtypes.missing import _use_inf_as_null
    _use_inf_as_null(key)


with cf.config_prefix('mode'):
    cf.register_option('use_inf_as_null', False, use_inf_as_null_doc,
                       cb=use_inf_as_null_cb)

# user warnings
chained_assignment = """
: string
    Raise an exception, warn, or no action if trying to use chained assignment,
    The default is warn
"""

with cf.config_prefix('mode'):
    cf.register_option('chained_assignment', 'warn', chained_assignment,
                       validator=is_one_of_factory([None, 'warn', 'raise']))

# Set up the io.excel specific configuration.
writer_engine_doc = """
: string
    The default Excel writer engine for '{ext}' files. Available options:
    '{default}' (the default){others}.
"""

with cf.config_prefix('io.excel'):
    # going forward, will be additional writers
    for ext, options in [('xls', ['xlwt']), ('xlsm', ['openpyxl'])]:
        default = options.pop(0)
        if options:
            options = " " + ", ".join(options)
        else:
            options = ""
        doc = writer_engine_doc.format(ext=ext, default=default,
                                       others=options)
        cf.register_option(ext + '.writer', default, doc, validator=str)

    def _register_xlsx(engine, other):
        cf.register_option('xlsx.writer', engine,
                           writer_engine_doc.format(ext='xlsx', default=engine,
                                                    others=", '%s'" % other),
                           validator=str)

    try:
        # better memory footprint
        import xlsxwriter  # noqa
        _register_xlsx('xlsxwriter', 'openpyxl')
    except ImportError:
        # fallback
        _register_xlsx('openpyxl', 'xlsxwriter')
