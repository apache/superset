# -*- coding: utf-8 -*-

"""
Tests parsers ability to read and parse non-local files
and hence require a network connection to be read.
"""

import os
import pytest

import pandas.util.testing as tm
from pandas import DataFrame
from pandas.io.parsers import read_csv, read_table


@pytest.fixture(scope='module')
def salaries_table():
    path = os.path.join(tm.get_data_path(), 'salaries.csv')
    return read_table(path)


@pytest.mark.parametrize(
    "compression,extension",
    [('gzip', '.gz'), ('bz2', '.bz2'), ('zip', '.zip'),
     pytest.mark.skipif(not tm._check_if_lzma(),
                        reason='need backports.lzma to run')(('xz', '.xz'))])
@pytest.mark.parametrize('mode', ['explicit', 'infer'])
@pytest.mark.parametrize('engine', ['python', 'c'])
def test_compressed_urls(salaries_table, compression, extension, mode, engine):
    check_compressed_urls(salaries_table, compression, extension, mode, engine)


@tm.network
def check_compressed_urls(salaries_table, compression, extension, mode,
                          engine):
    # test reading compressed urls with various engines and
    # extension inference
    base_url = ('https://github.com/pandas-dev/pandas/raw/master/'
                'pandas/tests/io/parser/data/salaries.csv')

    url = base_url + extension

    if mode != 'explicit':
        compression = mode

    url_table = read_table(url, compression=compression, engine=engine)
    tm.assert_frame_equal(url_table, salaries_table)


class TestS3(object):

    def setup_method(self, method):
        try:
            import s3fs  # noqa
        except ImportError:
            pytest.skip("s3fs not installed")

    @tm.network
    def test_parse_public_s3_bucket(self):
        for ext, comp in [('', None), ('.gz', 'gzip'), ('.bz2', 'bz2')]:
            df = read_csv('s3://pandas-test/tips.csv' +
                          ext, compression=comp)
            assert isinstance(df, DataFrame)
            assert not df.empty
            tm.assert_frame_equal(read_csv(
                tm.get_data_path('tips.csv')), df)

        # Read public file from bucket with not-public contents
        df = read_csv('s3://cant_get_it/tips.csv')
        assert isinstance(df, DataFrame)
        assert not df.empty
        tm.assert_frame_equal(read_csv(tm.get_data_path('tips.csv')), df)

    @tm.network
    def test_parse_public_s3n_bucket(self):
        # Read from AWS s3 as "s3n" URL
        df = read_csv('s3n://pandas-test/tips.csv', nrows=10)
        assert isinstance(df, DataFrame)
        assert not df.empty
        tm.assert_frame_equal(read_csv(
            tm.get_data_path('tips.csv')).iloc[:10], df)

    @tm.network
    def test_parse_public_s3a_bucket(self):
        # Read from AWS s3 as "s3a" URL
        df = read_csv('s3a://pandas-test/tips.csv', nrows=10)
        assert isinstance(df, DataFrame)
        assert not df.empty
        tm.assert_frame_equal(read_csv(
            tm.get_data_path('tips.csv')).iloc[:10], df)

    @tm.network
    def test_parse_public_s3_bucket_nrows(self):
        for ext, comp in [('', None), ('.gz', 'gzip'), ('.bz2', 'bz2')]:
            df = read_csv('s3://pandas-test/tips.csv' +
                          ext, nrows=10, compression=comp)
            assert isinstance(df, DataFrame)
            assert not df.empty
            tm.assert_frame_equal(read_csv(
                tm.get_data_path('tips.csv')).iloc[:10], df)

    @tm.network
    def test_parse_public_s3_bucket_chunked(self):
        # Read with a chunksize
        chunksize = 5
        local_tips = read_csv(tm.get_data_path('tips.csv'))
        for ext, comp in [('', None), ('.gz', 'gzip'), ('.bz2', 'bz2')]:
            df_reader = read_csv('s3://pandas-test/tips.csv' + ext,
                                 chunksize=chunksize, compression=comp)
            assert df_reader.chunksize == chunksize
            for i_chunk in [0, 1, 2]:
                # Read a couple of chunks and make sure we see them
                # properly.
                df = df_reader.get_chunk()
                assert isinstance(df, DataFrame)
                assert not df.empty
                true_df = local_tips.iloc[
                    chunksize * i_chunk: chunksize * (i_chunk + 1)]
                tm.assert_frame_equal(true_df, df)

    @tm.network
    def test_parse_public_s3_bucket_chunked_python(self):
        # Read with a chunksize using the Python parser
        chunksize = 5
        local_tips = read_csv(tm.get_data_path('tips.csv'))
        for ext, comp in [('', None), ('.gz', 'gzip'), ('.bz2', 'bz2')]:
            df_reader = read_csv('s3://pandas-test/tips.csv' + ext,
                                 chunksize=chunksize, compression=comp,
                                 engine='python')
            assert df_reader.chunksize == chunksize
            for i_chunk in [0, 1, 2]:
                # Read a couple of chunks and make sure we see them properly.
                df = df_reader.get_chunk()
                assert isinstance(df, DataFrame)
                assert not df.empty
                true_df = local_tips.iloc[
                    chunksize * i_chunk: chunksize * (i_chunk + 1)]
                tm.assert_frame_equal(true_df, df)

    @tm.network
    def test_parse_public_s3_bucket_python(self):
        for ext, comp in [('', None), ('.gz', 'gzip'), ('.bz2', 'bz2')]:
            df = read_csv('s3://pandas-test/tips.csv' + ext, engine='python',
                          compression=comp)
            assert isinstance(df, DataFrame)
            assert not df.empty
            tm.assert_frame_equal(read_csv(
                tm.get_data_path('tips.csv')), df)

    @tm.network
    def test_infer_s3_compression(self):
        for ext in ['', '.gz', '.bz2']:
            df = read_csv('s3://pandas-test/tips.csv' + ext,
                          engine='python', compression='infer')
            assert isinstance(df, DataFrame)
            assert not df.empty
            tm.assert_frame_equal(read_csv(
                tm.get_data_path('tips.csv')), df)

    @tm.network
    def test_parse_public_s3_bucket_nrows_python(self):
        for ext, comp in [('', None), ('.gz', 'gzip'), ('.bz2', 'bz2')]:
            df = read_csv('s3://pandas-test/tips.csv' + ext, engine='python',
                          nrows=10, compression=comp)
            assert isinstance(df, DataFrame)
            assert not df.empty
            tm.assert_frame_equal(read_csv(
                tm.get_data_path('tips.csv')).iloc[:10], df)

    @tm.network
    def test_s3_fails(self):
        with pytest.raises(IOError):
            read_csv('s3://nyqpug/asdf.csv')

        # Receive a permission error when trying to read a private bucket.
        # It's irrelevant here that this isn't actually a table.
        with pytest.raises(IOError):
            read_csv('s3://cant_get_it/')

    @tm.network
    def boto3_client_s3(self):
        # see gh-16135

        # boto3 is a dependency of s3fs
        import boto3
        client = boto3.client("s3")

        key = "/tips.csv"
        bucket = "pandas-test"
        s3_object = client.get_object(Bucket=bucket, Key=key)

        result = read_csv(s3_object["Body"])
        assert isinstance(result, DataFrame)
        assert not result.empty

        expected = read_csv(tm.get_data_path('tips.csv'))
        tm.assert_frame_equal(result, expected)
