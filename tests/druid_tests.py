"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import unittest

from mock import Mock, patch

from caravel import db
from caravel.models import DruidCluster

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

        resp = self.client.get('/caravel/explore/druid/{}/'.format(
            datasource_id))
        assert "[test_cluster].[test_datasource]" in resp.data.decode('utf-8')

        nres = [
            list(v['event'].items()) + [('timestamp', v['timestamp'])]
            for v in GB_RESULT_SET]
        nres = [dict(v) for v in nres]
        import pandas as pd
        df = pd.DataFrame(nres)
        instance.export_pandas.return_value = df
        instance.query_dict = {}
        instance.query_builder.last_query.query_dict = {}
        resp = self.client.get(
            '/caravel/explore/druid/{}/?viz_type=table&granularity=one+day&'
            'druid_time_origin=&since=7+days+ago&until=now&row_limit=5000&'
            'include_search=false&metrics=count&groupby=name&flt_col_0=dim1&'
            'flt_op_0=in&flt_eq_0=&slice_id=&slice_name=&collapsed_fieldsets=&'
            'action=&datasource_name=test_datasource&datasource_id={}&'
            'datasource_type=druid&previous_viz_type=table&json=true&'
            'force=true'.format(datasource_id, datasource_id))
        assert "Canada" in resp.data.decode('utf-8')

if __name__ == '__main__':
    unittest.main()
