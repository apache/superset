# -*- coding: utf-8 -*-
"""Unit tests for Superset"""
import json

from .base_tests import SupersetTestCase
from .fixtures.datasource import datasource_post


class DatasourceTests(SupersetTestCase):

    requires_examples = True

    def __init__(self, *args, **kwargs):
        super(DatasourceTests, self).__init__(*args, **kwargs)

    def test_external_metadata(self):
        self.login(username='admin')
        tbl_id = self.get_table_by_name('birth_names').id
        url = '/datasource/external_metadata/table/{}/'.format(tbl_id)
        resp = self.get_json_resp(url)
        col_names = {o.get('name') for o in resp}
        self.assertEquals(
            col_names,
            {'sum_boys', 'num', 'gender', 'name', 'ds', 'state', 'sum_girls'},
        )

    def compare_lists(self, l1, l2, key):
        l2_lookup = {o.get(key): o for o in l2}
        for obj1 in l1:
            obj2 = l2_lookup.get(obj1.get(key))
            for k in obj1:
                if k not in 'id' and obj1.get(k):
                    self.assertEquals(obj1.get(k), obj2.get(k))

    def test_save(self):
        self.login(username='admin')
        tbl_id = self.get_table_by_name('birth_names').id
        datasource_post['id'] = tbl_id
        data = dict(data=json.dumps(datasource_post))
        resp = self.get_json_resp('/datasource/save/', data)
        for k in datasource_post:
            if k == 'columns':
                self.compare_lists(datasource_post[k], resp[k], 'column_name')
            elif k == 'metrics':
                self.compare_lists(datasource_post[k], resp[k], 'metric_name')
            else:
                self.assertEquals(resp[k], datasource_post[k])
