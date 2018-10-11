# -*- coding: utf-8 -*-
"""Unit tests for Superset with caching"""
import json

from superset import cache, db, utils
from .base_tests import SupersetTestCase


class CacheTests(SupersetTestCase):

    def __init__(self, *args, **kwargs):
        super(CacheTests, self).__init__(*args, **kwargs)

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_cache_value(self):
        self.login(username='admin')
        slc = self.get_slice('Girls', db.session)

        json_endpoint = (
            '/superset/explore_json/{}/{}/'
            .format(slc.datasource_type, slc.datasource_id)
        )
        resp = self.get_json_resp(
            json_endpoint, {'form_data': json.dumps(slc.viz.form_data)})
        resp_from_cache = self.get_json_resp(
            json_endpoint, {'form_data': json.dumps(slc.viz.form_data)})
        self.assertFalse(resp['is_cached'])
        self.assertTrue(resp_from_cache['is_cached'])
        self.assertEqual(resp_from_cache['status'], utils.QueryStatus.SUCCESS)
        self.assertEqual(resp['data'], resp_from_cache['data'])
        self.assertEqual(resp['query'], resp_from_cache['query'])
