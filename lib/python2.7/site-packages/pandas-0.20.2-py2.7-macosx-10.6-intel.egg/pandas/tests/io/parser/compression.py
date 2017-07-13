# -*- coding: utf-8 -*-

"""
Tests compressed data parsing functionality for all
of the parsers defined in parsers.py
"""

import pytest

import pandas.util.testing as tm


class CompressionTests(object):

    def test_zip(self):
        try:
            import zipfile
        except ImportError:
            pytest.skip('need zipfile to run')

        with open(self.csv1, 'rb') as data_file:
            data = data_file.read()
            expected = self.read_csv(self.csv1)

        with tm.ensure_clean('test_file.zip') as path:
            tmp = zipfile.ZipFile(path, mode='w')
            tmp.writestr('test_file', data)
            tmp.close()

            result = self.read_csv(path, compression='zip')
            tm.assert_frame_equal(result, expected)

            result = self.read_csv(path, compression='infer')
            tm.assert_frame_equal(result, expected)

            if self.engine is not 'python':
                with open(path, 'rb') as f:
                    result = self.read_csv(f, compression='zip')
                    tm.assert_frame_equal(result, expected)

        with tm.ensure_clean('combined_zip.zip') as path:
            inner_file_names = ['test_file', 'second_file']
            tmp = zipfile.ZipFile(path, mode='w')
            for file_name in inner_file_names:
                tmp.writestr(file_name, data)
            tmp.close()

            tm.assert_raises_regex(ValueError, 'Multiple files',
                                   self.read_csv, path, compression='zip')

            tm.assert_raises_regex(ValueError, 'Multiple files',
                                   self.read_csv, path,
                                   compression='infer')

        with tm.ensure_clean() as path:
            tmp = zipfile.ZipFile(path, mode='w')
            tmp.close()

            tm.assert_raises_regex(ValueError, 'Zero files',
                                   self.read_csv, path, compression='zip')

        with tm.ensure_clean() as path:
            with open(path, 'wb') as f:
                pytest.raises(zipfile.BadZipfile, self.read_csv,
                              f, compression='zip')

    def test_gzip(self):
        try:
            import gzip
        except ImportError:
            pytest.skip('need gzip to run')

        with open(self.csv1, 'rb') as data_file:
            data = data_file.read()
            expected = self.read_csv(self.csv1)

        with tm.ensure_clean() as path:
            tmp = gzip.GzipFile(path, mode='wb')
            tmp.write(data)
            tmp.close()

            result = self.read_csv(path, compression='gzip')
            tm.assert_frame_equal(result, expected)

            with open(path, 'rb') as f:
                result = self.read_csv(f, compression='gzip')
                tm.assert_frame_equal(result, expected)

        with tm.ensure_clean('test.gz') as path:
            tmp = gzip.GzipFile(path, mode='wb')
            tmp.write(data)
            tmp.close()
            result = self.read_csv(path, compression='infer')
            tm.assert_frame_equal(result, expected)

    def test_bz2(self):
        try:
            import bz2
        except ImportError:
            pytest.skip('need bz2 to run')

        with open(self.csv1, 'rb') as data_file:
            data = data_file.read()
            expected = self.read_csv(self.csv1)

        with tm.ensure_clean() as path:
            tmp = bz2.BZ2File(path, mode='wb')
            tmp.write(data)
            tmp.close()

            result = self.read_csv(path, compression='bz2')
            tm.assert_frame_equal(result, expected)

            pytest.raises(ValueError, self.read_csv,
                          path, compression='bz3')

            with open(path, 'rb') as fin:
                result = self.read_csv(fin, compression='bz2')
                tm.assert_frame_equal(result, expected)

        with tm.ensure_clean('test.bz2') as path:
            tmp = bz2.BZ2File(path, mode='wb')
            tmp.write(data)
            tmp.close()
            result = self.read_csv(path, compression='infer')
            tm.assert_frame_equal(result, expected)

    def test_xz(self):
        lzma = tm._skip_if_no_lzma()

        with open(self.csv1, 'rb') as data_file:
            data = data_file.read()
            expected = self.read_csv(self.csv1)

        with tm.ensure_clean() as path:
            tmp = lzma.LZMAFile(path, mode='wb')
            tmp.write(data)
            tmp.close()

            result = self.read_csv(path, compression='xz')
            tm.assert_frame_equal(result, expected)

            with open(path, 'rb') as f:
                result = self.read_csv(f, compression='xz')
                tm.assert_frame_equal(result, expected)

        with tm.ensure_clean('test.xz') as path:
            tmp = lzma.LZMAFile(path, mode='wb')
            tmp.write(data)
            tmp.close()
            result = self.read_csv(path, compression='infer')
            tm.assert_frame_equal(result, expected)

    def test_read_csv_infer_compression(self):
        # see gh-9770
        expected = self.read_csv(self.csv1, index_col=0, parse_dates=True)

        inputs = [self.csv1, self.csv1 + '.gz',
                  self.csv1 + '.bz2', open(self.csv1)]

        for f in inputs:
            df = self.read_csv(f, index_col=0, parse_dates=True,
                               compression='infer')

            tm.assert_frame_equal(expected, df)

        inputs[3].close()

    def test_invalid_compression(self):
        msg = 'Unrecognized compression type: sfark'
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv('test_file.zip', compression='sfark')
