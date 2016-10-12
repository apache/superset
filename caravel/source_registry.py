from sqlalchemy.orm import subqueryload


class SourceRegistry(object):
    """ Central Registry for all available datasource engines"""

    databases = {}
    sources = {}

    @classmethod
    def register_sources(cls, datasource_config):
        for module_name, class_names in datasource_config.items():
            module_obj = __import__(module_name, fromlist=class_names)
            for class_name in class_names:
                source_class = getattr(module_obj, class_name)
                cls.sources[source_class.type] = source_class

    @classmethod
    def register_databases(cls, database_config):
        for module_name, class_names in database_config.items():
            module_obj = __import__(module_name, fromlist=class_names)
            for class_name in class_names:
                database_class = getattr(module_obj, class_name)
                cls.databases[database_class.type] = database_class

    @classmethod
    def get_datasource(cls, datasource_type, datasource_id, session):
        return (
            session.query(cls.sources[datasource_type])
            .filter_by(id=datasource_id)
            .one()
        )

    @classmethod
    def get_dbs_datasources(cls, datasource_type, database_name, session):
        database_class = cls.databases[datasource_type]
        if datasource_type == 'druid':
            name_field = database_class.cluster_name
            datasources_field = 'datasources'
        elif datasource_type == 'table':
            name_field = database_class.database_name
            datasources_field = 'tables'
        else:
            raise Exception(
                'Unknown datasources type {}'.format(datasource_type))
        database = session.query(database_class).filter(
            name_field == database_name).one()
        return getattr(database, datasources_field)

    @classmethod
    def get_datasource_by_name(cls, session, datasource_type, datasource_name,
                               schema, database_name):
        datasource_class = SourceRegistry.sources[datasource_type]
        datasources = session.query(datasource_class).all()
        db_ds = [d for d in datasources if d.database.name == database_name and
                 d.name == datasource_name and schema == schema]
        return db_ds[0]

    @classmethod
    def get_eager_datasource(cls, session, datasource_type, datasource_id):
        """Returns datasource with columns and metrics."""
        datasource_class = SourceRegistry.sources[datasource_type]
        if datasource_type == 'table':
            return (
                session.query(datasource_class)
                .options(
                    subqueryload(datasource_class.columns),
                    subqueryload(datasource_class.metrics)
                )
                .filter_by(id=datasource_id)
                .one()
            )
        # TODO: support druid datasources.
        return session.query(datasource_class).filter_by(
            id=datasource_id).first()
