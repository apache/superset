# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from datetime import datetime
import re

from pandas.compat import (zip, range, lrange, StringIO)
from pandas import (DataFrame, Series, Index, date_range, compat,
                    Timestamp)
import pandas as pd

from numpy import nan
import numpy as np

from pandas.util.testing import (assert_series_equal,
                                 assert_frame_equal)

import pandas.util.testing as tm

from pandas.tests.frame.common import TestData


class TestDataFrameReplace(TestData):

    def test_replace_inplace(self):
        self.tsframe['A'][:5] = nan
        self.tsframe['A'][-5:] = nan

        tsframe = self.tsframe.copy()
        tsframe.replace(nan, 0, inplace=True)
        assert_frame_equal(tsframe, self.tsframe.fillna(0))

        pytest.raises(TypeError, self.tsframe.replace, nan, inplace=True)
        pytest.raises(TypeError, self.tsframe.replace, nan)

        # mixed type
        mf = self.mixed_frame
        mf.iloc[5:20, mf.columns.get_loc('foo')] = nan
        mf.iloc[-10:, mf.columns.get_loc('A')] = nan

        result = self.mixed_frame.replace(np.nan, 0)
        expected = self.mixed_frame.fillna(value=0)
        assert_frame_equal(result, expected)

        tsframe = self.tsframe.copy()
        tsframe.replace([nan], [0], inplace=True)
        assert_frame_equal(tsframe, self.tsframe.fillna(0))

    def test_regex_replace_scalar(self):
        obj = {'a': list('ab..'), 'b': list('efgh')}
        dfobj = DataFrame(obj)
        mix = {'a': lrange(4), 'b': list('ab..')}
        dfmix = DataFrame(mix)

        # simplest cases
        # regex -> value
        # obj frame
        res = dfobj.replace(r'\s*\.\s*', nan, regex=True)
        assert_frame_equal(dfobj, res.fillna('.'))

        # mixed
        res = dfmix.replace(r'\s*\.\s*', nan, regex=True)
        assert_frame_equal(dfmix, res.fillna('.'))

        # regex -> regex
        # obj frame
        res = dfobj.replace(r'\s*(\.)\s*', r'\1\1\1', regex=True)
        objc = obj.copy()
        objc['a'] = ['a', 'b', '...', '...']
        expec = DataFrame(objc)
        assert_frame_equal(res, expec)

        # with mixed
        res = dfmix.replace(r'\s*(\.)\s*', r'\1\1\1', regex=True)
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

        # everything with compiled regexs as well
        res = dfobj.replace(re.compile(r'\s*\.\s*'), nan, regex=True)
        assert_frame_equal(dfobj, res.fillna('.'))

        # mixed
        res = dfmix.replace(re.compile(r'\s*\.\s*'), nan, regex=True)
        assert_frame_equal(dfmix, res.fillna('.'))

        # regex -> regex
        # obj frame
        res = dfobj.replace(re.compile(r'\s*(\.)\s*'), r'\1\1\1')
        objc = obj.copy()
        objc['a'] = ['a', 'b', '...', '...']
        expec = DataFrame(objc)
        assert_frame_equal(res, expec)

        # with mixed
        res = dfmix.replace(re.compile(r'\s*(\.)\s*'), r'\1\1\1')
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

        res = dfmix.replace(regex=re.compile(r'\s*(\.)\s*'), value=r'\1\1\1')
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

        res = dfmix.replace(regex=r'\s*(\.)\s*', value=r'\1\1\1')
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

    def test_regex_replace_scalar_inplace(self):
        obj = {'a': list('ab..'), 'b': list('efgh')}
        dfobj = DataFrame(obj)
        mix = {'a': lrange(4), 'b': list('ab..')}
        dfmix = DataFrame(mix)

        # simplest cases
        # regex -> value
        # obj frame
        res = dfobj.copy()
        res.replace(r'\s*\.\s*', nan, regex=True, inplace=True)
        assert_frame_equal(dfobj, res.fillna('.'))

        # mixed
        res = dfmix.copy()
        res.replace(r'\s*\.\s*', nan, regex=True, inplace=True)
        assert_frame_equal(dfmix, res.fillna('.'))

        # regex -> regex
        # obj frame
        res = dfobj.copy()
        res.replace(r'\s*(\.)\s*', r'\1\1\1', regex=True, inplace=True)
        objc = obj.copy()
        objc['a'] = ['a', 'b', '...', '...']
        expec = DataFrame(objc)
        assert_frame_equal(res, expec)

        # with mixed
        res = dfmix.copy()
        res.replace(r'\s*(\.)\s*', r'\1\1\1', regex=True, inplace=True)
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

        # everything with compiled regexs as well
        res = dfobj.copy()
        res.replace(re.compile(r'\s*\.\s*'), nan, regex=True, inplace=True)
        assert_frame_equal(dfobj, res.fillna('.'))

        # mixed
        res = dfmix.copy()
        res.replace(re.compile(r'\s*\.\s*'), nan, regex=True, inplace=True)
        assert_frame_equal(dfmix, res.fillna('.'))

        # regex -> regex
        # obj frame
        res = dfobj.copy()
        res.replace(re.compile(r'\s*(\.)\s*'), r'\1\1\1', regex=True,
                    inplace=True)
        objc = obj.copy()
        objc['a'] = ['a', 'b', '...', '...']
        expec = DataFrame(objc)
        assert_frame_equal(res, expec)

        # with mixed
        res = dfmix.copy()
        res.replace(re.compile(r'\s*(\.)\s*'), r'\1\1\1', regex=True,
                    inplace=True)
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

        res = dfobj.copy()
        res.replace(regex=r'\s*\.\s*', value=nan, inplace=True)
        assert_frame_equal(dfobj, res.fillna('.'))

        # mixed
        res = dfmix.copy()
        res.replace(regex=r'\s*\.\s*', value=nan, inplace=True)
        assert_frame_equal(dfmix, res.fillna('.'))

        # regex -> regex
        # obj frame
        res = dfobj.copy()
        res.replace(regex=r'\s*(\.)\s*', value=r'\1\1\1', inplace=True)
        objc = obj.copy()
        objc['a'] = ['a', 'b', '...', '...']
        expec = DataFrame(objc)
        assert_frame_equal(res, expec)

        # with mixed
        res = dfmix.copy()
        res.replace(regex=r'\s*(\.)\s*', value=r'\1\1\1', inplace=True)
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

        # everything with compiled regexs as well
        res = dfobj.copy()
        res.replace(regex=re.compile(r'\s*\.\s*'), value=nan, inplace=True)
        assert_frame_equal(dfobj, res.fillna('.'))

        # mixed
        res = dfmix.copy()
        res.replace(regex=re.compile(r'\s*\.\s*'), value=nan, inplace=True)
        assert_frame_equal(dfmix, res.fillna('.'))

        # regex -> regex
        # obj frame
        res = dfobj.copy()
        res.replace(regex=re.compile(r'\s*(\.)\s*'), value=r'\1\1\1',
                    inplace=True)
        objc = obj.copy()
        objc['a'] = ['a', 'b', '...', '...']
        expec = DataFrame(objc)
        assert_frame_equal(res, expec)

        # with mixed
        res = dfmix.copy()
        res.replace(regex=re.compile(r'\s*(\.)\s*'), value=r'\1\1\1',
                    inplace=True)
        mixc = mix.copy()
        mixc['b'] = ['a', 'b', '...', '...']
        expec = DataFrame(mixc)
        assert_frame_equal(res, expec)

    def test_regex_replace_list_obj(self):
        obj = {'a': list('ab..'), 'b': list('efgh'), 'c': list('helo')}
        dfobj = DataFrame(obj)

        # lists of regexes and values
        # list of [re1, re2, ..., reN] -> [v1, v2, ..., vN]
        to_replace_res = [r'\s*\.\s*', r'e|f|g']
        values = [nan, 'crap']
        res = dfobj.replace(to_replace_res, values, regex=True)
        expec = DataFrame({'a': ['a', 'b', nan, nan], 'b': ['crap'] * 3 +
                           ['h'], 'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [re1, re2, .., reN]
        to_replace_res = [r'\s*(\.)\s*', r'(e|f|g)']
        values = [r'\1\1', r'\1_crap']
        res = dfobj.replace(to_replace_res, values, regex=True)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['e_crap',
                                                              'f_crap',
                                                              'g_crap', 'h'],
                           'c': ['h', 'e_crap', 'l', 'o']})

        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [(re1 or v1), (re2 or v2), ..., (reN
        # or vN)]
        to_replace_res = [r'\s*(\.)\s*', r'e']
        values = [r'\1\1', r'crap']
        res = dfobj.replace(to_replace_res, values, regex=True)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['crap', 'f', 'g',
                                                              'h'],
                           'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

        to_replace_res = [r'\s*(\.)\s*', r'e']
        values = [r'\1\1', r'crap']
        res = dfobj.replace(value=values, regex=to_replace_res)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['crap', 'f', 'g',
                                                              'h'],
                           'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

    def test_regex_replace_list_obj_inplace(self):
        # same as above with inplace=True
        # lists of regexes and values
        obj = {'a': list('ab..'), 'b': list('efgh'), 'c': list('helo')}
        dfobj = DataFrame(obj)

        # lists of regexes and values
        # list of [re1, re2, ..., reN] -> [v1, v2, ..., vN]
        to_replace_res = [r'\s*\.\s*', r'e|f|g']
        values = [nan, 'crap']
        res = dfobj.copy()
        res.replace(to_replace_res, values, inplace=True, regex=True)
        expec = DataFrame({'a': ['a', 'b', nan, nan], 'b': ['crap'] * 3 +
                           ['h'], 'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [re1, re2, .., reN]
        to_replace_res = [r'\s*(\.)\s*', r'(e|f|g)']
        values = [r'\1\1', r'\1_crap']
        res = dfobj.copy()
        res.replace(to_replace_res, values, inplace=True, regex=True)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['e_crap',
                                                              'f_crap',
                                                              'g_crap', 'h'],
                           'c': ['h', 'e_crap', 'l', 'o']})

        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [(re1 or v1), (re2 or v2), ..., (reN
        # or vN)]
        to_replace_res = [r'\s*(\.)\s*', r'e']
        values = [r'\1\1', r'crap']
        res = dfobj.copy()
        res.replace(to_replace_res, values, inplace=True, regex=True)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['crap', 'f', 'g',
                                                              'h'],
                           'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

        to_replace_res = [r'\s*(\.)\s*', r'e']
        values = [r'\1\1', r'crap']
        res = dfobj.copy()
        res.replace(value=values, regex=to_replace_res, inplace=True)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['crap', 'f', 'g',
                                                              'h'],
                           'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

    def test_regex_replace_list_mixed(self):
        # mixed frame to make sure this doesn't break things
        mix = {'a': lrange(4), 'b': list('ab..')}
        dfmix = DataFrame(mix)

        # lists of regexes and values
        # list of [re1, re2, ..., reN] -> [v1, v2, ..., vN]
        to_replace_res = [r'\s*\.\s*', r'a']
        values = [nan, 'crap']
        mix2 = {'a': lrange(4), 'b': list('ab..'), 'c': list('halo')}
        dfmix2 = DataFrame(mix2)
        res = dfmix2.replace(to_replace_res, values, regex=True)
        expec = DataFrame({'a': mix2['a'], 'b': ['crap', 'b', nan, nan],
                           'c': ['h', 'crap', 'l', 'o']})
        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [re1, re2, .., reN]
        to_replace_res = [r'\s*(\.)\s*', r'(a|b)']
        values = [r'\1\1', r'\1_crap']
        res = dfmix.replace(to_replace_res, values, regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a_crap', 'b_crap', '..',
                                                '..']})

        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [(re1 or v1), (re2 or v2), ..., (reN
        # or vN)]
        to_replace_res = [r'\s*(\.)\s*', r'a', r'(b)']
        values = [r'\1\1', r'crap', r'\1_crap']
        res = dfmix.replace(to_replace_res, values, regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['crap', 'b_crap', '..', '..']})
        assert_frame_equal(res, expec)

        to_replace_res = [r'\s*(\.)\s*', r'a', r'(b)']
        values = [r'\1\1', r'crap', r'\1_crap']
        res = dfmix.replace(regex=to_replace_res, value=values)
        expec = DataFrame({'a': mix['a'], 'b': ['crap', 'b_crap', '..', '..']})
        assert_frame_equal(res, expec)

    def test_regex_replace_list_mixed_inplace(self):
        mix = {'a': lrange(4), 'b': list('ab..')}
        dfmix = DataFrame(mix)
        # the same inplace
        # lists of regexes and values
        # list of [re1, re2, ..., reN] -> [v1, v2, ..., vN]
        to_replace_res = [r'\s*\.\s*', r'a']
        values = [nan, 'crap']
        res = dfmix.copy()
        res.replace(to_replace_res, values, inplace=True, regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['crap', 'b', nan, nan]})
        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [re1, re2, .., reN]
        to_replace_res = [r'\s*(\.)\s*', r'(a|b)']
        values = [r'\1\1', r'\1_crap']
        res = dfmix.copy()
        res.replace(to_replace_res, values, inplace=True, regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a_crap', 'b_crap', '..',
                                                '..']})

        assert_frame_equal(res, expec)

        # list of [re1, re2, ..., reN] -> [(re1 or v1), (re2 or v2), ..., (reN
        # or vN)]
        to_replace_res = [r'\s*(\.)\s*', r'a', r'(b)']
        values = [r'\1\1', r'crap', r'\1_crap']
        res = dfmix.copy()
        res.replace(to_replace_res, values, inplace=True, regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['crap', 'b_crap', '..', '..']})
        assert_frame_equal(res, expec)

        to_replace_res = [r'\s*(\.)\s*', r'a', r'(b)']
        values = [r'\1\1', r'crap', r'\1_crap']
        res = dfmix.copy()
        res.replace(regex=to_replace_res, value=values, inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': ['crap', 'b_crap', '..', '..']})
        assert_frame_equal(res, expec)

    def test_regex_replace_dict_mixed(self):
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        dfmix = DataFrame(mix)

        # dicts
        # single dict {re1: v1}, search the whole frame
        # need test for this...

        # list of dicts {re1: v1, re2: v2, ..., re3: v3}, search the whole
        # frame
        res = dfmix.replace({'b': r'\s*\.\s*'}, {'b': nan}, regex=True)
        res2 = dfmix.copy()
        res2.replace({'b': r'\s*\.\s*'}, {'b': nan}, inplace=True, regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 'b', nan, nan], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)

        # list of dicts {re1: re11, re2: re12, ..., reN: re1N}, search the
        # whole frame
        res = dfmix.replace({'b': r'\s*(\.)\s*'}, {'b': r'\1ty'}, regex=True)
        res2 = dfmix.copy()
        res2.replace({'b': r'\s*(\.)\s*'}, {'b': r'\1ty'}, inplace=True,
                     regex=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 'b', '.ty', '.ty'], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)

        res = dfmix.replace(regex={'b': r'\s*(\.)\s*'}, value={'b': r'\1ty'})
        res2 = dfmix.copy()
        res2.replace(regex={'b': r'\s*(\.)\s*'}, value={'b': r'\1ty'},
                     inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 'b', '.ty', '.ty'], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)

        # scalar -> dict
        # to_replace regex, {value: value}
        expec = DataFrame({'a': mix['a'], 'b': [nan, 'b', '.', '.'], 'c':
                           mix['c']})
        res = dfmix.replace('a', {'b': nan}, regex=True)
        res2 = dfmix.copy()
        res2.replace('a', {'b': nan}, regex=True, inplace=True)
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)

        res = dfmix.replace('a', {'b': nan}, regex=True)
        res2 = dfmix.copy()
        res2.replace(regex='a', value={'b': nan}, inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': [nan, 'b', '.', '.'], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)

    def test_regex_replace_dict_nested(self):
        # nested dicts will not work until this is implemented for Series
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        dfmix = DataFrame(mix)
        res = dfmix.replace({'b': {r'\s*\.\s*': nan}}, regex=True)
        res2 = dfmix.copy()
        res4 = dfmix.copy()
        res2.replace({'b': {r'\s*\.\s*': nan}}, inplace=True, regex=True)
        res3 = dfmix.replace(regex={'b': {r'\s*\.\s*': nan}})
        res4.replace(regex={'b': {r'\s*\.\s*': nan}}, inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 'b', nan, nan], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)
        assert_frame_equal(res3, expec)
        assert_frame_equal(res4, expec)

    def test_regex_replace_dict_nested_gh4115(self):
        df = pd.DataFrame({'Type': ['Q', 'T', 'Q', 'Q', 'T'], 'tmp': 2})
        expected = DataFrame({'Type': [0, 1, 0, 0, 1], 'tmp': 2})
        result = df.replace({'Type': {'Q': 0, 'T': 1}})
        assert_frame_equal(result, expected)

    def test_regex_replace_list_to_scalar(self):
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        df = DataFrame(mix)
        expec = DataFrame({'a': mix['a'], 'b': np.array([nan] * 4),
                           'c': [nan, nan, nan, 'd']})

        res = df.replace([r'\s*\.\s*', 'a|b'], nan, regex=True)
        res2 = df.copy()
        res3 = df.copy()
        res2.replace([r'\s*\.\s*', 'a|b'], nan, regex=True, inplace=True)
        res3.replace(regex=[r'\s*\.\s*', 'a|b'], value=nan, inplace=True)
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)
        assert_frame_equal(res3, expec)

    def test_regex_replace_str_to_numeric(self):
        # what happens when you try to replace a numeric value with a regex?
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        df = DataFrame(mix)
        res = df.replace(r'\s*\.\s*', 0, regex=True)
        res2 = df.copy()
        res2.replace(r'\s*\.\s*', 0, inplace=True, regex=True)
        res3 = df.copy()
        res3.replace(regex=r'\s*\.\s*', value=0, inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 'b', 0, 0], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)
        assert_frame_equal(res3, expec)

    def test_regex_replace_regex_list_to_numeric(self):
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        df = DataFrame(mix)
        res = df.replace([r'\s*\.\s*', 'b'], 0, regex=True)
        res2 = df.copy()
        res2.replace([r'\s*\.\s*', 'b'], 0, regex=True, inplace=True)
        res3 = df.copy()
        res3.replace(regex=[r'\s*\.\s*', 'b'], value=0, inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 0, 0, 0], 'c': ['a', 0,
                                                                     nan,
                                                                     'd']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)
        assert_frame_equal(res3, expec)

    def test_regex_replace_series_of_regexes(self):
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        df = DataFrame(mix)
        s1 = Series({'b': r'\s*\.\s*'})
        s2 = Series({'b': nan})
        res = df.replace(s1, s2, regex=True)
        res2 = df.copy()
        res2.replace(s1, s2, inplace=True, regex=True)
        res3 = df.copy()
        res3.replace(regex=s1, value=s2, inplace=True)
        expec = DataFrame({'a': mix['a'], 'b': ['a', 'b', nan, nan], 'c':
                           mix['c']})
        assert_frame_equal(res, expec)
        assert_frame_equal(res2, expec)
        assert_frame_equal(res3, expec)

    def test_regex_replace_numeric_to_object_conversion(self):
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        df = DataFrame(mix)
        expec = DataFrame({'a': ['a', 1, 2, 3], 'b': mix['b'], 'c': mix['c']})
        res = df.replace(0, 'a')
        assert_frame_equal(res, expec)
        assert res.a.dtype == np.object_

    def test_replace_regex_metachar(self):
        metachars = '[]', '()', r'\d', r'\w', r'\s'

        for metachar in metachars:
            df = DataFrame({'a': [metachar, 'else']})
            result = df.replace({'a': {metachar: 'paren'}})
            expected = DataFrame({'a': ['paren', 'else']})
            assert_frame_equal(result, expected)

    def test_replace(self):
        self.tsframe['A'][:5] = nan
        self.tsframe['A'][-5:] = nan

        zero_filled = self.tsframe.replace(nan, -1e8)
        assert_frame_equal(zero_filled, self.tsframe.fillna(-1e8))
        assert_frame_equal(zero_filled.replace(-1e8, nan), self.tsframe)

        self.tsframe['A'][:5] = nan
        self.tsframe['A'][-5:] = nan
        self.tsframe['B'][:5] = -1e8

        # empty
        df = DataFrame(index=['a', 'b'])
        assert_frame_equal(df, df.replace(5, 7))

        # GH 11698
        # test for mixed data types.
        df = pd.DataFrame([('-', pd.to_datetime('20150101')),
                           ('a', pd.to_datetime('20150102'))])
        df1 = df.replace('-', np.nan)
        expected_df = pd.DataFrame([(np.nan, pd.to_datetime('20150101')),
                                    ('a', pd.to_datetime('20150102'))])
        assert_frame_equal(df1, expected_df)

    def test_replace_list(self):
        obj = {'a': list('ab..'), 'b': list('efgh'), 'c': list('helo')}
        dfobj = DataFrame(obj)

        # lists of regexes and values
        # list of [v1, v2, ..., vN] -> [v1, v2, ..., vN]
        to_replace_res = [r'.', r'e']
        values = [nan, 'crap']
        res = dfobj.replace(to_replace_res, values)
        expec = DataFrame({'a': ['a', 'b', nan, nan],
                           'b': ['crap', 'f', 'g', 'h'], 'c': ['h', 'crap',
                                                               'l', 'o']})
        assert_frame_equal(res, expec)

        # list of [v1, v2, ..., vN] -> [v1, v2, .., vN]
        to_replace_res = [r'.', r'f']
        values = [r'..', r'crap']
        res = dfobj.replace(to_replace_res, values)
        expec = DataFrame({'a': ['a', 'b', '..', '..'], 'b': ['e', 'crap', 'g',
                                                              'h'],
                           'c': ['h', 'e', 'l', 'o']})

        assert_frame_equal(res, expec)

    def test_replace_series_dict(self):
        # from GH 3064
        df = DataFrame({'zero': {'a': 0.0, 'b': 1}, 'one': {'a': 2.0, 'b': 0}})
        result = df.replace(0, {'zero': 0.5, 'one': 1.0})
        expected = DataFrame(
            {'zero': {'a': 0.5, 'b': 1}, 'one': {'a': 2.0, 'b': 1.0}})
        assert_frame_equal(result, expected)

        result = df.replace(0, df.mean())
        assert_frame_equal(result, expected)

        # series to series/dict
        df = DataFrame({'zero': {'a': 0.0, 'b': 1}, 'one': {'a': 2.0, 'b': 0}})
        s = Series({'zero': 0.0, 'one': 2.0})
        result = df.replace(s, {'zero': 0.5, 'one': 1.0})
        expected = DataFrame(
            {'zero': {'a': 0.5, 'b': 1}, 'one': {'a': 1.0, 'b': 0.0}})
        assert_frame_equal(result, expected)

        result = df.replace(s, df.mean())
        assert_frame_equal(result, expected)

    def test_replace_convert(self):
        # gh 3907
        df = DataFrame([['foo', 'bar', 'bah'], ['bar', 'foo', 'bah']])
        m = {'foo': 1, 'bar': 2, 'bah': 3}
        rep = df.replace(m)
        expec = Series([np.int64] * 3)
        res = rep.dtypes
        assert_series_equal(expec, res)

    def test_replace_mixed(self):
        mf = self.mixed_frame
        mf.iloc[5:20, mf.columns.get_loc('foo')] = nan
        mf.iloc[-10:, mf.columns.get_loc('A')] = nan

        result = self.mixed_frame.replace(np.nan, -18)
        expected = self.mixed_frame.fillna(value=-18)
        assert_frame_equal(result, expected)
        assert_frame_equal(result.replace(-18, nan), self.mixed_frame)

        result = self.mixed_frame.replace(np.nan, -1e8)
        expected = self.mixed_frame.fillna(value=-1e8)
        assert_frame_equal(result, expected)
        assert_frame_equal(result.replace(-1e8, nan), self.mixed_frame)

        # int block upcasting
        df = DataFrame({'A': Series([1.0, 2.0], dtype='float64'),
                        'B': Series([0, 1], dtype='int64')})
        expected = DataFrame({'A': Series([1.0, 2.0], dtype='float64'),
                              'B': Series([0.5, 1], dtype='float64')})
        result = df.replace(0, 0.5)
        assert_frame_equal(result, expected)

        df.replace(0, 0.5, inplace=True)
        assert_frame_equal(df, expected)

        # int block splitting
        df = DataFrame({'A': Series([1.0, 2.0], dtype='float64'),
                        'B': Series([0, 1], dtype='int64'),
                        'C': Series([1, 2], dtype='int64')})
        expected = DataFrame({'A': Series([1.0, 2.0], dtype='float64'),
                              'B': Series([0.5, 1], dtype='float64'),
                              'C': Series([1, 2], dtype='int64')})
        result = df.replace(0, 0.5)
        assert_frame_equal(result, expected)

        # to object block upcasting
        df = DataFrame({'A': Series([1.0, 2.0], dtype='float64'),
                        'B': Series([0, 1], dtype='int64')})
        expected = DataFrame({'A': Series([1, 'foo'], dtype='object'),
                              'B': Series([0, 1], dtype='int64')})
        result = df.replace(2, 'foo')
        assert_frame_equal(result, expected)

        expected = DataFrame({'A': Series(['foo', 'bar'], dtype='object'),
                              'B': Series([0, 'foo'], dtype='object')})
        result = df.replace([1, 2], ['foo', 'bar'])
        assert_frame_equal(result, expected)

        # test case from
        df = DataFrame({'A': Series([3, 0], dtype='int64'),
                        'B': Series([0, 3], dtype='int64')})
        result = df.replace(3, df.mean().to_dict())
        expected = df.copy().astype('float64')
        m = df.mean()
        expected.iloc[0, 0] = m[0]
        expected.iloc[1, 1] = m[1]
        assert_frame_equal(result, expected)

    def test_replace_simple_nested_dict(self):
        df = DataFrame({'col': range(1, 5)})
        expected = DataFrame({'col': ['a', 2, 3, 'b']})

        result = df.replace({'col': {1: 'a', 4: 'b'}})
        assert_frame_equal(expected, result)

        # in this case, should be the same as the not nested version
        result = df.replace({1: 'a', 4: 'b'})
        assert_frame_equal(expected, result)

    def test_replace_simple_nested_dict_with_nonexistent_value(self):
        df = DataFrame({'col': range(1, 5)})
        expected = DataFrame({'col': ['a', 2, 3, 'b']})

        result = df.replace({-1: '-', 1: 'a', 4: 'b'})
        assert_frame_equal(expected, result)

        result = df.replace({'col': {-1: '-', 1: 'a', 4: 'b'}})
        assert_frame_equal(expected, result)

    def test_replace_value_is_none(self):
        pytest.raises(TypeError, self.tsframe.replace, nan)
        orig_value = self.tsframe.iloc[0, 0]
        orig2 = self.tsframe.iloc[1, 0]

        self.tsframe.iloc[0, 0] = nan
        self.tsframe.iloc[1, 0] = 1

        result = self.tsframe.replace(to_replace={nan: 0})
        expected = self.tsframe.T.replace(to_replace={nan: 0}).T
        assert_frame_equal(result, expected)

        result = self.tsframe.replace(to_replace={nan: 0, 1: -1e8})
        tsframe = self.tsframe.copy()
        tsframe.iloc[0, 0] = 0
        tsframe.iloc[1, 0] = -1e8
        expected = tsframe
        assert_frame_equal(expected, result)
        self.tsframe.iloc[0, 0] = orig_value
        self.tsframe.iloc[1, 0] = orig2

    def test_replace_for_new_dtypes(self):

        # dtypes
        tsframe = self.tsframe.copy().astype(np.float32)
        tsframe['A'][:5] = nan
        tsframe['A'][-5:] = nan

        zero_filled = tsframe.replace(nan, -1e8)
        assert_frame_equal(zero_filled, tsframe.fillna(-1e8))
        assert_frame_equal(zero_filled.replace(-1e8, nan), tsframe)

        tsframe['A'][:5] = nan
        tsframe['A'][-5:] = nan
        tsframe['B'][:5] = -1e8

        b = tsframe['B']
        b[b == -1e8] = nan
        tsframe['B'] = b
        result = tsframe.fillna(method='bfill')
        assert_frame_equal(result, tsframe.fillna(method='bfill'))

    def test_replace_dtypes(self):
        # int
        df = DataFrame({'ints': [1, 2, 3]})
        result = df.replace(1, 0)
        expected = DataFrame({'ints': [0, 2, 3]})
        assert_frame_equal(result, expected)

        df = DataFrame({'ints': [1, 2, 3]}, dtype=np.int32)
        result = df.replace(1, 0)
        expected = DataFrame({'ints': [0, 2, 3]}, dtype=np.int32)
        assert_frame_equal(result, expected)

        df = DataFrame({'ints': [1, 2, 3]}, dtype=np.int16)
        result = df.replace(1, 0)
        expected = DataFrame({'ints': [0, 2, 3]}, dtype=np.int16)
        assert_frame_equal(result, expected)

        # bools
        df = DataFrame({'bools': [True, False, True]})
        result = df.replace(False, True)
        assert result.values.all()

        # complex blocks
        df = DataFrame({'complex': [1j, 2j, 3j]})
        result = df.replace(1j, 0j)
        expected = DataFrame({'complex': [0j, 2j, 3j]})
        assert_frame_equal(result, expected)

        # datetime blocks
        prev = datetime.today()
        now = datetime.today()
        df = DataFrame({'datetime64': Index([prev, now, prev])})
        result = df.replace(prev, now)
        expected = DataFrame({'datetime64': Index([now] * 3)})
        assert_frame_equal(result, expected)

    def test_replace_input_formats_listlike(self):
        # both dicts
        to_rep = {'A': np.nan, 'B': 0, 'C': ''}
        values = {'A': 0, 'B': -1, 'C': 'missing'}
        df = DataFrame({'A': [np.nan, 0, np.inf], 'B': [0, 2, 5],
                        'C': ['', 'asdf', 'fd']})
        filled = df.replace(to_rep, values)
        expected = {}
        for k, v in compat.iteritems(df):
            expected[k] = v.replace(to_rep[k], values[k])
        assert_frame_equal(filled, DataFrame(expected))

        result = df.replace([0, 2, 5], [5, 2, 0])
        expected = DataFrame({'A': [np.nan, 5, np.inf], 'B': [5, 2, 0],
                              'C': ['', 'asdf', 'fd']})
        assert_frame_equal(result, expected)

        # scalar to dict
        values = {'A': 0, 'B': -1, 'C': 'missing'}
        df = DataFrame({'A': [np.nan, 0, np.nan], 'B': [0, 2, 5],
                        'C': ['', 'asdf', 'fd']})
        filled = df.replace(np.nan, values)
        expected = {}
        for k, v in compat.iteritems(df):
            expected[k] = v.replace(np.nan, values[k])
        assert_frame_equal(filled, DataFrame(expected))

        # list to list
        to_rep = [np.nan, 0, '']
        values = [-2, -1, 'missing']
        result = df.replace(to_rep, values)
        expected = df.copy()
        for i in range(len(to_rep)):
            expected.replace(to_rep[i], values[i], inplace=True)
        assert_frame_equal(result, expected)

        pytest.raises(ValueError, df.replace, to_rep, values[1:])

    def test_replace_input_formats_scalar(self):
        df = DataFrame({'A': [np.nan, 0, np.inf], 'B': [0, 2, 5],
                        'C': ['', 'asdf', 'fd']})

        # dict to scalar
        to_rep = {'A': np.nan, 'B': 0, 'C': ''}
        filled = df.replace(to_rep, 0)
        expected = {}
        for k, v in compat.iteritems(df):
            expected[k] = v.replace(to_rep[k], 0)
        assert_frame_equal(filled, DataFrame(expected))

        pytest.raises(TypeError, df.replace, to_rep, [np.nan, 0, ''])

        # list to scalar
        to_rep = [np.nan, 0, '']
        result = df.replace(to_rep, -1)
        expected = df.copy()
        for i in range(len(to_rep)):
            expected.replace(to_rep[i], -1, inplace=True)
        assert_frame_equal(result, expected)

    def test_replace_limit(self):
        pass

    def test_replace_dict_no_regex(self):
        answer = Series({0: 'Strongly Agree', 1: 'Agree', 2: 'Neutral', 3:
                         'Disagree', 4: 'Strongly Disagree'})
        weights = {'Agree': 4, 'Disagree': 2, 'Neutral': 3, 'Strongly Agree':
                   5, 'Strongly Disagree': 1}
        expected = Series({0: 5, 1: 4, 2: 3, 3: 2, 4: 1})
        result = answer.replace(weights)
        assert_series_equal(result, expected)

    def test_replace_series_no_regex(self):
        answer = Series({0: 'Strongly Agree', 1: 'Agree', 2: 'Neutral', 3:
                         'Disagree', 4: 'Strongly Disagree'})
        weights = Series({'Agree': 4, 'Disagree': 2, 'Neutral': 3,
                          'Strongly Agree': 5, 'Strongly Disagree': 1})
        expected = Series({0: 5, 1: 4, 2: 3, 3: 2, 4: 1})
        result = answer.replace(weights)
        assert_series_equal(result, expected)

    def test_replace_dict_tuple_list_ordering_remains_the_same(self):
        df = DataFrame(dict(A=[nan, 1]))
        res1 = df.replace(to_replace={nan: 0, 1: -1e8})
        res2 = df.replace(to_replace=(1, nan), value=[-1e8, 0])
        res3 = df.replace(to_replace=[1, nan], value=[-1e8, 0])

        expected = DataFrame({'A': [0, -1e8]})
        assert_frame_equal(res1, res2)
        assert_frame_equal(res2, res3)
        assert_frame_equal(res3, expected)

    def test_replace_doesnt_replace_without_regex(self):
        raw = """fol T_opp T_Dir T_Enh
        0    1     0     0    vo
        1    2    vr     0     0
        2    2     0     0     0
        3    3     0    bt     0"""
        df = pd.read_csv(StringIO(raw), sep=r'\s+')
        res = df.replace({r'\D': 1})
        assert_frame_equal(df, res)

    def test_replace_bool_with_string(self):
        df = DataFrame({'a': [True, False], 'b': list('ab')})
        result = df.replace(True, 'a')
        expected = DataFrame({'a': ['a', False], 'b': df.b})
        assert_frame_equal(result, expected)

    def test_replace_pure_bool_with_string_no_op(self):
        df = DataFrame(np.random.rand(2, 2) > 0.5)
        result = df.replace('asdf', 'fdsa')
        assert_frame_equal(df, result)

    def test_replace_bool_with_bool(self):
        df = DataFrame(np.random.rand(2, 2) > 0.5)
        result = df.replace(False, True)
        expected = DataFrame(np.ones((2, 2), dtype=bool))
        assert_frame_equal(result, expected)

    def test_replace_with_dict_with_bool_keys(self):
        df = DataFrame({0: [True, False], 1: [False, True]})
        with tm.assert_raises_regex(TypeError, 'Cannot compare types .+'):
            df.replace({'asdf': 'asdb', True: 'yes'})

    def test_replace_truthy(self):
        df = DataFrame({'a': [True, True]})
        r = df.replace([np.inf, -np.inf], np.nan)
        e = df
        assert_frame_equal(r, e)

    def test_replace_int_to_int_chain(self):
        df = DataFrame({'a': lrange(1, 5)})
        with tm.assert_raises_regex(ValueError,
                                    "Replacement not allowed .+"):
            df.replace({'a': dict(zip(range(1, 5), range(2, 6)))})

    def test_replace_str_to_str_chain(self):
        a = np.arange(1, 5)
        astr = a.astype(str)
        bstr = np.arange(2, 6).astype(str)
        df = DataFrame({'a': astr})
        with tm.assert_raises_regex(ValueError,
                                    "Replacement not allowed .+"):
            df.replace({'a': dict(zip(astr, bstr))})

    def test_replace_swapping_bug(self):
        df = pd.DataFrame({'a': [True, False, True]})
        res = df.replace({'a': {True: 'Y', False: 'N'}})
        expect = pd.DataFrame({'a': ['Y', 'N', 'Y']})
        assert_frame_equal(res, expect)

        df = pd.DataFrame({'a': [0, 1, 0]})
        res = df.replace({'a': {0: 'Y', 1: 'N'}})
        expect = pd.DataFrame({'a': ['Y', 'N', 'Y']})
        assert_frame_equal(res, expect)

    def test_replace_period(self):
        d = {
            'fname': {
                'out_augmented_AUG_2011.json':
                pd.Period(year=2011, month=8, freq='M'),
                'out_augmented_JAN_2011.json':
                pd.Period(year=2011, month=1, freq='M'),
                'out_augmented_MAY_2012.json':
                pd.Period(year=2012, month=5, freq='M'),
                'out_augmented_SUBSIDY_WEEK.json':
                pd.Period(year=2011, month=4, freq='M'),
                'out_augmented_AUG_2012.json':
                pd.Period(year=2012, month=8, freq='M'),
                'out_augmented_MAY_2011.json':
                pd.Period(year=2011, month=5, freq='M'),
                'out_augmented_SEP_2013.json':
                pd.Period(year=2013, month=9, freq='M')}}

        df = pd.DataFrame(['out_augmented_AUG_2012.json',
                           'out_augmented_SEP_2013.json',
                           'out_augmented_SUBSIDY_WEEK.json',
                           'out_augmented_MAY_2012.json',
                           'out_augmented_MAY_2011.json',
                           'out_augmented_AUG_2011.json',
                           'out_augmented_JAN_2011.json'], columns=['fname'])
        assert set(df.fname.values) == set(d['fname'].keys())
        expected = DataFrame({'fname': [d['fname'][k]
                                        for k in df.fname.values]})
        result = df.replace(d)
        assert_frame_equal(result, expected)

    def test_replace_datetime(self):
        d = {'fname':
             {'out_augmented_AUG_2011.json': pd.Timestamp('2011-08'),
              'out_augmented_JAN_2011.json': pd.Timestamp('2011-01'),
              'out_augmented_MAY_2012.json': pd.Timestamp('2012-05'),
              'out_augmented_SUBSIDY_WEEK.json': pd.Timestamp('2011-04'),
              'out_augmented_AUG_2012.json': pd.Timestamp('2012-08'),
              'out_augmented_MAY_2011.json': pd.Timestamp('2011-05'),
              'out_augmented_SEP_2013.json': pd.Timestamp('2013-09')}}

        df = pd.DataFrame(['out_augmented_AUG_2012.json',
                           'out_augmented_SEP_2013.json',
                           'out_augmented_SUBSIDY_WEEK.json',
                           'out_augmented_MAY_2012.json',
                           'out_augmented_MAY_2011.json',
                           'out_augmented_AUG_2011.json',
                           'out_augmented_JAN_2011.json'], columns=['fname'])
        assert set(df.fname.values) == set(d['fname'].keys())
        expected = DataFrame({'fname': [d['fname'][k]
                                        for k in df.fname.values]})
        result = df.replace(d)
        assert_frame_equal(result, expected)

    def test_replace_datetimetz(self):

        # GH 11326
        # behaving poorly when presented with a datetime64[ns, tz]
        df = DataFrame({'A': date_range('20130101', periods=3,
                                        tz='US/Eastern'),
                        'B': [0, np.nan, 2]})
        result = df.replace(np.nan, 1)
        expected = DataFrame({'A': date_range('20130101', periods=3,
                                              tz='US/Eastern'),
                              'B': Series([0, 1, 2], dtype='float64')})
        assert_frame_equal(result, expected)

        result = df.fillna(1)
        assert_frame_equal(result, expected)

        result = df.replace(0, np.nan)
        expected = DataFrame({'A': date_range('20130101', periods=3,
                                              tz='US/Eastern'),
                              'B': [np.nan, np.nan, 2]})
        assert_frame_equal(result, expected)

        result = df.replace(Timestamp('20130102', tz='US/Eastern'),
                            Timestamp('20130104', tz='US/Eastern'))
        expected = DataFrame({'A': [Timestamp('20130101', tz='US/Eastern'),
                                    Timestamp('20130104', tz='US/Eastern'),
                                    Timestamp('20130103', tz='US/Eastern')],
                              'B': [0, np.nan, 2]})
        assert_frame_equal(result, expected)

        result = df.copy()
        result.iloc[1, 0] = np.nan
        result = result.replace(
            {'A': pd.NaT}, Timestamp('20130104', tz='US/Eastern'))
        assert_frame_equal(result, expected)

        # coerce to object
        result = df.copy()
        result.iloc[1, 0] = np.nan
        result = result.replace(
            {'A': pd.NaT}, Timestamp('20130104', tz='US/Pacific'))
        expected = DataFrame({'A': [Timestamp('20130101', tz='US/Eastern'),
                                    Timestamp('20130104', tz='US/Pacific'),
                                    Timestamp('20130103', tz='US/Eastern')],
                              'B': [0, np.nan, 2]})
        assert_frame_equal(result, expected)

        result = df.copy()
        result.iloc[1, 0] = np.nan
        result = result.replace({'A': np.nan}, Timestamp('20130104'))
        expected = DataFrame({'A': [Timestamp('20130101', tz='US/Eastern'),
                                    Timestamp('20130104'),
                                    Timestamp('20130103', tz='US/Eastern')],
                              'B': [0, np.nan, 2]})
        assert_frame_equal(result, expected)

    def test_replace_with_empty_dictlike(self):
        # GH 15289
        mix = {'a': lrange(4), 'b': list('ab..'), 'c': ['a', 'b', nan, 'd']}
        df = DataFrame(mix)
        assert_frame_equal(df, df.replace({}))
        assert_frame_equal(df, df.replace(Series([])))

        assert_frame_equal(df, df.replace({'b': {}}))
        assert_frame_equal(df, df.replace(Series({'b': {}})))
