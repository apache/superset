# -*- coding: utf-8 -*-

from __future__ import print_function

import csv
import pytest

from numpy import nan
import numpy as np

from pandas.compat import (lmap, range, lrange, StringIO, u)
from pandas.errors import ParserError
from pandas import (DataFrame, Index, Series, MultiIndex, Timestamp,
                    date_range, read_csv, compat, to_datetime)
import pandas as pd

from pandas.util.testing import (assert_almost_equal,
                                 assert_series_equal,
                                 assert_frame_equal,
                                 ensure_clean, slow,
                                 makeCustomDataframe as mkdf)
import pandas.util.testing as tm

from pandas.tests.frame.common import TestData


MIXED_FLOAT_DTYPES = ['float16', 'float32', 'float64']
MIXED_INT_DTYPES = ['uint8', 'uint16', 'uint32', 'uint64', 'int8', 'int16',
                    'int32', 'int64']


class TestDataFrameToCSV(TestData):

    def test_to_csv_from_csv1(self):

        with ensure_clean('__tmp_to_csv_from_csv1__') as path:
            self.frame['A'][:5] = nan

            self.frame.to_csv(path)
            self.frame.to_csv(path, columns=['A', 'B'])
            self.frame.to_csv(path, header=False)
            self.frame.to_csv(path, index=False)

            # test roundtrip
            self.tsframe.to_csv(path)
            recons = DataFrame.from_csv(path)

            assert_frame_equal(self.tsframe, recons)

            self.tsframe.to_csv(path, index_label='index')
            recons = DataFrame.from_csv(path, index_col=None)
            assert(len(recons.columns) == len(self.tsframe.columns) + 1)

            # no index
            self.tsframe.to_csv(path, index=False)
            recons = DataFrame.from_csv(path, index_col=None)
            assert_almost_equal(self.tsframe.values, recons.values)

            # corner case
            dm = DataFrame({'s1': Series(lrange(3), lrange(3)),
                            's2': Series(lrange(2), lrange(2))})
            dm.to_csv(path)
            recons = DataFrame.from_csv(path)
            assert_frame_equal(dm, recons)

    def test_to_csv_from_csv2(self):

        with ensure_clean('__tmp_to_csv_from_csv2__') as path:

            # duplicate index
            df = DataFrame(np.random.randn(3, 3), index=['a', 'a', 'b'],
                           columns=['x', 'y', 'z'])
            df.to_csv(path)
            result = DataFrame.from_csv(path)
            assert_frame_equal(result, df)

            midx = MultiIndex.from_tuples(
                [('A', 1, 2), ('A', 1, 2), ('B', 1, 2)])
            df = DataFrame(np.random.randn(3, 3), index=midx,
                           columns=['x', 'y', 'z'])
            df.to_csv(path)
            result = DataFrame.from_csv(path, index_col=[0, 1, 2],
                                        parse_dates=False)
            # TODO from_csv names index ['Unnamed: 1', 'Unnamed: 2'] should it
            # ?
            assert_frame_equal(result, df, check_names=False)

            # column aliases
            col_aliases = Index(['AA', 'X', 'Y', 'Z'])
            self.frame2.to_csv(path, header=col_aliases)
            rs = DataFrame.from_csv(path)
            xp = self.frame2.copy()
            xp.columns = col_aliases

            assert_frame_equal(xp, rs)

            pytest.raises(ValueError, self.frame2.to_csv, path,
                          header=['AA', 'X'])

    def test_to_csv_from_csv3(self):

        with ensure_clean('__tmp_to_csv_from_csv3__') as path:
            df1 = DataFrame(np.random.randn(3, 1))
            df2 = DataFrame(np.random.randn(3, 1))

            df1.to_csv(path)
            df2.to_csv(path, mode='a', header=False)
            xp = pd.concat([df1, df2])
            rs = pd.read_csv(path, index_col=0)
            rs.columns = lmap(int, rs.columns)
            xp.columns = lmap(int, xp.columns)
            assert_frame_equal(xp, rs)

    def test_to_csv_from_csv4(self):

        with ensure_clean('__tmp_to_csv_from_csv4__') as path:
            # GH 10833 (TimedeltaIndex formatting)
            dt = pd.Timedelta(seconds=1)
            df = pd.DataFrame({'dt_data': [i * dt for i in range(3)]},
                              index=pd.Index([i * dt for i in range(3)],
                                             name='dt_index'))
            df.to_csv(path)

            result = pd.read_csv(path, index_col='dt_index')
            result.index = pd.to_timedelta(result.index)
            # TODO: remove renaming when GH 10875 is solved
            result.index = result.index.rename('dt_index')
            result['dt_data'] = pd.to_timedelta(result['dt_data'])

            assert_frame_equal(df, result, check_index_type=True)

    def test_to_csv_from_csv5(self):

        # tz, 8260
        with ensure_clean('__tmp_to_csv_from_csv5__') as path:

            self.tzframe.to_csv(path)
            result = pd.read_csv(path, index_col=0, parse_dates=['A'])

            converter = lambda c: to_datetime(result[c]).dt.tz_localize(
                'UTC').dt.tz_convert(self.tzframe[c].dt.tz)
            result['B'] = converter('B')
            result['C'] = converter('C')
            assert_frame_equal(result, self.tzframe)

    def test_to_csv_cols_reordering(self):
        # GH3454
        import pandas as pd

        chunksize = 5
        N = int(chunksize * 2.5)

        df = mkdf(N, 3)
        cs = df.columns
        cols = [cs[2], cs[0]]

        with ensure_clean() as path:
            df.to_csv(path, columns=cols, chunksize=chunksize)
            rs_c = pd.read_csv(path, index_col=0)

        assert_frame_equal(df[cols], rs_c, check_names=False)

    def test_to_csv_new_dupe_cols(self):
        import pandas as pd

        def _check_df(df, cols=None):
            with ensure_clean() as path:
                df.to_csv(path, columns=cols, chunksize=chunksize)
                rs_c = pd.read_csv(path, index_col=0)

                # we wrote them in a different order
                # so compare them in that order
                if cols is not None:

                    if df.columns.is_unique:
                        rs_c.columns = cols
                    else:
                        indexer, missing = df.columns.get_indexer_non_unique(
                            cols)
                        rs_c.columns = df.columns.take(indexer)

                    for c in cols:
                        obj_df = df[c]
                        obj_rs = rs_c[c]
                        if isinstance(obj_df, Series):
                            assert_series_equal(obj_df, obj_rs)
                        else:
                            assert_frame_equal(
                                obj_df, obj_rs, check_names=False)

                # wrote in the same order
                else:
                    rs_c.columns = df.columns
                    assert_frame_equal(df, rs_c, check_names=False)

        chunksize = 5
        N = int(chunksize * 2.5)

        # dupe cols
        df = mkdf(N, 3)
        df.columns = ['a', 'a', 'b']
        _check_df(df, None)

        # dupe cols with selection
        cols = ['b', 'a']
        _check_df(df, cols)

    @slow
    def test_to_csv_dtnat(self):
        # GH3437
        from pandas import NaT

        def make_dtnat_arr(n, nnat=None):
            if nnat is None:
                nnat = int(n * 0.1)  # 10%
            s = list(date_range('2000', freq='5min', periods=n))
            if nnat:
                for i in np.random.randint(0, len(s), nnat):
                    s[i] = NaT
                i = np.random.randint(100)
                s[-i] = NaT
                s[i] = NaT
            return s

        chunksize = 1000
        # N=35000
        s1 = make_dtnat_arr(chunksize + 5)
        s2 = make_dtnat_arr(chunksize + 5, 0)

        # s3=make_dtnjat_arr(chunksize+5,0)
        with ensure_clean('1.csv') as pth:
            df = DataFrame(dict(a=s1, b=s2))
            df.to_csv(pth, chunksize=chunksize)
            recons = DataFrame.from_csv(pth)._convert(datetime=True,
                                                      coerce=True)
            assert_frame_equal(df, recons, check_names=False,
                               check_less_precise=True)

    @slow
    def test_to_csv_moar(self):

        def _do_test(df, r_dtype=None, c_dtype=None,
                     rnlvl=None, cnlvl=None, dupe_col=False):

            kwargs = dict(parse_dates=False)
            if cnlvl:
                if rnlvl is not None:
                    kwargs['index_col'] = lrange(rnlvl)
                kwargs['header'] = lrange(cnlvl)
                with ensure_clean('__tmp_to_csv_moar__') as path:
                    df.to_csv(path, encoding='utf8',
                              chunksize=chunksize, tupleize_cols=False)
                    recons = DataFrame.from_csv(
                        path, tupleize_cols=False, **kwargs)
            else:
                kwargs['header'] = 0
                with ensure_clean('__tmp_to_csv_moar__') as path:
                    df.to_csv(path, encoding='utf8', chunksize=chunksize)
                    recons = DataFrame.from_csv(path, **kwargs)

            def _to_uni(x):
                if not isinstance(x, compat.text_type):
                    return x.decode('utf8')
                return x
            if dupe_col:
                # read_Csv disambiguates the columns by
                # labeling them dupe.1,dupe.2, etc'. monkey patch columns
                recons.columns = df.columns
            if rnlvl and not cnlvl:
                delta_lvl = [recons.iloc[
                    :, i].values for i in range(rnlvl - 1)]
                ix = MultiIndex.from_arrays([list(recons.index)] + delta_lvl)
                recons.index = ix
                recons = recons.iloc[:, rnlvl - 1:]

            type_map = dict(i='i', f='f', s='O', u='O', dt='O', p='O')
            if r_dtype:
                if r_dtype == 'u':  # unicode
                    r_dtype = 'O'
                    recons.index = np.array(lmap(_to_uni, recons.index),
                                            dtype=r_dtype)
                    df.index = np.array(lmap(_to_uni, df.index), dtype=r_dtype)
                elif r_dtype == 'dt':  # unicode
                    r_dtype = 'O'
                    recons.index = np.array(lmap(Timestamp, recons.index),
                                            dtype=r_dtype)
                    df.index = np.array(
                        lmap(Timestamp, df.index), dtype=r_dtype)
                elif r_dtype == 'p':
                    r_dtype = 'O'
                    recons.index = np.array(
                        list(map(Timestamp, to_datetime(recons.index))),
                        dtype=r_dtype)
                    df.index = np.array(
                        list(map(Timestamp, df.index.to_timestamp())),
                        dtype=r_dtype)
                else:
                    r_dtype = type_map.get(r_dtype)
                    recons.index = np.array(recons.index, dtype=r_dtype)
                    df.index = np.array(df.index, dtype=r_dtype)
            if c_dtype:
                if c_dtype == 'u':
                    c_dtype = 'O'
                    recons.columns = np.array(lmap(_to_uni, recons.columns),
                                              dtype=c_dtype)
                    df.columns = np.array(
                        lmap(_to_uni, df.columns), dtype=c_dtype)
                elif c_dtype == 'dt':
                    c_dtype = 'O'
                    recons.columns = np.array(lmap(Timestamp, recons.columns),
                                              dtype=c_dtype)
                    df.columns = np.array(
                        lmap(Timestamp, df.columns), dtype=c_dtype)
                elif c_dtype == 'p':
                    c_dtype = 'O'
                    recons.columns = np.array(
                        lmap(Timestamp, to_datetime(recons.columns)),
                        dtype=c_dtype)
                    df.columns = np.array(
                        lmap(Timestamp, df.columns.to_timestamp()),
                        dtype=c_dtype)
                else:
                    c_dtype = type_map.get(c_dtype)
                    recons.columns = np.array(recons.columns, dtype=c_dtype)
                    df.columns = np.array(df.columns, dtype=c_dtype)

            assert_frame_equal(df, recons, check_names=False,
                               check_less_precise=True)

        N = 100
        chunksize = 1000

        for ncols in [4]:
            base = int((chunksize // ncols or 1) or 1)
            for nrows in [2, 10, N - 1, N, N + 1, N + 2, 2 * N - 2,
                          2 * N - 1, 2 * N, 2 * N + 1, 2 * N + 2,
                          base - 1, base, base + 1]:
                _do_test(mkdf(nrows, ncols, r_idx_type='dt',
                              c_idx_type='s'), 'dt', 's')

        for ncols in [4]:
            base = int((chunksize // ncols or 1) or 1)
            for nrows in [2, 10, N - 1, N, N + 1, N + 2, 2 * N - 2,
                          2 * N - 1, 2 * N, 2 * N + 1, 2 * N + 2,
                          base - 1, base, base + 1]:
                _do_test(mkdf(nrows, ncols, r_idx_type='dt',
                              c_idx_type='s'), 'dt', 's')
                pass

        for r_idx_type, c_idx_type in [('i', 'i'), ('s', 's'), ('u', 'dt'),
                                       ('p', 'p')]:
            for ncols in [1, 2, 3, 4]:
                base = int((chunksize // ncols or 1) or 1)
                for nrows in [2, 10, N - 1, N, N + 1, N + 2, 2 * N - 2,
                              2 * N - 1, 2 * N, 2 * N + 1, 2 * N + 2,
                              base - 1, base, base + 1]:
                    _do_test(mkdf(nrows, ncols, r_idx_type=r_idx_type,
                                  c_idx_type=c_idx_type),
                             r_idx_type, c_idx_type)

        for ncols in [1, 2, 3, 4]:
            base = int((chunksize // ncols or 1) or 1)
            for nrows in [10, N - 2, N - 1, N, N + 1, N + 2, 2 * N - 2,
                          2 * N - 1, 2 * N, 2 * N + 1, 2 * N + 2,
                          base - 1, base, base + 1]:
                _do_test(mkdf(nrows, ncols))

        for nrows in [10, N - 2, N - 1, N, N + 1, N + 2]:
            df = mkdf(nrows, 3)
            cols = list(df.columns)
            cols[:2] = ["dupe", "dupe"]
            cols[-2:] = ["dupe", "dupe"]
            ix = list(df.index)
            ix[:2] = ["rdupe", "rdupe"]
            ix[-2:] = ["rdupe", "rdupe"]
            df.index = ix
            df.columns = cols
            _do_test(df, dupe_col=True)

        _do_test(DataFrame(index=lrange(10)))
        _do_test(mkdf(chunksize // 2 + 1, 2, r_idx_nlevels=2), rnlvl=2)
        for ncols in [2, 3, 4]:
            base = int(chunksize // ncols)
            for nrows in [10, N - 2, N - 1, N, N + 1, N + 2, 2 * N - 2,
                          2 * N - 1, 2 * N, 2 * N + 1, 2 * N + 2,
                          base - 1, base, base + 1]:
                _do_test(mkdf(nrows, ncols, r_idx_nlevels=2), rnlvl=2)
                _do_test(mkdf(nrows, ncols, c_idx_nlevels=2), cnlvl=2)
                _do_test(mkdf(nrows, ncols, r_idx_nlevels=2, c_idx_nlevels=2),
                         rnlvl=2, cnlvl=2)

    def test_to_csv_from_csv_w_some_infs(self):

        # test roundtrip with inf, -inf, nan, as full columns and mix
        self.frame['G'] = np.nan
        f = lambda x: [np.inf, np.nan][np.random.rand() < .5]
        self.frame['H'] = self.frame.index.map(f)

        with ensure_clean() as path:
            self.frame.to_csv(path)
            recons = DataFrame.from_csv(path)

            # TODO to_csv drops column name
            assert_frame_equal(self.frame, recons, check_names=False)
            assert_frame_equal(np.isinf(self.frame),
                               np.isinf(recons), check_names=False)

    def test_to_csv_from_csv_w_all_infs(self):

        # test roundtrip with inf, -inf, nan, as full columns and mix
        self.frame['E'] = np.inf
        self.frame['F'] = -np.inf

        with ensure_clean() as path:
            self.frame.to_csv(path)
            recons = DataFrame.from_csv(path)

            # TODO to_csv drops column name
            assert_frame_equal(self.frame, recons, check_names=False)
            assert_frame_equal(np.isinf(self.frame),
                               np.isinf(recons), check_names=False)

    def test_to_csv_no_index(self):
        # GH 3624, after appending columns, to_csv fails
        with ensure_clean('__tmp_to_csv_no_index__') as path:
            df = DataFrame({'c1': [1, 2, 3], 'c2': [4, 5, 6]})
            df.to_csv(path, index=False)
            result = read_csv(path)
            assert_frame_equal(df, result)
            df['c3'] = Series([7, 8, 9], dtype='int64')
            df.to_csv(path, index=False)
            result = read_csv(path)
            assert_frame_equal(df, result)

    def test_to_csv_with_mix_columns(self):
        # gh-11637: incorrect output when a mix of integer and string column
        # names passed as columns parameter in to_csv

        df = DataFrame({0: ['a', 'b', 'c'],
                        1: ['aa', 'bb', 'cc']})
        df['test'] = 'txt'
        assert df.to_csv() == df.to_csv(columns=[0, 1, 'test'])

    def test_to_csv_headers(self):
        # GH6186, the presence or absence of `index` incorrectly
        # causes to_csv to have different header semantics.
        from_df = DataFrame([[1, 2], [3, 4]], columns=['A', 'B'])
        to_df = DataFrame([[1, 2], [3, 4]], columns=['X', 'Y'])
        with ensure_clean('__tmp_to_csv_headers__') as path:
            from_df.to_csv(path, header=['X', 'Y'])
            recons = DataFrame.from_csv(path)
            assert_frame_equal(to_df, recons)

            from_df.to_csv(path, index=False, header=['X', 'Y'])
            recons = DataFrame.from_csv(path)
            recons.reset_index(inplace=True)
            assert_frame_equal(to_df, recons)

    def test_to_csv_multiindex(self):

        frame = self.frame
        old_index = frame.index
        arrays = np.arange(len(old_index) * 2).reshape(2, -1)
        new_index = MultiIndex.from_arrays(arrays, names=['first', 'second'])
        frame.index = new_index

        with ensure_clean('__tmp_to_csv_multiindex__') as path:

            frame.to_csv(path, header=False)
            frame.to_csv(path, columns=['A', 'B'])

            # round trip
            frame.to_csv(path)
            df = DataFrame.from_csv(path, index_col=[0, 1], parse_dates=False)

            # TODO to_csv drops column name
            assert_frame_equal(frame, df, check_names=False)
            assert frame.index.names == df.index.names

            # needed if setUP becomes a classmethod
            self.frame.index = old_index

            # try multiindex with dates
            tsframe = self.tsframe
            old_index = tsframe.index
            new_index = [old_index, np.arange(len(old_index))]
            tsframe.index = MultiIndex.from_arrays(new_index)

            tsframe.to_csv(path, index_label=['time', 'foo'])
            recons = DataFrame.from_csv(path, index_col=[0, 1])
            # TODO to_csv drops column name
            assert_frame_equal(tsframe, recons, check_names=False)

            # do not load index
            tsframe.to_csv(path)
            recons = DataFrame.from_csv(path, index_col=None)
            assert len(recons.columns) == len(tsframe.columns) + 2

            # no index
            tsframe.to_csv(path, index=False)
            recons = DataFrame.from_csv(path, index_col=None)
            assert_almost_equal(recons.values, self.tsframe.values)

            # needed if setUP becomes classmethod
            self.tsframe.index = old_index

        with ensure_clean('__tmp_to_csv_multiindex__') as path:
            # GH3571, GH1651, GH3141

            def _make_frame(names=None):
                if names is True:
                    names = ['first', 'second']
                return DataFrame(np.random.randint(0, 10, size=(3, 3)),
                                 columns=MultiIndex.from_tuples(
                                     [('bah', 'foo'),
                                      ('bah', 'bar'),
                                      ('ban', 'baz')], names=names),
                                 dtype='int64')

            # column & index are multi-index
            df = mkdf(5, 3, r_idx_nlevels=2, c_idx_nlevels=4)
            df.to_csv(path, tupleize_cols=False)
            result = read_csv(path, header=[0, 1, 2, 3], index_col=[
                              0, 1], tupleize_cols=False)
            assert_frame_equal(df, result)

            # column is mi
            df = mkdf(5, 3, r_idx_nlevels=1, c_idx_nlevels=4)
            df.to_csv(path, tupleize_cols=False)
            result = read_csv(
                path, header=[0, 1, 2, 3], index_col=0, tupleize_cols=False)
            assert_frame_equal(df, result)

            # dup column names?
            df = mkdf(5, 3, r_idx_nlevels=3, c_idx_nlevels=4)
            df.to_csv(path, tupleize_cols=False)
            result = read_csv(path, header=[0, 1, 2, 3], index_col=[
                              0, 1, 2], tupleize_cols=False)
            assert_frame_equal(df, result)

            # writing with no index
            df = _make_frame()
            df.to_csv(path, tupleize_cols=False, index=False)
            result = read_csv(path, header=[0, 1], tupleize_cols=False)
            assert_frame_equal(df, result)

            # we lose the names here
            df = _make_frame(True)
            df.to_csv(path, tupleize_cols=False, index=False)
            result = read_csv(path, header=[0, 1], tupleize_cols=False)
            assert all([x is None for x in result.columns.names])
            result.columns.names = df.columns.names
            assert_frame_equal(df, result)

            # tupleize_cols=True and index=False
            df = _make_frame(True)
            df.to_csv(path, tupleize_cols=True, index=False)
            result = read_csv(
                path, header=0, tupleize_cols=True, index_col=None)
            result.columns = df.columns
            assert_frame_equal(df, result)

            # whatsnew example
            df = _make_frame()
            df.to_csv(path, tupleize_cols=False)
            result = read_csv(path, header=[0, 1], index_col=[
                              0], tupleize_cols=False)
            assert_frame_equal(df, result)

            df = _make_frame(True)
            df.to_csv(path, tupleize_cols=False)
            result = read_csv(path, header=[0, 1], index_col=[
                              0], tupleize_cols=False)
            assert_frame_equal(df, result)

            # column & index are multi-index (compatibility)
            df = mkdf(5, 3, r_idx_nlevels=2, c_idx_nlevels=4)
            df.to_csv(path, tupleize_cols=True)
            result = read_csv(path, header=0, index_col=[
                              0, 1], tupleize_cols=True)
            result.columns = df.columns
            assert_frame_equal(df, result)

            # invalid options
            df = _make_frame(True)
            df.to_csv(path, tupleize_cols=False)

            for i in [6, 7]:
                msg = 'len of {i}, but only 5 lines in file'.format(i=i)
                with tm.assert_raises_regex(ParserError, msg):
                    read_csv(path, tupleize_cols=False,
                             header=lrange(i), index_col=0)

            # write with cols
            with tm.assert_raises_regex(TypeError, 'cannot specify cols '
                                        'with a MultiIndex'):
                df.to_csv(path, tupleize_cols=False, columns=['foo', 'bar'])

        with ensure_clean('__tmp_to_csv_multiindex__') as path:
            # empty
            tsframe[:0].to_csv(path)
            recons = DataFrame.from_csv(path)
            exp = tsframe[:0]
            exp.index = []

            tm.assert_index_equal(recons.columns, exp.columns)
            assert len(recons) == 0

    def test_to_csv_float32_nanrep(self):
        df = DataFrame(np.random.randn(1, 4).astype(np.float32))
        df[1] = np.nan

        with ensure_clean('__tmp_to_csv_float32_nanrep__.csv') as path:
            df.to_csv(path, na_rep=999)

            with open(path) as f:
                lines = f.readlines()
                assert lines[1].split(',')[2] == '999'

    def test_to_csv_withcommas(self):

        # Commas inside fields should be correctly escaped when saving as CSV.
        df = DataFrame({'A': [1, 2, 3], 'B': ['5,6', '7,8', '9,0']})

        with ensure_clean('__tmp_to_csv_withcommas__.csv') as path:
            df.to_csv(path)
            df2 = DataFrame.from_csv(path)
            assert_frame_equal(df2, df)

    def test_to_csv_mixed(self):

        def create_cols(name):
            return ["%s%03d" % (name, i) for i in range(5)]

        df_float = DataFrame(np.random.randn(
            100, 5), dtype='float64', columns=create_cols('float'))
        df_int = DataFrame(np.random.randn(100, 5),
                           dtype='int64', columns=create_cols('int'))
        df_bool = DataFrame(True, index=df_float.index,
                            columns=create_cols('bool'))
        df_object = DataFrame('foo', index=df_float.index,
                              columns=create_cols('object'))
        df_dt = DataFrame(Timestamp('20010101'),
                          index=df_float.index, columns=create_cols('date'))

        # add in some nans
        df_float.loc[30:50, 1:3] = np.nan

        # ## this is a bug in read_csv right now ####
        # df_dt.loc[30:50,1:3] = np.nan

        df = pd.concat([df_float, df_int, df_bool, df_object, df_dt], axis=1)

        # dtype
        dtypes = dict()
        for n, dtype in [('float', np.float64), ('int', np.int64),
                         ('bool', np.bool), ('object', np.object)]:
            for c in create_cols(n):
                dtypes[c] = dtype

        with ensure_clean() as filename:
            df.to_csv(filename)
            rs = read_csv(filename, index_col=0, dtype=dtypes,
                          parse_dates=create_cols('date'))
            assert_frame_equal(rs, df)

    def test_to_csv_dups_cols(self):

        df = DataFrame(np.random.randn(1000, 30), columns=lrange(
            15) + lrange(15), dtype='float64')

        with ensure_clean() as filename:
            df.to_csv(filename)  # single dtype, fine
            result = read_csv(filename, index_col=0)
            result.columns = df.columns
            assert_frame_equal(result, df)

        df_float = DataFrame(np.random.randn(1000, 3), dtype='float64')
        df_int = DataFrame(np.random.randn(1000, 3), dtype='int64')
        df_bool = DataFrame(True, index=df_float.index, columns=lrange(3))
        df_object = DataFrame('foo', index=df_float.index, columns=lrange(3))
        df_dt = DataFrame(Timestamp('20010101'),
                          index=df_float.index, columns=lrange(3))
        df = pd.concat([df_float, df_int, df_bool, df_object,
                        df_dt], axis=1, ignore_index=True)

        cols = []
        for i in range(5):
            cols.extend([0, 1, 2])
        df.columns = cols

        with ensure_clean() as filename:
            df.to_csv(filename)
            result = read_csv(filename, index_col=0)

            # date cols
            for i in ['0.4', '1.4', '2.4']:
                result[i] = to_datetime(result[i])

            result.columns = df.columns
            assert_frame_equal(result, df)

        # GH3457
        from pandas.util.testing import makeCustomDataframe as mkdf

        N = 10
        df = mkdf(N, 3)
        df.columns = ['a', 'a', 'b']

        with ensure_clean() as filename:
            df.to_csv(filename)

            # read_csv will rename the dups columns
            result = read_csv(filename, index_col=0)
            result = result.rename(columns={'a.1': 'a'})
            assert_frame_equal(result, df)

    def test_to_csv_chunking(self):

        aa = DataFrame({'A': lrange(100000)})
        aa['B'] = aa.A + 1.0
        aa['C'] = aa.A + 2.0
        aa['D'] = aa.A + 3.0

        for chunksize in [10000, 50000, 100000]:
            with ensure_clean() as filename:
                aa.to_csv(filename, chunksize=chunksize)
                rs = read_csv(filename, index_col=0)
                assert_frame_equal(rs, aa)

    @slow
    def test_to_csv_wide_frame_formatting(self):
        # Issue #8621
        df = DataFrame(np.random.randn(1, 100010), columns=None, index=None)
        with ensure_clean() as filename:
            df.to_csv(filename, header=False, index=False)
            rs = read_csv(filename, header=None)
            assert_frame_equal(rs, df)

    def test_to_csv_bug(self):
        f1 = StringIO('a,1.0\nb,2.0')
        df = DataFrame.from_csv(f1, header=None)
        newdf = DataFrame({'t': df[df.columns[0]]})

        with ensure_clean() as path:
            newdf.to_csv(path)

            recons = read_csv(path, index_col=0)
            # don't check_names as t != 1
            assert_frame_equal(recons, newdf, check_names=False)

    def test_to_csv_unicode(self):

        df = DataFrame({u('c/\u03c3'): [1, 2, 3]})
        with ensure_clean() as path:

            df.to_csv(path, encoding='UTF-8')
            df2 = read_csv(path, index_col=0, encoding='UTF-8')
            assert_frame_equal(df, df2)

            df.to_csv(path, encoding='UTF-8', index=False)
            df2 = read_csv(path, index_col=None, encoding='UTF-8')
            assert_frame_equal(df, df2)

    def test_to_csv_unicode_index_col(self):
        buf = StringIO('')
        df = DataFrame(
            [[u("\u05d0"), "d2", "d3", "d4"], ["a1", "a2", "a3", "a4"]],
            columns=[u("\u05d0"),
                     u("\u05d1"), u("\u05d2"), u("\u05d3")],
            index=[u("\u05d0"), u("\u05d1")])

        df.to_csv(buf, encoding='UTF-8')
        buf.seek(0)

        df2 = read_csv(buf, index_col=0, encoding='UTF-8')
        assert_frame_equal(df, df2)

    def test_to_csv_stringio(self):
        buf = StringIO()
        self.frame.to_csv(buf)
        buf.seek(0)
        recons = read_csv(buf, index_col=0)
        # TODO to_csv drops column name
        assert_frame_equal(recons, self.frame, check_names=False)

    def test_to_csv_float_format(self):

        df = DataFrame([[0.123456, 0.234567, 0.567567],
                        [12.32112, 123123.2, 321321.2]],
                       index=['A', 'B'], columns=['X', 'Y', 'Z'])

        with ensure_clean() as filename:

            df.to_csv(filename, float_format='%.2f')

            rs = read_csv(filename, index_col=0)
            xp = DataFrame([[0.12, 0.23, 0.57],
                            [12.32, 123123.20, 321321.20]],
                           index=['A', 'B'], columns=['X', 'Y', 'Z'])
            assert_frame_equal(rs, xp)

    def test_to_csv_unicodewriter_quoting(self):
        df = DataFrame({'A': [1, 2, 3], 'B': ['foo', 'bar', 'baz']})

        buf = StringIO()
        df.to_csv(buf, index=False, quoting=csv.QUOTE_NONNUMERIC,
                  encoding='utf-8')

        result = buf.getvalue()
        expected = ('"A","B"\n'
                    '1,"foo"\n'
                    '2,"bar"\n'
                    '3,"baz"\n')

        assert result == expected

    def test_to_csv_quote_none(self):
        # GH4328
        df = DataFrame({'A': ['hello', '{"hello"}']})
        for encoding in (None, 'utf-8'):
            buf = StringIO()
            df.to_csv(buf, quoting=csv.QUOTE_NONE,
                      encoding=encoding, index=False)
            result = buf.getvalue()
            expected = 'A\nhello\n{"hello"}\n'
            assert result == expected

    def test_to_csv_index_no_leading_comma(self):
        df = DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]},
                       index=['one', 'two', 'three'])

        buf = StringIO()
        df.to_csv(buf, index_label=False)
        expected = ('A,B\n'
                    'one,1,4\n'
                    'two,2,5\n'
                    'three,3,6\n')
        assert buf.getvalue() == expected

    def test_to_csv_line_terminators(self):
        df = DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]},
                       index=['one', 'two', 'three'])

        buf = StringIO()
        df.to_csv(buf, line_terminator='\r\n')
        expected = (',A,B\r\n'
                    'one,1,4\r\n'
                    'two,2,5\r\n'
                    'three,3,6\r\n')
        assert buf.getvalue() == expected

        buf = StringIO()
        df.to_csv(buf)  # The default line terminator remains \n
        expected = (',A,B\n'
                    'one,1,4\n'
                    'two,2,5\n'
                    'three,3,6\n')
        assert buf.getvalue() == expected

    def test_to_csv_from_csv_categorical(self):

        # CSV with categoricals should result in the same output as when one
        # would add a "normal" Series/DataFrame.
        s = Series(pd.Categorical(['a', 'b', 'b', 'a', 'a', 'c', 'c', 'c']))
        s2 = Series(['a', 'b', 'b', 'a', 'a', 'c', 'c', 'c'])
        res = StringIO()
        s.to_csv(res)
        exp = StringIO()
        s2.to_csv(exp)
        assert res.getvalue() == exp.getvalue()

        df = DataFrame({"s": s})
        df2 = DataFrame({"s": s2})
        res = StringIO()
        df.to_csv(res)
        exp = StringIO()
        df2.to_csv(exp)
        assert res.getvalue() == exp.getvalue()

    def test_to_csv_path_is_none(self):
        # GH 8215
        # Make sure we return string for consistency with
        # Series.to_csv()
        csv_str = self.frame.to_csv(path_or_buf=None)
        assert isinstance(csv_str, str)
        recons = pd.read_csv(StringIO(csv_str), index_col=0)
        assert_frame_equal(self.frame, recons)

    def test_to_csv_compression_gzip(self):
        # GH7615
        # use the compression kw in to_csv
        df = DataFrame([[0.123456, 0.234567, 0.567567],
                        [12.32112, 123123.2, 321321.2]],
                       index=['A', 'B'], columns=['X', 'Y', 'Z'])

        with ensure_clean() as filename:

            df.to_csv(filename, compression="gzip")

            # test the round trip - to_csv -> read_csv
            rs = read_csv(filename, compression="gzip", index_col=0)
            assert_frame_equal(df, rs)

            # explicitly make sure file is gziped
            import gzip
            f = gzip.open(filename, 'rb')
            text = f.read().decode('utf8')
            f.close()
            for col in df.columns:
                assert col in text

    def test_to_csv_compression_bz2(self):
        # GH7615
        # use the compression kw in to_csv
        df = DataFrame([[0.123456, 0.234567, 0.567567],
                        [12.32112, 123123.2, 321321.2]],
                       index=['A', 'B'], columns=['X', 'Y', 'Z'])

        with ensure_clean() as filename:

            df.to_csv(filename, compression="bz2")

            # test the round trip - to_csv -> read_csv
            rs = read_csv(filename, compression="bz2", index_col=0)
            assert_frame_equal(df, rs)

            # explicitly make sure file is bz2ed
            import bz2
            f = bz2.BZ2File(filename, 'rb')
            text = f.read().decode('utf8')
            f.close()
            for col in df.columns:
                assert col in text

    def test_to_csv_compression_xz(self):
        # GH11852
        # use the compression kw in to_csv
        tm._skip_if_no_lzma()
        df = DataFrame([[0.123456, 0.234567, 0.567567],
                        [12.32112, 123123.2, 321321.2]],
                       index=['A', 'B'], columns=['X', 'Y', 'Z'])

        with ensure_clean() as filename:

            df.to_csv(filename, compression="xz")

            # test the round trip - to_csv -> read_csv
            rs = read_csv(filename, compression="xz", index_col=0)
            assert_frame_equal(df, rs)

            # explicitly make sure file is xzipped
            lzma = compat.import_lzma()
            f = lzma.open(filename, 'rb')
            assert_frame_equal(df, read_csv(f, index_col=0))
            f.close()

    def test_to_csv_compression_value_error(self):
        # GH7615
        # use the compression kw in to_csv
        df = DataFrame([[0.123456, 0.234567, 0.567567],
                        [12.32112, 123123.2, 321321.2]],
                       index=['A', 'B'], columns=['X', 'Y', 'Z'])

        with ensure_clean() as filename:
            # zip compression is not supported and should raise ValueError
            import zipfile
            pytest.raises(zipfile.BadZipfile, df.to_csv,
                          filename, compression="zip")

    def test_to_csv_date_format(self):
        with ensure_clean('__tmp_to_csv_date_format__') as path:
            dt_index = self.tsframe.index
            datetime_frame = DataFrame(
                {'A': dt_index, 'B': dt_index.shift(1)}, index=dt_index)
            datetime_frame.to_csv(path, date_format='%Y%m%d')

            # Check that the data was put in the specified format
            test = read_csv(path, index_col=0)

            datetime_frame_int = datetime_frame.applymap(
                lambda x: int(x.strftime('%Y%m%d')))
            datetime_frame_int.index = datetime_frame_int.index.map(
                lambda x: int(x.strftime('%Y%m%d')))

            assert_frame_equal(test, datetime_frame_int)

            datetime_frame.to_csv(path, date_format='%Y-%m-%d')

            # Check that the data was put in the specified format
            test = read_csv(path, index_col=0)
            datetime_frame_str = datetime_frame.applymap(
                lambda x: x.strftime('%Y-%m-%d'))
            datetime_frame_str.index = datetime_frame_str.index.map(
                lambda x: x.strftime('%Y-%m-%d'))

            assert_frame_equal(test, datetime_frame_str)

            # Check that columns get converted
            datetime_frame_columns = datetime_frame.T
            datetime_frame_columns.to_csv(path, date_format='%Y%m%d')

            test = read_csv(path, index_col=0)

            datetime_frame_columns = datetime_frame_columns.applymap(
                lambda x: int(x.strftime('%Y%m%d')))
            # Columns don't get converted to ints by read_csv
            datetime_frame_columns.columns = (
                datetime_frame_columns.columns
                .map(lambda x: x.strftime('%Y%m%d')))

            assert_frame_equal(test, datetime_frame_columns)

            # test NaTs
            nat_index = to_datetime(
                ['NaT'] * 10 + ['2000-01-01', '1/1/2000', '1-1-2000'])
            nat_frame = DataFrame({'A': nat_index}, index=nat_index)
            nat_frame.to_csv(path, date_format='%Y-%m-%d')

            test = read_csv(path, parse_dates=[0, 1], index_col=0)

            assert_frame_equal(test, nat_frame)

    def test_to_csv_with_dst_transitions(self):

        with ensure_clean('csv_date_format_with_dst') as path:
            # make sure we are not failing on transitions
            times = pd.date_range("2013-10-26 23:00", "2013-10-27 01:00",
                                  tz="Europe/London",
                                  freq="H",
                                  ambiguous='infer')

            for i in [times, times + pd.Timedelta('10s')]:
                time_range = np.array(range(len(i)), dtype='int64')
                df = DataFrame({'A': time_range}, index=i)
                df.to_csv(path, index=True)

                # we have to reconvert the index as we
                # don't parse the tz's
                result = read_csv(path, index_col=0)
                result.index = to_datetime(result.index).tz_localize(
                    'UTC').tz_convert('Europe/London')
                assert_frame_equal(result, df)

        # GH11619
        idx = pd.date_range('2015-01-01', '2015-12-31',
                            freq='H', tz='Europe/Paris')
        df = DataFrame({'values': 1, 'idx': idx},
                       index=idx)
        with ensure_clean('csv_date_format_with_dst') as path:
            df.to_csv(path, index=True)
            result = read_csv(path, index_col=0)
            result.index = to_datetime(result.index).tz_localize(
                'UTC').tz_convert('Europe/Paris')
            result['idx'] = to_datetime(result['idx']).astype(
                'datetime64[ns, Europe/Paris]')
            assert_frame_equal(result, df)

        # assert working
        df.astype(str)

        with ensure_clean('csv_date_format_with_dst') as path:
            df.to_pickle(path)
            result = pd.read_pickle(path)
            assert_frame_equal(result, df)

    def test_to_csv_quoting(self):
        df = DataFrame({
            'c_string': ['a', 'b,c'],
            'c_int': [42, np.nan],
            'c_float': [1.0, 3.2],
            'c_bool': [True, False],
        })

        expected = """\
,c_bool,c_float,c_int,c_string
0,True,1.0,42.0,a
1,False,3.2,,"b,c"
"""
        result = df.to_csv()
        assert result == expected

        result = df.to_csv(quoting=None)
        assert result == expected

        result = df.to_csv(quoting=csv.QUOTE_MINIMAL)
        assert result == expected

        expected = """\
"","c_bool","c_float","c_int","c_string"
"0","True","1.0","42.0","a"
"1","False","3.2","","b,c"
"""
        result = df.to_csv(quoting=csv.QUOTE_ALL)
        assert result == expected

        # see gh-12922, gh-13259: make sure changes to
        # the formatters do not break this behaviour
        expected = """\
"","c_bool","c_float","c_int","c_string"
0,True,1.0,42.0,"a"
1,False,3.2,"","b,c"
"""
        result = df.to_csv(quoting=csv.QUOTE_NONNUMERIC)
        assert result == expected

        msg = "need to escape, but no escapechar set"
        tm.assert_raises_regex(csv.Error, msg, df.to_csv,
                               quoting=csv.QUOTE_NONE)
        tm.assert_raises_regex(csv.Error, msg, df.to_csv,
                               quoting=csv.QUOTE_NONE,
                               escapechar=None)

        expected = """\
,c_bool,c_float,c_int,c_string
0,True,1.0,42.0,a
1,False,3.2,,b!,c
"""
        result = df.to_csv(quoting=csv.QUOTE_NONE,
                           escapechar='!')
        assert result == expected

        expected = """\
,c_bool,c_ffloat,c_int,c_string
0,True,1.0,42.0,a
1,False,3.2,,bf,c
"""
        result = df.to_csv(quoting=csv.QUOTE_NONE,
                           escapechar='f')
        assert result == expected

        # see gh-3503: quoting Windows line terminators
        # presents with encoding?
        text = 'a,b,c\n1,"test \r\n",3\n'
        df = pd.read_csv(StringIO(text))
        buf = StringIO()
        df.to_csv(buf, encoding='utf-8', index=False)
        assert buf.getvalue() == text

        # xref gh-7791: make sure the quoting parameter is passed through
        # with multi-indexes
        df = pd.DataFrame({'a': [1, 2], 'b': [3, 4], 'c': [5, 6]})
        df = df.set_index(['a', 'b'])
        expected = '"a","b","c"\n"1","3","5"\n"2","4","6"\n'
        assert df.to_csv(quoting=csv.QUOTE_ALL) == expected

    def test_period_index_date_overflow(self):
        # see gh-15982

        dates = ["1990-01-01", "2000-01-01", "3005-01-01"]
        index = pd.PeriodIndex(dates, freq="D")

        df = pd.DataFrame([4, 5, 6], index=index)
        result = df.to_csv()

        expected = ',0\n1990-01-01,4\n2000-01-01,5\n3005-01-01,6\n'
        assert result == expected

        date_format = "%m-%d-%Y"
        result = df.to_csv(date_format=date_format)

        expected = ',0\n01-01-1990,4\n01-01-2000,5\n01-01-3005,6\n'
        assert result == expected

        # Overflow with pd.NaT
        dates = ["1990-01-01", pd.NaT, "3005-01-01"]
        index = pd.PeriodIndex(dates, freq="D")

        df = pd.DataFrame([4, 5, 6], index=index)
        result = df.to_csv()

        expected = ',0\n1990-01-01,4\n,5\n3005-01-01,6\n'
        assert result == expected
