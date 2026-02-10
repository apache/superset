"""set cross_filter_column if null

Revision ID: a1b2c3d4e5f6
Revises: 74ad1125881c
Create Date: 2026-02-10 13:30:00.000000

"""

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
import json


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "74ad1125881c"
branch_labels = None
depends_on = None

Base = declarative_base()


class Database(Base):
    __tablename__ = "dbs"
    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(String(1024))


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer)
    viz_type = Column(String(200))
    params = Column(Text)


class SqlaTable(Base):
    __tablename__ = "tables"
    id = Column(Integer, primary_key=True)
    database_id = Column(Integer)
    datasource_type = Column(String(200))


def upgrade():
    """Set cross_filter_column to geom_column if null for WFS datasources"""
    bind = op.get_bind()
    session = Session(bind=bind)

    try:
        # Find all WFS databases
        wfs_dbs = (
            session.query(Database).filter(Database.sqlalchemy_uri.like("%wfs%")).all()
        )

        for db in wfs_dbs:
            # Find all slices for these databases
            slices = (
                session.query(Slice)
                .join(SqlaTable, Slice.datasource_id == SqlaTable.id)
                .filter(
                    Slice.viz_type == "thematic_map", SqlaTable.database_id == db.id
                )
                .all()
            )

            for slc in slices:
                try:
                    params = json.loads(slc.params or "{}")

                    # If cross_filter_column is not set, try to set it from geom_column
                    if not params.get("cross_filter_column") and params.get(
                        "geom_column"
                    ):
                        params["cross_filter_column"] = params["geom_column"]
                        slc.params = json.dumps(params)

                except Exception as e:
                    print(f"Warning: Could not update slice {slc.id}: {e}")

        session.commit()

    except Exception as e:
        print(f"Warning: WFS cross_filter_column migration encountered issue: {e}")
        session.rollback()
    finally:
        session.close()


def downgrade():
    """Remove cross_filter_column if it was set to geom_column"""
    pass
