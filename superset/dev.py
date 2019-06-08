# superset.core.models imports
"""A collection of ORM sqlalchemy models for Superset"""
from contextlib import closing
from copy import copy, deepcopy
from datetime import datetime
import functools
import json
import logging
import os
import sys
import textwrap
from typing import List

from flask import escape, g, Markup, request
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.security.sqla.models import User
import numpy
import pandas as pd
import sqlalchemy as sqla
from sqlalchemy import (
    Boolean, Column, create_engine, DateTime, ForeignKey, Integer,
    MetaData, String, Table, Text,
)
from sqlalchemy.engine import url
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import relationship, sessionmaker, subqueryload
from sqlalchemy.orm.session import make_transient
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import select, text
from sqlalchemy_utils import EncryptedType
import sqlparse

from superset import app, db, db_engine_specs, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.legacy import update_time_range
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.models.tags import ChartUpdater, DashboardUpdater, FavStarUpdater
from superset.models.user_attributes import UserAttribute
from superset.utils import (
    cache as cache_util,
    core as utils,
)
from superset.viz import viz_types
from urllib import parse  # noqa

config = app.config
custom_password_store = config.get('SQLALCHEMY_CUSTOM_PASSWORD_STORE')
stats_logger = config.get('STATS_LOGGER')
log_query = config.get('QUERY_LOGGER')
metadata = Model.metadata  # pylint: disable=no-member

PASSWORD_MASK = 'X' * 10


# My setup
dashboard_ids=[1]
dashboard_titles=[]
export_data=True
export_data_dir='.'

session = db.session()


# superset.utils.dashboard_import_export imports
from superset.models.core import Dashboard


# superset.models.core.export_dashboards internals
copied_dashboards = []
datasource_ids = set()
for dashboard_id in dashboard_ids:
    # make sure that dashboard_id is an integer
    dashboard_id = int(dashboard_id)
    copied_dashboard = (
        db.session.query(Dashboard)
        .options(subqueryload(Dashboard.slices))
        .filter_by(id=dashboard_id).first()
    )
    make_transient(copied_dashboard)
    for slc in copied_dashboard.slices:
        datasource_ids.add((slc.datasource_id, slc.datasource_type))
        # add extra params for the import
        slc.alter_params(
            remote_id=slc.id,
            datasource_name=slc.datasource.name,
            schema=slc.datasource.name,
            database_name=slc.datasource.database.name,
        )
    copied_dashboard.alter_params(remote_id=dashboard_id)
    copied_dashboards.append(copied_dashboard)

    eager_datasources = []
    for dashboard_id, dashboard_type in datasource_ids:
        eager_datasource = ConnectorRegistry.get_eager_datasource(
            db.session, dashboard_type, dashboard_id)
        eager_datasource.alter_params(
            remote_id=eager_datasource.id,
            database_name=eager_datasource.database.name,
        )
        make_transient(eager_datasource)
        eager_datasources.append(eager_datasource)