import json
import unittest

from mock import Mock

from superset.connectors.druid.models import (
    DruidColumn, DruidDatasource, DruidMetric,
)


class DruidFuncTestCase(unittest.TestCase):

    def test_get_filters_ignores_invalid_filter_objects(self):
        filtr = {'col': 'col1', 'op': '=='}
        filters = [filtr]
        self.assertEqual(None, DruidDatasource.get_filters(filters, []))

    def test_get_filters_constructs_filter_in(self):
        filtr = {'col': 'A', 'op': 'in', 'val': ['a', 'b', 'c']}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertIn('filter', res.filter)
        self.assertIn('fields', res.filter['filter'])
        self.assertEqual('or', res.filter['filter']['type'])
        self.assertEqual(3, len(res.filter['filter']['fields']))

    def test_get_filters_constructs_filter_not_in(self):
        filtr = {'col': 'A', 'op': 'not in', 'val': ['a', 'b', 'c']}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertIn('filter', res.filter)
        self.assertIn('type', res.filter['filter'])
        self.assertEqual('not', res.filter['filter']['type'])
        self.assertIn('field', res.filter['filter'])
        self.assertEqual(
            3,
            len(res.filter['filter']['field'].filter['filter']['fields']),
        )

    def test_get_filters_constructs_filter_equals(self):
        filtr = {'col': 'A', 'op': '==', 'val': 'h'}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('selector', res.filter['filter']['type'])
        self.assertEqual('A', res.filter['filter']['dimension'])
        self.assertEqual('h', res.filter['filter']['value'])

    def test_get_filters_constructs_filter_not_equals(self):
        filtr = {'col': 'A', 'op': '!=', 'val': 'h'}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('not', res.filter['filter']['type'])
        self.assertEqual(
            'h',
            res.filter['filter']['field'].filter['filter']['value'],
        )

    def test_get_filters_constructs_bounds_filter(self):
        filtr = {'col': 'A', 'op': '>=', 'val': 'h'}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertFalse(res.filter['filter']['lowerStrict'])
        self.assertEqual('A', res.filter['filter']['dimension'])
        self.assertEqual('h', res.filter['filter']['lower'])
        self.assertFalse(res.filter['filter']['alphaNumeric'])
        filtr['op'] = '>'
        res = DruidDatasource.get_filters([filtr], [])
        self.assertTrue(res.filter['filter']['lowerStrict'])
        filtr['op'] = '<='
        res = DruidDatasource.get_filters([filtr], [])
        self.assertFalse(res.filter['filter']['upperStrict'])
        self.assertEqual('h', res.filter['filter']['upper'])
        filtr['op'] = '<'
        res = DruidDatasource.get_filters([filtr], [])
        self.assertTrue(res.filter['filter']['upperStrict'])

    def test_get_filters_constructs_regex_filter(self):
        filtr = {'col': 'A', 'op': 'regex', 'val': '[abc]'}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('regex', res.filter['filter']['type'])
        self.assertEqual('[abc]', res.filter['filter']['pattern'])
        self.assertEqual('A', res.filter['filter']['dimension'])

    def test_get_filters_composes_multiple_filters(self):
        filtr1 = {'col': 'A', 'op': '!=', 'val': 'y'}
        filtr2 = {'col': 'B', 'op': 'in', 'val': ['a', 'b', 'c']}
        res = DruidDatasource.get_filters([filtr1, filtr2], [])
        self.assertEqual('and', res.filter['filter']['type'])
        self.assertEqual(2, len(res.filter['filter']['fields']))

    def test_get_filters_ignores_in_not_in_with_empty_value(self):
        filtr1 = {'col': 'A', 'op': 'in', 'val': []}
        filtr2 = {'col': 'A', 'op': 'not in', 'val': []}
        res = DruidDatasource.get_filters([filtr1, filtr2], [])
        self.assertEqual(None, res)

    def test_get_filters_constructs_equals_for_in_not_in_single_value(self):
        filtr = {'col': 'A', 'op': 'in', 'val': ['a']}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('selector', res.filter['filter']['type'])

    def test_get_filters_handles_arrays_for_string_types(self):
        filtr = {'col': 'A', 'op': '==', 'val': ['a', 'b']}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('a', res.filter['filter']['value'])
        filtr = {'col': 'A', 'op': '==', 'val': []}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('', res.filter['filter']['value'])

    def test_get_filters_handles_none_for_string_types(self):
        filtr = {'col': 'A', 'op': '==', 'val': None}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('', res.filter['filter']['value'])

    def test_get_filters_extracts_values_in_quotes(self):
        filtr = {'col': 'A', 'op': 'in', 'val': ['  "a" ']}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('a', res.filter['filter']['value'])

    def test_get_filters_converts_strings_to_num(self):
        filtr = {'col': 'A', 'op': 'in', 'val': ['6']}
        res = DruidDatasource.get_filters([filtr], ['A'])
        self.assertEqual(6, res.filter['filter']['value'])
        filtr = {'col': 'A', 'op': '==', 'val': '6'}
        res = DruidDatasource.get_filters([filtr], ['A'])
        self.assertEqual(6, res.filter['filter']['value'])

    def test_run_query_no_groupby(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value='from')
        to_dttm.isoformat = Mock(return_value='to')
        timezone = 'timezone'
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name='datasource')
        metric1 = DruidMetric(metric_name='metric1')
        metric2 = DruidMetric(metric_name='metric2')
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name='col1')
        col2 = DruidColumn(column_name='col2')
        ds.columns = [col1, col2]
        all_metrics = []
        post_aggs = ['some_agg']
        ds._metrics_and_post_aggs = Mock(return_value=(all_metrics, post_aggs))
        groupby = []
        metrics = ['metric1']
        ds.get_having_filters = Mock(return_value=[])
        client.query_builder = Mock()
        client.query_builder.last_query = Mock()
        client.query_builder.last_query.query_dict = {'mock': 0}
        # no groupby calls client.timeseries
        ds.run_query(
            groupby, metrics, None, from_dttm,
            to_dttm, client=client, filter=[], row_limit=100,
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(0, len(client.groupby.call_args_list))
        self.assertEqual(1, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args = client.timeseries.call_args_list[0][1]
        self.assertNotIn('dimensions', called_args)
        self.assertIn('post_aggregations', called_args)
        # restore functions

    def test_run_query_single_groupby(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value='from')
        to_dttm.isoformat = Mock(return_value='to')
        timezone = 'timezone'
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name='datasource')
        metric1 = DruidMetric(metric_name='metric1')
        metric2 = DruidMetric(metric_name='metric2')
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name='col1')
        col2 = DruidColumn(column_name='col2')
        ds.columns = [col1, col2]
        all_metrics = ['metric1']
        post_aggs = ['some_agg']
        ds._metrics_and_post_aggs = Mock(return_value=(all_metrics, post_aggs))
        groupby = ['col1']
        metrics = ['metric1']
        ds.get_having_filters = Mock(return_value=[])
        client.query_builder.last_query.query_dict = {'mock': 0}
        # client.topn is called twice
        ds.run_query(
            groupby, metrics, None, from_dttm, to_dttm, row_limit=100,
            client=client, order_desc=True, filter=[],
        )
        self.assertEqual(2, len(client.topn.call_args_list))
        self.assertEqual(0, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args_pre = client.topn.call_args_list[0][1]
        self.assertNotIn('dimensions', called_args_pre)
        self.assertIn('dimension', called_args_pre)
        called_args = client.topn.call_args_list[1][1]
        self.assertIn('dimension', called_args)
        self.assertEqual('col1', called_args['dimension'])
        # not order_desc
        client = Mock()
        client.query_builder.last_query.query_dict = {'mock': 0}
        ds.run_query(
            groupby, metrics, None, from_dttm, to_dttm, client=client,
            order_desc=False, filter=[], row_limit=100,
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(1, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        self.assertIn('dimensions', client.groupby.call_args_list[0][1])
        self.assertEqual(['col1'], client.groupby.call_args_list[0][1]['dimensions'])
        # order_desc but timeseries and dimension spec
        spec = {'spec': 1}
        spec_json = json.dumps(spec)
        col3 = DruidColumn(column_name='col3', dimension_spec_json=spec_json)
        ds.columns.append(col3)
        groupby = ['col3']
        client = Mock()
        client.query_builder.last_query.query_dict = {'mock': 0}
        ds.run_query(
            groupby, metrics, None, from_dttm, to_dttm,
            client=client, order_desc=True, timeseries_limit=5,
            filter=[], row_limit=100,
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(2, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        self.assertIn('dimensions', client.groupby.call_args_list[0][1])
        self.assertIn('dimensions', client.groupby.call_args_list[1][1])
        self.assertEqual([spec], client.groupby.call_args_list[0][1]['dimensions'])
        self.assertEqual([spec], client.groupby.call_args_list[1][1]['dimensions'])

    def test_run_query_multiple_groupby(self):
        client = Mock()
        from_dttm = Mock()
        to_dttm = Mock()
        from_dttm.replace = Mock(return_value=from_dttm)
        to_dttm.replace = Mock(return_value=to_dttm)
        from_dttm.isoformat = Mock(return_value='from')
        to_dttm.isoformat = Mock(return_value='to')
        timezone = 'timezone'
        from_dttm.tzname = Mock(return_value=timezone)
        ds = DruidDatasource(datasource_name='datasource')
        metric1 = DruidMetric(metric_name='metric1')
        metric2 = DruidMetric(metric_name='metric2')
        ds.metrics = [metric1, metric2]
        col1 = DruidColumn(column_name='col1')
        col2 = DruidColumn(column_name='col2')
        ds.columns = [col1, col2]
        all_metrics = []
        post_aggs = ['some_agg']
        ds._metrics_and_post_aggs = Mock(return_value=(all_metrics, post_aggs))
        groupby = ['col1', 'col2']
        metrics = ['metric1']
        ds.get_having_filters = Mock(return_value=[])
        client.query_builder = Mock()
        client.query_builder.last_query = Mock()
        client.query_builder.last_query.query_dict = {'mock': 0}
        # no groupby calls client.timeseries
        ds.run_query(
            groupby, metrics, None, from_dttm,
            to_dttm, client=client, row_limit=100,
            filter=[],
        )
        self.assertEqual(0, len(client.topn.call_args_list))
        self.assertEqual(1, len(client.groupby.call_args_list))
        self.assertEqual(0, len(client.timeseries.call_args_list))
        # check that there is no dimensions entry
        called_args = client.groupby.call_args_list[0][1]
        self.assertIn('dimensions', called_args)
        self.assertEqual(['col1', 'col2'], called_args['dimensions'])
