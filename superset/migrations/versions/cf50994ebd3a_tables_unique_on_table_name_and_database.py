"""tables unique on table name and database

Revision ID: cf50994ebd3a
Revises: f959a6652acd
Create Date: 2017-11-16 12:36:52.492000

"""

# revision identifiers, used by Alembic.


revision = 'cf50994ebd3a'
down_revision = 'f959a6652acd'

from superset import db
from superset.utils import generic_find_constraint_name, table_has_constraint
import logging
from sqlalchemy.orm import sessionmaker


def upgrade():
    try:
        # wasn't created for sqlite in migrations b4456560d4f3, 3b626e2a6783
        if db.engine.url.get_dialect().name.lower() == 'sqlite':
            logging.info("_customer_location_uc does not exist; creating new table with constraint and copying data")

            Session = sessionmaker(bind=db.engine)
            session = Session()
            try:
                session.execute("ALTER TABLE tables RENAME TO temp_table")
                session.execute("""CREATE TABLE "tables" ( 
                                    created_on DATETIME NOT NULL, 
                                    changed_on DATETIME NOT NULL, 
                                    id INTEGER NOT NULL, 
                                    table_name VARCHAR(250), 
                                    main_dttm_col VARCHAR(250), 
                                    default_endpoint TEXT, 
                                    database_id INTEGER NOT NULL, 
                                    created_by_fk INTEGER, 
                                    changed_by_fk INTEGER, 
                                    "offset" INTEGER, 
                                    description TEXT, 
                                    is_featured BOOLEAN, 
                                    user_id INTEGER, 
                                    cache_timeout INTEGER, 
                                    schema VARCHAR(255), 
                                    sql TEXT, 
                                    params TEXT, 
                                    perm VARCHAR(1000), 
                                    filter_select_enabled BOOLEAN, 
                                    fetch_values_predicate VARCHAR(1000), 
                                    PRIMARY KEY (id), 
                                    CHECK (is_featured IN (0, 1)), 
                                    CONSTRAINT user_id FOREIGN KEY(user_id) REFERENCES ab_user (id), 
                                    FOREIGN KEY(changed_by_fk) REFERENCES ab_user (id), 
                                    FOREIGN KEY(database_id) REFERENCES dbs (id), 
                                    FOREIGN KEY(created_by_fk) REFERENCES ab_user (id), 
                                    CONSTRAINT _customer_location_uc UNIQUE (table_name, schema, database_id) )""")
                session.execute("""INSERT INTO tables 
                                    SELECT *
                                    FROM temp_table""")
                session.execute("DROP TABLE temp_table")

            except Exception as e:
                session.rollback()
                logging.warning(str(e))
    except Exception as e:
        logging.warning(str(e))

def downgrade():
    # Nothing to downgrade as db ought to be in this state already (which is the case for all DBs except sqlite)
    pass
