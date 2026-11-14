from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.db_engine_specs.postgres import PostgresEngineSpec

class MaterializeEngineSpec(PostgresEngineSpec):
    engine = "postgresql"
    engine_name = "Materialize"
    default_driver = "psycopg2"
    metadata = {
        # Required fields
        "description": "A brief description of the database.",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["psycopg2"],
        "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}",

        # Recommended fields
        "logo": "materialize.svg",  # Logo file in docs/static/img/databases/
        "homepage_url": "https://materialize.com/",
        "default_port": 6875,
    }