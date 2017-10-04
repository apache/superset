import unittest
import pandas as pd
import superset.viz as viz
import superset.utils as utils

from superset.utils import DTTM_ALIAS
from mock import Mock, patch
from datetime import datetime, timedelta

class BaseVizTestCase(unittest.TestCase):
    def test_constructor_exception_no_datasource(self):
        form_data = {}
        datasource = None
        with self.assertRaises(Exception):
            viz.BaseViz(datasource, form_data)

    def test_get_fillna_returns_default_on_null_columns(self):
        form_data = {
            'viz_type': 'table',
            'token': '12345',
        }
        datasource = {'type': 'table'}
        test_viz = viz.BaseViz(datasource, form_data);
        self.assertEquals(
            test_viz.default_fillna,
            test_viz.get_fillna_for_columns()
        )

    def test_get_df_returns_empty_df(self):
        datasource = Mock()
        datasource.type = 'table'
        mock_dttm_col = Mock()
        mock_dttm_col.python_date_format = Mock()
        datasource.get_col = Mock(return_value=mock_dttm_col)
        form_data = {'dummy': 123}
        query_obj = {'granularity': 'day'}
        results = Mock()
        results.query = Mock()
        results.status = Mock()
        results.error_message = None
        results.df = Mock()
        results.df.empty = True
        datasource.query = Mock(return_value=results)
        test_viz = viz.BaseViz(datasource, form_data)
        result = test_viz.get_df(query_obj)
        self.assertEqual(type(result), pd.DataFrame)
        self.assertTrue(result.empty)
        self.assertEqual(test_viz.error_message, 'No data.')
        self.assertEqual(test_viz.status, utils.QueryStatus.FAILED)

    def test_get_df_handles_dttm_col(self):
        datasource = Mock()
        datasource.type = 'table'
        datasource.offset = 1
        mock_dttm_col = Mock()
        mock_dttm_col.python_date_format = 'epoch_ms'
        datasource.get_col = Mock(return_value=mock_dttm_col)
        form_data = {'dummy': 123}
        query_obj = {'granularity': 'day'}
        results = Mock()
        results.query = Mock()
        results.status = Mock()
        results.error_message = Mock()
        df = Mock()
        df.columns = [DTTM_ALIAS]
        f_datetime = datetime(1960, 1, 1, 5, 0)
        df.__getitem__ = Mock(return_value=pd.Series([f_datetime]))
        df.__setitem__ = Mock()
        df.replace = Mock()
        df.fillna = Mock()
        results.df = df
        results.df.empty = False
        datasource.query = Mock(return_value=results)
        test_viz = viz.BaseViz(datasource, form_data)
        test_viz.get_fillna_for_columns = Mock(return_value=0)
        result = test_viz.get_df(query_obj)
        mock_call = df.__setitem__.mock_calls[0]
        self.assertEqual(mock_call[1][0], DTTM_ALIAS)
        self.assertFalse(mock_call[1][1].empty)
        self.assertEqual(mock_call[1][1][0], f_datetime)
        mock_call = df.__setitem__.mock_calls[1]
        self.assertEqual(mock_call[1][0], DTTM_ALIAS)
        self.assertEqual(mock_call[1][1][0].hour, 6)
        self.assertEqual(mock_call[1][1].dtype, 'datetime64[ns]')
        mock_dttm_col.python_date_format = 'utc'
        result = test_viz.get_df(query_obj)
        mock_call = df.__setitem__.mock_calls[2]
        self.assertEqual(mock_call[1][0], DTTM_ALIAS)
        self.assertFalse(mock_call[1][1].empty)
        self.assertEqual(mock_call[1][1][0].hour, 6)
        mock_call = df.__setitem__.mock_calls[3]
        self.assertEqual(mock_call[1][0], DTTM_ALIAS)
        self.assertEqual(mock_call[1][1][0].hour, 7)
        self.assertEqual(mock_call[1][1].dtype, 'datetime64[ns]')

    def test_cache_timeout(self):
        datasource = Mock()
        form_data = {'cache_timeout': '10'}
        test_viz = viz.BaseViz(datasource, form_data)
        self.assertEqual(10, test_viz.cache_timeout)
        del form_data['cache_timeout']
        datasource.cache_timeout = 156
        self.assertEqual(156, test_viz.cache_timeout)
        datasource.cache_timeout = None
        datasource.database = Mock()
        datasource.database.cache_timeout= 1666
        self.assertEqual(1666, test_viz.cache_timeout)


class TableVizTestCase(unittest.TestCase):
    def test_get_data_applies_percentage(self):
        form_data = {
            'percent_metrics': ['sum__A', 'avg__B'],
            'metrics': ['sum__A', 'count', 'avg__C'],
        }
        datasource = Mock()
        raw = {}
        raw['sum__A'] = [15, 20, 25, 40]
        raw['avg__B'] = [10, 20, 5, 15]
        raw['avg__C'] = [11, 22, 33, 44]
        raw['count'] = [6, 7, 8, 9]
        raw['groupA'] = ['A', 'B', 'C', 'C']
        raw['groupB'] = ['x', 'x', 'y', 'z']
        df = pd.DataFrame(raw)
        test_viz = viz.TableViz(datasource, form_data)
        data = test_viz.get_data(df)
        # Check method correctly transforms data and computes percents
        self.assertEqual(set([
            'groupA', 'groupB', 'count',
            'sum__A', 'avg__C',
            '%sum__A', '%avg__B',
        ]), set(data['columns']))
        expected = [
            {
                'groupA': 'A', 'groupB': 'x',
                'count': 6, 'sum__A': 15, 'avg__C': 11,
                '%sum__A': 0.15, '%avg__B': 0.2,
            },
            {
                'groupA': 'B', 'groupB': 'x',
                'count': 7, 'sum__A': 20, 'avg__C': 22,
                '%sum__A': 0.2, '%avg__B': 0.4,
            },
            {
                'groupA': 'C', 'groupB': 'y',
                'count': 8, 'sum__A': 25, 'avg__C': 33,
                '%sum__A': 0.25, '%avg__B': 0.1,
            },
            {
                'groupA': 'C', 'groupB': 'z',
                'count': 9, 'sum__A': 40, 'avg__C': 44,
                '%sum__A': 0.40, '%avg__B': 0.3,
            },
        ]
        self.assertEqual(expected, data['records'])

    @patch('superset.viz.BaseViz.query_obj')
    def test_query_obj_merges_percent_metrics(self, super_query_obj):
        datasource = Mock()
        form_data = {
            'percent_metrics': ['sum__A', 'avg__B', 'max__Y'],
            'metrics': ['sum__A', 'count', 'avg__C'],
        }
        test_viz = viz.TableViz(datasource, form_data)
        f_query_obj = {
            'metrics': form_data['metrics']
        }
        super_query_obj.return_value = f_query_obj
        query_obj = test_viz.query_obj()
        self.assertEqual([
            'sum__A', 'count', 'avg__C',
            'avg__B', 'max__Y'
        ], query_obj['metrics'])

    @patch('superset.viz.BaseViz.query_obj')
    def test_query_obj_throws_columns_and_metrics(self, super_query_obj):
        datasource = Mock()
        form_data = {
            'all_columns': ['A', 'B'],
            'metrics': ['x', 'y'],
        }
        super_query_obj.return_value = {}
        test_viz = viz.TableViz(datasource, form_data)
        with self.assertRaises(Exception):
            test_viz.query_obj()
        del form_data['metrics']
        form_data['groupby'] = ['B', 'C']
        test_viz = viz.TableViz(datasource, form_data)
        with self.assertRaises(Exception):
            test_viz.query_obj()

    @patch('superset.viz.BaseViz.query_obj')
    def test_query_obj_merges_all_columns(self, super_query_obj):
        datasource = Mock()
        form_data = {
            'all_columns': ['colA', 'colB', 'colC'],
            'order_by_cols': ['["colA", "colB"]', '["colC"]']
        }
        super_query_obj.return_value = {
            'columns': ['colD', 'colC'],
            'groupby': ['colA', 'colB'],
        }
        test_viz = viz.TableViz(datasource, form_data)
        query_obj = test_viz.query_obj()
        self.assertEqual(form_data['all_columns'], query_obj['columns'])
        self.assertEqual([], query_obj['groupby'])
        self.assertEqual([['colA', 'colB'], ['colC']], query_obj['orderby'])

    @patch('superset.viz.BaseViz.query_obj')
    def test_query_obj_uses_sortby(self, super_query_obj):
        datasource = Mock()
        form_data = {
            'timeseries_limit_metric': '__time__',
            'order_desc': False
        }
        super_query_obj.return_value = {
            'metrics': ['colA', 'colB']
        }
        test_viz = viz.TableViz(datasource, form_data)
        query_obj = test_viz.query_obj()
        self.assertEqual([
            'colA', 'colB', '__time__'
        ], query_obj['metrics'])
        self.assertEqual([(
            '__time__', True
        )], query_obj['orderby'])

    def test_should_be_timeseries_raises_when_no_granularity(self):
        datasource = Mock()
        form_data = {'include_time': True}
        test_viz = viz.TableViz(datasource, form_data)
        with self.assertRaises(Exception):
            test_viz.should_be_timeseries()


class PairedTTestTestCase(unittest.TestCase):
    def test_get_data_transforms_dataframe(self):
        form_data = {
            'groupby': ['groupA', 'groupB', 'groupC'],
            'metrics': ['metric1', 'metric2', 'metric3']
        }
        datasource = {'type': 'table'}
        # Test data
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300, 100, 200, 300, 100, 200, 300]
        raw['groupA'] = ['a1', 'a1', 'a1', 'b1', 'b1', 'b1', 'c1', 'c1', 'c1']
        raw['groupB'] = ['a2', 'a2', 'a2', 'b2', 'b2', 'b2', 'c2', 'c2', 'c2']
        raw['groupC'] = ['a3', 'a3', 'a3', 'b3', 'b3', 'b3', 'c3', 'c3', 'c3']
        raw['metric1'] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        raw['metric2'] = [10, 20, 30, 40, 50, 60, 70, 80, 90]
        raw['metric3'] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
        df = pd.DataFrame(raw)
        pairedTTestViz = viz.viz_types['paired_ttest'](datasource, form_data)
        data = pairedTTestViz.get_data(df)
        # Check method correctly transforms data
        expected = {
            'metric1': [
                {
                    'values': [
                        {'x': 100, 'y': 1},
                        {'x': 200, 'y': 2},
                        {'x': 300, 'y': 3}],
                    'group': ('a1', 'a2', 'a3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 4},
                        {'x': 200, 'y': 5},
                        {'x': 300, 'y': 6}],
                    'group': ('b1', 'b2', 'b3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 7},
                        {'x': 200, 'y': 8},
                        {'x': 300, 'y': 9}],
                    'group': ('c1', 'c2', 'c3'),
                },
            ],
            'metric2': [
                {
                    'values': [
                        {'x': 100, 'y': 10},
                        {'x': 200, 'y': 20},
                        {'x': 300, 'y': 30}],
                    'group': ('a1', 'a2', 'a3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 40},
                        {'x': 200, 'y': 50},
                        {'x': 300, 'y': 60}],
                    'group': ('b1', 'b2', 'b3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 70},
                        {'x': 200, 'y': 80},
                        {'x': 300, 'y': 90}],
                    'group': ('c1', 'c2', 'c3'),
                },
            ],
            'metric3': [
                {
                    'values': [
                        {'x': 100, 'y': 100},
                        {'x': 200, 'y': 200},
                        {'x': 300, 'y': 300}],
                    'group': ('a1', 'a2', 'a3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 400},
                        {'x': 200, 'y': 500},
                        {'x': 300, 'y': 600}],
                    'group': ('b1', 'b2', 'b3'),
                },
                {
                    'values': [
                        {'x': 100, 'y': 700},
                        {'x': 200, 'y': 800},
                        {'x': 300, 'y': 900}],
                    'group': ('c1', 'c2', 'c3'),
                },
            ],
        }
        self.assertEquals(data, expected)

    def test_get_data_empty_null_keys(self):
        form_data = {
            'groupby': [],
            'metrics': ['', None]
        }
        datasource = {'type': 'table'}
        # Test data
        raw = {}
        raw[DTTM_ALIAS] = [100, 200, 300]
        raw[''] = [1, 2, 3]
        raw[None] = [10, 20, 30]

        df = pd.DataFrame(raw)
        pairedTTestViz = viz.viz_types['paired_ttest'](datasource, form_data)
        data = pairedTTestViz.get_data(df)
        # Check method correctly transforms data
        expected = {
            'N/A': [
                {
                    'values': [
                        {'x': 100, 'y': 1},
                        {'x': 200, 'y': 2},
                        {'x': 300, 'y': 3}],
                    'group': 'All',
                },
            ],
            'NULL': [
                {
                    'values': [
                        {'x': 100, 'y': 10},
                        {'x': 200, 'y': 20},
                        {'x': 300, 'y': 30}],
                    'group': 'All',
                },
            ],
        }
        self.assertEquals(data, expected)
