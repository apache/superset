# -*- coding: utf-8 -*-

import re
from textwrap import dedent
from datetime import datetime
from distutils.version import LooseVersion

import pytest
import numpy as np
import pandas as pd
from pandas import compat, DataFrame, MultiIndex, option_context, Index
from pandas.compat import u, lrange, StringIO
from pandas.util import testing as tm
import pandas.io.formats.format as fmt

div_style = ''
try:
    import IPython
    if IPython.__version__ < LooseVersion('3.0.0'):
        div_style = ' style="max-width:1500px;overflow:auto;"'
except (ImportError, AttributeError):
    pass


class TestToHTML(object):

    def test_to_html_with_col_space(self):
        def check_with_width(df, col_space):
            # check that col_space affects HTML generation
            # and be very brittle about it.
            html = df.to_html(col_space=col_space)
            hdrs = [x for x in html.split(r"\n") if re.search(r"<th[>\s]", x)]
            assert len(hdrs) > 0
            for h in hdrs:
                assert "min-width" in h
                assert str(col_space) in h

        df = DataFrame(np.random.random(size=(1, 3)))

        check_with_width(df, 30)
        check_with_width(df, 50)

    def test_to_html_with_empty_string_label(self):
        # GH3547, to_html regards empty string labels as repeated labels
        data = {'c1': ['a', 'b'], 'c2': ['a', ''], 'data': [1, 2]}
        df = DataFrame(data).set_index(['c1', 'c2'])
        res = df.to_html()
        assert "rowspan" not in res

    def test_to_html_unicode(self):
        df = DataFrame({u('\u03c3'): np.arange(10.)})
        expected = u'<table border="1" class="dataframe">\n  <thead>\n    <tr style="text-align: right;">\n      <th></th>\n      <th>\u03c3</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <th>0</th>\n      <td>0.0</td>\n    </tr>\n    <tr>\n      <th>1</th>\n      <td>1.0</td>\n    </tr>\n    <tr>\n      <th>2</th>\n      <td>2.0</td>\n    </tr>\n    <tr>\n      <th>3</th>\n      <td>3.0</td>\n    </tr>\n    <tr>\n      <th>4</th>\n      <td>4.0</td>\n    </tr>\n    <tr>\n      <th>5</th>\n      <td>5.0</td>\n    </tr>\n    <tr>\n      <th>6</th>\n      <td>6.0</td>\n    </tr>\n    <tr>\n      <th>7</th>\n      <td>7.0</td>\n    </tr>\n    <tr>\n      <th>8</th>\n      <td>8.0</td>\n    </tr>\n    <tr>\n      <th>9</th>\n      <td>9.0</td>\n    </tr>\n  </tbody>\n</table>'  # noqa
        assert df.to_html() == expected
        df = DataFrame({'A': [u('\u03c3')]})
        expected = u'<table border="1" class="dataframe">\n  <thead>\n    <tr style="text-align: right;">\n      <th></th>\n      <th>A</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <th>0</th>\n      <td>\u03c3</td>\n    </tr>\n  </tbody>\n</table>'  # noqa
        assert df.to_html() == expected

    def test_to_html_decimal(self):
        # GH 12031
        df = DataFrame({'A': [6.0, 3.1, 2.2]})
        result = df.to_html(decimal=',')
        expected = ('<table border="1" class="dataframe">\n'
                    '  <thead>\n'
                    '    <tr style="text-align: right;">\n'
                    '      <th></th>\n'
                    '      <th>A</th>\n'
                    '    </tr>\n'
                    '  </thead>\n'
                    '  <tbody>\n'
                    '    <tr>\n'
                    '      <th>0</th>\n'
                    '      <td>6,0</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>1</th>\n'
                    '      <td>3,1</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>2</th>\n'
                    '      <td>2,2</td>\n'
                    '    </tr>\n'
                    '  </tbody>\n'
                    '</table>')
        assert result == expected

    def test_to_html_escaped(self):
        a = 'str<ing1 &amp;'
        b = 'stri>ng2 &amp;'

        test_dict = {'co<l1': {a: "<type 'str'>",
                               b: "<type 'str'>"},
                     'co>l2': {a: "<type 'str'>",
                               b: "<type 'str'>"}}
        rs = DataFrame(test_dict).to_html()
        xp = """<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>co&lt;l1</th>
      <th>co&gt;l2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>str&lt;ing1 &amp;amp;</th>
      <td>&lt;type 'str'&gt;</td>
      <td>&lt;type 'str'&gt;</td>
    </tr>
    <tr>
      <th>stri&gt;ng2 &amp;amp;</th>
      <td>&lt;type 'str'&gt;</td>
      <td>&lt;type 'str'&gt;</td>
    </tr>
  </tbody>
</table>"""

        assert xp == rs

    def test_to_html_escape_disabled(self):
        a = 'str<ing1 &amp;'
        b = 'stri>ng2 &amp;'

        test_dict = {'co<l1': {a: "<b>bold</b>",
                               b: "<b>bold</b>"},
                     'co>l2': {a: "<b>bold</b>",
                               b: "<b>bold</b>"}}
        rs = DataFrame(test_dict).to_html(escape=False)
        xp = """<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>co<l1</th>
      <th>co>l2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>str<ing1 &amp;</th>
      <td><b>bold</b></td>
      <td><b>bold</b></td>
    </tr>
    <tr>
      <th>stri>ng2 &amp;</th>
      <td><b>bold</b></td>
      <td><b>bold</b></td>
    </tr>
  </tbody>
</table>"""

        assert xp == rs

    def test_to_html_multiindex_index_false(self):
        # issue 8452
        df = DataFrame({
            'a': range(2),
            'b': range(3, 5),
            'c': range(5, 7),
            'd': range(3, 5)
        })
        df.columns = MultiIndex.from_product([['a', 'b'], ['c', 'd']])
        result = df.to_html(index=False)
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr>
      <th colspan="2" halign="left">a</th>
      <th colspan="2" halign="left">b</th>
    </tr>
    <tr>
      <th>c</th>
      <th>d</th>
      <th>c</th>
      <th>d</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>0</td>
      <td>3</td>
      <td>5</td>
      <td>3</td>
    </tr>
    <tr>
      <td>1</td>
      <td>4</td>
      <td>6</td>
      <td>4</td>
    </tr>
  </tbody>
</table>"""

        assert result == expected

        df.index = Index(df.index.values, name='idx')
        result = df.to_html(index=False)
        assert result == expected

    def test_to_html_multiindex_sparsify_false_multi_sparse(self):
        with option_context('display.multi_sparse', False):
            index = MultiIndex.from_arrays([[0, 0, 1, 1], [0, 1, 0, 1]],
                                           names=['foo', None])

            df = DataFrame([[0, 1], [2, 3], [4, 5], [6, 7]], index=index)

            result = df.to_html()
            expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th>0</th>
      <th>1</th>
    </tr>
    <tr>
      <th>foo</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <th>0</th>
      <td>0</td>
      <td>1</td>
    </tr>
    <tr>
      <th>0</th>
      <th>1</th>
      <td>2</td>
      <td>3</td>
    </tr>
    <tr>
      <th>1</th>
      <th>0</th>
      <td>4</td>
      <td>5</td>
    </tr>
    <tr>
      <th>1</th>
      <th>1</th>
      <td>6</td>
      <td>7</td>
    </tr>
  </tbody>
</table>"""

            assert result == expected

            df = DataFrame([[0, 1], [2, 3], [4, 5], [6, 7]],
                           columns=index[::2], index=index)

            result = df.to_html()
            expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr>
      <th></th>
      <th>foo</th>
      <th>0</th>
      <th>1</th>
    </tr>
    <tr>
      <th></th>
      <th></th>
      <th>0</th>
      <th>0</th>
    </tr>
    <tr>
      <th>foo</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <th>0</th>
      <td>0</td>
      <td>1</td>
    </tr>
    <tr>
      <th>0</th>
      <th>1</th>
      <td>2</td>
      <td>3</td>
    </tr>
    <tr>
      <th>1</th>
      <th>0</th>
      <td>4</td>
      <td>5</td>
    </tr>
    <tr>
      <th>1</th>
      <th>1</th>
      <td>6</td>
      <td>7</td>
    </tr>
  </tbody>
</table>"""

            assert result == expected

    def test_to_html_multiindex_sparsify(self):
        index = MultiIndex.from_arrays([[0, 0, 1, 1], [0, 1, 0, 1]],
                                       names=['foo', None])

        df = DataFrame([[0, 1], [2, 3], [4, 5], [6, 7]], index=index)

        result = df.to_html()
        expected = """<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th>0</th>
      <th>1</th>
    </tr>
    <tr>
      <th>foo</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">0</th>
      <th>0</th>
      <td>0</td>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>3</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">1</th>
      <th>0</th>
      <td>4</td>
      <td>5</td>
    </tr>
    <tr>
      <th>1</th>
      <td>6</td>
      <td>7</td>
    </tr>
  </tbody>
</table>"""

        assert result == expected

        df = DataFrame([[0, 1], [2, 3], [4, 5], [6, 7]], columns=index[::2],
                       index=index)

        result = df.to_html()
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr>
      <th></th>
      <th>foo</th>
      <th>0</th>
      <th>1</th>
    </tr>
    <tr>
      <th></th>
      <th></th>
      <th>0</th>
      <th>0</th>
    </tr>
    <tr>
      <th>foo</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">0</th>
      <th>0</th>
      <td>0</td>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>3</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">1</th>
      <th>0</th>
      <td>4</td>
      <td>5</td>
    </tr>
    <tr>
      <th>1</th>
      <td>6</td>
      <td>7</td>
    </tr>
  </tbody>
</table>"""

        assert result == expected

    def test_to_html_multiindex_odd_even_truncate(self):
        # GH 14882 - Issue on truncation with odd length DataFrame
        mi = MultiIndex.from_product([[100, 200, 300],
                                      [10, 20, 30],
                                      [1, 2, 3, 4, 5, 6, 7]],
                                     names=['a', 'b', 'c'])
        df = DataFrame({'n': range(len(mi))}, index=mi)
        result = df.to_html(max_rows=60)
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th></th>
      <th>n</th>
    </tr>
    <tr>
      <th>a</th>
      <th>b</th>
      <th>c</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="21" valign="top">100</th>
      <th rowspan="7" valign="top">10</th>
      <th>1</th>
      <td>0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2</td>
    </tr>
    <tr>
      <th>4</th>
      <td>3</td>
    </tr>
    <tr>
      <th>5</th>
      <td>4</td>
    </tr>
    <tr>
      <th>6</th>
      <td>5</td>
    </tr>
    <tr>
      <th>7</th>
      <td>6</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">20</th>
      <th>1</th>
      <td>7</td>
    </tr>
    <tr>
      <th>2</th>
      <td>8</td>
    </tr>
    <tr>
      <th>3</th>
      <td>9</td>
    </tr>
    <tr>
      <th>4</th>
      <td>10</td>
    </tr>
    <tr>
      <th>5</th>
      <td>11</td>
    </tr>
    <tr>
      <th>6</th>
      <td>12</td>
    </tr>
    <tr>
      <th>7</th>
      <td>13</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">30</th>
      <th>1</th>
      <td>14</td>
    </tr>
    <tr>
      <th>2</th>
      <td>15</td>
    </tr>
    <tr>
      <th>3</th>
      <td>16</td>
    </tr>
    <tr>
      <th>4</th>
      <td>17</td>
    </tr>
    <tr>
      <th>5</th>
      <td>18</td>
    </tr>
    <tr>
      <th>6</th>
      <td>19</td>
    </tr>
    <tr>
      <th>7</th>
      <td>20</td>
    </tr>
    <tr>
      <th rowspan="19" valign="top">200</th>
      <th rowspan="7" valign="top">10</th>
      <th>1</th>
      <td>21</td>
    </tr>
    <tr>
      <th>2</th>
      <td>22</td>
    </tr>
    <tr>
      <th>3</th>
      <td>23</td>
    </tr>
    <tr>
      <th>4</th>
      <td>24</td>
    </tr>
    <tr>
      <th>5</th>
      <td>25</td>
    </tr>
    <tr>
      <th>6</th>
      <td>26</td>
    </tr>
    <tr>
      <th>7</th>
      <td>27</td>
    </tr>
    <tr>
      <th rowspan="5" valign="top">20</th>
      <th>1</th>
      <td>28</td>
    </tr>
    <tr>
      <th>2</th>
      <td>29</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
    </tr>
    <tr>
      <th>6</th>
      <td>33</td>
    </tr>
    <tr>
      <th>7</th>
      <td>34</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">30</th>
      <th>1</th>
      <td>35</td>
    </tr>
    <tr>
      <th>2</th>
      <td>36</td>
    </tr>
    <tr>
      <th>3</th>
      <td>37</td>
    </tr>
    <tr>
      <th>4</th>
      <td>38</td>
    </tr>
    <tr>
      <th>5</th>
      <td>39</td>
    </tr>
    <tr>
      <th>6</th>
      <td>40</td>
    </tr>
    <tr>
      <th>7</th>
      <td>41</td>
    </tr>
    <tr>
      <th rowspan="21" valign="top">300</th>
      <th rowspan="7" valign="top">10</th>
      <th>1</th>
      <td>42</td>
    </tr>
    <tr>
      <th>2</th>
      <td>43</td>
    </tr>
    <tr>
      <th>3</th>
      <td>44</td>
    </tr>
    <tr>
      <th>4</th>
      <td>45</td>
    </tr>
    <tr>
      <th>5</th>
      <td>46</td>
    </tr>
    <tr>
      <th>6</th>
      <td>47</td>
    </tr>
    <tr>
      <th>7</th>
      <td>48</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">20</th>
      <th>1</th>
      <td>49</td>
    </tr>
    <tr>
      <th>2</th>
      <td>50</td>
    </tr>
    <tr>
      <th>3</th>
      <td>51</td>
    </tr>
    <tr>
      <th>4</th>
      <td>52</td>
    </tr>
    <tr>
      <th>5</th>
      <td>53</td>
    </tr>
    <tr>
      <th>6</th>
      <td>54</td>
    </tr>
    <tr>
      <th>7</th>
      <td>55</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">30</th>
      <th>1</th>
      <td>56</td>
    </tr>
    <tr>
      <th>2</th>
      <td>57</td>
    </tr>
    <tr>
      <th>3</th>
      <td>58</td>
    </tr>
    <tr>
      <th>4</th>
      <td>59</td>
    </tr>
    <tr>
      <th>5</th>
      <td>60</td>
    </tr>
    <tr>
      <th>6</th>
      <td>61</td>
    </tr>
    <tr>
      <th>7</th>
      <td>62</td>
    </tr>
  </tbody>
</table>"""
        assert result == expected

        # Test that ... appears in a middle level
        result = df.to_html(max_rows=56)
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th></th>
      <th>n</th>
    </tr>
    <tr>
      <th>a</th>
      <th>b</th>
      <th>c</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="21" valign="top">100</th>
      <th rowspan="7" valign="top">10</th>
      <th>1</th>
      <td>0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2</td>
    </tr>
    <tr>
      <th>4</th>
      <td>3</td>
    </tr>
    <tr>
      <th>5</th>
      <td>4</td>
    </tr>
    <tr>
      <th>6</th>
      <td>5</td>
    </tr>
    <tr>
      <th>7</th>
      <td>6</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">20</th>
      <th>1</th>
      <td>7</td>
    </tr>
    <tr>
      <th>2</th>
      <td>8</td>
    </tr>
    <tr>
      <th>3</th>
      <td>9</td>
    </tr>
    <tr>
      <th>4</th>
      <td>10</td>
    </tr>
    <tr>
      <th>5</th>
      <td>11</td>
    </tr>
    <tr>
      <th>6</th>
      <td>12</td>
    </tr>
    <tr>
      <th>7</th>
      <td>13</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">30</th>
      <th>1</th>
      <td>14</td>
    </tr>
    <tr>
      <th>2</th>
      <td>15</td>
    </tr>
    <tr>
      <th>3</th>
      <td>16</td>
    </tr>
    <tr>
      <th>4</th>
      <td>17</td>
    </tr>
    <tr>
      <th>5</th>
      <td>18</td>
    </tr>
    <tr>
      <th>6</th>
      <td>19</td>
    </tr>
    <tr>
      <th>7</th>
      <td>20</td>
    </tr>
    <tr>
      <th rowspan="15" valign="top">200</th>
      <th rowspan="7" valign="top">10</th>
      <th>1</th>
      <td>21</td>
    </tr>
    <tr>
      <th>2</th>
      <td>22</td>
    </tr>
    <tr>
      <th>3</th>
      <td>23</td>
    </tr>
    <tr>
      <th>4</th>
      <td>24</td>
    </tr>
    <tr>
      <th>5</th>
      <td>25</td>
    </tr>
    <tr>
      <th>6</th>
      <td>26</td>
    </tr>
    <tr>
      <th>7</th>
      <td>27</td>
    </tr>
    <tr>
      <th>...</th>
      <th>...</th>
      <td>...</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">30</th>
      <th>1</th>
      <td>35</td>
    </tr>
    <tr>
      <th>2</th>
      <td>36</td>
    </tr>
    <tr>
      <th>3</th>
      <td>37</td>
    </tr>
    <tr>
      <th>4</th>
      <td>38</td>
    </tr>
    <tr>
      <th>5</th>
      <td>39</td>
    </tr>
    <tr>
      <th>6</th>
      <td>40</td>
    </tr>
    <tr>
      <th>7</th>
      <td>41</td>
    </tr>
    <tr>
      <th rowspan="21" valign="top">300</th>
      <th rowspan="7" valign="top">10</th>
      <th>1</th>
      <td>42</td>
    </tr>
    <tr>
      <th>2</th>
      <td>43</td>
    </tr>
    <tr>
      <th>3</th>
      <td>44</td>
    </tr>
    <tr>
      <th>4</th>
      <td>45</td>
    </tr>
    <tr>
      <th>5</th>
      <td>46</td>
    </tr>
    <tr>
      <th>6</th>
      <td>47</td>
    </tr>
    <tr>
      <th>7</th>
      <td>48</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">20</th>
      <th>1</th>
      <td>49</td>
    </tr>
    <tr>
      <th>2</th>
      <td>50</td>
    </tr>
    <tr>
      <th>3</th>
      <td>51</td>
    </tr>
    <tr>
      <th>4</th>
      <td>52</td>
    </tr>
    <tr>
      <th>5</th>
      <td>53</td>
    </tr>
    <tr>
      <th>6</th>
      <td>54</td>
    </tr>
    <tr>
      <th>7</th>
      <td>55</td>
    </tr>
    <tr>
      <th rowspan="7" valign="top">30</th>
      <th>1</th>
      <td>56</td>
    </tr>
    <tr>
      <th>2</th>
      <td>57</td>
    </tr>
    <tr>
      <th>3</th>
      <td>58</td>
    </tr>
    <tr>
      <th>4</th>
      <td>59</td>
    </tr>
    <tr>
      <th>5</th>
      <td>60</td>
    </tr>
    <tr>
      <th>6</th>
      <td>61</td>
    </tr>
    <tr>
      <th>7</th>
      <td>62</td>
    </tr>
  </tbody>
</table>"""
        assert result == expected

    def test_to_html_index_formatter(self):
        df = DataFrame([[0, 1], [2, 3], [4, 5], [6, 7]], columns=['foo', None],
                       index=lrange(4))

        f = lambda x: 'abcd' [x]
        result = df.to_html(formatters={'__index__': f})
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>foo</th>
      <th>None</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>a</th>
      <td>0</td>
      <td>1</td>
    </tr>
    <tr>
      <th>b</th>
      <td>2</td>
      <td>3</td>
    </tr>
    <tr>
      <th>c</th>
      <td>4</td>
      <td>5</td>
    </tr>
    <tr>
      <th>d</th>
      <td>6</td>
      <td>7</td>
    </tr>
  </tbody>
</table>"""

        assert result == expected

    def test_to_html_datetime64_monthformatter(self):
        months = [datetime(2016, 1, 1), datetime(2016, 2, 2)]
        x = DataFrame({'months': months})

        def format_func(x):
            return x.strftime('%Y-%m')
        result = x.to_html(formatters={'months': format_func})
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>months</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2016-01</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2016-02</td>
    </tr>
  </tbody>
</table>"""
        assert result == expected

    def test_to_html_datetime64_hourformatter(self):

        x = DataFrame({'hod': pd.to_datetime(['10:10:10.100', '12:12:12.120'],
                                             format='%H:%M:%S.%f')})

        def format_func(x):
            return x.strftime('%H:%M')
        result = x.to_html(formatters={'hod': format_func})
        expected = """\
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>hod</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>10:10</td>
    </tr>
    <tr>
      <th>1</th>
      <td>12:12</td>
    </tr>
  </tbody>
</table>"""
        assert result == expected

    def test_to_html_regression_GH6098(self):
        df = DataFrame({
            u('clé1'): [u('a'), u('a'), u('b'), u('b'), u('a')],
            u('clé2'): [u('1er'), u('2ème'), u('1er'), u('2ème'), u('1er')],
            'données1': np.random.randn(5),
            'données2': np.random.randn(5)})

        # it works
        df.pivot_table(index=[u('clé1')], columns=[u('clé2')])._repr_html_()

    def test_to_html_truncate(self):
        pytest.skip("unreliable on travis")
        index = pd.DatetimeIndex(start='20010101', freq='D', periods=20)
        df = DataFrame(index=index, columns=range(20))
        fmt.set_option('display.max_rows', 8)
        fmt.set_option('display.max_columns', 4)
        result = df._repr_html_()
        expected = '''\
<div{0}>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>0</th>
      <th>1</th>
      <th>...</th>
      <th>18</th>
      <th>19</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>2001-01-01</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2001-01-02</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2001-01-03</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2001-01-04</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>2001-01-17</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2001-01-18</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2001-01-19</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>2001-01-20</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
<p>20 rows × 20 columns</p>
</div>'''.format(div_style)
        if compat.PY2:
            expected = expected.decode('utf-8')
        assert result == expected

    def test_to_html_truncate_multi_index(self):
        pytest.skip("unreliable on travis")
        arrays = [['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux'],
                  ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        df = DataFrame(index=arrays, columns=arrays)
        fmt.set_option('display.max_rows', 7)
        fmt.set_option('display.max_columns', 7)
        result = df._repr_html_()
        expected = '''\
<div{0}>
<table border="1" class="dataframe">
  <thead>
    <tr>
      <th></th>
      <th></th>
      <th colspan="2" halign="left">bar</th>
      <th>baz</th>
      <th>...</th>
      <th>foo</th>
      <th colspan="2" halign="left">qux</th>
    </tr>
    <tr>
      <th></th>
      <th></th>
      <th>one</th>
      <th>two</th>
      <th>one</th>
      <th>...</th>
      <th>two</th>
      <th>one</th>
      <th>two</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">bar</th>
      <th>one</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>two</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>baz</th>
      <th>one</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>...</th>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>foo</th>
      <th>two</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">qux</th>
      <th>one</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>two</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
<p>8 rows × 8 columns</p>
</div>'''.format(div_style)
        if compat.PY2:
            expected = expected.decode('utf-8')
        assert result == expected

    def test_to_html_truncate_multi_index_sparse_off(self):
        pytest.skip("unreliable on travis")
        arrays = [['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux'],
                  ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        df = DataFrame(index=arrays, columns=arrays)
        fmt.set_option('display.max_rows', 7)
        fmt.set_option('display.max_columns', 7)
        fmt.set_option('display.multi_sparse', False)
        result = df._repr_html_()
        expected = '''\
<div{0}>
<table border="1" class="dataframe">
  <thead>
    <tr>
      <th></th>
      <th></th>
      <th>bar</th>
      <th>bar</th>
      <th>baz</th>
      <th>...</th>
      <th>foo</th>
      <th>qux</th>
      <th>qux</th>
    </tr>
    <tr>
      <th></th>
      <th></th>
      <th>one</th>
      <th>two</th>
      <th>one</th>
      <th>...</th>
      <th>two</th>
      <th>one</th>
      <th>two</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>bar</th>
      <th>one</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>bar</th>
      <th>two</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>baz</th>
      <th>one</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>foo</th>
      <th>two</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>qux</th>
      <th>one</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>qux</th>
      <th>two</th>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>...</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
<p>8 rows × 8 columns</p>
</div>'''.format(div_style)
        if compat.PY2:
            expected = expected.decode('utf-8')
        assert result == expected

    def test_to_html_border(self):
        df = DataFrame({'A': [1, 2]})
        result = df.to_html()
        assert 'border="1"' in result

    def test_to_html_border_option(self):
        df = DataFrame({'A': [1, 2]})
        with pd.option_context('html.border', 0):
            result = df.to_html()
            assert 'border="0"' in result
            assert 'border="0"' in df._repr_html_()

    def test_to_html_border_zero(self):
        df = DataFrame({'A': [1, 2]})
        result = df.to_html(border=0)
        assert 'border="0"' in result

    def test_to_html(self):
        # big mixed
        biggie = DataFrame({'A': np.random.randn(200),
                            'B': tm.makeStringIndex(200)},
                           index=lrange(200))

        biggie.loc[:20, 'A'] = np.nan
        biggie.loc[:20, 'B'] = np.nan
        s = biggie.to_html()

        buf = StringIO()
        retval = biggie.to_html(buf=buf)
        assert retval is None
        assert buf.getvalue() == s

        assert isinstance(s, compat.string_types)

        biggie.to_html(columns=['B', 'A'], col_space=17)
        biggie.to_html(columns=['B', 'A'],
                       formatters={'A': lambda x: '%.1f' % x})

        biggie.to_html(columns=['B', 'A'], float_format=str)
        biggie.to_html(columns=['B', 'A'], col_space=12, float_format=str)

        frame = DataFrame(index=np.arange(200))
        frame.to_html()

    def test_to_html_filename(self):
        biggie = DataFrame({'A': np.random.randn(200),
                            'B': tm.makeStringIndex(200)},
                           index=lrange(200))

        biggie.loc[:20, 'A'] = np.nan
        biggie.loc[:20, 'B'] = np.nan
        with tm.ensure_clean('test.html') as path:
            biggie.to_html(path)
            with open(path, 'r') as f:
                s = biggie.to_html()
                s2 = f.read()
                assert s == s2

        frame = DataFrame(index=np.arange(200))
        with tm.ensure_clean('test.html') as path:
            frame.to_html(path)
            with open(path, 'r') as f:
                assert frame.to_html() == f.read()

    def test_to_html_with_no_bold(self):
        x = DataFrame({'x': np.random.randn(5)})
        ashtml = x.to_html(bold_rows=False)
        assert '<strong' not in ashtml[ashtml.find("</thead>")]

    def test_to_html_columns_arg(self):
        frame = DataFrame(tm.getSeriesData())
        result = frame.to_html(columns=['A'])
        assert '<th>B</th>' not in result

    def test_to_html_multiindex(self):
        columns = MultiIndex.from_tuples(list(zip(np.arange(2).repeat(2),
                                                  np.mod(lrange(4), 2))),
                                         names=['CL0', 'CL1'])
        df = DataFrame([list('abcd'), list('efgh')], columns=columns)
        result = df.to_html(justify='left')
        expected = ('<table border="1" class="dataframe">\n'
                    '  <thead>\n'
                    '    <tr>\n'
                    '      <th>CL0</th>\n'
                    '      <th colspan="2" halign="left">0</th>\n'
                    '      <th colspan="2" halign="left">1</th>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>CL1</th>\n'
                    '      <th>0</th>\n'
                    '      <th>1</th>\n'
                    '      <th>0</th>\n'
                    '      <th>1</th>\n'
                    '    </tr>\n'
                    '  </thead>\n'
                    '  <tbody>\n'
                    '    <tr>\n'
                    '      <th>0</th>\n'
                    '      <td>a</td>\n'
                    '      <td>b</td>\n'
                    '      <td>c</td>\n'
                    '      <td>d</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>1</th>\n'
                    '      <td>e</td>\n'
                    '      <td>f</td>\n'
                    '      <td>g</td>\n'
                    '      <td>h</td>\n'
                    '    </tr>\n'
                    '  </tbody>\n'
                    '</table>')

        assert result == expected

        columns = MultiIndex.from_tuples(list(zip(
            range(4), np.mod(
                lrange(4), 2))))
        df = DataFrame([list('abcd'), list('efgh')], columns=columns)

        result = df.to_html(justify='right')
        expected = ('<table border="1" class="dataframe">\n'
                    '  <thead>\n'
                    '    <tr>\n'
                    '      <th></th>\n'
                    '      <th>0</th>\n'
                    '      <th>1</th>\n'
                    '      <th>2</th>\n'
                    '      <th>3</th>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th></th>\n'
                    '      <th>0</th>\n'
                    '      <th>1</th>\n'
                    '      <th>0</th>\n'
                    '      <th>1</th>\n'
                    '    </tr>\n'
                    '  </thead>\n'
                    '  <tbody>\n'
                    '    <tr>\n'
                    '      <th>0</th>\n'
                    '      <td>a</td>\n'
                    '      <td>b</td>\n'
                    '      <td>c</td>\n'
                    '      <td>d</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>1</th>\n'
                    '      <td>e</td>\n'
                    '      <td>f</td>\n'
                    '      <td>g</td>\n'
                    '      <td>h</td>\n'
                    '    </tr>\n'
                    '  </tbody>\n'
                    '</table>')

        assert result == expected

    def test_to_html_justify(self):
        df = DataFrame({'A': [6, 30000, 2],
                        'B': [1, 2, 70000],
                        'C': [223442, 0, 1]},
                       columns=['A', 'B', 'C'])
        result = df.to_html(justify='left')
        expected = ('<table border="1" class="dataframe">\n'
                    '  <thead>\n'
                    '    <tr style="text-align: left;">\n'
                    '      <th></th>\n'
                    '      <th>A</th>\n'
                    '      <th>B</th>\n'
                    '      <th>C</th>\n'
                    '    </tr>\n'
                    '  </thead>\n'
                    '  <tbody>\n'
                    '    <tr>\n'
                    '      <th>0</th>\n'
                    '      <td>6</td>\n'
                    '      <td>1</td>\n'
                    '      <td>223442</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>1</th>\n'
                    '      <td>30000</td>\n'
                    '      <td>2</td>\n'
                    '      <td>0</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>2</th>\n'
                    '      <td>2</td>\n'
                    '      <td>70000</td>\n'
                    '      <td>1</td>\n'
                    '    </tr>\n'
                    '  </tbody>\n'
                    '</table>')
        assert result == expected

        result = df.to_html(justify='right')
        expected = ('<table border="1" class="dataframe">\n'
                    '  <thead>\n'
                    '    <tr style="text-align: right;">\n'
                    '      <th></th>\n'
                    '      <th>A</th>\n'
                    '      <th>B</th>\n'
                    '      <th>C</th>\n'
                    '    </tr>\n'
                    '  </thead>\n'
                    '  <tbody>\n'
                    '    <tr>\n'
                    '      <th>0</th>\n'
                    '      <td>6</td>\n'
                    '      <td>1</td>\n'
                    '      <td>223442</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>1</th>\n'
                    '      <td>30000</td>\n'
                    '      <td>2</td>\n'
                    '      <td>0</td>\n'
                    '    </tr>\n'
                    '    <tr>\n'
                    '      <th>2</th>\n'
                    '      <td>2</td>\n'
                    '      <td>70000</td>\n'
                    '      <td>1</td>\n'
                    '    </tr>\n'
                    '  </tbody>\n'
                    '</table>')
        assert result == expected

    def test_to_html_index(self):
        index = ['foo', 'bar', 'baz']
        df = DataFrame({'A': [1, 2, 3],
                        'B': [1.2, 3.4, 5.6],
                        'C': ['one', 'two', np.nan]},
                       columns=['A', 'B', 'C'],
                       index=index)
        expected_with_index = ('<table border="1" class="dataframe">\n'
                               '  <thead>\n'
                               '    <tr style="text-align: right;">\n'
                               '      <th></th>\n'
                               '      <th>A</th>\n'
                               '      <th>B</th>\n'
                               '      <th>C</th>\n'
                               '    </tr>\n'
                               '  </thead>\n'
                               '  <tbody>\n'
                               '    <tr>\n'
                               '      <th>foo</th>\n'
                               '      <td>1</td>\n'
                               '      <td>1.2</td>\n'
                               '      <td>one</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>bar</th>\n'
                               '      <td>2</td>\n'
                               '      <td>3.4</td>\n'
                               '      <td>two</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>baz</th>\n'
                               '      <td>3</td>\n'
                               '      <td>5.6</td>\n'
                               '      <td>NaN</td>\n'
                               '    </tr>\n'
                               '  </tbody>\n'
                               '</table>')
        assert df.to_html() == expected_with_index

        expected_without_index = ('<table border="1" class="dataframe">\n'
                                  '  <thead>\n'
                                  '    <tr style="text-align: right;">\n'
                                  '      <th>A</th>\n'
                                  '      <th>B</th>\n'
                                  '      <th>C</th>\n'
                                  '    </tr>\n'
                                  '  </thead>\n'
                                  '  <tbody>\n'
                                  '    <tr>\n'
                                  '      <td>1</td>\n'
                                  '      <td>1.2</td>\n'
                                  '      <td>one</td>\n'
                                  '    </tr>\n'
                                  '    <tr>\n'
                                  '      <td>2</td>\n'
                                  '      <td>3.4</td>\n'
                                  '      <td>two</td>\n'
                                  '    </tr>\n'
                                  '    <tr>\n'
                                  '      <td>3</td>\n'
                                  '      <td>5.6</td>\n'
                                  '      <td>NaN</td>\n'
                                  '    </tr>\n'
                                  '  </tbody>\n'
                                  '</table>')
        result = df.to_html(index=False)
        for i in index:
            assert i not in result
        assert result == expected_without_index
        df.index = Index(['foo', 'bar', 'baz'], name='idx')
        expected_with_index = ('<table border="1" class="dataframe">\n'
                               '  <thead>\n'
                               '    <tr style="text-align: right;">\n'
                               '      <th></th>\n'
                               '      <th>A</th>\n'
                               '      <th>B</th>\n'
                               '      <th>C</th>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>idx</th>\n'
                               '      <th></th>\n'
                               '      <th></th>\n'
                               '      <th></th>\n'
                               '    </tr>\n'
                               '  </thead>\n'
                               '  <tbody>\n'
                               '    <tr>\n'
                               '      <th>foo</th>\n'
                               '      <td>1</td>\n'
                               '      <td>1.2</td>\n'
                               '      <td>one</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>bar</th>\n'
                               '      <td>2</td>\n'
                               '      <td>3.4</td>\n'
                               '      <td>two</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>baz</th>\n'
                               '      <td>3</td>\n'
                               '      <td>5.6</td>\n'
                               '      <td>NaN</td>\n'
                               '    </tr>\n'
                               '  </tbody>\n'
                               '</table>')
        assert df.to_html() == expected_with_index
        assert df.to_html(index=False) == expected_without_index

        tuples = [('foo', 'car'), ('foo', 'bike'), ('bar', 'car')]
        df.index = MultiIndex.from_tuples(tuples)

        expected_with_index = ('<table border="1" class="dataframe">\n'
                               '  <thead>\n'
                               '    <tr style="text-align: right;">\n'
                               '      <th></th>\n'
                               '      <th></th>\n'
                               '      <th>A</th>\n'
                               '      <th>B</th>\n'
                               '      <th>C</th>\n'
                               '    </tr>\n'
                               '  </thead>\n'
                               '  <tbody>\n'
                               '    <tr>\n'
                               '      <th rowspan="2" valign="top">foo</th>\n'
                               '      <th>car</th>\n'
                               '      <td>1</td>\n'
                               '      <td>1.2</td>\n'
                               '      <td>one</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>bike</th>\n'
                               '      <td>2</td>\n'
                               '      <td>3.4</td>\n'
                               '      <td>two</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>bar</th>\n'
                               '      <th>car</th>\n'
                               '      <td>3</td>\n'
                               '      <td>5.6</td>\n'
                               '      <td>NaN</td>\n'
                               '    </tr>\n'
                               '  </tbody>\n'
                               '</table>')
        assert df.to_html() == expected_with_index

        result = df.to_html(index=False)
        for i in ['foo', 'bar', 'car', 'bike']:
            assert i not in result
        # must be the same result as normal index
        assert result == expected_without_index

        df.index = MultiIndex.from_tuples(tuples, names=['idx1', 'idx2'])
        expected_with_index = ('<table border="1" class="dataframe">\n'
                               '  <thead>\n'
                               '    <tr style="text-align: right;">\n'
                               '      <th></th>\n'
                               '      <th></th>\n'
                               '      <th>A</th>\n'
                               '      <th>B</th>\n'
                               '      <th>C</th>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>idx1</th>\n'
                               '      <th>idx2</th>\n'
                               '      <th></th>\n'
                               '      <th></th>\n'
                               '      <th></th>\n'
                               '    </tr>\n'
                               '  </thead>\n'
                               '  <tbody>\n'
                               '    <tr>\n'
                               '      <th rowspan="2" valign="top">foo</th>\n'
                               '      <th>car</th>\n'
                               '      <td>1</td>\n'
                               '      <td>1.2</td>\n'
                               '      <td>one</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>bike</th>\n'
                               '      <td>2</td>\n'
                               '      <td>3.4</td>\n'
                               '      <td>two</td>\n'
                               '    </tr>\n'
                               '    <tr>\n'
                               '      <th>bar</th>\n'
                               '      <th>car</th>\n'
                               '      <td>3</td>\n'
                               '      <td>5.6</td>\n'
                               '      <td>NaN</td>\n'
                               '    </tr>\n'
                               '  </tbody>\n'
                               '</table>')
        assert df.to_html() == expected_with_index
        assert df.to_html(index=False) == expected_without_index

    def test_to_html_with_classes(self):
        df = DataFrame()
        result = df.to_html(classes="sortable draggable")
        expected = dedent("""

            <table border="1" class="dataframe sortable draggable">
              <thead>
                <tr style="text-align: right;">
                  <th></th>
                </tr>
              </thead>
              <tbody>
              </tbody>
            </table>

        """).strip()
        assert result == expected

        result = df.to_html(classes=["sortable", "draggable"])
        assert result == expected

    def test_to_html_no_index_max_rows(self):
        # GH https://github.com/pandas-dev/pandas/issues/14998
        df = DataFrame({"A": [1, 2, 3, 4]})
        result = df.to_html(index=False, max_rows=1)
        expected = dedent("""\
        <table border="1" class="dataframe">
          <thead>
            <tr style="text-align: right;">
              <th>A</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
            </tr>
          </tbody>
        </table>""")
        assert result == expected

    def test_to_html_notebook_has_style(self):
        df = pd.DataFrame({"A": [1, 2, 3]})
        result = df.to_html(notebook=True)
        assert "thead tr:only-child" in result

    def test_to_html_notebook_has_no_style(self):
        df = pd.DataFrame({"A": [1, 2, 3]})
        result = df.to_html()
        assert "thead tr:only-child" not in result

    def test_to_html_with_index_names_false(self):
        # gh-16493
        df = pd.DataFrame({"A": [1, 2]}, index=pd.Index(['a', 'b'],
                                                        name='myindexname'))
        result = df.to_html(index_names=False)
        assert 'myindexname' not in result
