"""remove double percents

Revision ID: 4451805bbaa1
Revises: afb7730f6a9c
Create Date: 2018-06-13 10:20:35.846744

"""

# revision identifiers, used by Alembic.
revision = '4451805bbaa1'
down_revision = 'bddc498dd179'


from alembic import op
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, create_engine, ForeignKey, Integer, String, Text

from superset import db

Base = declarative_base()


class Slice(Base):
    __tablename__ = 'slices'

    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer, ForeignKey('tables.id'))
    datasource_type = Column(String(200))
    params = Column(Text)


class Table(Base):
    __tablename__ = 'tables'

    id = Column(Integer, primary_key=True)
    database_id = Column(Integer, ForeignKey('dbs.id'))


class Database(Base):
    __tablename__ = 'dbs'

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(String(1024))


def replace(source, target):
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = (
        session.query(Slice, Database)
        .join(Table)
        .join(Database)
        .filter(Slice.datasource_type == 'table')
        .all()
    )

    for slc, database in query:
        try:
            engine = create_engine(database.sqlalchemy_uri)

            if engine.dialect.identifier_preparer._double_percents:
                params = json.loads(slc.params)

                if 'adhoc_filters' in params:
                    for filt in params['adhoc_filters']:
                        if 'sqlExpression' in filt:
                            filt['sqlExpression'] = (
                                filt['sqlExpression'].replace(source, target)
                            )

                    slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


def upgrade():
    replace('%%', '%')


def downgrade():
    replace('%', '%%')
