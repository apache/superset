

class SourceRegistry(object):
    """ Central Registry for all available datasource engines"""

    sources = {}

    @classmethod
    def register_sources(cls, datasource_config):
        for module_name, class_names in datasource_config.items():
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
