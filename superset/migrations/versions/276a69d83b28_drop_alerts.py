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
"""drop alerts

Revision ID: 276a69d83b28
Revises: a9422eeaae74
Create Date: 2022-05-02 18:46:30.124352

"""

# revision identifiers, used by Alembic.
revision = '276a69d83b28'
down_revision = 'a9422eeaae74'

from importlib import import_module

modules = [
    import_module("superset.migrations.versions.2f1d15e8a6af_add_alerts")
    import_module("superset.migrations.versions.2e5a0ee25ed4_refractor_alerting")
]

def upgrade():
    for module in reversed(module):
        module.downgrade()


def downgrade():
    for module in modules:
        module.upgrade()
