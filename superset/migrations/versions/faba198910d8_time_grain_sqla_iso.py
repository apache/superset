"""Time grain SQLA iso

Revision ID: faba198910d8
Revises: c18bd4186f15
Create Date: 2018-07-25 18:32:15.101217

"""

# revision identifiers, used by Alembic.
revision = 'faba198910d8'
down_revision = 'c18bd4186f15'

from alembic import op
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.engine.url import make_url

from superset import db, db_engine_specs, utils

Base = declarative_base()


class Database(Base):
    __tablename__ = 'dbs'

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(Text)

    def grains(self):
        url = make_url(self.sqlalchemy_uri)
        backend = url.get_backend_name()
        db_engine_spec = db_engine_specs.engines.get(
            backend, db_engine_specs.BaseEngineSpec)
        return db_engine_spec.time_grains


class Table(Base):
    __tablename__ = 'tables'

    id = Column(Integer, primary_key=True)
    database_id = Column(Integer, ForeignKey('dbs.id'))


class Slice(Base):
    __tablename__ = 'slices'

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    datasource_type = Column(Text)
    datasource_id = Column(Integer)


@utils.memoized
def name_to_duration(time_grains):
    return {grain.name: grain.duration for grain in time_grains}


@utils.memoized
def duration_to_name(time_grains):
    return {grain.duration: grain.name for grain in time_grains}


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = (
        session
        .query(Slice, Database)
        .filter(Slice.datasource_type == 'table')
        .filter(Slice.datasource_id == Table.id)
        .filter(Table.database_id == Database.id)
        .all()
    )

    for slc, database in query:
        try:
            params = json.loads(slc.params)
            duration_dict = name_to_duration(database.grains())
            granularity = params.get('time_grain_sqla')
            if granularity in duration_dict:
                params['time_grain_sqla'] = duration_dict.get(granularity)
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = (
        session
        .query(Slice, Database)
        .filter(Slice.datasource_type == 'table')
        .filter(Slice.datasource_id == Table.id)
        .filter(Table.database_id == Database.id)
        .all()
    )

    for slc, database in query:
        try:
            params = json.loads(slc.params)
            duration_dict = duration_to_name(database.grains())
            granularity = params.get('time_grain_sqla')
            if granularity in duration_dict:
                params['time_grain_sqla'] = duration_dict.get(granularity)
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()
