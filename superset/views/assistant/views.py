# Sample Assiststant Page

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset.models.core import Database
import logging
from superset.extensions import security_manager


class AssistantView(BaseSupersetView):
    logger = logging.getLogger(__name__)
    datamodel = SQLAInterface(Database)
    route_base = "/assistant"
    default_view = "root"

    # Get Database Connections, their schema , tables and columns data
    # Get Databases
    def get_databases(self):
        count, databases = self.datamodel.query()
        return databases
    
    # Get Schema
    def get_schema(self, database):
        schemas = database.get_all_schema_names()
        # allowed_schemas = security_manager.get_schemas_accessible_by_user(
        #         database,
        #         None,
        #         schemas,
        #     )
        return schemas
    
    # Get Tables
    def get_tables(self, database, schema):
        tables = database.get_all_table_names_in_schema(catalog = None, schema = schema)
        self.logger.info(f"Found {len(tables)} tables in schema {schema}")
        return tables
    
    # Get Columns
    def get_columns(self, database, table):
        try:
            columns = database.get_columns(table)
            self.logger.info(f"<====> Found => {len(columns)} columns in table {table.table}")
        except Exception as e:
            self.logger.error(f"<====> Error while fetching columns for table {table.table} => {e}")
            columns = []
        return columns
    
    def get_database_schema_table_columns(self):
        databases = self.get_databases()
        data = []
        for database in databases:
            db_data = {
                "database_id": database.id,
                "database_name": database.database_name,
                "schemas": []
            }
            schemas = self.get_schema(database)
            self.logger.info(f"<====> Found {len(schemas)} schemas in database {database.database_name}")
            for schema in schemas:
                schema_data = {
                    "schema_name": schema,
                    "tables": []
                }
                tables = self.get_tables(database, schema)
                for table in tables:
                    table_data = {
                        "table_name": table.table,
                        "description": "",
                        "suggested": "",
                        "columns": []
                    }
                    # columns = self.get_columns(database, table)
                    # for column in columns:        
                    #     table_data["columns"].append({
                    #         "column_name": column["column_name"],
                    #         "data_type": column["type"],
                    #         "description": "",
                    #         "suggested": ""
                    #     })
                    schema_data["tables"].append(table_data)
                db_data["schemas"].append(schema_data)
            data.append(db_data)
        return data


    @expose("/")
    def root(self) -> FlaskResponse:
        """ Assistant Home Page """
        return self.render_app_template()
    
     # Api to get the context data
    @expose("/context", methods=["GET"])
    @safe
    def context(self):
        """ Get the context data """
        databases = self.get_database_schema_table_columns()
        return self.json_response(databases)

   