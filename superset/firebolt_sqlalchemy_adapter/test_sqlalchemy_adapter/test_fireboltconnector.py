from sqlalchemy_adapter import firebolt_connector


class Testfirebolt_connector:

    def test_connect_success(self):
        user_email = "aapurva@sigmoidanalytics.com"
        password = "Apurva111"
        db_name = "Sigmoid_Alchemy"
        connection = firebolt_connector.connect(user_email, password, db_name)
        assert connection.access_token
        assert connection.engine_url

    def test_connect_invalid_credentials(self):
        user_email = "aapurva@sigmoidanalytics.com"
        password = "wrongpassword"
        db_name = "Sigmoid_Alchemy"
        connection = firebolt_connector.connect(user_email, password, db_name)
        assert not connection.access_token
        assert not connection.engine_url

    def test_connect_invalid_database(self):
        user_email = "aapurva@sigmoidanalytics.com"
        password = "Apurva111"
        db_name = "wrongdatabase"
        connection = firebolt_connector.connect(user_email, password, db_name)
        assert not connection.access_token
        assert not connection.engine_url

    def test_get_type(self):
        value_1 = "String Value"
        value_2_1 = 5
        value_2_2 = 5.1
        value_3_1 = True
        value_3_2 = False
        assert firebolt_connector.get_type(value_1) == 1
        assert firebolt_connector.get_type(value_2_1) == 2
        assert firebolt_connector.get_type(value_2_2) == 2
        assert firebolt_connector.get_type(value_3_1) == 3
        assert firebolt_connector.get_type(value_3_2) == 3
        # TODO check how to assert/test exceptions

    def test_get_description_from_row(self):
        row = {'id': 1, 'name': 'John', 'is_eligible': True}
        result = firebolt_connector.get_description_from_row(row)
        assert result[0][0] == 'id'
        assert result[0][1] == firebolt_connector.Type.NUMBER
        assert result[0][6] == False
        assert result[1][0] == 'name'
        assert result[1][1] == firebolt_connector.Type.STRING
        assert result[1][6] == True
        assert result[2][0] == 'is_eligible'
        assert result[2][1] == firebolt_connector.Type.BOOLEAN
        assert result[2][6] == False

    def test_connection_cursor(self):
        user_email = "aapurva@sigmoidanalytics.com"
        password = "Apurva111"
        db_name = "Sigmoid_Alchemy"
        connection = firebolt_connector.connect(user_email, password, db_name)
        assert len(connection.cursors) == 0
        connection.cursor()
        assert len(connection.cursors) > 0

    def test_connection_execute(self):
        user_email = "aapurva@sigmoidanalytics.com"
        password = "Apurva111"
        db_name = "Sigmoid_Alchemy"
        query = "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.DATABASES"
        connection = firebolt_connector.connect(user_email, password, db_name)
        result = connection.execute(query)
        assert result['data'][0]['schema_name'] == 'Sigmoid_Alchemy'

    def test_escape(self):
        assert firebolt_connector.escape("*") == "*"
