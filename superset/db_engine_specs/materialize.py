from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.db_engine_specs.postgres import PostgresEngineSpec

class MaterializeEngineSpec(PostgresEngineSpec):
    engine = "materialize"
    engine_name = "Materialize"
    
    default_driver = "psycopg2"
    
    # TODO: Fix the URI after making the dialect, also for connection_string
    sqlalchemy_uri_placeholder = (
        "materialize+psycopg2://username:password@host:port/database"
    )
    
    metadata = {
        # Required fields
        "description": "A brief description of the database.",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        # TODO: Add package name for SQLAlchemy dialect after making it
        "pypi_packages": ["psycopg2", "sqlalchemy-materialize"],
        "connection_string": 
            "materialize+psycopg2://{username}:{password}@{host}:{port}/{database}",

        # Recommended fields
        "logo": "materialize.svg",  # TODO: Logo file in docs/static/img/databases/
        "homepage_url": "https://materialize.com/",
        "default_port": 6875,
    }
    
    
    # NOTES: 
    # - Time grains inherited from Postgres work. Tested in Materialize Console.
    # - TODO: Test in SQLLab once pg_catalog.pg_opclass thingy is fixed
    # I think I fixed pg_opclass in the dialect, but there's more to fix
    # e.g. afaik, foreign key is not supported in Materialize.
    # and theres like get_foreign_key() function or similar in the dialect.