"""NOTE:  copied/adapted from SQLAlchemy master for backwards compatibility;
   this should be removable when Alembic targets SQLAlchemy 1.0.0
"""
from sqlalchemy.engine import url as sa_url
from sqlalchemy import text
from sqlalchemy import exc
from ..util import compat
from . import config, engines
from .compat import get_url_backend_name
import os
import time
import logging
log = logging.getLogger(__name__)

FOLLOWER_IDENT = None


class register(object):
    def __init__(self):
        self.fns = {}

    @classmethod
    def init(cls, fn):
        return register().for_db("*")(fn)

    def for_db(self, dbname):
        def decorate(fn):
            self.fns[dbname] = fn
            return self
        return decorate

    def __call__(self, cfg, *arg):
        if isinstance(cfg, compat.string_types):
            url = sa_url.make_url(cfg)
        elif isinstance(cfg, sa_url.URL):
            url = cfg
        else:
            url = cfg.db.url
        backend = get_url_backend_name(url)
        if backend in self.fns:
            return self.fns[backend](cfg, *arg)
        else:
            return self.fns['*'](cfg, *arg)


def create_follower_db(follower_ident):

    for cfg in _configs_for_db_operation():
        _create_db(cfg, cfg.db, follower_ident)


def configure_follower(follower_ident):
    for cfg in config.Config.all_configs():
        _configure_follower(cfg, follower_ident)


def setup_config(db_url, options, file_config, follower_ident):
    if follower_ident:
        db_url = _follower_url_from_main(db_url, follower_ident)
    db_opts = {}
    _update_db_opts(db_url, db_opts)
    eng = engines.testing_engine(db_url, db_opts)
    _post_configure_engine(db_url, eng, follower_ident)
    eng.connect().close()
    cfg = config.Config.register(eng, db_opts, options, file_config)
    if follower_ident:
        _configure_follower(cfg, follower_ident)
    return cfg


def drop_follower_db(follower_ident):
    for cfg in _configs_for_db_operation():
        _drop_db(cfg, cfg.db, follower_ident)


def _configs_for_db_operation():
    hosts = set()

    for cfg in config.Config.all_configs():
        cfg.db.dispose()

    for cfg in config.Config.all_configs():
        url = cfg.db.url
        backend = get_url_backend_name(url)
        host_conf = (
            backend,
            url.username, url.host, url.database)

        if host_conf not in hosts:
            yield cfg
            hosts.add(host_conf)

    for cfg in config.Config.all_configs():
        cfg.db.dispose()


@register.init
def _create_db(cfg, eng, ident):
    raise NotImplementedError("no DB creation routine for cfg: %s" % eng.url)


@register.init
def _drop_db(cfg, eng, ident):
    raise NotImplementedError("no DB drop routine for cfg: %s" % eng.url)


@register.init
def _update_db_opts(db_url, db_opts):
    pass


@register.init
def _configure_follower(cfg, ident):
    pass


@register.init
def _post_configure_engine(url, engine, follower_ident):
    pass


@register.init
def _follower_url_from_main(url, ident):
    url = sa_url.make_url(url)
    url.database = ident
    return url


@_update_db_opts.for_db("mssql")
def _mssql_update_db_opts(db_url, db_opts):
    db_opts['legacy_schema_aliasing'] = False


@_follower_url_from_main.for_db("sqlite")
def _sqlite_follower_url_from_main(url, ident):
    url = sa_url.make_url(url)
    if not url.database or url.database == ':memory:':
        return url
    else:
        return sa_url.make_url("sqlite:///%s.db" % ident)


@_post_configure_engine.for_db("sqlite")
def _sqlite_post_configure_engine(url, engine, follower_ident):
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def connect(dbapi_connection, connection_record):
        # use file DBs in all cases, memory acts kind of strangely
        # as an attached
        if not follower_ident:
            dbapi_connection.execute(
                'ATTACH DATABASE "test_schema.db" AS test_schema')
        else:
            dbapi_connection.execute(
                'ATTACH DATABASE "%s_test_schema.db" AS test_schema'
                % follower_ident)


@_create_db.for_db("postgresql")
def _pg_create_db(cfg, eng, ident):
    with eng.connect().execution_options(
            isolation_level="AUTOCOMMIT") as conn:
        try:
            _pg_drop_db(cfg, conn, ident)
        except Exception:
            pass
        currentdb = conn.scalar("select current_database()")
        for attempt in range(3):
            try:
                conn.execute(
                    "CREATE DATABASE %s TEMPLATE %s" % (ident, currentdb))
            except exc.OperationalError as err:
                if attempt != 2 and "accessed by other users" in str(err):
                    time.sleep(.2)
                    continue
                else:
                    raise
            else:
                break


@_create_db.for_db("mysql")
def _mysql_create_db(cfg, eng, ident):
    with eng.connect() as conn:
        try:
            _mysql_drop_db(cfg, conn, ident)
        except Exception:
            pass
        conn.execute("CREATE DATABASE %s" % ident)
        conn.execute("CREATE DATABASE %s_test_schema" % ident)
        conn.execute("CREATE DATABASE %s_test_schema_2" % ident)


@_configure_follower.for_db("mysql")
def _mysql_configure_follower(config, ident):
    config.test_schema = "%s_test_schema" % ident
    config.test_schema_2 = "%s_test_schema_2" % ident


@_create_db.for_db("sqlite")
def _sqlite_create_db(cfg, eng, ident):
    pass


@_drop_db.for_db("postgresql")
def _pg_drop_db(cfg, eng, ident):
    with eng.connect().execution_options(
            isolation_level="AUTOCOMMIT") as conn:
        conn.execute(
            text(
                "select pg_terminate_backend(pid) from pg_stat_activity "
                "where usename=current_user and pid != pg_backend_pid() "
                "and datname=:dname"
            ), dname=ident)
        conn.execute("DROP DATABASE %s" % ident)


@_drop_db.for_db("sqlite")
def _sqlite_drop_db(cfg, eng, ident):
    if ident:
        os.remove("%s_test_schema.db" % ident)
    else:
        os.remove("%s.db" % ident)


@_drop_db.for_db("mysql")
def _mysql_drop_db(cfg, eng, ident):
    with eng.connect() as conn:
        conn.execute("DROP DATABASE %s_test_schema" % ident)
        conn.execute("DROP DATABASE %s_test_schema_2" % ident)
        conn.execute("DROP DATABASE %s" % ident)


@_create_db.for_db("oracle")
def _oracle_create_db(cfg, eng, ident):
    # NOTE: make sure you've run "ALTER DATABASE default tablespace users" or
    # similar, so that the default tablespace is not "system"; reflection will
    # fail otherwise
    with eng.connect() as conn:
        conn.execute("create user %s identified by xe" % ident)
        conn.execute("create user %s_ts1 identified by xe" % ident)
        conn.execute("create user %s_ts2 identified by xe" % ident)
        conn.execute("grant dba to %s" % (ident, ))
        conn.execute("grant unlimited tablespace to %s" % ident)
        conn.execute("grant unlimited tablespace to %s_ts1" % ident)
        conn.execute("grant unlimited tablespace to %s_ts2" % ident)

@_configure_follower.for_db("oracle")
def _oracle_configure_follower(config, ident):
    config.test_schema = "%s_ts1" % ident
    config.test_schema_2 = "%s_ts2" % ident


def _ora_drop_ignore(conn, dbname):
    try:
        conn.execute("drop user %s cascade" % dbname)
        log.info("Reaped db: %s" % dbname)
        return True
    except exc.DatabaseError as err:
        log.warn("couldn't drop db: %s" % err)
        return False


@_drop_db.for_db("oracle")
def _oracle_drop_db(cfg, eng, ident):
    with eng.connect() as conn:
        # cx_Oracle seems to occasionally leak open connections when a large
        # suite it run, even if we confirm we have zero references to
        # connection objects.
        # while there is a "kill session" command in Oracle,
        # it unfortunately does not release the connection sufficiently.
        _ora_drop_ignore(conn, ident)
        _ora_drop_ignore(conn, "%s_ts1" % ident)
        _ora_drop_ignore(conn, "%s_ts2" % ident)


def reap_oracle_dbs(eng, idents_file):
    log.info("Reaping Oracle dbs...")
    with eng.connect() as conn:
        with open(idents_file) as file_:
            idents = set(line.strip() for line in file_)

        log.info("identifiers in file: %s", ", ".join(idents))

        to_reap = conn.execute(
            "select u.username from all_users u where username "
            "like 'TEST_%' and not exists (select username "
            "from v$session where username=u.username)")
        all_names = set([username.lower() for (username, ) in to_reap])
        to_drop = set()
        for name in all_names:
            if name.endswith("_ts1") or name.endswith("_ts2"):
                continue
            elif name in idents:
                to_drop.add(name)
                if "%s_ts1" % name in all_names:
                    to_drop.add("%s_ts1" % name)
                if "%s_ts2" % name in all_names:
                    to_drop.add("%s_ts2" % name)

        dropped = total = 0
        for total, username in enumerate(to_drop, 1):
            if _ora_drop_ignore(conn, username):
                dropped += 1
        log.info(
            "Dropped %d out of %d stale databases detected", dropped, total)


@_follower_url_from_main.for_db("oracle")
def _oracle_follower_url_from_main(url, ident):
    url = sa_url.make_url(url)
    url.username = ident
    url.password = 'xe'
    return url


