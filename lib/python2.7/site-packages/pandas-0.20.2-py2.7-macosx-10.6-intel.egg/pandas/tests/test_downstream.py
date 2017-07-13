"""
Testing that we work in the downstream packages
"""
import pytest
import numpy as np  # noqa
from pandas import DataFrame
from pandas.compat import PY36
from pandas.util import testing as tm
import importlib


def import_module(name):
    # we *only* want to skip if the module is truly not available
    # and NOT just an actual import error because of pandas changes

    if PY36:
        try:
            return importlib.import_module(name)
        except ModuleNotFoundError:  # noqa
            pytest.skip("skipping as {} not available".format(name))

    else:
        try:
            return importlib.import_module(name)
        except ImportError as e:
            if "No module named" in str(e) and name in str(e):
                pytest.skip("skipping as {} not available".format(name))
            raise


@pytest.fixture
def df():
    return DataFrame({'A': [1, 2, 3]})


def test_dask(df):

    toolz = import_module('toolz')  # noqa
    dask = import_module('dask')  # noqa

    import dask.dataframe as dd

    ddf = dd.from_pandas(df, npartitions=3)
    assert ddf.A is not None
    assert ddf.compute() is not None


def test_xarray(df):

    xarray = import_module('xarray')  # noqa

    assert df.to_xarray() is not None


def test_statsmodels():

    statsmodels = import_module('statsmodels')  # noqa
    import statsmodels.api as sm
    import statsmodels.formula.api as smf
    df = sm.datasets.get_rdataset("Guerry", "HistData").data
    smf.ols('Lottery ~ Literacy + np.log(Pop1831)', data=df).fit()


def test_scikit_learn(df):

    sklearn = import_module('sklearn')  # noqa
    from sklearn import svm, datasets

    digits = datasets.load_digits()
    clf = svm.SVC(gamma=0.001, C=100.)
    clf.fit(digits.data[:-1], digits.target[:-1])
    clf.predict(digits.data[-1:])


def test_seaborn():

    seaborn = import_module('seaborn')
    tips = seaborn.load_dataset("tips")
    seaborn.stripplot(x="day", y="total_bill", data=tips)


def test_pandas_gbq(df):

    pandas_gbq = import_module('pandas_gbq')  # noqa


def test_pandas_datareader():

    pandas_datareader = import_module('pandas_datareader')  # noqa
    pandas_datareader.get_data_google('AAPL')


def test_geopandas():

    geopandas = import_module('geopandas')  # noqa
    fp = geopandas.datasets.get_path('naturalearth_lowres')
    assert geopandas.read_file(fp) is not None


def test_pyarrow(df):

    pyarrow = import_module('pyarrow')  # noqa
    table = pyarrow.Table.from_pandas(df)
    result = table.to_pandas()
    tm.assert_frame_equal(result, df)
