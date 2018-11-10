"""Unit tests for DataFrameCache"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
import datetime
import os
import shutil
import tempfile
import time
import pandas as pd
from pandas.testing import assert_frame_equal
from tests.base_tests import SupersetTestCase
from ..cache.dataframe import DataFrameCache
class DataFrameCacheTestCase(SupersetTestCase):
    def setUp(self):
        self.cache = DataFrameCache(cache_dir=tempfile.mkdtemp())
    def tearDown(self):
        shutil.rmtree(self.cache._path)
    def get_df(self, key):
        return pd.DataFrame({'one': pd.Series([1, 2, 3]),
                             key: pd.Series([1, 2, 3, 4])})
    def test_get_dict(self):
        a = self.get_df('a')
        b = self.get_df('b')
        assert self.cache.set('a', a)
        assert self.cache.set('b', b)
        d = self.cache.get_dict('a', 'b')
        assert 'a' in d
        assert_frame_equal(a, d['a'])
        assert_frame_equal(b, d['b'])
    def test_set_get(self):
        for i in range(3):
            assert self.cache.set(str(i), self.get_df(str(i)))
        for i in range(3):
            assert_frame_equal(self.cache.get(str(i)), self.get_df(str(i)))
    def test_get_set(self):
        assert self.cache.set('foo', self.get_df('bar'))
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
    def test_get_many(self):
        assert self.cache.set('foo', self.get_df('bar'))
        assert self.cache.set('spam', self.get_df('eggs'))
        result = list(self.cache.get_many('foo', 'spam'))
        assert_frame_equal(result[0], self.get_df('bar'))
        assert_frame_equal(result[1], self.get_df('eggs'))
    def test_set_many(self):
        assert self.cache.set_many({'foo': self.get_df('bar'),
                                    'spam': self.get_df('eggs')})
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
        assert_frame_equal(self.cache.get('spam'), self.get_df('eggs'))
    def test_add(self):
        # sanity check that add() works like set()
        assert self.cache.add('foo', self.get_df('bar'))
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
        assert not self.cache.add('foo', self.get_df('qux'))
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
    def test_delete(self):
        assert self.cache.add('foo', self.get_df('bar'))
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
        assert self.cache.delete('foo')
        assert self.cache.get('foo') is None
    def test_delete_many(self):
        assert self.cache.add('foo', self.get_df('bar'))
        assert self.cache.add('spam', self.get_df('eggs'))
        assert self.cache.delete_many('foo', 'spam')
        assert self.cache.get('foo') is None
        assert self.cache.get('spam') is None
    def test_timeout(self):
        self.cache.set('foo', self.get_df('bar'), 0)
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
        self.cache.set('baz', self.get_df('qux'), 1)
        assert_frame_equal(self.cache.get('baz'), self.get_df('qux'))
        time.sleep(3)
        # timeout of zero means no timeout
        assert_frame_equal(self.cache.get('foo'), self.get_df('bar'))
        assert self.cache.get('baz') is None
    def test_has(self):
        assert self.cache.has('foo') in (False, 0)
        assert self.cache.has('spam') in (False, 0)
        assert self.cache.set('foo', self.get_df('bar'))
        assert self.cache.has('foo') in (True, 1)
        assert self.cache.has('spam') in (False, 0)
        self.cache.delete('foo')
        assert self.cache.has('foo') in (False, 0)
        assert self.cache.has('spam') in (False, 0)
    def test_prune(self):
        THRESHOLD = 13
        c = DataFrameCache(cache_dir=tempfile.mkdtemp(),
                           threshold=THRESHOLD)
        for i in range(2 * THRESHOLD):
            assert c.set(str(i), self.get_df(str(i)))
        cache_files = os.listdir(c._path)
        shutil.rmtree(c._path)
        # There will be a small .expires file for every cached file
        assert len(cache_files) <= THRESHOLD * 2
    def test_clear(self):
        cache_files = os.listdir(self.cache._path)
        assert self.cache.set('foo', self.get_df('bar'))
        cache_files = os.listdir(self.cache._path)
        # There will be a small .expires file for every cached file
        assert len(cache_files) == 2
        assert self.cache.clear()
        cache_files = os.listdir(self.cache._path)
        assert len(cache_files) == 0
    def test_non_feather_format(self):
        # The Feather on-disk format isn't indexed and doesn't handle
        # Object-type columns with non-homogeneous data
        # See:
        # - https://github.com/wesm/feather/tree/master/python#limitations
        # - https://github.com/wesm/feather/issues/200
        now = datetime.datetime.now
        df = pd.DataFrame({'one': pd.Series([1, 2, 3], index=['a', 'b', 'c']),
                           'two': pd.Series([1, 'string', now(), 4],
                                            index=['a', 'b', 'c', 'd'])})
        assert self.cache.set('foo', df)
        assert_frame_equal(self.cache.get('foo'), df)