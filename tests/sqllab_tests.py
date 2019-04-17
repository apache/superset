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
"""Unit tests for Sql Lab"""
from datetime import datetime, timedelta
import json
import unittest

from flask_appbuilder.security.sqla import models as ab_models

from superset import db, security_manager
from superset.dataframe import SupersetDataFrame
from superset.db_engine_specs import BaseEngineSpec
from superset.models.sql_lab import Query
from superset.utils.core import datetime_to_epoch, get_main_database
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
        self.logout()
        db.session.query(Query).delete()
        db.session.commit()
        db.session.close()

    def test_sql_json(self):
        self.login('admin')

        data = self.run_sql('SELECT * FROM ab_user', '1')
        self.assertLess(0, len(data['data']))

        data = self.run_sql('SELECT * FROM unexistant_table', '2')
        self.assertLess(0, len(data['error']))

    def test_multi_sql(self):
        self.login('admin')

        multi_sql = """
        SELECT first_name FROM ab_user;
        SELECT first_name FROM ab_user;
        """
        data = self.run_sql(multi_sql, '2234')
        self.assertLess(0, len(data['data']))

    def test_explain(self):
        self.login('admin')

        data = self.run_sql('EXPLAIN SELECT * FROM ab_user', '1')
        self.assertLess(0, len(data['data']))

    def test_sql_json_has_access(self):
        main_db = get_main_database(db.session)
        security_manager.add_permission_view_menu('database_access', main_db.perm)
        db.session.commit()
        main_db_permission_view = (
            db.session.query(ab_models.PermissionView)
            .join(ab_models.ViewMenu)
            .join(ab_models.Permission)
            .filter(ab_models.ViewMenu.name == '[main].(id:1)')
            .filter(ab_models.Permission.name == 'database_access')
            .first()
        )
        astronaut = security_manager.add_role('Astronaut')
        security_manager.add_permission_role(astronaut, main_db_permission_view)
        # Astronaut role is Gamma + sqllab +  main db permissions
        for perm in security_manager.find_role('Gamma').permissions:
            security_manager.add_permission_role(astronaut, perm)
        for perm in security_manager.find_role('sql_lab').permissions:
            security_manager.add_permission_role(astronaut, perm)

        gagarin = security_manager.find_user('gagarin')
        if not gagarin:
            security_manager.add_user(
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
                int(datetime_to_epoch(now)) - 1000))
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
        user_id = security_manager.find_user('admin').id
        data = self.get_json_resp(
            '/superset/search_queries?user_id={}'.format(user_id))
        self.assertEquals(2, len(data))
        user_ids = {k['userId'] for k in data}
        self.assertEquals(set([user_id]), user_ids)

        user_id = security_manager.find_user('gamma_sqllab').id
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

    def test_search_query_with_owner_only_perms(self) -> None:
        """
        Test a search query with can_only_access_owned_queries perm added to
        Admin and make sure only Admin queries show up.
        """
        session = db.session

        # Add can_only_access_owned_queries perm to Admin user
        owned_queries_view = security_manager.find_permission_view_menu(
            'can_only_access_owned_queries',
            'can_only_access_owned_queries',
        )
        security_manager.add_permission_role(
            security_manager.find_role('Admin'),
            owned_queries_view,
        )
        session.commit()

        # Test search_queries for Admin user
        self.run_some_queries()
        self.login('admin')

        user_id = security_manager.find_user('admin').id
        data = self.get_json_resp('/superset/search_queries')
        self.assertEquals(2, len(data))
        user_ids = {k['userId'] for k in data}
        self.assertEquals(set([user_id]), user_ids)

        # Remove can_only_access_owned_queries from Admin
        owned_queries_view = security_manager.find_permission_view_menu(
            'can_only_access_owned_queries',
            'can_only_access_owned_queries',
        )
        security_manager.del_permission_role(
            security_manager.find_role('Admin'),
            owned_queries_view,
        )

        session.commit()

    def test_alias_duplicate(self):
        self.run_sql(
            'SELECT username as col, id as col, username FROM ab_user',
            client_id='2e2df3',
            user_name='admin',
            raise_on_error=True)

    def test_df_conversion_no_dict(self):
        cols = [
            ['string_col', 'string'],
            ['int_col', 'int'],
            ['float_col', 'float'],
        ]
        data = [['a', 4, 4.0]]
        cdf = SupersetDataFrame(data, cols, BaseEngineSpec)

        self.assertEquals(len(data), cdf.size)
        self.assertEquals(len(cols), len(cdf.columns))

    def test_df_conversion_tuple(self):
        cols = ['string_col', 'int_col', 'list_col', 'float_col']
        data = [(u'Text', 111, [123], 1.0)]
        cdf = SupersetDataFrame(data, cols, BaseEngineSpec)

        self.assertEquals(len(data), cdf.size)
        self.assertEquals(len(cols), len(cdf.columns))

    def test_df_conversion_dict(self):
        cols = ['string_col', 'dict_col', 'int_col']
        data = [['a', {'c1': 1, 'c2': 2, 'c3': 3}, 4]]
        cdf = SupersetDataFrame(data, cols, BaseEngineSpec)

        self.assertEquals(len(data), cdf.size)
        self.assertEquals(len(cols), len(cdf.columns))

    def test_sqllab_viz(self):
        payload = {
            'chartType': 'dist_bar',
            'datasourceName': 'test_viz_flow_table',
            'schema': 'superset',
            'columns': [{
                'is_date': False,
                'type': 'STRING',
                'nam:qe': 'viz_type',
                'is_dim': True,
            }, {
                'is_date': False,
                'type': 'OBJECT',
                'name': 'ccount',
                'is_dim': True,
                'agg': 'sum',
            }],
            'sql': """\
                SELECT viz_type, count(1) as ccount
                FROM slices
                WHERE viz_type LIKE '%a%'
                GROUP BY viz_type""",
            'dbId': 1,
        }
        data = {'data': json.dumps(payload)}
        resp = self.get_json_resp('/superset/sqllab_viz/', data=data)
        self.assertIn('table_id', resp)

    def test_sql_limit(self):
        self.login('admin')
        test_limit = 1
        data = self.run_sql(
            'SELECT * FROM ab_user',
            client_id='sql_limit_1')
        self.assertGreater(len(data['data']), test_limit)
        data = self.run_sql(
            'SELECT * FROM ab_user',
            client_id='sql_limit_2',
            query_limit=test_limit)
        self.assertEquals(len(data['data']), test_limit)
        data = self.run_sql(
            'SELECT * FROM ab_user LIMIT {}'.format(test_limit),
            client_id='sql_limit_3',
            query_limit=test_limit + 1)
        self.assertEquals(len(data['data']), test_limit)
        data = self.run_sql(
            'SELECT * FROM ab_user LIMIT {}'.format(test_limit + 1),
            client_id='sql_limit_4',
            query_limit=test_limit)
        self.assertEquals(len(data['data']), test_limit)

    def test_queryview_filter(self) -> None:
        """
        Test queryview api without can_only_access_owned_queries perm added to
        Admin and make sure all queries show up.
        """
        self.run_some_queries()
        self.login(username='admin')

        url = '/queryview/api/read'
        data = self.get_json_resp(url)
        admin = security_manager.find_user('admin')
        gamma_sqllab = security_manager.find_user('gamma_sqllab')
        self.assertEquals(3, len(data['result']))
        user_queries = [
            result.get('username') for result in data['result']
        ]
        assert admin.username in user_queries
        assert gamma_sqllab.username in user_queries

    def test_queryview_filter_owner_only(self) -> None:
        """
        Test queryview api with can_only_access_owned_queries perm added to
        Admin and make sure only Admin queries show up.
        """
        session = db.session

        # Add can_only_access_owned_queries perm to Admin user
        owned_queries_view = security_manager.find_permission_view_menu(
            'can_only_access_owned_queries',
            'can_only_access_owned_queries',
        )
        security_manager.add_permission_role(
            security_manager.find_role('Admin'),
            owned_queries_view,
        )
        session.commit()

        # Test search_queries for Admin user
        self.run_some_queries()
        self.login('admin')

        url = '/queryview/api/read'
        data = self.get_json_resp(url)
        admin = security_manager.find_user('admin')
        self.assertEquals(2, len(data['result']))
        all_admin_user_queries = all([
            result.get('username') == admin.username for result in data['result']
        ])
        assert all_admin_user_queries is True

        # Remove can_only_access_owned_queries from Admin
        owned_queries_view = security_manager.find_permission_view_menu(
            'can_only_access_owned_queries',
            'can_only_access_owned_queries',
        )
        security_manager.del_permission_role(
            security_manager.find_role('Admin'),
            owned_queries_view,
        )

        session.commit()


if __name__ == '__main__':
    unittest.main()
