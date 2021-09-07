from sqlalchemy_adapter import firebolt_connector
from sqlalchemy_adapter import firebolt_dialect

class ConnectionDetails():
    user_email = "aapurva@sigmoidanalytics.com"
    password = "Apurva111"
    db_name = "Sigmoid_Alchemy"
    connection = firebolt_connector.connect(user_email, password, db_name)
    fireboltDialect = firebolt_dialect.FireboltDialect

class TestFireboltDialect:



    def test_create_connect_args(self):
        None

    def test_get_schema_names(self):
        # result = fireboltDialect.get_schema_names()
        None

    def test_has_table(self):
        None

    def test_get_table_names(self):
        None

    def get_columns(self):
        None