from pandas import DatetimeIndex

import numpy as np

import pandas.util.testing as tm
import pandas as pd


def test_to_native_types():
    index = DatetimeIndex(freq='1D', periods=3, start='2017-01-01')

    # First, with no arguments.
    expected = np.array(['2017-01-01', '2017-01-02',
                         '2017-01-03'], dtype=object)

    result = index.to_native_types()
    tm.assert_numpy_array_equal(result, expected)

    # No NaN values, so na_rep has no effect
    result = index.to_native_types(na_rep='pandas')
    tm.assert_numpy_array_equal(result, expected)

    # Make sure slicing works
    expected = np.array(['2017-01-01', '2017-01-03'], dtype=object)

    result = index.to_native_types([0, 2])
    tm.assert_numpy_array_equal(result, expected)

    # Make sure date formatting works
    expected = np.array(['01-2017-01', '01-2017-02',
                         '01-2017-03'], dtype=object)

    result = index.to_native_types(date_format='%m-%Y-%d')
    tm.assert_numpy_array_equal(result, expected)

    # NULL object handling should work
    index = DatetimeIndex(['2017-01-01', pd.NaT, '2017-01-03'])
    expected = np.array(['2017-01-01', 'NaT', '2017-01-03'], dtype=object)

    result = index.to_native_types()
    tm.assert_numpy_array_equal(result, expected)

    expected = np.array(['2017-01-01', 'pandas',
                         '2017-01-03'], dtype=object)

    result = index.to_native_types(na_rep='pandas')
    tm.assert_numpy_array_equal(result, expected)
