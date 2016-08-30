import unittest
from caravel.models import TableColumn
from datetime import datetime

class DummyDatabase:
        def __init__(self, uri):
            self.sqlachemy_uri = uri
class DummyImpl:
    def append(self, child_state,
                    child_dict,
                    state,
                    initiator,
                    passive):
        pass
class DummyColumns:
    def __init__(self):
        self.impl = DummyImpl()
class DummyState:
    def __init__(self):
        self.manager = {"columns": DummyColumns()}
class DummyTable:
    def __init__(self, db):
        self.database = DummyDatabase(db)
        self._sa_instance_state = DummyState()

class CaravelTestCase(unittest.TestCase):

    def buildTable(self, dbtype):
        tc = TableColumn()
        tc.database_expression = None
        tc.table = DummyTable(dbtype)
        return tc

    def test_dttm_sql_literal_mssql(self):
        tc = self.buildTable("mssql")
        dt = datetime(2016, 7, 8, 9, 10, 11, 131456)
        expected = {
            "date": "CONVERT(DATE, '2016-07-08 09:10:11.131', 121)",
            "datetime": "CONVERT(DATETIME, '2016-07-08 09:10:11.131', 121)",
            "datetime2": "'2016-07-08 09:10:11.131456'"
        }
        for key in expected.keys():
            dtsql = tc.dttm_sql_literal(dt, key)
            assert dtsql == expected[key], "%s    <>    %s" % (dtsql, expected[key])

    def test_dttm_sql_literal_oracle(self):
        tc = self.buildTable("oracle")
        dt = datetime(2016, 7, 8, 9, 10, 11, 131456)
        expected = {
            "default": "TO_TIMESTAMP('2016-07-08 09:10:11.131456', 'YYYY-MM-DD HH24:MI:SS.ff6')"
        }
        for key in expected.keys():
            dtsql = tc.dttm_sql_literal(dt, key)
            assert dtsql == expected[key], "%s    <>    %s" % (dtsql, expected[key])