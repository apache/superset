# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from sqlalchemy.orm import subqueryload


class ConnectorRegistry(object):
    """ Central Registry for all available datasource engines"""

    sources = {}

    @classmethod
    def register_sources(cls, datasource_config):
        for module_name, class_names in datasource_config.items():
            class_names = [str(s) for s in class_names]
            module_obj = __import__(module_name, fromlist=class_names)
            for class_name in class_names:
                source_class = getattr(module_obj, class_name)
                cls.sources[source_class.type] = source_class

    @classmethod
    def get_datasource(cls, datasource_type, datasource_id, session):
        return (
            session.query(cls.sources[datasource_type])
            .filter_by(id=datasource_id)
            .first()
        )

    @classmethod
    def get_all_datasources(cls, session):
        datasources = []
        for source_type in ConnectorRegistry.sources:
            source_class = ConnectorRegistry.sources[source_type]
            qry = session.query(source_class)
            qry = source_class.default_query(qry)
            datasources.extend(qry.all())
        return datasources

    @classmethod
    def get_datasource_by_name(cls, session, datasource_type, datasource_name,
                               schema, database_name):
        datasource_class = ConnectorRegistry.sources[datasource_type]
        datasources = session.query(datasource_class).all()

        # Filter datasoures that don't have database.
        db_ds = [d for d in datasources if d.database and
                 d.database.name == database_name and
                 d.name == datasource_name and schema == schema]
        return db_ds[0]

    @classmethod
    def query_datasources_by_permissions(cls, session, database, permissions):
        datasource_class = ConnectorRegistry.sources[database.type]
        return (
            session.query(datasource_class)
            .filter_by(database_id=database.id)
            .filter(datasource_class.perm.in_(permissions))
            .all()
        )

    @classmethod
    def get_eager_datasource(cls, session, datasource_type, datasource_id):
        """Returns datasource with columns and metrics."""
        datasource_class = ConnectorRegistry.sources[datasource_type]
        return (
            session.query(datasource_class)
            .options(
                subqueryload(datasource_class.columns),
                subqueryload(datasource_class.metrics),
            )
            .filter_by(id=datasource_id)
            .one()
        )

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        datasource_class = ConnectorRegistry.sources[database.type]
        return datasource_class.query_datasources_by_name(
            session, database, datasource_name, schema=None)
