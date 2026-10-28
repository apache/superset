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
"""merge outstanding Alembic heads before user_ui_prefs

Revision ID: c4e8a1f2b3d5
Revises: ('1072de5ed955', '3740c7bcb2c6', 'd7cecc48bd55', 'e4a7c2b9d1f3')
Create Date: 2026-10-28 12:00:00.000000

"""

revision = "c4e8a1f2b3d5"
down_revision = ("1072de5ed955", "3740c7bcb2c6", "d7cecc48bd55", "e4a7c2b9d1f3")


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
