"""Unit tests for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import json
import unittest

from mock import Mock, patch

from superset import db, security, sm
from superset.connectors.druid.models import (
    DruidCluster, DruidDatasource, DruidMetric, Postaggregator, PyDruid,
    Quantile,
)
from .base_tests import SupersetTestCase

class PickableMock(Mock):
    def __reduce__(self):
        return (Mock, ())

SEGMENT_METADATA = [{
  "id": "some_id",
  "intervals": ["2013-05-13T00:00:00.000Z/2013-05-14T00:00:00.000Z"],
  "columns": {
    "__time": {
        "type": "LONG", "hasMultipleValues": False,
        "size": 407240380, "cardinality": None, "errorMessage": None},
    "dim1": {
        "type": "STRING", "hasMultipleValues": False,
        "size": 100000, "cardinality": 1944, "errorMessage": None},
    "dim2": {
        "type": "STRING", "hasMultipleValues": True,
        "size": 100000, "cardinality": 1504, "errorMessage": None},
    "metric1": {
        "type": "FLOAT", "hasMultipleValues": False,
        "size": 100000, "cardinality": None, "errorMessage": None}
  },
  "aggregators": {
    "metric1": {
        "type": "longSum",
        "name": "metric1",
        "fieldName": "metric1"},
  },
  "size": 300000,
  "numRows": 5000000
}]

GB_RESULT_SET = [
  {
    "version": "v1",
    "timestamp": "2012-01-01T00:00:00.000Z",
    "event": {
      "dim1": 'Canada',
      "metric1": 12345678,
    }
  },
  {
    "version": "v1",
    "timestamp": "2012-01-01T00:00:00.000Z",
    "event": {
      "dim1": 'USA',
      "metric1": 12345678 / 2,
    }
  },
]


class DruidTests(SupersetTestCase):

    """Testing interactions with Druid"""

    def __init__(self, *args, **kwargs):
        super(DruidTests, self).__init__(*args, **kwargs)

    @patch('superset.connectors.druid.models.PyDruid')  # noqa ignore: F811
    def test_client(self, PyDruid):
        self.login(username='admin')
        instance = PyDruid.return_value
        instance.time_boundary.return_value = [
            {'result': {'maxTime': '2016-01-01'}}]
        instance.segment_metadata.return_value = SEGMENT_METADATA

        cluster = (
            db.session
            .query(DruidCluster)
            .filter_by(cluster_name='test_cluster')
            .first()
        )
        if cluster:
            db.session.delete(cluster)
        db.session.commit()

        cluster = DruidCluster(
            cluster_name='test_cluster',
            coordinator_host='localhost',
            coordinator_port=7979,
            broker_host='localhost',
            broker_port=7980,
            metadata_last_refreshed=datetime.now())

        db.session.add(cluster)
        cluster.get_datasources = PickableMock(return_value=['test_datasource'])
        cluster.get_druid_version = PickableMock(return_value='0.9.1')
        cluster.refresh_datasources()
        cluster.refresh_datasources(merge_flag=True)
        datasource_id = cluster.datasources[0].id
        db.session.commit()

        nres = [
            list(v['event'].items()) + [('timestamp', v['timestamp'])]
            for v in GB_RESULT_SET]
        nres = [dict(v) for v in nres]
        import pandas as pd
        df = pd.DataFrame(nres)
        instance.export_pandas.return_value = df
        instance.query_dict = {}
        instance.query_builder.last_query.query_dict = {}

        resp = self.get_resp('/superset/explore/druid/{}/'.format(
            datasource_id))
        self.assertIn("test_datasource", resp)
        form_data = {
            'viz_type': 'table',
            'granularity': 'one+day',
            'druid_time_origin': '',
            'since': '7+days+ago',
            'until': 'now',
            'row_limit': 5000,
            'include_search': 'false',
            'metrics': ['count'],
            'groupby': ['dim1'],
            'force': 'true',
        }
        # One groupby
        url = (
            '/superset/explore_json/druid/{}/?form_data={}'.format(
                datasource_id, json.dumps(form_data))
        )
        resp = self.get_json_resp(url)
        self.assertEqual("Canada", resp['data']['records'][0]['dim1'])

        form_data = {
            'viz_type': 'table',
            'granularity': 'one+day',
            'druid_time_origin': '',
            'since': '7+days+ago',
            'until': 'now',
            'row_limit': 5000,
            'include_search': 'false',
            'metrics': ['count'],
            'groupby': ['dim1', 'dim2d'],
            'force': 'true',
        }
        # two groupby
        url = (
            '/superset/explore_json/druid/{}/?form_data={}'.format(
                datasource_id, json.dumps(form_data))
        )
        resp = self.get_json_resp(url)
        self.assertEqual("Canada", resp['data']['records'][0]['dim1'])

    def test_druid_sync_from_config(self):
        CLUSTER_NAME = 'new_druid'
        self.login()
        cluster = self.get_or_create(
            DruidCluster,
            {'cluster_name': CLUSTER_NAME},
            db.session)

        db.session.merge(cluster)
        db.session.commit()

        ds = (
            db.session.query(DruidDatasource)
            .filter_by(datasource_name='test_click')
            .first()
        )
        if ds:
            db.session.delete(ds)
        db.session.commit()

        cfg = {
            "user": "admin",
            "cluster": CLUSTER_NAME,
            "config": {
                "name": "test_click",
                "dimensions": ["affiliate_id", "campaign", "first_seen"],
                "metrics_spec": [{"type": "count", "name": "count"},
                                 {"type": "sum", "name": "sum"}],
                "batch_ingestion": {
                    "sql": "SELECT * FROM clicks WHERE d='{{ ds }}'",
                    "ts_column": "d",
                    "sources": [{
                        "table": "clicks",
                        "partition": "d='{{ ds }}'"
                    }]
                }
            }
        }
        def check():
            resp = self.client.post('/superset/sync_druid/', data=json.dumps(cfg))
            druid_ds = (
                db.session
                .query(DruidDatasource)
                .filter_by(datasource_name="test_click")
                .one()
            )
            col_names = set([c.column_name for c in druid_ds.columns])
            assert {"affiliate_id", "campaign", "first_seen"} == col_names
            metric_names = {m.metric_name for m in druid_ds.metrics}
            assert {"count", "sum"} == metric_names
            assert resp.status_code == 201

        check()
        # checking twice to make sure a second sync yields the same results
        check()

        # datasource exists, add new metrics and dimensions
        cfg = {
            "user": "admin",
            "cluster": CLUSTER_NAME,
            "config": {
                "name": "test_click",
                "dimensions": ["affiliate_id", "second_seen"],
                "metrics_spec": [
                    {"type": "bla", "name": "sum"},
                    {"type": "unique", "name": "unique"}
                ],
            }
        }
        resp = self.client.post('/superset/sync_druid/', data=json.dumps(cfg))
        druid_ds = db.session.query(DruidDatasource).filter_by(
            datasource_name="test_click").one()
        # columns and metrics are not deleted if config is changed as
        # user could define his own dimensions / metrics and want to keep them
        assert set([c.column_name for c in druid_ds.columns]) == set(
            ["affiliate_id", "campaign", "first_seen", "second_seen"])
        assert set([m.metric_name for m in druid_ds.metrics]) == set(
            ["count", "sum", "unique"])
        # metric type will not be overridden, sum stays instead of bla
        assert set([m.metric_type for m in druid_ds.metrics]) == set(
            ["longSum", "sum", "unique"])
        assert resp.status_code == 201

    def test_filter_druid_datasource(self):
        CLUSTER_NAME = 'new_druid'
        cluster = self.get_or_create(
            DruidCluster,
            {'cluster_name': CLUSTER_NAME},
            db.session)
        db.session.merge(cluster)

        gamma_ds = self.get_or_create(
            DruidDatasource, {'datasource_name': 'datasource_for_gamma'},
            db.session)
        gamma_ds.cluster = cluster
        db.session.merge(gamma_ds)

        no_gamma_ds = self.get_or_create(
            DruidDatasource, {'datasource_name': 'datasource_not_for_gamma'},
            db.session)
        no_gamma_ds.cluster = cluster
        db.session.merge(no_gamma_ds)
        db.session.commit()

        security.merge_perm(sm, 'datasource_access', gamma_ds.perm)
        security.merge_perm(sm, 'datasource_access', no_gamma_ds.perm)

        perm = sm.find_permission_view_menu(
            'datasource_access', gamma_ds.get_perm())
        sm.add_permission_role(sm.find_role('Gamma'), perm)
        sm.get_session.commit()

        self.login(username='gamma')
        url = '/druiddatasourcemodelview/list/'
        resp = self.get_resp(url)
        self.assertIn('datasource_for_gamma', resp)
        self.assertNotIn('datasource_not_for_gamma', resp)

    @patch('superset.connectors.druid.models.PyDruid')  # noqa ignore: F811
    def test_sync_druid_perm(self, PyDruid):
        self.login(username='admin')
        instance = PyDruid.return_value
        instance.time_boundary.return_value = [
            {'result': {'maxTime': '2016-01-01'}}]
        instance.segment_metadata.return_value = SEGMENT_METADATA

        cluster = (
            db.session
            .query(DruidCluster)
            .filter_by(cluster_name='test_cluster')
            .first()
        )
        if cluster:
            db.session.delete(cluster)
        db.session.commit()

        cluster = DruidCluster(
            cluster_name='test_cluster',
            coordinator_host='localhost',
            coordinator_port=7979,
            broker_host='localhost',
            broker_port=7980,
            metadata_last_refreshed=datetime.now())

        db.session.add(cluster)
        cluster.get_datasources = PickableMock(
            return_value=['test_datasource']
        )
        cluster.get_druid_version = PickableMock(return_value='0.9.1')

        cluster.refresh_datasources()
        cluster.datasources[0].merge_flag = True
        metadata = cluster.datasources[0].latest_metadata()
        self.assertEqual(len(metadata), 4)
        db.session.commit()

        view_menu_name = cluster.datasources[0].get_perm()
        view_menu = sm.find_view_menu(view_menu_name)
        permission = sm.find_permission("datasource_access")

        pv = sm.get_session.query(sm.permissionview_model).filter_by(
            permission=permission, view_menu=view_menu).first()
        assert pv is not None

    def test_metrics_and_post_aggs(self):
        """
        Test generation of metrics and post-aggregations from an initial list
        of superset metrics (which may include the results of either). This
        primarily tests that specifying a post-aggregator metric will also
        require the raw aggregation of the associated druid metric column.
        """
        metrics_dict = {
            'unused_count': DruidMetric(
                metric_name='unused_count',
                verbose_name='COUNT(*)',
                metric_type='count',
                json=json.dumps({'type': 'count', 'name': 'unused_count'})),
            'some_sum': DruidMetric(
                metric_name='some_sum',
                verbose_name='SUM(*)',
                metric_type='sum',
                json=json.dumps({'type': 'sum', 'name': 'sum'})),
            'a_histogram': DruidMetric(
                metric_name='a_histogram',
                verbose_name='APPROXIMATE_HISTOGRAM(*)',
                metric_type='approxHistogramFold',
                json=json.dumps(
                    {'type': 'approxHistogramFold', 'name': 'a_histogram'})
                ),
            'aCustomMetric': DruidMetric(
                metric_name='aCustomMetric',
                verbose_name='MY_AWESOME_METRIC(*)',
                metric_type='aCustomType',
                json=json.dumps(
                    {'type': 'customMetric', 'name': 'aCustomMetric'})
                ),
            'quantile_p95': DruidMetric(
                metric_name='quantile_p95',
                verbose_name='P95(*)',
                metric_type='postagg',
                json=json.dumps({
                    'type': 'quantile',
                    'probability': 0.95,
                    'name': 'p95',
                    'fieldName': 'a_histogram'})),
            'aCustomPostAgg': DruidMetric(
                metric_name='aCustomPostAgg',
                verbose_name='CUSTOM_POST_AGG(*)',
                metric_type='postagg',
                json=json.dumps({
                    'type': 'customPostAgg',
                    'name': 'aCustomPostAgg',
                    'field': {
                        'type': 'fieldAccess',
                        'fieldName': 'aCustomMetric'}})),
        }

        metrics = ['some_sum']
        all_metrics, post_aggs = DruidDatasource._metrics_and_post_aggs(
            metrics, metrics_dict)

        assert all_metrics == ['some_sum']
        assert post_aggs == {}

        metrics = ['quantile_p95']
        all_metrics, post_aggs = DruidDatasource._metrics_and_post_aggs(
            metrics, metrics_dict)

        result_postaggs = set(['quantile_p95'])
        assert all_metrics == ['a_histogram']
        assert set(post_aggs.keys()) == result_postaggs

        metrics = ['aCustomPostAgg']
        all_metrics, post_aggs = DruidDatasource._metrics_and_post_aggs(
            metrics, metrics_dict)

        result_postaggs = set(['aCustomPostAgg'])
        assert all_metrics == ['aCustomMetric']
        assert set(post_aggs.keys()) == result_postaggs

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
            len(res.filter['filter']['field'].filter['filter']['fields'])
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
            res.filter['filter']['field'].filter['filter']['value']
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
        filtr = {'col': 'A', 'op': 'in', 'val': ["  'a' "]}
        res = DruidDatasource.get_filters([filtr], [])
        self.assertEqual('a', res.filter['filter']['value'])

    def test_get_filters_converts_strings_to_num(self):
        filtr = {'col': 'A', 'op': 'in', 'val': ['6']}
        res = DruidDatasource.get_filters([filtr], ['A'])
        self.assertEqual(6, res.filter['filter']['value'])
        filtr = {'col': 'A', 'op': '==', 'val': '6'}
        res = DruidDatasource.get_filters([filtr], ['A'])
        self.assertEqual(6, res.filter['filter']['value'])


if __name__ == '__main__':
    unittest.main()
