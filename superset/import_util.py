# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging

from sqlalchemy.orm.session import make_transient


def import_datasource(
        session,
        i_datasource,
        lookup_database,
        lookup_datasource,
        import_time):
    """Imports the datasource from the object to the database.

     Metrics and columns and datasource will be overrided if exists.
     This function can be used to import/export dashboards between multiple
     superset instances. Audit metadata isn't copies over.
    """
    make_transient(i_datasource)
    logging.info('Started import of the datasource: {}'.format(
        i_datasource.to_json()))

    i_datasource.id = None
    i_datasource.database_id = lookup_database(i_datasource).id
    i_datasource.alter_params(import_time=import_time)

    # override the datasource
    datasource = lookup_datasource(i_datasource)

    if datasource:
        datasource.override(i_datasource)
        session.flush()
    else:
        datasource = i_datasource.copy()
        session.add(datasource)
        session.flush()

    for m in i_datasource.metrics:
        new_m = m.copy()
        new_m.table_id = datasource.id
        logging.info('Importing metric {} from the datasource: {}'.format(
            new_m.to_json(), i_datasource.full_name))
        imported_m = i_datasource.metric_class.import_obj(new_m)
        if (imported_m.metric_name not in
                [m.metric_name for m in datasource.metrics]):
            datasource.metrics.append(imported_m)

    for c in i_datasource.columns:
        new_c = c.copy()
        new_c.table_id = datasource.id
        logging.info('Importing column {} from the datasource: {}'.format(
            new_c.to_json(), i_datasource.full_name))
        imported_c = i_datasource.column_class.import_obj(new_c)
        if (imported_c.column_name not in
                [c.column_name for c in datasource.columns]):
            datasource.columns.append(imported_c)
    session.flush()
    return datasource.id


def import_simple_obj(session, i_obj, lookup_obj):
    make_transient(i_obj)
    i_obj.id = None
    i_obj.table = None

    # find if the column was already imported
    existing_column = lookup_obj(i_obj)
    i_obj.table = None
    if existing_column:
        existing_column.override(i_obj)
        session.flush()
        return existing_column

    session.add(i_obj)
    session.flush()
    return i_obj
