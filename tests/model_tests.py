# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import textwrap

from sqlalchemy.engine.url import make_url
from tests.base_tests import SupersetTestCase

from superset import db
from superset.models.core import Database


class DatabaseModelTestCase(SupersetTestCase):

    def test_database_schema_presto(self):
        sqlalchemy_uri = 'presto://presto.airbnb.io:8080/hive/default'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('hive/default', db)

        db = make_url(model.get_sqla_engine(schema='core_db').url).database
        self.assertEquals('hive/core_db', db)

        sqlalchemy_uri = 'presto://presto.airbnb.io:8080/hive'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('hive', db)

        db = make_url(model.get_sqla_engine(schema='core_db').url).database
        self.assertEquals('hive/core_db', db)

    def test_database_schema_postgres(self):
        sqlalchemy_uri = 'postgresql+psycopg2://postgres.airbnb.io:5439/prod'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('prod', db)

        db = make_url(model.get_sqla_engine(schema='foo').url).database
        self.assertEquals('prod', db)

    def test_database_schema_hive(self):
        sqlalchemy_uri = 'hive://hive@hive.airbnb.io:10000/default?auth=NOSASL'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('default', db)

        db = make_url(model.get_sqla_engine(schema='core_db').url).database
        self.assertEquals('core_db', db)

    def test_database_schema_mysql(self):
        sqlalchemy_uri = 'mysql://root@localhost/superset'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('superset', db)

        db = make_url(model.get_sqla_engine(schema='staging').url).database
        self.assertEquals('staging', db)

    def test_database_impersonate_user(self):
        uri = 'mysql://root@localhost'
        example_user = 'giuseppe'
        model = Database(sqlalchemy_uri=uri)

        model.impersonate_user = True
        user_name = make_url(model.get_sqla_engine(user_name=example_user).url).username
        self.assertEquals(example_user, user_name)

        model.impersonate_user = False
        user_name = make_url(model.get_sqla_engine(user_name=example_user).url).username
        self.assertNotEquals(example_user, user_name)

    def test_select_star(self):
        main_db = self.get_main_database(db.session)
        table_name = 'bart_lines'
        sql = main_db.select_star(
            table_name, show_cols=False, latest_partition=False)
        expected = textwrap.dedent("""\
        SELECT *
        FROM {table_name}
        LIMIT 100""".format(**locals()))
        assert sql.startswith(expected)

        sql = main_db.select_star(
            table_name, show_cols=True, latest_partition=False)
        expected = textwrap.dedent("""\
        SELECT color,
               name,
               path_json,
               polyline
        FROM bart_lines
        LIMIT 100""".format(**locals()))
        assert sql.startswith(expected)
