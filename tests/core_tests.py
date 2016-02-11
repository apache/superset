"""Unit tests for Caravel"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import doctest
import imp
import os
import unittest
from mock import Mock, patch

from flask import escape

import caravel
from caravel import app, db, models, utils, appbuilder

#os.environ['CARAVEL_CONFIG'] = 'tests.caravel_test_config'

app.config['TESTING'] = True
app.config['CSRF_ENABLED'] = False
app.config['SECRET_KEY'] = 'thisismyscretkey'
app.config['WTF_CSRF_ENABLED'] = False
BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/caravel")


class CoreTests(unittest.TestCase):

    def __init__(self, *args, **kwargs):
        super(CoreTests, self).__init__(*args, **kwargs)
        self.client = app.test_client()
        role_admin = appbuilder.sm.find_role('Admin')
        user = appbuilder.sm.find_user('admin')
        if not user:
            appbuilder.sm.add_user(
                'admin', 'admin',' user', 'admin@fab.org',
                role_admin, 'general')
        utils.init(caravel)
        self.load_examples()

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def login(self):
        self.client.post(
            '/login/',
            data=dict(username='admin', password='general'),
            follow_redirects=True)

    def load_examples(self):
        cli.load_examples(sample=True)

    def test_slices(self):
        # Testing by running all the examples
        self.login()
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                slc.slice_url,
                slc.viz.json_endpoint,
            ]
        for url in urls:
            self.client.get(url)

    def test_csv(self):
        self.client.get('/caravel/explore/table/1/?viz_type=table&granularity=ds&since=100+years&until=now&metrics=count&groupby=name&limit=50&show_brush=y&show_brush=false&show_legend=y&show_brush=false&rich_tooltip=y&show_brush=false&show_brush=false&show_brush=false&show_brush=false&y_axis_format=&x_axis_showminmax=y&show_brush=false&line_interpolation=linear&rolling_type=None&rolling_periods=&time_compare=&num_period_compare=&where=&having=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&slice_id=14&slice_name=Boys&collapsed_fieldsets=&action=&datasource_name=birth_names&datasource_id=1&datasource_type=table&previous_viz_type=line&csv=true')

    def test_bubble_chart_no_time(self):
        self.login()
        response = self.client.get('/caravel/explore/table/1/?viz_type=bubble&series=source&entity=source&x=count&y=count&size=count&limit=50&x_log_scale=false&y_log_scale=false&show_legend=y&show_legend=false&max_bubble_size=25&where=&having=&flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=&slice_name=&collapsed_fieldsets=&action=&datasource_name=energy_usage&datasource_id=1&datasource_type=table&previous_viz_type=bubble&json=true&force=false')
        self.assertEqual(response.status_code, 200)

    def test_dashboard(self):
        self.login()
        urls = {}
        for dash in db.session.query(models.Dashboard).all():
            urls[dash.dashboard_title] = dash.url
        for title, url in urls.items():
            print(url)
            assert escape(title) in self.client.get(url).data.decode('utf-8')

    def test_doctests(self):
        modules = [utils]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def test_misc(self):
        assert self.client.get('/health').data.decode('utf-8') == "OK"
        assert self.client.get('/ping').data.decode('utf-8') == "OK"


SEGMENT_METADATA = [{
  "id" : "some_id",
  "intervals" : [ "2013-05-13T00:00:00.000Z/2013-05-14T00:00:00.000Z" ],
  "columns" : {
    "__time" : {
        "type" : "LONG", "hasMultipleValues" : False,
        "size" : 407240380, "cardinality" : None, "errorMessage" : None },
    "dim1" : {
        "type" : "STRING", "hasMultipleValues" : False,
        "size" : 100000, "cardinality" : 1944, "errorMessage" : None },
    "dim2" : {
        "type" : "STRING", "hasMultipleValues" : True,
        "size" : 100000, "cardinality" : 1504, "errorMessage" : None },
    "metric1" : {
        "type" : "FLOAT", "hasMultipleValues" : False,
        "size" : 100000, "cardinality" : None, "errorMessage" : None }
  },
  "aggregators" : {
    "metric1" : {
        "type" : "longSum",
        "name" : "metric1",
        "fieldName" : "metric1" }
  },
  "size" : 300000,
  "numRows" : 5000000
}]


class DruidTests(unittest.TestCase):

    """Testing interactions with Druid"""

    @patch('caravel.models.PyDruid')
    def test_client(self, PyDruid):
        from caravel.models import DruidCluster
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
        cluster.refresh_datasources()
        db.session.commit()


if __name__ == '__main__':
    unittest.main()
