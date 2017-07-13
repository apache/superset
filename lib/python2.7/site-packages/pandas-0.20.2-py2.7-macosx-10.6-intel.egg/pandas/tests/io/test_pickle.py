# pylint: disable=E1101,E1103,W0232

"""
manage legacy pickle tests

How to add pickle tests:

1. Install pandas version intended to output the pickle.

2. Execute "generate_legacy_storage_files.py" to create the pickle.
$ python generate_legacy_storage_files.py <output_dir> pickle

3. Move the created pickle to "data/legacy_pickle/<version>" directory.
"""

import pytest
from warnings import catch_warnings

import os
from distutils.version import LooseVersion
import pandas as pd
from pandas import Index
from pandas.compat import is_platform_little_endian
import pandas
import pandas.util.testing as tm
from pandas.tseries.offsets import Day, MonthEnd
import shutil


@pytest.fixture(scope='module')
def current_pickle_data():
    # our current version pickle data
    from pandas.tests.io.generate_legacy_storage_files import (
        create_pickle_data)
    return create_pickle_data()


# ---------------------
# comparision functions
# ---------------------
def compare_element(result, expected, typ, version=None):
    if isinstance(expected, Index):
        tm.assert_index_equal(expected, result)
        return

    if typ.startswith('sp_'):
        comparator = getattr(tm, "assert_%s_equal" % typ)
        comparator(result, expected, exact_indices=False)
    elif typ == 'timestamp':
        if expected is pd.NaT:
            assert result is pd.NaT
        else:
            assert result == expected
            assert result.freq == expected.freq
    else:
        comparator = getattr(tm, "assert_%s_equal" %
                             typ, tm.assert_almost_equal)
        comparator(result, expected)


def compare(data, vf, version):

    # py3 compat when reading py2 pickle
    try:
        data = pandas.read_pickle(vf)
    except (ValueError) as e:
        if 'unsupported pickle protocol:' in str(e):
            # trying to read a py3 pickle in py2
            return
        else:
            raise

    m = globals()
    for typ, dv in data.items():
        for dt, result in dv.items():
            try:
                expected = data[typ][dt]
            except (KeyError):
                if version in ('0.10.1', '0.11.0') and dt == 'reg':
                    break
                else:
                    raise

            # use a specific comparator
            # if available
            comparator = "compare_{typ}_{dt}".format(typ=typ, dt=dt)

            comparator = m.get(comparator, m['compare_element'])
            comparator(result, expected, typ, version)
    return data


def compare_sp_series_ts(res, exp, typ, version):
    # SparseTimeSeries integrated into SparseSeries in 0.12.0
    # and deprecated in 0.17.0
    if version and LooseVersion(version) <= "0.12.0":
        tm.assert_sp_series_equal(res, exp, check_series_type=False)
    else:
        tm.assert_sp_series_equal(res, exp)


def compare_series_ts(result, expected, typ, version):
    # GH 7748
    tm.assert_series_equal(result, expected)
    assert result.index.freq == expected.index.freq
    assert not result.index.freq.normalize
    tm.assert_series_equal(result > 0, expected > 0)

    # GH 9291
    freq = result.index.freq
    assert freq + Day(1) == Day(2)

    res = freq + pandas.Timedelta(hours=1)
    assert isinstance(res, pandas.Timedelta)
    assert res == pandas.Timedelta(days=1, hours=1)

    res = freq + pandas.Timedelta(nanoseconds=1)
    assert isinstance(res, pandas.Timedelta)
    assert res == pandas.Timedelta(days=1, nanoseconds=1)


def compare_series_dt_tz(result, expected, typ, version):
    # 8260
    # dtype is object < 0.17.0
    if LooseVersion(version) < '0.17.0':
        expected = expected.astype(object)
        tm.assert_series_equal(result, expected)
    else:
        tm.assert_series_equal(result, expected)


def compare_series_cat(result, expected, typ, version):
    # Categorical dtype is added in 0.15.0
    # ordered is changed in 0.16.0
    if LooseVersion(version) < '0.15.0':
        tm.assert_series_equal(result, expected, check_dtype=False,
                               check_categorical=False)
    elif LooseVersion(version) < '0.16.0':
        tm.assert_series_equal(result, expected, check_categorical=False)
    else:
        tm.assert_series_equal(result, expected)


def compare_frame_dt_mixed_tzs(result, expected, typ, version):
    # 8260
    # dtype is object < 0.17.0
    if LooseVersion(version) < '0.17.0':
        expected = expected.astype(object)
        tm.assert_frame_equal(result, expected)
    else:
        tm.assert_frame_equal(result, expected)


def compare_frame_cat_onecol(result, expected, typ, version):
    # Categorical dtype is added in 0.15.0
    # ordered is changed in 0.16.0
    if LooseVersion(version) < '0.15.0':
        tm.assert_frame_equal(result, expected, check_dtype=False,
                              check_categorical=False)
    elif LooseVersion(version) < '0.16.0':
        tm.assert_frame_equal(result, expected, check_categorical=False)
    else:
        tm.assert_frame_equal(result, expected)


def compare_frame_cat_and_float(result, expected, typ, version):
    compare_frame_cat_onecol(result, expected, typ, version)


def compare_index_period(result, expected, typ, version):
    tm.assert_index_equal(result, expected)
    assert isinstance(result.freq, MonthEnd)
    assert result.freq == MonthEnd()
    assert result.freqstr == 'M'
    tm.assert_index_equal(result.shift(2), expected.shift(2))


def compare_sp_frame_float(result, expected, typ, version):
    if LooseVersion(version) <= '0.18.1':
        tm.assert_sp_frame_equal(result, expected, exact_indices=False,
                                 check_dtype=False)
    else:
        tm.assert_sp_frame_equal(result, expected)


# ---------------------
# tests
# ---------------------
def legacy_pickle_versions():
    # yield the pickle versions
    path = tm.get_data_path('legacy_pickle')
    for v in os.listdir(path):
        p = os.path.join(path, v)
        if os.path.isdir(p):
            yield v


@pytest.mark.parametrize('version', legacy_pickle_versions())
def test_pickles(current_pickle_data, version):
    if not is_platform_little_endian():
        pytest.skip("known failure on non-little endian")

    pth = tm.get_data_path('legacy_pickle/{0}'.format(version))
    n = 0
    for f in os.listdir(pth):
        vf = os.path.join(pth, f)
        with catch_warnings(record=True):
            data = compare(current_pickle_data, vf, version)

        if data is None:
            continue
        n += 1
    assert n > 0, ('Pickle files are not '
                   'tested: {version}'.format(version=version))


def test_round_trip_current(current_pickle_data):

    try:
        import cPickle as c_pickle

        def c_pickler(obj, path):
            with open(path, 'wb') as fh:
                c_pickle.dump(obj, fh, protocol=-1)

        def c_unpickler(path):
            with open(path, 'rb') as fh:
                fh.seek(0)
                return c_pickle.load(fh)
    except:
        c_pickler = None
        c_unpickler = None

    import pickle as python_pickle

    def python_pickler(obj, path):
        with open(path, 'wb') as fh:
            python_pickle.dump(obj, fh, protocol=-1)

    def python_unpickler(path):
        with open(path, 'rb') as fh:
            fh.seek(0)
            return python_pickle.load(fh)

    data = current_pickle_data
    for typ, dv in data.items():
        for dt, expected in dv.items():

            for writer in [pd.to_pickle, c_pickler, python_pickler]:
                if writer is None:
                    continue

                with tm.ensure_clean() as path:

                    # test writing with each pickler
                    writer(expected, path)

                    # test reading with each unpickler
                    result = pd.read_pickle(path)
                    compare_element(result, expected, typ)

                    if c_unpickler is not None:
                        result = c_unpickler(path)
                        compare_element(result, expected, typ)

                    result = python_unpickler(path)
                    compare_element(result, expected, typ)


def test_pickle_v0_14_1():

    cat = pd.Categorical(values=['a', 'b', 'c'], ordered=False,
                         categories=['a', 'b', 'c', 'd'])
    pickle_path = os.path.join(tm.get_data_path(),
                               'categorical_0_14_1.pickle')
    # This code was executed once on v0.14.1 to generate the pickle:
    #
    # cat = Categorical(labels=np.arange(3), levels=['a', 'b', 'c', 'd'],
    #                   name='foobar')
    # with open(pickle_path, 'wb') as f: pickle.dump(cat, f)
    #
    tm.assert_categorical_equal(cat, pd.read_pickle(pickle_path))


def test_pickle_v0_15_2():
    # ordered -> _ordered
    # GH 9347

    cat = pd.Categorical(values=['a', 'b', 'c'], ordered=False,
                         categories=['a', 'b', 'c', 'd'])
    pickle_path = os.path.join(tm.get_data_path(),
                               'categorical_0_15_2.pickle')
    # This code was executed once on v0.15.2 to generate the pickle:
    #
    # cat = Categorical(labels=np.arange(3), levels=['a', 'b', 'c', 'd'],
    #                   name='foobar')
    # with open(pickle_path, 'wb') as f: pickle.dump(cat, f)
    #
    tm.assert_categorical_equal(cat, pd.read_pickle(pickle_path))


def test_pickle_path_pathlib():
    df = tm.makeDataFrame()
    result = tm.round_trip_pathlib(df.to_pickle, pd.read_pickle)
    tm.assert_frame_equal(df, result)


def test_pickle_path_localpath():
    df = tm.makeDataFrame()
    result = tm.round_trip_localpath(df.to_pickle, pd.read_pickle)
    tm.assert_frame_equal(df, result)


# ---------------------
# test pickle compression
# ---------------------

@pytest.fixture
def get_random_path():
    return u'__%s__.pickle' % tm.rands(10)


class TestCompression(object):

    _compression_to_extension = {
        None: ".none",
        'gzip': '.gz',
        'bz2': '.bz2',
        'zip': '.zip',
        'xz': '.xz',
    }

    def compress_file(self, src_path, dest_path, compression):
        if compression is None:
            shutil.copyfile(src_path, dest_path)
            return

        if compression == 'gzip':
            import gzip
            f = gzip.open(dest_path, "w")
        elif compression == 'bz2':
            import bz2
            f = bz2.BZ2File(dest_path, "w")
        elif compression == 'zip':
            import zipfile
            zip_file = zipfile.ZipFile(dest_path, "w",
                                       compression=zipfile.ZIP_DEFLATED)
            zip_file.write(src_path, os.path.basename(src_path))
        elif compression == 'xz':
            lzma = pandas.compat.import_lzma()
            f = lzma.LZMAFile(dest_path, "w")
        else:
            msg = 'Unrecognized compression type: {}'.format(compression)
            raise ValueError(msg)

        if compression != "zip":
            with open(src_path, "rb") as fh:
                f.write(fh.read())
            f.close()

    def decompress_file(self, src_path, dest_path, compression):
        if compression is None:
            shutil.copyfile(src_path, dest_path)
            return

        if compression == 'gzip':
            import gzip
            f = gzip.open(src_path, "r")
        elif compression == 'bz2':
            import bz2
            f = bz2.BZ2File(src_path, "r")
        elif compression == 'zip':
            import zipfile
            zip_file = zipfile.ZipFile(src_path)
            zip_names = zip_file.namelist()
            if len(zip_names) == 1:
                f = zip_file.open(zip_names.pop())
            else:
                raise ValueError('ZIP file {} error. Only one file per ZIP.'
                                 .format(src_path))
        elif compression == 'xz':
            lzma = pandas.compat.import_lzma()
            f = lzma.LZMAFile(src_path, "r")
        else:
            msg = 'Unrecognized compression type: {}'.format(compression)
            raise ValueError(msg)

        with open(dest_path, "wb") as fh:
            fh.write(f.read())
        f.close()

    @pytest.mark.parametrize('compression', [None, 'gzip', 'bz2', 'xz'])
    def test_write_explicit(self, compression, get_random_path):
        # issue 11666
        if compression == 'xz':
            tm._skip_if_no_lzma()

        base = get_random_path
        path1 = base + ".compressed"
        path2 = base + ".raw"

        with tm.ensure_clean(path1) as p1, tm.ensure_clean(path2) as p2:
            df = tm.makeDataFrame()

            # write to compressed file
            df.to_pickle(p1, compression=compression)

            # decompress
            self.decompress_file(p1, p2, compression=compression)

            # read decompressed file
            df2 = pd.read_pickle(p2, compression=None)

            tm.assert_frame_equal(df, df2)

    @pytest.mark.parametrize('compression', ['', 'None', 'bad', '7z'])
    def test_write_explicit_bad(self, compression, get_random_path):
        with tm.assert_raises_regex(ValueError,
                                    "Unrecognized compression type"):
            with tm.ensure_clean(get_random_path) as path:
                df = tm.makeDataFrame()
                df.to_pickle(path, compression=compression)

    @pytest.mark.parametrize('ext', ['', '.gz', '.bz2', '.xz', '.no_compress'])
    def test_write_infer(self, ext, get_random_path):
        if ext == '.xz':
            tm._skip_if_no_lzma()

        base = get_random_path
        path1 = base + ext
        path2 = base + ".raw"
        compression = None
        for c in self._compression_to_extension:
            if self._compression_to_extension[c] == ext:
                compression = c
                break

        with tm.ensure_clean(path1) as p1, tm.ensure_clean(path2) as p2:
            df = tm.makeDataFrame()

            # write to compressed file by inferred compression method
            df.to_pickle(p1)

            # decompress
            self.decompress_file(p1, p2, compression=compression)

            # read decompressed file
            df2 = pd.read_pickle(p2, compression=None)

            tm.assert_frame_equal(df, df2)

    @pytest.mark.parametrize('compression', [None, 'gzip', 'bz2', 'xz', "zip"])
    def test_read_explicit(self, compression, get_random_path):
        # issue 11666
        if compression == 'xz':
            tm._skip_if_no_lzma()

        base = get_random_path
        path1 = base + ".raw"
        path2 = base + ".compressed"

        with tm.ensure_clean(path1) as p1, tm.ensure_clean(path2) as p2:
            df = tm.makeDataFrame()

            # write to uncompressed file
            df.to_pickle(p1, compression=None)

            # compress
            self.compress_file(p1, p2, compression=compression)

            # read compressed file
            df2 = pd.read_pickle(p2, compression=compression)

            tm.assert_frame_equal(df, df2)

    @pytest.mark.parametrize('ext', ['', '.gz', '.bz2', '.xz', '.zip',
                                     '.no_compress'])
    def test_read_infer(self, ext, get_random_path):
        if ext == '.xz':
            tm._skip_if_no_lzma()

        base = get_random_path
        path1 = base + ".raw"
        path2 = base + ext
        compression = None
        for c in self._compression_to_extension:
            if self._compression_to_extension[c] == ext:
                compression = c
                break

        with tm.ensure_clean(path1) as p1, tm.ensure_clean(path2) as p2:
            df = tm.makeDataFrame()

            # write to uncompressed file
            df.to_pickle(p1, compression=None)

            # compress
            self.compress_file(p1, p2, compression=compression)

            # read compressed file by inferred compression method
            df2 = pd.read_pickle(p2)

            tm.assert_frame_equal(df, df2)
