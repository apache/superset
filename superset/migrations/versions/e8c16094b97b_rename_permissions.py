"""Renames permissions

Revision ID: e8c16094b97b
Revises: db527d8c4c78
Create Date: 2017-03-20 10:07:20.926604

"""

# revision identifiers, used by Alembic.
revision = 'e8c16094b97b'
down_revision = 'db527d8c4c78'

import logging
import sqlalchemy as sa

from alembic import op
from superset import db
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import backref, relationship, sessionmaker
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Sequence)

Base = declarative_base()


class Database(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'dbs'
    type = "table"
    id = Column(Integer, primary_key=True)
    database_name = Column(String(250), unique=True)
    perm = Column(String(1000))

    def get_perm(self):
        return '{}.{}'.format(self.type, self.database_name)

    def get_old_perm(self):
        return "[{obj.database_name}].(id:{obj.id})".format(obj=self)


class DruidCluster(Base):
    __tablename__ = 'clusters'
    type = "druid"
    id = Column(Integer, primary_key=True)
    cluster_name = Column(String(250), unique=True)
    perm = Column(String(1000))

    def get_perm(self):
        return '{}.{}'.format(self.type, self.cluster_name)

    def get_old_perm(self):
        return "[{obj.cluster_name}].(id:{obj.id})".format(obj=self)


class SqlaTable(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'tables'
    type = "table"
    id = Column(Integer, primary_key=True)
    table_name = Column(String(250))
    schema = Column(String(255))
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    database = relationship(
        'Database',
        backref=backref('tables', cascade='all, delete-orphan'),
        foreign_keys=[database_id])
    perm = Column(String(1000))

    def get_perm(self):
        return "{}.{}".format(self.database.perm, self.name)

    def get_old_perm(self):
        return "[{obj.database}].[{obj.table_name}](id:{obj.id})".format(
            obj=self)

    def get_schema_perm(self):
        """Returns schema permission if present, database one otherwise."""
        if self.schema:
            return "{}.{}".format(self.database.perm, self.schema)

    def get_old_schema_perm(self):
        """Returns schema permission if present, database one otherwise."""
        if self.schema:
            return "[{}].[{}]".format(self.database, self.schema)


class DruidDatasource(Base):
    """Declarative class to do query in upgrade"""
    type = "druid"
    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    datasource_name = Column(String(255), unique=True)
    cluster_name = Column(
        String(250), ForeignKey('clusters.cluster_name'))
    cluster = relationship(
        'DruidCluster', backref='datasources', foreign_keys=[cluster_name])
    perm = Column(String(1000))

    def get_perm(self):
        return "{}.{}".format(self.cluster.perm, self.name)

    def get_old_perm(self):
        return (
            "[{obj.cluster_name}].[{obj.datasource_name}](id:{obj.id})".format(
                obj=self))


class ViewMenu(Base):
    __tablename__ = 'ab_view_menu'
    id = Column(Integer, Sequence('ab_view_menu_id_seq'), primary_key=True)
    name = Column(String(100), unique=True, nullable=False)


class PermissionView(Base):
    __tablename__ = 'ab_permission_view'
    id = Column(Integer, Sequence('ab_permission_view_id_seq'),
                primary_key=True)
    view_menu_id = Column(Integer, ForeignKey('ab_view_menu.id'))
    view_menu = relationship("ViewMenu")


def update_perms(
        obj_class,
        old_perm_attr='perm',
        new_perm_attr='get_perm',
        db_attr='perm',
        ):
    session = db.session
    for obj in session.query(obj_class).all():
        old_perm = getattr(obj, old_perm_attr)
        logging.info('renaming {} permission'.format(old_perm))
        old_view_menu = session.query(ViewMenu).filter_by(name=old_perm).first()
        new_perm = getattr(obj, new_perm_attr)
        if old_view_menu:
            new_view_menu = session.query(ViewMenu).filter_by(
                name=new_perm).first()
            if new_view_menu:
                # View menu already exists, attach permission view menues to the
                # found view menu. Impossible to reverse.
                pvms = session.query(PermissionView).filter_by(
                    view_menu_id=old_view_menu.id).all()
                for pvm in pvms:
                    pvm.view_menu_id = new_view_menu.id
                session.commit()
            else:
                # Rename the view menu name
                old_view_menu.name = new_perm
                session.commit()
        # Persist update perm value.
        if db_attr:
            setattr(obj, db_attr, new_perm)
            session.commit()
    session.commit()


def downgrade_perms(
        obj_class,
        old_perm_attr='get_old_perm',
        new_perm_attr='get_perm',
        db_attr='perm',
        ):
    session = db.session
    for obj in session.query(obj_class).all():
        new_perm = getattr(obj, new_perm_attr)
        new_view_menu = session.query(ViewMenu).filter_by(name=new_perm).one()

        old_perm = getattr(obj, old_perm_attr)
        old_view_menu = session.query(ViewMenu).filter_by(
            name=old_perm).first()

        # Should not exist.
        if old_view_menu:
            # View menu already exists, attach permission view menues to the
            # found view menu. Impossible to reverse.
            pvms = session.query(PermissionView).filter_by(
                view_menu_id=new_perm.id).all()
            for pvm in pvms:
                pvm.view_menu_id = old_view_menu.id
            session.flush()
        else:
            # Rename the view menu name
            new_view_menu.name = old_perm
            session.flush()

        # Persist update perm value if not processing schema.
        if db_attr:
            setattr(obj, db_attr, new_perm)
            session.flush()
    session.commit()


def upgrade():
    op.add_column('clusters', sa.Column('perm', sa.Text(), nullable=True))
    bind = op.get_bind()
    Session = sessionmaker()
    session = Session(bind=bind)
    session.commit()

    update_perms(Database)
    update_perms(SqlaTable)
    update_perms(
        SqlaTable, old_perm_attr='get_old_schema_perm',
        new_perm_attr='get_schema_perm', db_attr=None,
    )

    update_perms(DruidCluster)
    update_perms(DruidDatasource)


def downgrade():
    downgrade_perms(Database)
    downgrade_perms(SqlaTable)
    downgrade_perms(
        SqlaTable, old_perm_attr='get_old_schema_perm',
        new_perm_attr='get_schema_perm', db_attr=None,
    )
    downgrade_perms(DruidCluster)
    downgrade_perms(DruidDatasource)
    op.drop_column('clusters', 'perm')

