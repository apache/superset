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

"""
This is the main entrypoint used by Celery workers. As such,
it needs to call create_app() in order to initialize things properly
"""

# Superset framework imports
from superset import create_app
from superset.extensions import celery_app

# Init the Flask app / configure everything
create_app()

# Need to import late, as the celery_app will have been setup by "create_app()"
# pylint: disable=wrong-import-position, unused-import
from . import cache, schedules  # isort:skip

# Export the celery app globally for Celery (as run on the cmd line) to find
app = celery_app
