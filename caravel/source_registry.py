from flask import flash


class SourceRegistry(object):
    """ Central Registry for all available datasource engines"""

    sources = {}

    def add_source(self, ds_type, cls_model):
        if ds_type not in self.sources:
            self.sources[ds_type] = cls_model
        if self.sources[ds_type] is not cls_model:
            raise Exception(
                'source type: {} is already associated with Model: {}'.format(
                    ds_type, self.sources[ds_type]))
