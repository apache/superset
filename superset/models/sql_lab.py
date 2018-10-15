# pylint: disable=C,R,W
"""A collection of ORM sqlalchemy models for SQL Lab"""
from datetime import datetime
import re

from flask import Markup
from flask_appbuilder import Model
from future.standard_library import install_aliases
import sqlalchemy as sqla
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text,
)
from sqlalchemy.orm import backref, relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable
from superset.utils import QueryStatus, user_label

install_aliases()


class Query(Model):
    """ORM model for SQL query"""

    __tablename__ = 'query'
    id = Column(Integer, primary_key=True)
    client_id = Column(String(11), unique=True, nullable=False)

    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)

    # Store the tmp table into the DB only if the user asks for it.
    tmp_table_name = Column(String(256))
    user_id = Column(Integer, ForeignKey('ab_user.id'), nullable=True)
    status = Column(String(16), default=QueryStatus.PENDING)
    tab_name = Column(String(256))
    sql_editor_id = Column(String(256))
    schema = Column(String(256))
    sql = Column(Text)
    # Query to retrieve the results,
    # used only in case of select_as_cta_used is true.
    select_sql = Column(Text)
    executed_sql = Column(Text)
    # Could be configured in the superset config.
    limit = Column(Integer)
    limit_used = Column(Boolean, default=False)
    select_as_cta = Column(Boolean)
    select_as_cta_used = Column(Boolean, default=False)

    progress = Column(Integer, default=0)  # 1..100
    # # of rows in the result set or rows modified.
    rows = Column(Integer)
    error_message = Column(Text)
    # key used to store the results in the results backend
    results_key = Column(String(64), index=True)

    # Using Numeric in place of DateTime for sub-second precision
    # stored as seconds since epoch, allowing for milliseconds
    start_time = Column(Numeric(precision=20, scale=6))
    start_running_time = Column(Numeric(precision=20, scale=6))
    end_time = Column(Numeric(precision=20, scale=6))
    end_result_backend_time = Column(Numeric(precision=20, scale=6))
    tracking_url = Column(Text)

    changed_on = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=True)

    database = relationship(
        'Database',
        foreign_keys=[database_id],
        backref=backref('queries', cascade='all, delete-orphan'))
    user = relationship(security_manager.user_model, foreign_keys=[user_id])

    __table_args__ = (
        sqla.Index('ti_user_id_changed_on', user_id, changed_on),
    )

    @property
    def limit_reached(self):
        return self.rows == self.limit if self.limit_used else False

    def to_dict(self):
        return {
            'changedOn': self.changed_on,
            'changed_on': self.changed_on.isoformat(),
            'dbId': self.database_id,
            'db': self.database.database_name,
            'endDttm': self.end_time,
            'errorMessage': self.error_message,
            'executedSql': self.executed_sql,
            'id': self.client_id,
            'limit': self.limit,
            'progress': self.progress,
            'rows': self.rows,
            'schema': self.schema,
            'ctas': self.select_as_cta,
            'serverId': self.id,
            'sql': self.sql,
            'sqlEditorId': self.sql_editor_id,
            'startDttm': self.start_time,
            'state': self.status.lower(),
            'tab': self.tab_name,
            'tempTable': self.tmp_table_name,
            'userId': self.user_id,
            'user': user_label(self.user),
            'limit_reached': self.limit_reached,
            'resultsKey': self.results_key,
            'trackingUrl': self.tracking_url,
        }

    @property
    def name(self):
        """Name property"""
        ts = datetime.now().isoformat()
        ts = ts.replace('-', '').replace(':', '').split('.')[0]
        tab = (self.tab_name.replace(' ', '_').lower()
               if self.tab_name else 'notab')
        tab = re.sub(r'\W+', '', tab)
        return 'sqllab_{tab}_{ts}'.format(**locals())


class SavedQuery(Model, AuditMixinNullable):
    """ORM model for SQL query"""

    __tablename__ = 'saved_query'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'), nullable=True)
    db_id = Column(Integer, ForeignKey('dbs.id'), nullable=True)
    schema = Column(String(128))
    label = Column(String(256))
    description = Column(Text)
    sql = Column(Text)
    user = relationship(
        security_manager.user_model,
        backref=backref('saved_queries', cascade='all, delete-orphan'),
        foreign_keys=[user_id])
    database = relationship(
        'Database',
        foreign_keys=[db_id],
        backref=backref('saved_queries', cascade='all, delete-orphan'))

    @property
    def pop_tab_link(self):
        return Markup("""
            <a href="/superset/sqllab?savedQueryId={self.id}">
                <i class="fa fa-link"></i>
            </a>
        """.format(**locals()))
