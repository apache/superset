import unittest

from sqlalchemy.engine.url import make_url

from superset.models import Database


class DatabaseModelTestCase(unittest.TestCase):
    def test_database_for_various_backend(self):
        sqlalchemy_uri = 'presto://presto.airbnb.io:8080/hive/default'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        url = make_url(model.sqlalchemy_uri)
        db = model.get_database_for_various_backend(url, None)
        assert db == 'hive/default'
        db = model.get_database_for_various_backend(url, 'raw_data')
        assert db == 'hive/raw_data'

        sqlalchemy_uri = 'redshift+psycopg2://superset:XXXXXXXXXX@redshift.airbnb.io:5439/prod'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        url = make_url(model.sqlalchemy_uri)
        db = model.get_database_for_various_backend(url, None)
        assert db == 'prod'
        db = model.get_database_for_various_backend(url, 'test')
        assert db == 'prod'

        sqlalchemy_uri = 'postgresql+psycopg2://superset:XXXXXXXXXX@postgres.airbnb.io:5439/prod'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        url = make_url(model.sqlalchemy_uri)
        db = model.get_database_for_various_backend(url, None)
        assert db == 'prod'
        db = model.get_database_for_various_backend(url, 'adhoc')
        assert db == 'prod'

        sqlalchemy_uri = 'hive://hive@hive.airbnb.io:10000/raw_data'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        url = make_url(model.sqlalchemy_uri)
        db = model.get_database_for_various_backend(url, None)
        assert db == 'raw_data'
        db = model.get_database_for_various_backend(url, 'adhoc')
        assert db == 'adhoc'

        sqlalchemy_uri = 'mysql://superset:XXXXXXXXXX@mysql.airbnb.io/superset'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        url = make_url(model.sqlalchemy_uri)
        db = model.get_database_for_various_backend(url, None)
        assert db == 'superset'
        db = model.get_database_for_various_backend(url, 'adhoc')
        assert db == 'adhoc'
