import pytest

from itertools import product
import numpy as np

from pandas.util import testing as tm
from pandas import MultiIndex, DataFrame, Series, date_range


@pytest.mark.slow
@pytest.mark.parametrize("n,m", product((100, 1000), (5, 20)))
def test_series_groupby_value_counts(n, m):
    np.random.seed(1234)

    def rebuild_index(df):
        arr = list(map(df.index.get_level_values, range(df.index.nlevels)))
        df.index = MultiIndex.from_arrays(arr, names=df.index.names)
        return df

    def check_value_counts(df, keys, bins):
        for isort, normalize, sort, ascending, dropna \
                in product((False, True), repeat=5):

            kwargs = dict(normalize=normalize, sort=sort,
                          ascending=ascending, dropna=dropna, bins=bins)

            gr = df.groupby(keys, sort=isort)
            left = gr['3rd'].value_counts(**kwargs)

            gr = df.groupby(keys, sort=isort)
            right = gr['3rd'].apply(Series.value_counts, **kwargs)
            right.index.names = right.index.names[:-1] + ['3rd']

            # have to sort on index because of unstable sort on values
            left, right = map(rebuild_index, (left, right))  # xref GH9212
            tm.assert_series_equal(left.sort_index(), right.sort_index())

    def loop(df):
        bins = None, np.arange(0, max(5, df['3rd'].max()) + 1, 2)
        keys = '1st', '2nd', ('1st', '2nd')
        for k, b in product(keys, bins):
            check_value_counts(df, k, b)

    days = date_range('2015-08-24', periods=10)

    frame = DataFrame({
        '1st': np.random.choice(
            list('abcd'), n),
        '2nd': np.random.choice(days, n),
        '3rd': np.random.randint(1, m + 1, n)
    })

    loop(frame)

    frame.loc[1::11, '1st'] = np.nan
    frame.loc[3::17, '2nd'] = np.nan
    frame.loc[7::19, '3rd'] = np.nan
    frame.loc[8::19, '3rd'] = np.nan
    frame.loc[9::19, '3rd'] = np.nan

    loop(frame)
