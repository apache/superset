""" feather-format compat """

from distutils.version import LooseVersion
from pandas import DataFrame, RangeIndex, Int64Index
from pandas.compat import range


def _try_import():
    # since pandas is a dependency of feather
    # we need to import on first use

    try:
        import feather
    except ImportError:

        # give a nice error message
        raise ImportError("the feather-format library is not installed\n"
                          "you can install via conda\n"
                          "conda install feather-format -c conda-forge\n"
                          "or via pip\n"
                          "pip install feather-format\n")

    try:
        feather.__version__ >= LooseVersion('0.3.1')
    except AttributeError:
        raise ImportError("the feather-format library must be >= "
                          "version 0.3.1\n"
                          "you can install via conda\n"
                          "conda install feather-format -c conda-forge"
                          "or via pip\n"
                          "pip install feather-format\n")

    return feather


def to_feather(df, path):
    """
    Write a DataFrame to the feather-format

    Parameters
    ----------
    df : DataFrame
    path : string
        File path
    """
    if not isinstance(df, DataFrame):
        raise ValueError("feather only support IO with DataFrames")

    feather = _try_import()
    valid_types = {'string', 'unicode'}

    # validate index
    # --------------

    # validate that we have only a default index
    # raise on anything else as we don't serialize the index

    if not isinstance(df.index, Int64Index):
        raise ValueError("feather does not support serializing {} "
                         "for the index; you can .reset_index()"
                         "to make the index into column(s)".format(
                             type(df.index)))

    if not df.index.equals(RangeIndex.from_range(range(len(df)))):
        raise ValueError("feather does not support serializing a "
                         "non-default index for the index; you "
                         "can .reset_index() to make the index "
                         "into column(s)")

    if df.index.name is not None:
        raise ValueError("feather does not serialize index meta-data on a "
                         "default index")

    # validate columns
    # ----------------

    # must have value column names (strings only)
    if df.columns.inferred_type not in valid_types:
        raise ValueError("feather must have string column names")

    feather.write_dataframe(df, path)


def read_feather(path):
    """
    Load a feather-format object from the file path

    .. versionadded 0.20.0

    Parameters
    ----------
    path : string
        File path

    Returns
    -------
    type of object stored in file

    """

    feather = _try_import()
    return feather.read_dataframe(path)
