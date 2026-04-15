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
"""replay 317970b4400c

Revision ID: b7851ee5522f
Revises: 4b85906e5b91
Create Date: 2023-12-01 12:03:27.538945

"""

# revision identifiers, used by Alembic.
revision = "b7851ee5522f"
down_revision = "4b85906e5b91"

from importlib import import_module  # noqa: E402

module = import_module(
    "superset.migrations.versions.2023-09-06_13-18_317970b4400c_added_time_secondary_column_to_"
)


def upgrade():
    module.upgrade()


def downgrade():
    module.downgrade()
