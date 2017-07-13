import collections
import itertools
import os
from copy import copy

import sqlalchemy as sa
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import OperationalError, ProgrammingError

from ..expressions import explain_analyze
from ..utils import starts_with
from .orm import quote


class PlanAnalysis(object):
    def __init__(self, plan):
        self.plan = plan

    @property
    def node_types(self):
        types = [self.plan['Node Type']]
        if 'Plans' in self.plan:
            for plan in self.plan['Plans']:
                analysis = PlanAnalysis(plan)
                types.extend(analysis.node_types)
        return types


class QueryAnalysis(object):
    def __init__(self, result_set):
        self.plan = result_set[0]['Plan']
        if 'Total Runtime' in result_set[0]:
            # PostgreSQL versions < 9.4
            self.runtime = result_set[0]['Total Runtime']
        else:
            # PostgreSQL versions >= 9.4
            self.runtime = (
                result_set[0]['Execution Time'] +
                result_set[0]['Planning Time']
            )

    @property
    def node_types(self):
        return list(PlanAnalysis(self.plan).node_types)

    def __repr__(self):
        return '<QueryAnalysis runtime=%r>' % self.runtime


def analyze(conn, query):
    """
    Analyze query using given connection and return :class:`QueryAnalysis`
    object. Analysis is performed using database specific EXPLAIN ANALYZE
    construct and then examining the results into structured format. Currently
    only PostgreSQL is supported.


    Getting query runtime (in database level) ::


        from sqlalchemy_utils import analyze


        analysis = analyze(conn, 'SELECT * FROM article')
        analysis.runtime  # runtime as milliseconds


    Analyze can be very useful when testing that query doesn't issue a
    sequential scan (scanning all rows in table). You can for example write
    simple performance tests this way.::


        query = (
            session.query(Article.name)
            .order_by(Article.name)
            .limit(10)
        )
        analysis = analyze(self.connection, query)
        analysis.node_types  # [u'Limit', u'Index Only Scan']

        assert 'Seq Scan' not in analysis.node_types


    .. versionadded: 0.26.17

    :param conn: SQLAlchemy Connection object
    :param query: SQLAlchemy Query object or query as a string
    """
    return QueryAnalysis(
        conn.execute(
            explain_analyze(query, buffers=True, format='json')
        ).scalar()
    )


def escape_like(string, escape_char='*'):
    """
    Escape the string paremeter used in SQL LIKE expressions.

    ::

        from sqlalchemy_utils import escape_like


        query = session.query(User).filter(
            User.name.ilike(escape_like('John'))
        )


    :param string: a string to escape
    :param escape_char: escape character
    """
    return (
        string
        .replace(escape_char, escape_char * 2)
        .replace('%', escape_char + '%')
        .replace('_', escape_char + '_')
    )


def json_sql(value, scalars_to_json=True):
    """
    Convert python data structures to PostgreSQL specific SQLAlchemy JSON
    constructs. This function is extremly useful if you need to build
    PostgreSQL JSON on python side.

    .. note::

        This function needs PostgreSQL >= 9.4

    Scalars are converted to to_json SQLAlchemy function objects

    ::

        json_sql(1)     # Equals SQL: to_json(1)

        json_sql('a')   # to_json('a')


    Mappings are converted to json_build_object constructs

    ::

        json_sql({'a': 'c', '2': 5})  # json_build_object('a', 'c', '2', 5)


    Sequences (other than strings) are converted to json_build_array constructs

    ::

        json_sql([1, 2, 3])  # json_build_array(1, 2, 3)


    You can also nest these data structures

    ::

        json_sql({'a': [1, 2, 3]})
        # json_build_object('a', json_build_array[1, 2, 3])


    :param value:
        value to be converted to SQLAlchemy PostgreSQL function constructs
    """
    scalar_convert = sa.text
    if scalars_to_json:
        def scalar_convert(a):
            return sa.func.to_json(sa.text(a))

    if isinstance(value, collections.Mapping):
        return sa.func.json_build_object(
            *(
                json_sql(v, scalars_to_json=False)
                for v in itertools.chain(*value.items())
            )
        )
    elif isinstance(value, str):
        return scalar_convert("'{0}'".format(value))
    elif isinstance(value, collections.Sequence):
        return sa.func.json_build_array(
            *(
                json_sql(v, scalars_to_json=False)
                for v in value
            )
        )
    elif isinstance(value, (int, float)):
        return scalar_convert(str(value))
    return value


def has_index(column_or_constraint):
    """
    Return whether or not given column or the columns of given foreign key
    constraint have an index. A column has an index if it has a single column
    index or it is the first column in compound column index.

    A foreign key constraint has an index if the constraint columns are the
    first columns in compound column index.

    :param column_or_constraint:
        SQLAlchemy Column object or SA ForeignKeyConstraint object

    .. versionadded: 0.26.2

    .. versionchanged: 0.30.18
        Added support for foreign key constaints.

    ::

        from sqlalchemy_utils import has_index


        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            title = sa.Column(sa.String(100))
            is_published = sa.Column(sa.Boolean, index=True)
            is_deleted = sa.Column(sa.Boolean)
            is_archived = sa.Column(sa.Boolean)

            __table_args__ = (
                sa.Index('my_index', is_deleted, is_archived),
            )


        table = Article.__table__

        has_index(table.c.is_published) # True
        has_index(table.c.is_deleted)   # True
        has_index(table.c.is_archived)  # False


    Also supports primary key indexes

    ::

        from sqlalchemy_utils import has_index


        class ArticleTranslation(Base):
            __tablename__ = 'article_translation'
            id = sa.Column(sa.Integer, primary_key=True)
            locale = sa.Column(sa.String(10), primary_key=True)
            title = sa.Column(sa.String(100))


        table = ArticleTranslation.__table__

        has_index(table.c.locale)   # False
        has_index(table.c.id)       # True


    This function supports foreign key constraints as well

    ::


        class User(Base):
            __tablename__ = 'user'
            first_name = sa.Column(sa.Unicode(255), primary_key=True)
            last_name = sa.Column(sa.Unicode(255), primary_key=True)

        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            author_first_name = sa.Column(sa.Unicode(255))
            author_last_name = sa.Column(sa.Unicode(255))
            __table_args__ = (
                sa.ForeignKeyConstraint(
                    [author_first_name, author_last_name],
                    [User.first_name, User.last_name]
                ),
                sa.Index(
                    'my_index',
                    author_first_name,
                    author_last_name
                )
            )

        table = Article.__table__
        constraint = list(table.foreign_keys)[0].constraint

        has_index(constraint)  # True
    """
    table = column_or_constraint.table
    if not isinstance(table, sa.Table):
        raise TypeError(
            'Only columns belonging to Table objects are supported. Given '
            'column belongs to %r.' % table
        )
    primary_keys = table.primary_key.columns.values()
    if isinstance(column_or_constraint, sa.ForeignKeyConstraint):
        columns = list(column_or_constraint.columns.values())
    else:
        columns = [column_or_constraint]

    return (
        (primary_keys and starts_with(primary_keys, columns)) or
        any(
            starts_with(index.columns.values(), columns)
            for index in table.indexes
        )
    )


def has_unique_index(column_or_constraint):
    """
    Return whether or not given column or given foreign key constraint has a
    unique index.

    A column has a unique index if it has a single column primary key index or
    it has a single column UniqueConstraint.

    A foreign key constraint has a unique index if the columns of the
    constraint are the same as the columns of table primary key or the coluns
    of any unique index or any unique constraint of the given table.

    :param column: SQLAlchemy Column object

    .. versionadded: 0.27.1

    .. versionchanged: 0.30.18
        Added support for foreign key constaints.

        Fixed support for unique indexes (previously only worked for unique
        constraints)

    ::

        from sqlalchemy_utils import has_unique_index


        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            title = sa.Column(sa.String(100))
            is_published = sa.Column(sa.Boolean, unique=True)
            is_deleted = sa.Column(sa.Boolean)
            is_archived = sa.Column(sa.Boolean)


        table = Article.__table__

        has_unique_index(table.c.is_published) # True
        has_unique_index(table.c.is_deleted)   # False
        has_unique_index(table.c.id)           # True


    This function supports foreign key constraints as well

    ::


        class User(Base):
            __tablename__ = 'user'
            first_name = sa.Column(sa.Unicode(255), primary_key=True)
            last_name = sa.Column(sa.Unicode(255), primary_key=True)

        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            author_first_name = sa.Column(sa.Unicode(255))
            author_last_name = sa.Column(sa.Unicode(255))
            __table_args__ = (
                sa.ForeignKeyConstraint(
                    [author_first_name, author_last_name],
                    [User.first_name, User.last_name]
                ),
                sa.Index(
                    'my_index',
                    author_first_name,
                    author_last_name,
                    unique=True
                )
            )

        table = Article.__table__
        constraint = list(table.foreign_keys)[0].constraint

        has_unique_index(constraint)  # True


    :raises TypeError: if given column does not belong to a Table object
    """
    table = column_or_constraint.table
    if not isinstance(table, sa.Table):
        raise TypeError(
            'Only columns belonging to Table objects are supported. Given '
            'column belongs to %r.' % table
        )
    primary_keys = list(table.primary_key.columns.values())
    if isinstance(column_or_constraint, sa.ForeignKeyConstraint):
        columns = list(column_or_constraint.columns.values())
    else:
        columns = [column_or_constraint]

    return (
        (columns == primary_keys) or
        any(
            columns == list(constraint.columns.values())
            for constraint in table.constraints
            if isinstance(constraint, sa.sql.schema.UniqueConstraint)
        ) or
        any(
            columns == list(index.columns.values())
            for index in table.indexes
            if index.unique
        )
    )


def is_auto_assigned_date_column(column):
    """
    Returns whether or not given SQLAlchemy Column object's is auto assigned
    DateTime or Date.

    :param column: SQLAlchemy Column object
    """
    return (
        (
            isinstance(column.type, sa.DateTime) or
            isinstance(column.type, sa.Date)
        ) and
        (
            column.default or
            column.server_default or
            column.onupdate or
            column.server_onupdate
        )
    )


def database_exists(url):
    """Check if a database exists.

    :param url: A SQLAlchemy engine URL.

    Performs backend-specific testing to quickly determine if a database
    exists on the server. ::

        database_exists('postgres://postgres@localhost/name')  #=> False
        create_database('postgres://postgres@localhost/name')
        database_exists('postgres://postgres@localhost/name')  #=> True

    Supports checking against a constructed URL as well. ::

        engine = create_engine('postgres://postgres@localhost/name')
        database_exists(engine.url)  #=> False
        create_database(engine.url)
        database_exists(engine.url)  #=> True

    """

    url = copy(make_url(url))
    database = url.database
    if url.drivername.startswith('postgresql'):
        url.database = 'template1'
    else:
        url.database = None

    engine = sa.create_engine(url)

    if engine.dialect.name == 'postgresql':
        text = "SELECT 1 FROM pg_database WHERE datname='%s'" % database
        return bool(engine.execute(text).scalar())

    elif engine.dialect.name == 'mysql':
        text = ("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA "
                "WHERE SCHEMA_NAME = '%s'" % database)
        return bool(engine.execute(text).scalar())

    elif engine.dialect.name == 'sqlite':
        if database:
            return database == ':memory:' or os.path.exists(database)
        else:
            # The default SQLAlchemy database is in memory,
            # and :memory is not required, thus we should support that use-case
            return True

    else:
        text = 'SELECT 1'
        try:
            url.database = database
            engine = sa.create_engine(url)
            engine.execute(text)
            return True

        except (ProgrammingError, OperationalError):
            return False


def create_database(url, encoding='utf8', template=None):
    """Issue the appropriate CREATE DATABASE statement.

    :param url: A SQLAlchemy engine URL.
    :param encoding: The encoding to create the database as.
    :param template:
        The name of the template from which to create the new database. At the
        moment only supported by PostgreSQL driver.

    To create a database, you can pass a simple URL that would have
    been passed to ``create_engine``. ::

        create_database('postgres://postgres@localhost/name')

    You may also pass the url from an existing engine. ::

        create_database(engine.url)

    Has full support for mysql, postgres, and sqlite. In theory,
    other database engines should be supported.
    """

    url = copy(make_url(url))

    database = url.database

    if url.drivername.startswith('postgresql'):
        url.database = 'template1'
    elif not url.drivername.startswith('sqlite'):
        url.database = None

    engine = sa.create_engine(url)

    if engine.dialect.name == 'postgresql':
        if engine.driver == 'psycopg2':
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
            engine.raw_connection().set_isolation_level(
                ISOLATION_LEVEL_AUTOCOMMIT
            )

        if not template:
            template = 'template0'

        text = "CREATE DATABASE {0} ENCODING '{1}' TEMPLATE {2}".format(
            quote(engine, database),
            encoding,
            quote(engine, template)
        )
        engine.execute(text)

    elif engine.dialect.name == 'mysql':
        text = "CREATE DATABASE {0} CHARACTER SET = '{1}'".format(
            quote(engine, database),
            encoding
        )
        engine.execute(text)

    elif engine.dialect.name == 'sqlite' and database != ':memory:':
        if database:
            open(database, 'w').close()

    else:
        text = 'CREATE DATABASE {0}'.format(quote(engine, database))
        engine.execute(text)


def drop_database(url):
    """Issue the appropriate DROP DATABASE statement.

    :param url: A SQLAlchemy engine URL.

    Works similar to the :ref:`create_database` method in that both url text
    and a constructed url are accepted. ::

        drop_database('postgres://postgres@localhost/name')
        drop_database(engine.url)

    """

    url = copy(make_url(url))

    database = url.database

    if url.drivername.startswith('postgresql'):
        url.database = 'template1'
    elif not url.drivername.startswith('sqlite'):
        url.database = None

    engine = sa.create_engine(url)

    if engine.dialect.name == 'sqlite' and database != ':memory:':
        if database:
            os.remove(database)

    elif engine.dialect.name == 'postgresql' and engine.driver == 'psycopg2':
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

        connection = engine.connect()
        connection.connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

        # Disconnect all users from the database we are dropping.
        version = connection.dialect.server_version_info
        pid_column = (
            'pid' if (version >= (9, 2)) else 'procpid'
        )
        text = '''
        SELECT pg_terminate_backend(pg_stat_activity.%(pid_column)s)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '%(database)s'
          AND %(pid_column)s <> pg_backend_pid();
        ''' % {'pid_column': pid_column, 'database': database}
        connection.execute(text)

        # Drop the database.
        text = 'DROP DATABASE {0}'.format(quote(connection, database))
        connection.execute(text)
    else:
        text = 'DROP DATABASE {0}'.format(quote(engine, database))
        engine.execute(text)
