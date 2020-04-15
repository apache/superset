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
# from superset import db
# from superset.models.dashboard import Dashboard
import subprocess
import urllib.request
from unittest import skipUnless
from unittest.mock import patch

from flask_testing import LiveServerTestCase
from sqlalchemy.sql import func

from superset import db, is_feature_enabled, security_manager, thumbnail_cache
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.screenshots import (
    ChartScreenshot,
    DashboardScreenshot,
    get_auth_cookies,
)
from tests.test_app import app

from .base_tests import SupersetTestCase


class CeleryStartMixin:
    @classmethod
    def setUpClass(cls):
        with app.app_context():
            from werkzeug.contrib.cache import RedisCache

            class CeleryConfig(object):
                BROKER_URL = "redis://localhost"
                CELERY_IMPORTS = ("superset.tasks.thumbnails",)
                CONCURRENCY = 1

            app.config["CELERY_CONFIG"] = CeleryConfig

            def init_thumbnail_cache(app) -> RedisCache:
                return RedisCache(
                    host="localhost",
                    key_prefix="superset_thumbnails_",
                    default_timeout=10000,
                )

            app.config["THUMBNAIL_CACHE_CONFIG"] = init_thumbnail_cache

            base_dir = app.config["BASE_DIR"]
            worker_command = base_dir + "/bin/superset worker -w 2"
            subprocess.Popen(
                worker_command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

    @classmethod
    def tearDownClass(cls):
        subprocess.call(
            "ps auxww | grep 'celeryd' | awk '{print $2}' | xargs kill -9", shell=True
        )
        subprocess.call(
            "ps auxww | grep 'superset worker' | awk '{print $2}' | xargs kill -9",
            shell=True,
        )


class ThumbnailsSeleniumLive(CeleryStartMixin, LiveServerTestCase):
    def create_app(self):
        return app

    def url_open_auth(self, username: str, url: str):
        admin_user = security_manager.find_user(username=username)
        cookies = {}
        for cookie in get_auth_cookies(admin_user):
            cookies["session"] = cookie

        opener = urllib.request.build_opener()
        opener.addheaders.append(("Cookie", f"session={cookies['session']}"))
        return opener.open(f"{self.get_server_url()}/{url}")

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_dashboard_screenshot(self):
        """
            Thumbnails: Simple get async dashboard screenshot
        """
        dashboard = db.session.query(Dashboard).all()[0]
        with patch("superset.dashboards.api.DashboardRestApi.get") as mock_get:
            response = self.url_open_auth(
                "admin",
                f"api/v1/dashboard/{dashboard.id}/thumbnail/{dashboard.digest}/",
            )
            self.assertEqual(response.getcode(), 202)


class ThumbnailsTests(CeleryStartMixin, SupersetTestCase):

    mock_image = b"bytes mock image"

    def test_dashboard_thumbnail_disabled(self):
        """
            Thumbnails: Dashboard thumbnail disabled
        """
        if is_feature_enabled("THUMBNAILS"):
            return
        dashboard = db.session.query(Dashboard).all()[0]
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}/thumbnail/{dashboard.digest}/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_chart_thumbnail_disabled(self):
        """
            Thumbnails: Chart thumbnail disabled
        """
        if is_feature_enabled("THUMBNAILS"):
            return
        chart = db.session.query(Slice).all()[0]
        self.login(username="admin")
        uri = f"api/v1/chart/{chart}/thumbnail/{chart.digest}/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_dashboard_screenshot(self):
        """
            Thumbnails: Simple get async dashboard screenshot
        """
        dashboard = db.session.query(Dashboard).all()[0]
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}/thumbnail/{dashboard.digest}/"
        with patch(
            "superset.tasks.thumbnails.cache_dashboard_thumbnail.delay"
        ) as mock_task:
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 202)
            mock_task.assert_called_with(dashboard.id, force=True)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_dashboard_notfound(self):
        """
            Thumbnails: Simple get async dashboard not found
        """
        max_id = db.session.query(func.max(Dashboard.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/dashboard/{max_id + 1}/thumbnail/1234/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_dashboard_not_allowed(self):
        """
            Thumbnails: Simple get async dashboard not allowed
        """
        dashboard = db.session.query(Dashboard).all()[0]
        self.login(username="gamma")
        uri = f"api/v1/dashboard/{dashboard.id}/thumbnail/{dashboard.digest}/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_chart_screenshot(self):
        """
            Thumbnails: Simple get async chart screenshot
        """
        chart = db.session.query(Slice).all()[0]
        self.login(username="admin")
        uri = f"api/v1/chart/{chart.id}/thumbnail/{chart.digest}/"
        with patch(
            "superset.tasks.thumbnails.cache_chart_thumbnail.delay"
        ) as mock_task:
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 202)
            mock_task.assert_called_with(chart.id, force=True)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_chart_notfound(self):
        """
            Thumbnails: Simple get async chart not found
        """
        max_id = db.session.query(func.max(Slice.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/chart/{max_id + 1}/thumbnail/1234/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_cached_chart_wrong_digest(self):
        """
            Thumbnails: Simple get chart with wrong digest
        """
        chart = db.session.query(Slice).all()[0]
        # Cache a test "image"
        screenshot = ChartScreenshot(model_id=chart.id)
        thumbnail_cache.set(screenshot.cache_key, self.mock_image)
        self.login(username="admin")
        uri = f"api/v1/chart/{chart.id}/thumbnail/1234/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 302)
        self.assertRedirects(rv, f"api/v1/chart/{chart.id}/thumbnail/{chart.digest}/")

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_cached_dashboard_screenshot(self):
        """
            Thumbnails: Simple get cached dashboard screenshot
        """
        dashboard = db.session.query(Dashboard).all()[0]
        # Cache a test "image"
        screenshot = DashboardScreenshot(model_id=dashboard.id)
        thumbnail_cache.set(screenshot.cache_key, self.mock_image)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}/thumbnail/{dashboard.digest}/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(rv.data, self.mock_image)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_cached_chart_screenshot(self):
        """
            Thumbnails: Simple get cached chart screenshot
        """
        chart = db.session.query(Slice).all()[0]
        # Cache a test "image"
        screenshot = ChartScreenshot(model_id=chart.id)
        thumbnail_cache.set(screenshot.cache_key, self.mock_image)
        self.login(username="admin")
        uri = f"api/v1/chart/{chart.id}/thumbnail/{chart.digest}/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(rv.data, self.mock_image)

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_cached_dashboard_wrong_digest(self):
        """
            Thumbnails: Simple get dashboard with wrong digest
        """
        dashboard = db.session.query(Dashboard).all()[0]
        # Cache a test "image"
        screenshot = DashboardScreenshot(model_id=dashboard.id)
        thumbnail_cache.set(screenshot.cache_key, self.mock_image)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}/thumbnail/1234/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 302)
        self.assertRedirects(
            rv, f"api/v1/dashboard/{dashboard.id}/thumbnail/{dashboard.digest}/"
        )
