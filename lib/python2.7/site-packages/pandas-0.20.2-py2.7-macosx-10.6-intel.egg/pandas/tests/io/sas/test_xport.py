import pandas as pd
import pandas.util.testing as tm
from pandas.io.sas.sasreader import read_sas
import numpy as np
import os

# CSV versions of test xpt files were obtained using the R foreign library

# Numbers in a SAS xport file are always float64, so need to convert
# before making comparisons.


def numeric_as_float(data):
    for v in data.columns:
        if data[v].dtype is np.dtype('int64'):
            data[v] = data[v].astype(np.float64)


class TestXport(object):

    def setup_method(self, method):
        self.dirpath = tm.get_data_path()
        self.file01 = os.path.join(self.dirpath, "DEMO_G.xpt")
        self.file02 = os.path.join(self.dirpath, "SSHSV1_A.xpt")
        self.file03 = os.path.join(self.dirpath, "DRXFCD_G.xpt")
        self.file04 = os.path.join(self.dirpath, "paxraw_d_short.xpt")

    def test1_basic(self):
        # Tests with DEMO_G.xpt (all numeric file)

        # Compare to this
        data_csv = pd.read_csv(self.file01.replace(".xpt", ".csv"))
        numeric_as_float(data_csv)

        # Read full file
        data = read_sas(self.file01, format="xport")
        tm.assert_frame_equal(data, data_csv)
        num_rows = data.shape[0]

        # Test reading beyond end of file
        reader = read_sas(self.file01, format="xport", iterator=True)
        data = reader.read(num_rows + 100)
        assert data.shape[0] == num_rows
        reader.close()

        # Test incremental read with `read` method.
        reader = read_sas(self.file01, format="xport", iterator=True)
        data = reader.read(10)
        reader.close()
        tm.assert_frame_equal(data, data_csv.iloc[0:10, :])

        # Test incremental read with `get_chunk` method.
        reader = read_sas(self.file01, format="xport", chunksize=10)
        data = reader.get_chunk()
        reader.close()
        tm.assert_frame_equal(data, data_csv.iloc[0:10, :])

        # Test read in loop
        m = 0
        reader = read_sas(self.file01, format="xport", chunksize=100)
        for x in reader:
            m += x.shape[0]
        reader.close()
        assert m == num_rows

        # Read full file with `read_sas` method
        data = read_sas(self.file01)
        tm.assert_frame_equal(data, data_csv)

    def test1_index(self):
        # Tests with DEMO_G.xpt using index (all numeric file)

        # Compare to this
        data_csv = pd.read_csv(self.file01.replace(".xpt", ".csv"))
        data_csv = data_csv.set_index("SEQN")
        numeric_as_float(data_csv)

        # Read full file
        data = read_sas(self.file01, index="SEQN", format="xport")
        tm.assert_frame_equal(data, data_csv, check_index_type=False)

        # Test incremental read with `read` method.
        reader = read_sas(self.file01, index="SEQN", format="xport",
                          iterator=True)
        data = reader.read(10)
        reader.close()
        tm.assert_frame_equal(data, data_csv.iloc[0:10, :],
                              check_index_type=False)

        # Test incremental read with `get_chunk` method.
        reader = read_sas(self.file01, index="SEQN", format="xport",
                          chunksize=10)
        data = reader.get_chunk()
        reader.close()
        tm.assert_frame_equal(data, data_csv.iloc[0:10, :],
                              check_index_type=False)

    def test1_incremental(self):
        # Test with DEMO_G.xpt, reading full file incrementally

        data_csv = pd.read_csv(self.file01.replace(".xpt", ".csv"))
        data_csv = data_csv.set_index("SEQN")
        numeric_as_float(data_csv)

        reader = read_sas(self.file01, index="SEQN", chunksize=1000)

        all_data = [x for x in reader]
        data = pd.concat(all_data, axis=0)

        tm.assert_frame_equal(data, data_csv, check_index_type=False)

    def test2(self):
        # Test with SSHSV1_A.xpt

        # Compare to this
        data_csv = pd.read_csv(self.file02.replace(".xpt", ".csv"))
        numeric_as_float(data_csv)

        data = read_sas(self.file02)
        tm.assert_frame_equal(data, data_csv)

    def test_multiple_types(self):
        # Test with DRXFCD_G.xpt (contains text and numeric variables)

        # Compare to this
        data_csv = pd.read_csv(self.file03.replace(".xpt", ".csv"))

        data = read_sas(self.file03, encoding="utf-8")
        tm.assert_frame_equal(data, data_csv)

    def test_truncated_float_support(self):
        # Test with paxraw_d_short.xpt, a shortened version of:
        # http://wwwn.cdc.gov/Nchs/Nhanes/2005-2006/PAXRAW_D.ZIP
        # This file has truncated floats (5 bytes in this case).

        # GH 11713

        data_csv = pd.read_csv(self.file04.replace(".xpt", ".csv"))

        data = read_sas(self.file04, format="xport")
        tm.assert_frame_equal(data.astype('int64'), data_csv)
