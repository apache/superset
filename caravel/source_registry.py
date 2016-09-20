from flask import flash


class SourceRegistry(object):
    """ Central Registry for all available datasource engines"""

    sources = {}

    def add_source(self, ds_type, cls):
        self.sources[ds_type] = cls

    def get_cls_model(self, ds_type):
        return self.sources[ds_type]

    def all_sources(self):
        return self.sources
