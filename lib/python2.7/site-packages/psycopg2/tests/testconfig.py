# Configure the test suite from the env variables.

import os

dbname = os.environ.get('PSYCOPG2_TESTDB', 'psycopg2_test')
dbhost = os.environ.get('PSYCOPG2_TESTDB_HOST', None)
dbport = os.environ.get('PSYCOPG2_TESTDB_PORT', None)
dbuser = os.environ.get('PSYCOPG2_TESTDB_USER', None)
dbpass = os.environ.get('PSYCOPG2_TESTDB_PASSWORD', None)

# Check if we want to test psycopg's green path.
green = os.environ.get('PSYCOPG2_TEST_GREEN', None)
if green:
    if green == '1':
        from psycopg2.extras import wait_select as wait_callback
    elif green == 'eventlet':
        from eventlet.support.psycopg2_patcher import eventlet_wait_callback \
            as wait_callback
    else:
        raise ValueError("please set 'PSYCOPG2_TEST_GREEN' to a valid value")

    import psycopg2.extensions
    psycopg2.extensions.set_wait_callback(wait_callback)

# Construct a DSN to connect to the test database:
dsn = 'dbname=%s' % dbname
if dbhost is not None:
    dsn += ' host=%s' % dbhost
if dbport is not None:
    dsn += ' port=%s' % dbport
if dbuser is not None:
    dsn += ' user=%s' % dbuser
if dbpass is not None:
    dsn += ' password=%s' % dbpass

# Don't run replication tests if REPL_DSN is not set, default to normal DSN if
# set to empty string.
repl_dsn = os.environ.get('PSYCOPG2_TEST_REPL_DSN', None)
if repl_dsn == '':
    repl_dsn = dsn

repl_slot = os.environ.get('PSYCOPG2_TEST_REPL_SLOT', 'psycopg2_test_slot')
