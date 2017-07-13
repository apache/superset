import pandas as pd
from pandas.compat import PY2
import pandas.util.testing as tm
import os
import io
import pytest
import numpy as np


class TestSAS7BDAT(object):

    def setup_method(self, method):
        self.dirpath = tm.get_data_path()
        self.data = []
        self.test_ix = [list(range(1, 16)), [16]]
        for j in 1, 2:
            fname = os.path.join(self.dirpath, "test_sas7bdat_%d.csv" % j)
            df = pd.read_csv(fname)
            epoch = pd.datetime(1960, 1, 1)
            t1 = pd.to_timedelta(df["Column4"], unit='d')
            df["Column4"] = epoch + t1
            t2 = pd.to_timedelta(df["Column12"], unit='d')
            df["Column12"] = epoch + t2
            for k in range(df.shape[1]):
                col = df.iloc[:, k]
                if col.dtype == np.int64:
                    df.iloc[:, k] = df.iloc[:, k].astype(np.float64)
                elif col.dtype == np.dtype('O'):
                    if PY2:
                        f = lambda x: (x.decode('utf-8') if
                                       isinstance(x, str) else x)
                        df.iloc[:, k] = df.iloc[:, k].apply(f)
            self.data.append(df)

    def test_from_file(self):
        for j in 0, 1:
            df0 = self.data[j]
            for k in self.test_ix[j]:
                fname = os.path.join(self.dirpath, "test%d.sas7bdat" % k)
                df = pd.read_sas(fname, encoding='utf-8')
                tm.assert_frame_equal(df, df0)

    def test_from_buffer(self):
        for j in 0, 1:
            df0 = self.data[j]
            for k in self.test_ix[j]:
                fname = os.path.join(self.dirpath, "test%d.sas7bdat" % k)
                with open(fname, 'rb') as f:
                    byts = f.read()
                buf = io.BytesIO(byts)
                rdr = pd.read_sas(buf, format="sas7bdat",
                                  iterator=True, encoding='utf-8')
                df = rdr.read()
                tm.assert_frame_equal(df, df0, check_exact=False)
                rdr.close()

    def test_from_iterator(self):
        for j in 0, 1:
            df0 = self.data[j]
            for k in self.test_ix[j]:
                fname = os.path.join(self.dirpath, "test%d.sas7bdat" % k)
                rdr = pd.read_sas(fname, iterator=True, encoding='utf-8')
                df = rdr.read(2)
                tm.assert_frame_equal(df, df0.iloc[0:2, :])
                df = rdr.read(3)
                tm.assert_frame_equal(df, df0.iloc[2:5, :])
                rdr.close()

    @pytest.mark.xfail(reason="read_sas currently doesn't work with pathlib")
    def test_path_pathlib(self):
        tm._skip_if_no_pathlib()
        from pathlib import Path
        for j in 0, 1:
            df0 = self.data[j]
            for k in self.test_ix[j]:
                fname = Path(os.path.join(self.dirpath, "test%d.sas7bdat" % k))
                df = pd.read_sas(fname, encoding='utf-8')
                tm.assert_frame_equal(df, df0)

    @pytest.mark.xfail(reason="read_sas currently doesn't work with localpath")
    def test_path_localpath(self):
        tm._skip_if_no_localpath()
        from py.path import local as LocalPath
        for j in 0, 1:
            df0 = self.data[j]
            for k in self.test_ix[j]:
                fname = LocalPath(os.path.join(self.dirpath,
                                               "test%d.sas7bdat" % k))
                df = pd.read_sas(fname, encoding='utf-8')
                tm.assert_frame_equal(df, df0)

    def test_iterator_loop(self):
        # github #13654
        for j in 0, 1:
            for k in self.test_ix[j]:
                for chunksize in 3, 5, 10, 11:
                    fname = os.path.join(self.dirpath, "test%d.sas7bdat" % k)
                    rdr = pd.read_sas(fname, chunksize=10, encoding='utf-8')
                    y = 0
                    for x in rdr:
                        y += x.shape[0]
                    assert y == rdr.row_count
                    rdr.close()

    def test_iterator_read_too_much(self):
        # github #14734
        k = self.test_ix[0][0]
        fname = os.path.join(self.dirpath, "test%d.sas7bdat" % k)
        rdr = pd.read_sas(fname, format="sas7bdat",
                          iterator=True, encoding='utf-8')
        d1 = rdr.read(rdr.row_count + 20)
        rdr.close()

        rdr = pd.read_sas(fname, iterator=True, encoding="utf-8")
        d2 = rdr.read(rdr.row_count + 20)
        tm.assert_frame_equal(d1, d2)
        rdr.close()


def test_encoding_options():
    dirpath = tm.get_data_path()
    fname = os.path.join(dirpath, "test1.sas7bdat")
    df1 = pd.read_sas(fname)
    df2 = pd.read_sas(fname, encoding='utf-8')
    for col in df1.columns:
        try:
            df1[col] = df1[col].str.decode('utf-8')
        except AttributeError:
            pass
    tm.assert_frame_equal(df1, df2)

    from pandas.io.sas.sas7bdat import SAS7BDATReader
    rdr = SAS7BDATReader(fname, convert_header_text=False)
    df3 = rdr.read()
    rdr.close()
    for x, y in zip(df1.columns, df3.columns):
        assert(x == y.decode())


def test_productsales():
    dirpath = tm.get_data_path()
    fname = os.path.join(dirpath, "productsales.sas7bdat")
    df = pd.read_sas(fname, encoding='utf-8')
    fname = os.path.join(dirpath, "productsales.csv")
    df0 = pd.read_csv(fname)
    vn = ["ACTUAL", "PREDICT", "QUARTER", "YEAR", "MONTH"]
    df0[vn] = df0[vn].astype(np.float64)
    tm.assert_frame_equal(df, df0)


def test_12659():
    dirpath = tm.get_data_path()
    fname = os.path.join(dirpath, "test_12659.sas7bdat")
    df = pd.read_sas(fname)
    fname = os.path.join(dirpath, "test_12659.csv")
    df0 = pd.read_csv(fname)
    df0 = df0.astype(np.float64)
    tm.assert_frame_equal(df, df0)


def test_airline():
    dirpath = tm.get_data_path()
    fname = os.path.join(dirpath, "airline.sas7bdat")
    df = pd.read_sas(fname)
    fname = os.path.join(dirpath, "airline.csv")
    df0 = pd.read_csv(fname)
    df0 = df0.astype(np.float64)
    tm.assert_frame_equal(df, df0, check_exact=False)
