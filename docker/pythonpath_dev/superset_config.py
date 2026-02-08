# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# This file is included in the final Docker image and SHOULD be overridden when
# deploying the image to prod. Settings configured here are intended for use in local
# development environments. Also note that superset_config_docker.py is imported
# as a final step as a means to override "defaults" configured here
#
import logging
import os
import sys

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

logger = logging.getLogger()

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

EXAMPLES_USER = os.getenv("EXAMPLES_USER")
EXAMPLES_PASSWORD = os.getenv("EXAMPLES_PASSWORD")
EXAMPLES_HOST = os.getenv("EXAMPLES_HOST")
EXAMPLES_PORT = os.getenv("EXAMPLES_PORT")
EXAMPLES_DB = os.getenv("EXAMPLES_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

# Use environment variable if set, otherwise construct from components
# This MUST take precedence over any other configuration
SQLALCHEMY_EXAMPLES_URI = os.getenv(
    "SUPERSET__SQLALCHEMY_EXAMPLES_URI",
    (
        f"{DATABASE_DIALECT}://"
        f"{EXAMPLES_USER}:{EXAMPLES_PASSWORD}@"
        f"{EXAMPLES_HOST}:{EXAMPLES_PORT}/{EXAMPLES_DB}"
    ),
)


REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG
THUMBNAIL_CACHE_CONFIG = CACHE_CONFIG


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
    )
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 1
    task_acks_late = False
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {"ALERT_REPORTS": True}
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = f"http://superset_app{os.environ.get('SUPERSET_APP_ROOT', '/')}/"  # When using docker compose baseurl should be http://superset_nginx{ENV{BASEPATH}}/  # noqa: E501
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = (
    f"http://localhost:8888/{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
)
SQLLAB_CTAS_NO_LIMIT = True

log_level_text = os.getenv("SUPERSET_LOG_LEVEL", "INFO")
LOG_LEVEL = getattr(logging, log_level_text.upper(), logging.INFO)

if os.getenv("CYPRESS_CONFIG") == "true":
    # When running the service as a cypress backend, we need to import the config
    # located @ tests/integration_tests/superset_test_config.py
    base_dir = os.path.dirname(__file__)
    module_folder = os.path.abspath(
        os.path.join(base_dir, "../../tests/integration_tests/")
    )
    sys.path.insert(0, module_folder)
    from superset_test_config import *  # noqa

    sys.path.pop(0)

#
# Optionally import superset_config_docker.py (which will have been included on
# the PYTHONPATH) in order to allow for local settings to be overridden
#
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa: F403

    logger.info(
        "Loaded your Docker configuration at [%s]", superset_config_docker.__file__
    )
except ImportError:
    logger.info("Using default Docker config...")


EXTRA_CATEGORICAL_COLOR_SCHEMES = [
     {
         "id": 'risk_meter',
         "description": '',
         "label": 'Rik Meter Theme RYG',
         "colors":
          ['#008450','#D19900','#B81D13']
     },
     {
        "id": 'ey_color_palette',
        "description": '',
        "label": 'EY Color Palette I',
	        "isDefault": False,
        "colors":
         ['#E0B0FF', '#FF736A', '#FFB46A', '#8CE8AD', '#42C9C2', '#87D3F2', '#9C82D4','#922B73','#168736']
    },
    {
        "id": 'ey_color_palette_2',
        "description": '',
        "label": 'EY Color Palette II',
	        "isDefault": False,
        "colors":
         ['#B14891', '#FF736A', '#FF9831', '#c9ffe0', '#27ACAA', '#4EBEEB', '#D3888D','#e0b0ff']
    },
    {
        "id": 'subtle_color_palette_1',
        "description": '',
        "label": 'Subtle Color Palette I',
	        "isDefault": False,
        "colors":
         ['#D45E77', '#D07687', '#D3888D', '#D4A4A9', '#DCBABF', '#DEC3BE', '#E3D0D5','#E7DDEC','#EDE5DC']
    },
    {
        "id": 'subtle_color_palette_2',
        "description": '',
        "label": 'Subtle Color Palette II',
	        "isDefault": False,
        "colors":
         ['#794F6D', '#93727B', '#A5808B', '#AD9489', '#BCA28A', '#CAB095', '#F0D5C7','#FCA692']
    },
    {
        "id": 'subtle_color_palette_3',
        "description": '',
        "label": 'Subtle Color Palette III',
	        "isDefault": False,
        "colors":
         ['#B0ABAF', '#C1AEB1', '#C2C1C3', '#D2CCC9', '#D9D7D3', '#D4AF9B', '#DEB891','#E7C188','#EECA81']
    },
    {
        "id": 'subtle_color_palette_4',
        "description": '',
        "label": 'Subtle Color Palette IV',
	        "isDefault": False,
        "colors":
         ['#85C7DE', '#A3A5A9', '#D9C8C4', '#D3888D', '#E7C188', '#D07687','#9DA891','#93727B','#A0C4E2']
    },
    {
        "id": 'subtle_color_palette_blue_shades',
        "description": '',
        "label": 'Subtle Color Palette Blue Shades',
	        "isDefault": False,
        "colors":
         ['#91C8E4','#37B7C3','#92C7CF', '#AAD7D9', '#BFCFE7', '#E5E1DA','#ADC4CE']
    },
    {
        "id": 'subtle_color_palette_piechart',
        "description": '',
        "label": 'Subtle Color Palette Pie Charts',
	        "isDefault": False,
        "colors":
         [ '#083153','#0A558E','#1275C1','#55A6FC','#AFCDFB']
    },
    {
        "id": 'subtle_color_palette_dounut',
        "description": '',
        "label": 'Subtle Color Palette Dounut',
	        "isDefault": False,
        "colors":
         [  '#AFCDFB','#55A6FC','#1275C1','#0A558E','#083153']
    },
    {
        "id": 'subtle_color_palette_for_bars',
        "description": '',
        "label": 'Subtle Color Palette For Bars',
	        "isDefault": True,
        "colors":
         ['#D2E1FA','#AFCDFB','#85B9FD','#55A6FC','#188CE5','#1275C1','#0F69AE','#0A558E','#064372','#083153']
    }
    ]
