from sqlalchemy.orm import subqueryload


class SourceRegistry(object):
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
            .one()
        )

    @classmethod
    def get_all_datasources(cls, session):
        datasources = []
        for source_type in SourceRegistry.sources:
            datasources.extend(
                session.query(SourceRegistry.sources[source_type]).all())
        return datasources

    @classmethod
    def get_datasource_by_name(cls, session, datasource_type, datasource_name,
                               schema, database_name):
        datasource_class = SourceRegistry.sources[datasource_type]
        datasources = session.query(datasource_class).all()
        db_ds = [d for d in datasources if d.database.name == database_name and
                 d.name == datasource_name and schema == schema]
        return db_ds[0]

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        datasource_class = SourceRegistry.sources[database.type]
        if database.type == 'table':
            query = (
                session.query(datasource_class)
                .filter_by(database_id=database.id)
                .filter_by(table_name=datasource_name))
            if schema:
                query = query.filter_by(schema=schema)
            return query.all()
        if database.type == 'druid':
            return (
                session.query(datasource_class)
                .filter_by(cluster_name=database.id)
                .filter_by(datasource_name=datasource_name)
                .all()
            )
        return None

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
