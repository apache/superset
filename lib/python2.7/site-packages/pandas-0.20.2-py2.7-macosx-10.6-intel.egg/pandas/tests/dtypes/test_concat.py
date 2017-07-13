# -*- coding: utf-8 -*-

import pandas as pd
import pandas.core.dtypes.concat as _concat


class TestConcatCompat(object):

    def check_concat(self, to_concat, exp):
        for klass in [pd.Index, pd.Series]:
            to_concat_klass = [klass(c) for c in to_concat]
            res = _concat.get_dtype_kinds(to_concat_klass)
            assert res == set(exp)

    def test_get_dtype_kinds(self):
        to_concat = [['a'], [1, 2]]
        self.check_concat(to_concat, ['i', 'object'])

        to_concat = [[3, 4], [1, 2]]
        self.check_concat(to_concat, ['i'])

        to_concat = [[3, 4], [1, 2.1]]
        self.check_concat(to_concat, ['i', 'f'])

    def test_get_dtype_kinds_datetimelike(self):
        to_concat = [pd.DatetimeIndex(['2011-01-01']),
                     pd.DatetimeIndex(['2011-01-02'])]
        self.check_concat(to_concat, ['datetime'])

        to_concat = [pd.TimedeltaIndex(['1 days']),
                     pd.TimedeltaIndex(['2 days'])]
        self.check_concat(to_concat, ['timedelta'])

    def test_get_dtype_kinds_datetimelike_object(self):
        to_concat = [pd.DatetimeIndex(['2011-01-01']),
                     pd.DatetimeIndex(['2011-01-02'], tz='US/Eastern')]
        self.check_concat(to_concat,
                          ['datetime', 'datetime64[ns, US/Eastern]'])

        to_concat = [pd.DatetimeIndex(['2011-01-01'], tz='Asia/Tokyo'),
                     pd.DatetimeIndex(['2011-01-02'], tz='US/Eastern')]
        self.check_concat(to_concat,
                          ['datetime64[ns, Asia/Tokyo]',
                           'datetime64[ns, US/Eastern]'])

        # timedelta has single type
        to_concat = [pd.TimedeltaIndex(['1 days']),
                     pd.TimedeltaIndex(['2 hours'])]
        self.check_concat(to_concat, ['timedelta'])

        to_concat = [pd.DatetimeIndex(['2011-01-01'], tz='Asia/Tokyo'),
                     pd.TimedeltaIndex(['1 days'])]
        self.check_concat(to_concat,
                          ['datetime64[ns, Asia/Tokyo]', 'timedelta'])

    def test_get_dtype_kinds_period(self):
        # because we don't have Period dtype (yet),
        # Series results in object dtype
        to_concat = [pd.PeriodIndex(['2011-01'], freq='M'),
                     pd.PeriodIndex(['2011-01'], freq='M')]
        res = _concat.get_dtype_kinds(to_concat)
        assert res == set(['period[M]'])

        to_concat = [pd.Series([pd.Period('2011-01', freq='M')]),
                     pd.Series([pd.Period('2011-02', freq='M')])]
        res = _concat.get_dtype_kinds(to_concat)
        assert res == set(['object'])

        to_concat = [pd.PeriodIndex(['2011-01'], freq='M'),
                     pd.PeriodIndex(['2011-01'], freq='D')]
        res = _concat.get_dtype_kinds(to_concat)
        assert res == set(['period[M]', 'period[D]'])

        to_concat = [pd.Series([pd.Period('2011-01', freq='M')]),
                     pd.Series([pd.Period('2011-02', freq='D')])]
        res = _concat.get_dtype_kinds(to_concat)
        assert res == set(['object'])
