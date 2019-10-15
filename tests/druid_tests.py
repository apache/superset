# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Unit tests for Superset"""
from datetime import datetime
import json
import unittest
from unittest.mock import Mock, patch

from superset import db, security_manager

try:
    from superset.connectors.druid.models import (
        DruidCluster,
        DruidColumn,
        DruidDatasource,
        DruidMetric,
    )
except ImportError:
    pass
from .base_tests import SupersetTestCase


class PickableMock(Mock):
    def __reduce__(self):
        return (Mock, ())


SEGMENT_METADATA = [
    {
        "id": "some_id",
        "intervals": ["2013-05-13T00:00:00.000Z/2013-05-14T00:00:00.000Z"],
        "columns": {
            "__time": {
                "type": "LONG",
                "hasMultipleValues": False,
                "size": 407240380,
                "cardinality": None,
                "errorMessage": None,
            },
            "dim1": {
                "type": "STRING",
                "hasMultipleValues": False,
                "size": 100000,
                "cardinality": 1944,
                "errorMessage": None,
            },
            "dim2": {
                "type": "STRING",
                "hasMultipleValues": True,
                "size": 100000,
                "cardinality": 1504,
                "errorMessage": None,
            },
            "metric1": {
                "type": "FLOAT",
                "hasMultipleValues": False,
                "size": 100000,
                "cardinality": None,
                "errorMessage": None,
            },
        },
        "aggregators": {
            "metric1": {"type": "longSum", "name": "metric1", "fieldName": "metric1"}
        },
        "size": 300000,
        "numRows": 5000000,
    }
]

GB_RESULT_SET = [
    {
        "version": "v1",
        "timestamp": "2012-01-01T00:00:00.000Z",
        "event": {"dim1": "Canada", "dim2": "boy", "metric1": 12345678},
    },
    {
        "version": "v1",
        "timestamp": "2012-01-01T00:00:00.000Z",
        "event": {"dim1": "USA", "dim2": "girl", "metric1": 12345678 / 2},
    },
]

DruidCluster.get_druid_version = lambda _: "0.9.1"


class DruidTests(SupersetTestCase):

    """Testing interactions with Druid"""

    @classmethod
    def setUpClass(cls):
        cls.create_druid_test_objects()

    def get_test_cluster_obj(self):
        return DruidCluster(
            cluster_name="test_cluster",
            broker_host="localhost",
            broker_port=7980,
            broker_endpoint="druid/v2",
            metadata_last_refreshed=datetime.now(),
        )

    def get_cluster(self, PyDruid):
        instance = PyDruid.return_value
        instance.time_boundary.return_value = [{"result": {"maxTime": "2016-01-01"}}]
        instance.segment_metadata.return_value = SEGMENT_METADATA

        cluster = (
            db.session.query(DruidCluster)
            .filter_by(cluster_name="test_cluster")
            .first()
        )
        if cluster:
            for datasource in (
                db.session.query(DruidDatasource)
                .filter_by(cluster_name=cluster.cluster_name)
                .all()
            ):
                db.session.delete(datasource)

            db.session.delete(cluster)
        db.session.commit()

        cluster = self.get_test_cluster_obj()

        db.session.add(cluster)
        cluster.get_datasources = PickableMock(return_value=["test_datasource"])

        return cluster

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_client(self, PyDruid):
        self.login(username="admin")
        cluster = self.get_cluster(PyDruid)
        cluster.refresh_datasources()
        cluster.refresh_datasources(merge_flag=True)
        datasource_id = cluster.datasources[0].id
        db.session.commit()

        nres = [
            list(v["event"].items()) + [("timestamp", v["timestamp"])]
            for v in GB_RESULT_SET
        ]
        nres = [dict(v) for v in nres]
        import pandas as pd

        df = pd.DataFrame(nres)
        instance = PyDruid.return_value
        instance.export_pandas.return_value = df
        instance.query_dict = {}
        instance.query_builder.last_query.query_dict = {}

        resp = self.get_resp("/superset/explore/druid/{}/".format(datasource_id))
        self.assertIn("test_datasource", resp)
        form_data = {
            "viz_type": "table",
            "granularity": "one+day",
            "druid_time_origin": "",
            "since": "7+days+ago",
            "until": "now",
            "row_limit": 5000,
            "include_search": "false",
            "metrics": ["count"],
            "groupby": ["dim1"],
            "force": "true",
        }
        # One groupby
        url = "/superset/explore_json/druid/{}/".format(datasource_id)
        resp = self.get_json_resp(url, {"form_data": json.dumps(form_data)})
        self.assertEqual("Canada", resp["data"]["records"][0]["dim1"])

        form_data = {
            "viz_type": "table",
            "granularity": "one+day",
            "druid_time_origin": "",
            "since": "7+days+ago",
            "until": "now",
            "row_limit": 5000,
            "include_search": "false",
            "metrics": ["count"],
            "groupby": ["dim1", "dim2"],
            "force": "true",
        }
        # two groupby
        url = "/superset/explore_json/druid/{}/".format(datasource_id)
        resp = self.get_json_resp(url, {"form_data": json.dumps(form_data)})
        self.assertEqual("Canada", resp["data"]["records"][0]["dim1"])

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_druid_sync_from_config(self):
        CLUSTER_NAME = "new_druid"
        self.login()
        cluster = self.get_or_create(
            DruidCluster, {"cluster_name": CLUSTER_NAME}, db.session
        )

        db.session.merge(cluster)
        db.session.commit()

        ds = (
            db.session.query(DruidDatasource)
            .filter_by(datasource_name="test_click")
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
                "metrics_spec": [
                    {"type": "count", "name": "count"},
                    {"type": "sum", "name": "sum"},
                ],
                "batch_ingestion": {
                    "sql": "SELECT * FROM clicks WHERE d='{{ ds }}'",
                    "ts_column": "d",
                    "sources": [{"table": "clicks", "partition": "d='{{ ds }}'"}],
                },
            },
        }

        def check():
            resp = self.client.post("/superset/sync_druid/", data=json.dumps(cfg))
            druid_ds = (
                db.session.query(DruidDatasource)
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
                    {"type": "unique", "name": "unique"},
                ],
            },
        }
        resp = self.client.post("/superset/sync_druid/", data=json.dumps(cfg))
        druid_ds = (
            db.session.query(DruidDatasource)
            .filter_by(datasource_name="test_click")
            .one()
        )
        # columns and metrics are not deleted if config is changed as
        # user could define his own dimensions / metrics and want to keep them
        assert set([c.column_name for c in druid_ds.columns]) == set(
            ["affiliate_id", "campaign", "first_seen", "second_seen"]
        )
        assert set([m.metric_name for m in druid_ds.metrics]) == set(
            ["count", "sum", "unique"]
        )
        # metric type will not be overridden, sum stays instead of bla
        assert set([m.metric_type for m in druid_ds.metrics]) == set(
            ["longSum", "sum", "unique"]
        )
        assert resp.status_code == 201

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_filter_druid_datasource(self):
        CLUSTER_NAME = "new_druid"
        cluster = self.get_or_create(
            DruidCluster, {"cluster_name": CLUSTER_NAME}, db.session
        )
        db.session.merge(cluster)

        gamma_ds = self.get_or_create(
            DruidDatasource,
            {"datasource_name": "datasource_for_gamma", "cluster": cluster},
            db.session,
        )
        gamma_ds.cluster = cluster
        db.session.merge(gamma_ds)

        no_gamma_ds = self.get_or_create(
            DruidDatasource,
            {"datasource_name": "datasource_not_for_gamma", "cluster": cluster},
            db.session,
        )
        no_gamma_ds.cluster = cluster
        db.session.merge(no_gamma_ds)
        db.session.commit()

        security_manager.add_permission_view_menu("datasource_access", gamma_ds.perm)
        security_manager.add_permission_view_menu("datasource_access", no_gamma_ds.perm)

        perm = security_manager.find_permission_view_menu(
            "datasource_access", gamma_ds.get_perm()
        )
        security_manager.add_permission_role(security_manager.find_role("Gamma"), perm)
        security_manager.get_session.commit()

        self.login(username="gamma")
        url = "/druiddatasourcemodelview/list/"
        resp = self.get_resp(url)
        self.assertIn("datasource_for_gamma", resp)
        self.assertNotIn("datasource_not_for_gamma", resp)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_sync_druid_perm(self, PyDruid):
        self.login(username="admin")
        instance = PyDruid.return_value
        instance.time_boundary.return_value = [{"result": {"maxTime": "2016-01-01"}}]
        instance.segment_metadata.return_value = SEGMENT_METADATA

        cluster = (
            db.session.query(DruidCluster)
            .filter_by(cluster_name="test_cluster")
            .first()
        )
        if cluster:
            for datasource in (
                db.session.query(DruidDatasource)
                .filter_by(cluster_name=cluster.cluster_name)
                .all()
            ):
                db.session.delete(datasource)

            db.session.delete(cluster)
        db.session.commit()

        cluster = DruidCluster(
            cluster_name="test_cluster",
            broker_host="localhost",
            broker_port=7980,
            metadata_last_refreshed=datetime.now(),
        )

        db.session.add(cluster)
        cluster.get_datasources = PickableMock(return_value=["test_datasource"])

        cluster.refresh_datasources()
        cluster.datasources[0].merge_flag = True
        metadata = cluster.datasources[0].latest_metadata()
        self.assertEqual(len(metadata), 4)
        db.session.commit()

        view_menu_name = cluster.datasources[0].get_perm()
        view_menu = security_manager.find_view_menu(view_menu_name)
        permission = security_manager.find_permission("datasource_access")

        pv = (
            security_manager.get_session.query(security_manager.permissionview_model)
            .filter_by(permission=permission, view_menu=view_menu)
            .first()
        )
        assert pv is not None

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_refresh_metadata(self, PyDruid):
        self.login(username="admin")
        cluster = self.get_cluster(PyDruid)
        cluster.refresh_datasources()
        datasource = cluster.datasources[0]

        cols = db.session.query(DruidColumn).filter(
            DruidColumn.datasource_id == datasource.id
        )

        for col in cols:
            self.assertIn(col.column_name, SEGMENT_METADATA[0]["columns"].keys())

        metrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == datasource.id)
            .filter(DruidMetric.metric_name.like("%__metric1"))
        )

        for metric in metrics:
            agg, _ = metric.metric_name.split("__")

            self.assertEqual(
                json.loads(metric.json)["type"], "double{}".format(agg.capitalize())
            )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_refresh_metadata_augment_type(self, PyDruid):
        self.login(username="admin")
        cluster = self.get_cluster(PyDruid)
        cluster.refresh_datasources()

        metadata = SEGMENT_METADATA[:]
        metadata[0]["columns"]["metric1"]["type"] = "LONG"
        instance = PyDruid.return_value
        instance.segment_metadata.return_value = metadata
        cluster.refresh_datasources()
        datasource = cluster.datasources[0]

        column = (
            db.session.query(DruidColumn)
            .filter(DruidColumn.datasource_id == datasource.id)
            .filter(DruidColumn.column_name == "metric1")
        ).one()

        self.assertEqual(column.type, "LONG")

        metrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == datasource.id)
            .filter(DruidMetric.metric_name.like("%__metric1"))
        )

        for metric in metrics:
            agg, _ = metric.metric_name.split("__")

            self.assertEqual(metric.json_obj["type"], "long{}".format(agg.capitalize()))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_refresh_metadata_augment_verbose_name(self, PyDruid):
        self.login(username="admin")
        cluster = self.get_cluster(PyDruid)
        cluster.refresh_datasources()
        datasource = cluster.datasources[0]

        metrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == datasource.id)
            .filter(DruidMetric.metric_name.like("%__metric1"))
        )

        for metric in metrics:
            metric.verbose_name = metric.metric_name

        db.session.commit()

        # The verbose name should not change during a refresh.
        cluster.refresh_datasources()
        datasource = cluster.datasources[0]

        metrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == datasource.id)
            .filter(DruidMetric.metric_name.like("%__metric1"))
        )

        for metric in metrics:
            self.assertEqual(metric.verbose_name, metric.metric_name)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_urls(self):
        cluster = self.get_test_cluster_obj()
        self.assertEquals(
            cluster.get_base_url("localhost", "9999"), "http://localhost:9999"
        )
        self.assertEquals(
            cluster.get_base_url("http://localhost", "9999"), "http://localhost:9999"
        )
        self.assertEquals(
            cluster.get_base_url("https://localhost", "9999"), "https://localhost:9999"
        )

        self.assertEquals(
            cluster.get_base_broker_url(), "http://localhost:7980/druid/v2"
        )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_druid_time_granularities(self, PyDruid):
        self.login(username="admin")
        cluster = self.get_cluster(PyDruid)
        cluster.refresh_datasources()
        cluster.refresh_datasources(merge_flag=True)
        datasource_id = cluster.datasources[0].id
        db.session.commit()

        nres = [
            list(v["event"].items()) + [("timestamp", v["timestamp"])]
            for v in GB_RESULT_SET
        ]
        nres = [dict(v) for v in nres]
        import pandas as pd

        df = pd.DataFrame(nres)
        instance = PyDruid.return_value
        instance.export_pandas.return_value = df
        instance.query_dict = {}
        instance.query_builder.last_query.query_dict = {}

        form_data = {
            "viz_type": "table",
            "since": "7+days+ago",
            "until": "now",
            "metrics": ["count"],
            "groupby": [],
            "include_time": "true",
        }

        granularity_map = {
            "5 seconds": "PT5S",
            "30 seconds": "PT30S",
            "1 minute": "PT1M",
            "5 minutes": "PT5M",
            "1 hour": "PT1H",
            "6 hour": "PT6H",
            "one day": "P1D",
            "1 day": "P1D",
            "7 days": "P7D",
            "week": "P1W",
            "week_starting_sunday": "P1W",
            "week_ending_saturday": "P1W",
            "month": "P1M",
            "quarter": "P3M",
            "year": "P1Y",
        }
        url = "/superset/explore_json/druid/{}/".format(datasource_id)

        for granularity_mapping in granularity_map:
            form_data["granularity"] = granularity_mapping
            self.get_json_resp(url, {"form_data": json.dumps(form_data)})
            self.assertEqual(
                granularity_map[granularity_mapping],
                instance.timeseries.call_args[1]["granularity"]["period"],
            )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    @patch("superset.connectors.druid.models.PyDruid")
    def test_external_metadata(self, PyDruid):
        self.login(username="admin")
        self.login(username="admin")
        cluster = self.get_cluster(PyDruid)
        cluster.refresh_datasources()
        datasource = cluster.datasources[0]
        url = "/datasource/external_metadata/druid/{}/".format(datasource.id)
        resp = self.get_json_resp(url)
        col_names = {o.get("name") for o in resp}
        self.assertEquals(col_names, {"__time", "dim1", "dim2", "metric1"})


if __name__ == "__main__":
    unittest.main()
