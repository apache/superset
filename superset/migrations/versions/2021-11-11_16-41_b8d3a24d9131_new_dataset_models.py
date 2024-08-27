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

# pylint: disable=too-few-public-methods
"""New dataset models

Revision ID: b8d3a24d9131
Revises: 5afbb1a5849b
Create Date: 2021-11-11 16:41:53.266965

"""

# revision identifiers, used by Alembic.
revision = "b8d3a24d9131"
down_revision = "5afbb1a5849b"


# ===================== Notice ========================
#
# Migrations made in this revision has been moved to `new_dataset_models_take_2`
# to fix performance issues as well as a couple of shortcomings in the original
# design.
#
# ======================================================


def upgrade() -> None:
    pass


def downgrade():
    pass
