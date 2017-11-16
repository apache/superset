"""Unit tests for Sql Lab"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime, timedelta
import json
import unittest

from flask_appbuilder.security.sqla import models as ab_models

from superset import appbuilder, db, sm, utils
from superset.models.sql_lab import Query
from .base_tests import SupersetTestCase


class SqlLabTests(SupersetTestCase):
    """Testings for Sql Lab"""

    def __init__(self, *args, **kwargs):
        super(SqlLabTests, self).__init__(*args, **kwargs)

    def run_some_queries(self):
        db.session.query(Query).delete()
        db.session.commit()
        self.run_sql(
            'SELECT * FROM ab_user',
            client_id='client_id_1',
            user_name='admin')
        self.run_sql(
            'SELECT * FROM NO_TABLE',
            client_id='client_id_3',
            user_name='admin')
        self.run_sql(
            'SELECT * FROM ab_permission',
            client_id='client_id_2',
            user_name='gamma_sqllab')
        self.logout()

    def tearDown(self):
        db.session.query(Query).delete()
        db.session.commit()
        self.logout()

    def test_sql_json(self):
        self.login('admin')

        data = self.run_sql('SELECT * FROM ab_user', '1')
        self.assertLess(0, len(data['data']))

        data = self.run_sql('SELECT * FROM unexistant_table', '2')
        self.assertLess(0, len(data['error']))

    def test_sql_json_has_access(self):
        main_db = self.get_main_database(db.session)
        sm.add_permission_view_menu('database_access', main_db.perm)
        db.session.commit()
        main_db_permission_view = (
            db.session.query(ab_models.PermissionView)
            .join(ab_models.ViewMenu)
            .join(ab_models.Permission)
            .filter(ab_models.ViewMenu.name == '[main].(id:1)')
            .filter(ab_models.Permission.name == 'database_access')
            .first()
        )
        astronaut = sm.add_role('Astronaut')
        sm.add_permission_role(astronaut, main_db_permission_view)
        # Astronaut role is Gamma + sqllab +  main db permissions
        for perm in sm.find_role('Gamma').permissions:
            sm.add_permission_role(astronaut, perm)
        for perm in sm.find_role('sql_lab').permissions:
            sm.add_permission_role(astronaut, perm)

        gagarin = appbuilder.sm.find_user('gagarin')
        if not gagarin:
            appbuilder.sm.add_user(
                'gagarin', 'Iurii', 'Gagarin', 'gagarin@cosmos.ussr',
                astronaut,
                password='general')
        data = self.run_sql('SELECT * FROM ab_user', '3', user_name='gagarin')
        db.session.query(Query).delete()
        db.session.commit()
        self.assertLess(0, len(data['data']))

    def test_queries_endpoint(self):
        self.run_some_queries()

        # Not logged in, should error out
        resp = self.client.get('/superset/queries/0')
        # Redirects to the login page
        self.assertEquals(403, resp.status_code)

        # Admin sees queries
        self.login('admin')
        data = self.get_json_resp('/superset/queries/0')
        self.assertEquals(2, len(data))

        # Run 2 more queries
        self.run_sql('SELECT * FROM ab_user LIMIT 1', client_id='client_id_4')
        self.run_sql('SELECT * FROM ab_user LIMIT 2', client_id='client_id_5')
        self.login('admin')
        data = self.get_json_resp('/superset/queries/0')
        self.assertEquals(4, len(data))

        now = datetime.now() + timedelta(days=1)
        query = db.session.query(Query).filter_by(
            sql='SELECT * FROM ab_user LIMIT 1').first()
        query.changed_on = now
        db.session.commit()

        data = self.get_json_resp(
            '/superset/queries/{}'.format(
                int(utils.datetime_to_epoch(now)) - 1000))
        self.assertEquals(1, len(data))

        self.logout()
        resp = self.client.get('/superset/queries/0')
        # Redirects to the login page
        self.assertEquals(403, resp.status_code)

    def test_search_query_on_db_id(self):
        self.run_some_queries()
        self.login('admin')
        # Test search queries on database Id
        data = self.get_json_resp('/superset/search_queries?database_id=1')
        self.assertEquals(3, len(data))
        db_ids = [k['dbId'] for k in data]
        self.assertEquals([1, 1, 1], db_ids)

        resp = self.get_resp('/superset/search_queries?database_id=-1')
        data = json.loads(resp)
        self.assertEquals(0, len(data))

    def test_search_query_on_user(self):
        self.run_some_queries()
        self.login('admin')

        # Test search queries on user Id
        user_id = appbuilder.sm.find_user('admin').id
        data = self.get_json_resp(
            '/superset/search_queries?user_id={}'.format(user_id))
        self.assertEquals(2, len(data))
        user_ids = {k['userId'] for k in data}
        self.assertEquals(set([user_id]), user_ids)

        user_id = appbuilder.sm.find_user('gamma_sqllab').id
        resp = self.get_resp(
            '/superset/search_queries?user_id={}'.format(user_id))
        data = json.loads(resp)
        self.assertEquals(1, len(data))
        self.assertEquals(data[0]['userId'], user_id)

    def test_search_query_on_status(self):
        self.run_some_queries()
        self.login('admin')
        # Test search queries on status
        resp = self.get_resp('/superset/search_queries?status=success')
        data = json.loads(resp)
        self.assertEquals(2, len(data))
        states = [k['state'] for k in data]
        self.assertEquals(['success', 'success'], states)

        resp = self.get_resp('/superset/search_queries?status=failed')
        data = json.loads(resp)
        self.assertEquals(1, len(data))
        self.assertEquals(data[0]['state'], 'failed')

    def test_search_query_on_text(self):
        self.run_some_queries()
        self.login('admin')
        url = '/superset/search_queries?search_text=permission'
        data = self.get_json_resp(url)
        self.assertEquals(1, len(data))
        self.assertIn('permission', data[0]['sql'])

    def test_search_query_on_time(self):
        self.run_some_queries()
        self.login('admin')
        first_query_time = (
            db.session.query(Query)
            .filter_by(sql='SELECT * FROM ab_user').one()
        ).start_time
        second_query_time = (
            db.session.query(Query)
            .filter_by(sql='SELECT * FROM ab_permission').one()
        ).start_time
        # Test search queries on time filter
        from_time = 'from={}'.format(int(first_query_time))
        to_time = 'to={}'.format(int(second_query_time))
        params = [from_time, to_time]
        resp = self.get_resp('/superset/search_queries?' + '&'.join(params))
        data = json.loads(resp)
        self.assertEquals(2, len(data))

    def test_alias_duplicate(self):
        self.run_sql(
            'SELECT username as col, id as col, username FROM ab_user',
            client_id='2e2df3',
            user_name='admin',
            raise_on_error=True)


if __name__ == '__main__':
    unittest.main()
