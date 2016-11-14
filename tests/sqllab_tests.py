"""Unit tests for Sql Lab"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import csv
import json
import io
import unittest

from flask_appbuilder.security.sqla import models as ab_models
from superset import db, models, utils, appbuilder, sm
from .base_tests import SupersetTestCase


class SqlLabTests(SupersetTestCase):
    """Testings for Sql Lab"""

    def __init__(self, *args, **kwargs):
        super(SqlLabTests, self).__init__(*args, **kwargs)

    def setUp(self):
        db.session.query(models.Query).delete()
        self.run_sql("SELECT * FROM ab_user", 'admin', client_id='client_id_1')
        self.run_sql("SELECT * FROM NO_TABLE", 'admin', client_id='client_id_3')
        self.run_sql("SELECT * FROM ab_permission", 'gamma', client_id='client_id_2')

    def tearDown(self):
        db.session.query(models.Query).delete()

    def test_sql_json(self):
        data = self.run_sql('SELECT * FROM ab_user', 'admin', "1")
        self.assertLess(0, len(data['data']))

        data = self.run_sql('SELECT * FROM unexistant_table', 'admin', "2")
        self.assertLess(0, len(data['error']))

    def test_sql_json_has_access(self):
        main_db = self.get_main_database(db.session)
        sm.add_permission_view_menu('database_access', main_db.perm)
        db.session.commit()
        main_db_permission_view = (
            db.session.query(ab_models.PermissionView)
            .join(ab_models.ViewMenu)
            .filter(ab_models.ViewMenu.name == '[main].(id:1)')
            .first()
        )
        astronaut = sm.add_role("Astronaut")
        sm.add_permission_role(astronaut, main_db_permission_view)
        # Astronaut role is Gamma + main db permissions
        for gamma_perm in sm.find_role('Gamma').permissions:
            sm.add_permission_role(astronaut, gamma_perm)

        gagarin = appbuilder.sm.find_user('gagarin')
        if not gagarin:
            appbuilder.sm.add_user(
                'gagarin', 'Iurii', 'Gagarin', 'gagarin@cosmos.ussr',
                appbuilder.sm.find_role('Astronaut'),
                password='general')
        data = self.run_sql('SELECT * FROM ab_user', 'gagarin', "3")
        db.session.query(models.Query).delete()
        db.session.commit()
        self.assertLess(0, len(data['data']))

    def test_queries_endpoint(self):
        resp = self.client.get('/superset/queries/{}'.format(0))
        self.assertEquals(403, resp.status_code)

        self.login('admin')
        data = self.get_json_resp('/superset/queries/{}'.format(0))
        self.assertEquals(2, len(data))
        self.logout()

        self.run_sql("SELECT * FROM ab_user1", 'admin', client_id='client_id_4')
        self.run_sql("SELECT * FROM ab_user2", 'admin', client_id='client_id_5')
        self.login('admin')
        data = self.get_json_resp('/superset/queries/{}'.format(0))
        self.assertEquals(4, len(data))

        query = db.session.query(models.Query).filter_by(
            sql='SELECT * FROM ab_user1').first()
        query.changed_on = utils.EPOCH
        db.session.commit()

        data = self.get_json_resp('/superset/queries/{}'.format(123456000))
        self.assertEquals(3, len(data))

        self.logout()
        resp = self.client.get('/superset/queries/{}'.format(0))
        self.assertEquals(403, resp.status_code)

    def test_search_query_on_db_id(self):
      self.login('admin')
      # Test search queries on database Id
      resp = self.get_resp('/superset/search_queries?database_id=1')
      data = json.loads(resp)
      self.assertEquals(3, len(data))
      db_ids = [data[k]['dbId'] for k in data]
      self.assertEquals([1, 1, 1], db_ids)

      resp = self.get_resp('/superset/search_queries?database_id=-1')
      data = json.loads(resp)
      self.assertEquals(0, len(data))
      self.logout()

    def test_search_query_on_user(self):
      self.login('admin')
      # Test search queries on user Id
      user = appbuilder.sm.find_user('admin')
      resp = self.get_resp('/superset/search_queries?user_id={}'.format(user.id))
      data = json.loads(resp)
      self.assertEquals(2, len(data))
      user_ids = [data[k]['userId'] for k in data]
      self.assertEquals([user.id, user.id], user_ids)

      user = appbuilder.sm.find_user('gamma')
      resp = self.get_resp('/superset/search_queries?user_id={}'.format(user.id))
      data = json.loads(resp)
      self.assertEquals(1, len(data))
      self.assertEquals(list(data.values())[0]['userId'] , user.id)
      self.logout()

    def test_search_query_on_status(self):
      self.login('admin')
      # Test search queries on status
      resp = self.get_resp('/superset/search_queries?status=success')
      data = json.loads(resp)
      self.assertEquals(2, len(data))
      states = [data[k]['state'] for k in data]
      self.assertEquals(['success', 'success'], states)

      resp = self.get_resp('/superset/search_queries?status=failed')
      data = json.loads(resp)
      self.assertEquals(1, len(data))
      self.assertEquals(list(data.values())[0]['state'], 'failed')
      self.logout()

    def test_search_query_on_text(self):
      self.login('admin')
      resp = self.get_resp('/superset/search_queries?search_text=permission')
      data = json.loads(resp)
      self.assertEquals(1, len(data))
      self.assertIn('permission', list(data.values())[0]['sql'])
      self.logout()

    def test_search_query_on_time(self):
      self.login('admin')
      first_query_time = db.session.query(models.Query).filter_by(
          sql='SELECT * FROM ab_user').first().start_time
      second_query_time = db.session.query(models.Query).filter_by(
          sql='SELECT * FROM ab_permission').first().start_time
      # Test search queries on time filter
      from_time = 'from={}'.format(int(first_query_time))
      to_time = 'to={}'.format(int(second_query_time))
      params = [from_time, to_time]
      resp = self.get_resp('/superset/search_queries?'+'&'.join(params))
      data = json.loads(resp)
      self.assertEquals(2, len(data))
      for _, v in data.items():
        self.assertLess(int(first_query_time), v['startDttm'])
        self.assertLess(v['startDttm'], int(second_query_time))
      self.logout()


if __name__ == '__main__':
    unittest.main()
