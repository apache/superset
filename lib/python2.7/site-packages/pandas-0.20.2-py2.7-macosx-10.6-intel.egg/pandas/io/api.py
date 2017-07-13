"""
Data IO api
"""

# flake8: noqa

from pandas.io.parsers import read_csv, read_table, read_fwf
from pandas.io.clipboards import read_clipboard
from pandas.io.excel import ExcelFile, ExcelWriter, read_excel
from pandas.io.pytables import HDFStore, get_store, read_hdf
from pandas.io.json import read_json
from pandas.io.html import read_html
from pandas.io.sql import read_sql, read_sql_table, read_sql_query
from pandas.io.sas import read_sas
from pandas.io.feather_format import read_feather
from pandas.io.stata import read_stata
from pandas.io.pickle import read_pickle, to_pickle
from pandas.io.packers import read_msgpack, to_msgpack
from pandas.io.gbq import read_gbq

# deprecation, xref #13790
def Term(*args, **kwargs):
    import warnings

    warnings.warn("pd.Term is deprecated as it is not "
                  "applicable to user code. Instead use in-line "
                  "string expressions in the where clause when "
                  "searching in HDFStore",
                  FutureWarning, stacklevel=2)
    from pandas.io.pytables import Term
    return Term(*args, **kwargs)
