"""Package's main module!"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import os

from superset.source_registry import SourceRegistry
from superset import config

APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('SUPERSET_CONFIG', 'superset.config')

results_backend = config.RESULTS_BACKEND

# Registering sources
module_datasource_map = config.DEFAULT_MODULE_DS_MAP
module_datasource_map.update(config.ADDITIONAL_MODULE_DS_MAP)
SourceRegistry.register_sources(module_datasource_map)
