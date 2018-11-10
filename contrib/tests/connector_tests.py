"""Unit tests for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
from collections import OrderedDict
import datetime
import io
import re
import unittest
import markdown
import pandas as pd
from pandas.testing import assert_frame_equal
from sqlalchemy import Date
from tests.base_tests import SupersetTestCase
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.models.helpers import QueryResult
from superset.utils import QueryStatus
from ..connectors.pandas.models import (
    PandasColumn, PandasDatasource, PandasMetric)
class BaseConnectorTestCase(SupersetTestCase):
    """
    Standard tests for Connectors, especially for .query()
    Connector-specific subclasses should override, `setUp()`
    to create a Datasource with the appropriate Columns and
    Metrics, and store a copy of the raw
    data in the `self.df` attribute
    """
    def __init__(self, methodName='runTest'):
        """Setup assertEqual for DataFrames"""
        super(BaseConnectorTestCase, self).__init__(methodName)
        self.addTypeEqualityFunc(pd.DataFrame, 'assertFrameEqual')
    @classmethod
    def setUpClass(cls):
        if cls is BaseConnectorTestCase:
            raise unittest.SkipTest('Skip tests from BaseConnectorTestCase')
        super(BaseConnectorTestCase, cls).setUpClass()
    data = """
        | region   | district   | project   | received            | value  | value2 | category  |
        |----------|------------|-----------|---------------------|--------|--------|-----------|
        | Region 1 | District A | Project A | 2001-01-31 10:00:00 | 33     |  12.30 | CategoryA |
        | Region 1 | District A | Project A | 2001-01-31 12:00:00 | 32     |  13.60 | CategoryB |
        | Region 1 | District B | Project B | 2001-01-31 13:00:00 | 35     |  15.50 | CategoryA |
        | Region 2 | District C | Project C | 2001-01-31 09:00:00 | 12     |  17.80 | CategoryB |
        | Region 1 | District A | Project A | 2001-02-28 09:00:00 | 66     |  11.30 | CategoryB |
        | Region 1 | District B | Project B | 2001-02-28 08:00:00 | 15     |  19.90 | CategoryB |
        | Region 1 | District B | Project B | 2001-02-28 10:00:00 | 25     |  15.30 | CategoryA |
        | Region 2 | District C | Project C | 2001-02-28 08:00:00 | 18     |  13.80 | CategoryA |
        | Region 1 | District A | Project A | 2001-03-31 11:00:00 | 85     |  45.10 | CategoryB |
        | Region 1 | District B | Project B | 2001-03-31 12:00:00 |  5     |  28.10 | CategoryA |
        | Region 2 | District C | Project C | 2001-03-31 14:00:00 | 35     |  22.60 | CategoryB |
        | Region 1 | District A | Project A | 2001-04-30 10:00:00 | 15     |  11.00 | CategoryA |
        | Region 1 | District A | Project A | 2001-04-30 12:00:00 | 15     |  16.10 | CategoryB |
        | Region 2 | District C | Project C | 2001-04-30 13:00:00 | 15     |  18.50 | CategoryA |
        """  # NOQA: E501
    def assertFrameEqual(self, frame1, frame2, msg=None):
        # We don't care about the index, because it is
        # not part of the data returned to the client
        return assert_frame_equal(frame1.reset_index(drop=True),
                                  frame2.reset_index(drop=True),
                                  msg)
    def setUp(self):
        # Create a copy of the raw data as a dataframe to be
        # used for calculated expected results
        self.df = self.md_to_df(self.data)
        self.df['received'] = self.df['received'].values.astype('datetime64[D]')
    def md_to_html(self, md_raw):
        """
        Convert a possibly-indented Markdown-table to a file-like object
        that can be parsed by pd.read_html().
        See https://github.com/XLSForm/pyxform/blob/master/pyxform/tests_v1/pyxform_test_case.py # NOQA
        for the inspiration
        """
        _md = []
        for line in md_raw.split('\n'):
            if re.match(r'^\s+\#', line):
                # ignore lines which start with pound sign
                continue
            elif re.match(r'^(.*)(\#[^\|]+)$', line):
                # keep everything before the # outside of the last occurrence
                # of |
                _md.append(
                    re.match(r'^(.*)(\#[^\|]+)$', line).groups()[0].strip())
            else:
                _md.append(line.strip())
        md = '\n'.join(_md)
        return io.StringIO(
            markdown.markdown(md, extensions=['markdown.extensions.tables']))
    def md_to_df(self, md_raw):
        """
        Convert a possibly-indented Markdown-table to a Pandas DataFrame
        """
        return pd.read_html(self.md_to_html(md_raw))[0]
    def test_values_for_column(self):
        result = self.datasource.values_for_column('project')
        self.assertEqual(result, self.df['project'].unique().tolist())
    def test_values_for_column_with_limit(self):
        result = self.datasource.values_for_column('project', 1)
        self.assertEqual(result, self.df['project'].unique()[:1].tolist())
    def test_get_query_str(self):
        p = {
            'groupby': ['project'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.get_query_str(p)
        self.assertIn('project', result)
    def test_summary_single_metric(self):
        p = {
            'groupby': [],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = pd.DataFrame({'sum__value': [self.df['value'].sum()]})
        self.assertEqual(result.df, expected_df)
    def test_summary_multiple_metrics(self):
        p = {
            'groupby': [],
            'metrics': ['sum__value', 'avg__value', 'value_percentage', 'ratio'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        self.df['ratio'] = self.df['value'] / self.df['value2']
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = pd.DataFrame(OrderedDict([
            ('sum__value', [self.df['value'].sum()]),
            ('avg__value', [self.df['value'].mean()]),
            ('value_percentage', [sum(self.df['value']) /
                                  sum(self.df['value'] + self.df['value2'])]),
            ('ratio', [self.df['ratio'].mean()]),
        ]))
        self.assertEqual(result.df, expected_df)
    def test_from_to_dttm(self):
        p = {
            'groupby': [],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 3, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        df = self.df.loc[self.df['received'] > datetime.datetime(2001, 3, 1)]
        expected_df = pd.DataFrame({'sum__value': [df['value'].sum()]})
        self.assertEqual(result.df, expected_df)
    def test_filter_eq_string(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'district', 'val': 'District A', 'op': '=='},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[self.df['district'] == 'District A']
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = expected_df.sort_values(['sum__value'], ascending=False)
        self.assertEqual(result.df, expected_df)
    def test_filter_eq_num(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'value', 'val': '85', 'op': '=='},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[self.df['value'] == 85]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = expected_df.sort_values(['sum__value'], ascending=False)
        self.assertEqual(result.df, expected_df)
    def test_filter_eq_date(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'received', 'val': '2001-02-28', 'op': '=='},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[self.df['received'] == datetime.datetime(2001, 2, 28)]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = expected_df.sort_values(['sum__value'], ascending=False)
        self.assertEqual(result.df, expected_df)
    def test_filter_gte(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'value', 'val': '70', 'op': '>='},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[self.df['value'] >= 70]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = expected_df.sort_values(['sum__value'], ascending=False)
        self.assertEqual(result.df, expected_df)
    def test_filter_in_num(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'value', 'val': ['32', '35'], 'op': 'in'},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[~((self.df['value'] != 32) &
                                  (self.df['value'] != 35))]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = (expected_df.sort_values(['sum__value'], ascending=False)
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
    def test_filter_in_str(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'project', 'val': ['Project A', 'Project C'], 'op': 'in'},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[~((self.df['project'] != 'Project A') &
                                  (self.df['project'] != 'Project C'))]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = (expected_df.sort_values(['sum__value'], ascending=False)
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
    def test_filter_not_in_num(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'value', 'val': ['32', '35'], 'op': 'not in'},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[((self.df['value'] != 32) &
                                 (self.df['value'] != 35))]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = (expected_df.sort_values(['sum__value'], ascending=False)
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
    def test_filter_not_in_str(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [
                {'col': 'project', 'val': ['Project A', 'Project C'], 'op': 'not in'},
            ],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .loc[((self.df['project'] != 'Project A') &
                                 (self.df['project'] != 'Project C'))]
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = expected_df.sort_values(['sum__value'], ascending=False)
        self.assertEqual(result.df, expected_df)
    def test_columns_only(self):
        p = {
            'groupby': [],
            'metrics': [],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
            'columns': ['project', 'region', 'received', 'value'],
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = self.df[p['columns']].copy()
        expected_df['received'] = expected_df['received'].astype(str)
        self.assertEqual(result.df, expected_df)
    def test_orderby_with_columns(self):
        p = {
            'groupby': [],
            'metrics': [],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
            'columns': ['project', 'region', 'received', 'value'],
            'orderby': [
                ['project', False],
                ['region', True],
            ],
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .sort_values(['project', 'region'],
                                        ascending=[False, True])
                           .reset_index(drop=True)
                       [p['columns']])
        expected_df['received'] = expected_df['received'].astype(str)
        self.assertEqual(result.df, expected_df)
    def test_groupby_only(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': [],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])
                              .size()
                              .reset_index()
                              .sort_values([0], ascending=False)
                              .drop(0, axis=1))
        self.assertEqual(result.df, expected_df)
    def test_groupby_single_metric(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])['value']
                              .sum()
                              .reset_index()
                              .sort_values(['value'], ascending=False))
        expected_df.columns = p['groupby'] + p['metrics']
        self.assertEqual(result.df, expected_df)
    def test_groupby_multiple_metrics(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value', 'avg__value', 'value_percentage', 'ratio'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        self.df['ratio'] = self.df['value'] / self.df['value2']
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])
                           .aggregate(OrderedDict([('value', ['sum', 'mean']),
                                                   ('ratio', ['mean'])])))
        expected_df['value_percentage'] = (self.df.groupby(p['groupby'])
                                                  .apply(lambda x: sum(x['value']) /
                                                         sum(x['value'] + x['value2'])))
        expected_df = expected_df.reset_index()
        expected_df.columns = (p['groupby'] +
                               ['sum__value', 'avg__value', 'ratio', 'value_percentage'])
        expected_df = (expected_df[p['groupby'] + p['metrics']]
                       .sort_values(['sum__value'], ascending=False))
        self.assertEqual(result.df, expected_df)
    def test_groupby_ratio_metric(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['ratio'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        self.df['ratio'] = self.df['value'] / self.df['value2']
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])['ratio']
                              .mean()
                              .reset_index()
                              .sort_values(['ratio'], ascending=False))
        expected_df.columns = p['groupby'] + p['metrics']
        self.assertEqual(result.df, expected_df)
    def test_groupby_value_percentage_metric(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['value_percentage'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])
                              .apply(lambda x: sum(x['value']) /
                                     sum(x['value'] + x['value2']))
                              .reset_index()
                              .sort_values([0], ascending=False))
        expected_df.columns = p['groupby'] + p['metrics']
        self.assertEqual(result.df, expected_df)
    def test_groupby_category_percentage_metric(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['category_percentage'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])['category']
                              .value_counts(normalize=True)
                              .reset_index(p['groupby'])
                              .loc['CategoryA']
                              .reset_index(drop=True)
                              .sort_values(['category'], ascending=False))
        expected_df.columns = p['groupby'] + p['metrics']
        self.assertEqual(result.df, expected_df)
    def test_groupby_ascending_order(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value', 'avg__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
            },
            'order_desc': False,
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df.groupby(p['groupby'])
                           .aggregate({'value': ['sum', 'mean']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = expected_df.sort_values(['sum__value'], ascending=True)
        self.assertEqual(result.df, expected_df)
    def test_timeseries_single_metric(self):
        p = {
            'groupby': [],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': True,
            'timeseries_limit': 50,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                # Note that week and month don't work on SQLite
                # See https://github.com/apache/incubator-superset/issues/617
                'time_grain_sqla': 'day',
            },
            'order_desc': True,
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        time_grain = PandasDatasource.GRAINS[p['extras']['time_grain_sqla']]
        expected_df = (self.df.groupby(p['groupby'] +
                                       [pd.Grouper(key=p['granularity'],
                                                   freq=time_grain)])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = (p['groupby'] +
                               ['__timestamp'] +
                               p['metrics'])
        expected_df['__timestamp'] = expected_df['__timestamp'].astype(str)
        expected_df = (expected_df.sort_values(p['metrics'][0],
                                               ascending=(not p['order_desc']))
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
    def test_timeseries_multiple_metrics(self):
        p = {
            'groupby': [],
            'metrics': ['sum__value', 'avg__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': True,
            'timeseries_limit': 50,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                # Note that week and month don't work on SQLite
                # See https://github.com/apache/incubator-superset/issues/617
                'time_grain_sqla': 'day',
            },
            'order_desc': True,
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        time_grain = PandasDatasource.GRAINS[p['extras']['time_grain_sqla']]
        expected_df = (self.df.groupby(p['groupby'] +
                                       [pd.Grouper(key=p['granularity'],
                                                   freq=time_grain)])
                           .aggregate({'value': ['sum', 'mean']})
                           .reset_index())
        expected_df.columns = (p['groupby'] +
                               ['__timestamp'] +
                               p['metrics'])
        expected_df['__timestamp'] = expected_df['__timestamp'].astype(str)
        expected_df = (expected_df.sort_values(p['metrics'][0],
                                               ascending=(not p['order_desc'])))
        self.assertEqual(result.df, expected_df)
    def test_timeseries_groupby(self):
        p = {
            'groupby': ['project'],
            'metrics': ['sum__value', 'avg__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': True,
            'timeseries_limit': 50,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                # Note that week and month don't work on SQLite
                # See https://github.com/apache/incubator-superset/issues/617
                'time_grain_sqla': 'day',
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        time_grain = PandasDatasource.GRAINS[p['extras']['time_grain_sqla']]
        expected_df = (self.df.groupby(p['groupby'] +
                                       [pd.Grouper(key=p['granularity'],
                                                   freq=time_grain)])
                           .aggregate({'value': ['sum', 'mean']})
                           .reset_index())
        expected_df.columns = (p['groupby'] +
                               ['__timestamp'] +
                               p['metrics'])
        expected_df['__timestamp'] = expected_df['__timestamp'].astype(str)
        expected_df = (expected_df.sort_values(['sum__value'], ascending=False)
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
    def test_timeseries_limit(self):
        p = {
            'groupby': ['project', 'district'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': True,
            'timeseries_limit': 2,
            'timeseries_limit_metric': 'avg__value',
            'row_limit': 5000,
            'extras': {
                # Note that week and month don't work on SQLite
                # See https://github.com/apache/incubator-superset/issues/617
                'time_grain_sqla': 'day',
            },
            'order_desc': True,
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        time_grain = PandasDatasource.GRAINS[p['extras']['time_grain_sqla']]
        limit_df = (self.df.groupby(p['groupby'])
                           .aggregate({'value': 'mean'})
                           .sort_values('value', ascending=(not p['order_desc']))
                           .iloc[:p['timeseries_limit']])
        source_df = self.df.set_index(p['groupby'])
        expected_df = (source_df[source_df.index.isin(limit_df.index)]
                       .groupby(p['groupby'] + [pd.Grouper(key=p['granularity'],
                                freq=time_grain)])
                       .aggregate({'value': ['sum']})
                       .reset_index())
        expected_df.columns = (p['groupby'] +
                               ['__timestamp'] +
                               p['metrics'])
        expected_df['__timestamp'] = expected_df['__timestamp'].astype(str)
        expected_df = (expected_df.sort_values(['sum__value'],
                                               ascending=(not p['order_desc']))
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
    def test_timeseries_limit_ascending_order(self):
        p = {
            'groupby': ['project', 'district'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'filter': [],
            'is_timeseries': True,
            'timeseries_limit': 2,
            'timeseries_limit_metric': 'avg__value',
            'row_limit': 5000,
            'extras': {
                # Note that week and month don't work on SQLite
                # See https://github.com/apache/incubator-superset/issues/617
                'time_grain_sqla': 'day',
            },
            'order_desc': False,
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        time_grain = PandasDatasource.GRAINS[p['extras']['time_grain_sqla']]
        limit_df = (self.df.groupby(p['groupby'])
                           .aggregate({'value': 'mean'})
                           .sort_values('value', ascending=(not p['order_desc']))
                           .iloc[:p['timeseries_limit']])
        source_df = self.df.set_index(p['groupby'])
        expected_df = (source_df[source_df.index.isin(limit_df.index)]
                       .groupby(p['groupby'] + [pd.Grouper(key=p['granularity'],
                                freq=time_grain)])
                       .aggregate({'value': ['sum']})
                       .reset_index())
        expected_df.columns = (p['groupby'] +
                               ['__timestamp'] +
                               p['metrics'])
        expected_df['__timestamp'] = expected_df['__timestamp'].astype(str)
        expected_df = (expected_df.sort_values(['sum__value'],
                                               ascending=(not p['order_desc']))
                                  .reset_index(drop=True))
        self.assertEqual(result.df, expected_df)
class SqlaConnectorTestCase(BaseConnectorTestCase):
    columns = [
        TableColumn(column_name='region', type='VARCHAR(20)'),
        TableColumn(column_name='district', type='VARCHAR(20)'),
        TableColumn(column_name='project', type='VARCHAR(20)'),
        TableColumn(column_name='received', type='DATE', is_dttm=True),
        TableColumn(column_name='value', type='BIGINT'),
    ]
    metrics = [
        SqlMetric(metric_name='sum__value', metric_type='sum',
                  expression='SUM(value)'),
        SqlMetric(metric_name='avg__value', metric_type='avg',
                  expression='AVG(value)'),
        SqlMetric(metric_name='ratio', metric_type='avg',
                  expression='AVG(value/value2)'),
        SqlMetric(metric_name='value_percentage', metric_type='custom',
                  expression='SUM(value)/SUM(value + value2)'),
        SqlMetric(metric_name='category_percentage', metric_type='custom',
                  expression="SUM(CASE WHEN category='CategoryA' THEN 1 ELSE 0 END)/"
                             'CAST(COUNT(*) AS REAL)'),
    ]
    def setUp(self):
        super(SqlaConnectorTestCase, self).setUp()
        sqlalchemy_uri = 'sqlite:////tmp/test.db'
        database = Database(
            database_name='test_database',
            sqlalchemy_uri=sqlalchemy_uri)
        self.connection = database.get_sqla_engine().connect()
        self.datasource = SqlaTable(table_name='test_datasource',
                                    database=database,
                                    columns=self.columns,
                                    metrics=self.metrics)
        with database.get_sqla_engine().begin() as connection:
            self.df.to_sql(self.datasource.table_name,
                           connection,
                           if_exists='replace',
                           index=False,
                           dtype={'received': Date})
class PandasConnectorTestCase(BaseConnectorTestCase):
    columns = [
        PandasColumn(column_name='region', type='object'),
        PandasColumn(column_name='district', type='object'),
        PandasColumn(column_name='project', type='object'),
        PandasColumn(column_name='received', type='datetime64[D]'),
        PandasColumn(column_name='value', type='int64'),
        PandasColumn(column_name='ratio', type='float64',
                     expression='value / value2'),
        PandasColumn(column_name='inverse_ratio', type='float64',
                     expression='value2 / value'),
    ]
    metrics = [
        PandasMetric(metric_name='sum__value', metric_type='sum',
                     source='value', expression='sum'),
        PandasMetric(metric_name='avg__value', metric_type='avg',
                     source='value', expression='mean'),
        PandasMetric(metric_name='ratio', metric_type='avg',
                     source='ratio', expression='mean'),
        PandasMetric(metric_name='value_percentage', metric_type='custom',
                     source=None, expression='calc_value_percentage'),
        PandasMetric(metric_name='category_percentage', metric_type='custom',
                     source='category', expression='calc_category_percentage'),
    ]
    def setUp(self):
        super(PandasConnectorTestCase, self).setUp()
        self.datasource = PandasDatasource(name='test datasource',
                                           source_url=self.md_to_html(self.data),
                                           format='html',
                                           columns=self.columns,
                                           metrics=self.metrics)
        def calc_value_percentage(group):
            return sum(group['value']) / sum(group['value'] + group['value2'])
        self.datasource.calc_value_percentage = calc_value_percentage
        def calc_category_percentage(group):
            return group.value_counts(normalize=True).loc['CategoryA']
        self.datasource.calc_category_percentage = calc_category_percentage
    def test_post_aggregation_filter(self):
        p = {
            'groupby': ['project', 'region'],
            'metrics': ['sum__value'],
            'granularity': 'received',
            'from_dttm': datetime.datetime(2001, 1, 1),
            'to_dttm': datetime.datetime(2001, 12, 31),
            'is_timeseries': False,
            'timeseries_limit': 0,
            'timeseries_limit_metric': None,
            'row_limit': 5000,
            'extras': {
                'time_grain_sqla': None,
                'having_druid': [
                    {'col': 'sum__value', 'val': '150', 'op': '>='},
                ],
            },
        }
        result = self.datasource.query(p)
        self.assertIsInstance(result, QueryResult)
        self.assertEqual(result.error_message, None)
        self.assertEqual(result.status, QueryStatus.SUCCESS)
        expected_df = (self.df
                           .groupby(p['groupby'])
                           .aggregate({'value': ['sum']})
                           .reset_index())
        expected_df.columns = p['groupby'] + p['metrics']
        expected_df = (expected_df.loc[expected_df['sum__value'] >= 150]
                                  .sort_values(['sum__value'], ascending=False))
        self.assertEqual(result.df, expected_df)
if __name__ == '__main__':
    unittest.main()