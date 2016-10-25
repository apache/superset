"""Defines the templating context for SQL Lab"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import inspect
import jinja2

from datetime import datetime
import time
import uuid
import random

from caravel import app

config = app.config


class BaseContext(object):

    """Base class for database-specific jinja context

    There's this bit of magic in ``process_template`` that instantiates only
    the database context for the active database as a ``models.Database``
    object binds it to the context object, so that object methods
    have access to
    that context. This way, {{ hive.latest_partition('mytable') }} just
    knows about the database it is operating in.

    This means that object methods are only available for the active database
    and are given access to the ``models.Database`` object and schema
    name. For globally available methods use ``@classmethod``.
    """
    engine = None

    def __init__(self, database, query):
        self.database = database
        self.query = query
        self.schema = query.schema


class PrestoContext(BaseContext):
    engine = 'presto'

db_contexes = {
    o.engine: o for o in globals().values()
    if o and inspect.isclass(o) and issubclass(o, BaseContext)}


def get_context(engine_name=None):
    context = {
        'datetime': datetime,
        'time': time,
        'uuid': uuid,
        'random': random,
    }
    db_context = db_contexes.get(engine_name)
    if engine_name and db_context:
        context[engine_name] = db_context
    return context


def process_template(sql, database=None, query=None):
    """Processes a sql template

    >>> sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
    >>> process_template(sql)
    "SELECT '2017-01-01T00:00:00'"
    """

    context = get_context(database.backend if database else None)
    template = jinja2.Template(sql)
    backend = database.backend if database else None

    # instantiating only the context for the active database
    if context and backend in context:
        context[backend] = context[backend](database, query)
    context.update(config.get('JINJA_CONTEXT_ADDONS', {}))
    return template.render(context)
