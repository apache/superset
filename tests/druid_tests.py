"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import json
import unittest

from mock import Mock, patch

from caravel import db, sm, utils
from caravel.models import DruidCluster, DruidDatasource

from .base_tests import CaravelTestCase


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
        "fieldName": "metric1"}
  },
  "size": 300000,
  "numRows": 5000000
}]

GB_RESULT_SET = [
  {
    "version": "v1",
    "timestamp": "2012-01-01T00:00:00.000Z",
    "event": {
      "name": 'Canada',
      "sum__num": 12345678,
    }
  },
  {
    "version": "v1",
    "timestamp": "2012-01-01T00:00:00.000Z",
    "event": {
      "name": 'USA',
      "sum__num": 12345678 / 2,
    }
  },
]


class DruidTests(CaravelTestCase):

    """Testing interactions with Druid"""

    def __init__(self, *args, **kwargs):
        super(DruidTests, self).__init__(*args, **kwargs)

    @patch('caravel.models.PyDruid')
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
        cluster.get_datasources = Mock(return_value=['test_datasource'])
        cluster.get_druid_version = Mock(return_value='0.9.1')
        cluster.refresh_datasources()
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

        resp = self.get_resp('/caravel/explore/druid/{}/'.format(
            datasource_id))
        self.assertIn("[test_cluster].[test_datasource]", resp)

        # One groupby
        url = (
            '/caravel/explore_json/druid/{}/?viz_type=table&granularity=one+day&'
            'druid_time_origin=&since=7+days+ago&until=now&row_limit=5000&'
            'include_search=false&metrics=count&groupby=name&flt_col_0=dim1&'
            'flt_op_0=in&flt_eq_0=&slice_id=&slice_name=&collapsed_fieldsets=&'
            'action=&datasource_name=test_datasource&datasource_id={}&'
            'datasource_type=druid&previous_viz_type=table&'
            'force=true'.format(datasource_id, datasource_id))
        resp = self.get_json_resp(url)
        self.assertEqual("Canada", resp['data']['records'][0]['name'])

        # two groupby
        url = (
            '/caravel/explore_json/druid/{}/?viz_type=table&granularity=one+day&'
            'druid_time_origin=&since=7+days+ago&until=now&row_limit=5000&'
            'include_search=false&metrics=count&groupby=name&'
            'flt_col_0=dim1&groupby=second&'
            'flt_op_0=in&flt_eq_0=&slice_id=&slice_name=&collapsed_fieldsets=&'
            'action=&datasource_name=test_datasource&datasource_id={}&'
            'datasource_type=druid&previous_viz_type=table&'
            'force=true'.format(datasource_id, datasource_id))
        resp = self.get_json_resp(url)
        self.assertEqual("Canada", resp['data']['records'][0]['name'])

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
            resp = self.client.post('/caravel/sync_druid/', data=json.dumps(cfg))
            druid_ds = db.session.query(DruidDatasource).filter_by(
                datasource_name="test_click").first()
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
        resp = self.client.post('/caravel/sync_druid/', data=json.dumps(cfg))
        druid_ds = db.session.query(DruidDatasource).filter_by(
            datasource_name="test_click").first()
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

        utils.merge_perm(sm, 'datasource_access', gamma_ds.perm)
        utils.merge_perm(sm, 'datasource_access', no_gamma_ds.perm)

        db.session.commit()

        perm = sm.find_permission_view_menu('datasource_access', gamma_ds.perm)
        sm.add_permission_role(sm.find_role('Gamma'), perm)
        db.session.commit()

        self.login(username='gamma')
        url = '/druiddatasourcemodelview/list/'
        resp = self.get_resp(url)
        assert 'datasource_for_gamma' in resp
        assert 'datasource_not_for_gamma' not in resp


if __name__ == '__main__':
    unittest.main()
