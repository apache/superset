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
"""merge soft delete and word cloud migration heads

Both ``cb39f18af67f`` (sc-103157 soft delete) and ``fd0c8583b46d``
(upstream word-cloud sort_by_series) share the same parent
``ce6bd21901ab``. This empty merge migration unifies the two into a
single head so Alembic's ``upgrade head`` target is unambiguous.

Revision ID: a3b4c5d6e7f8
Revises: cb39f18af67f, fd0c8583b46d
Create Date: 2026-04-23 14:30:00.000000
"""

revision = "a3b4c5d6e7f8"
down_revision = ("cb39f18af67f", "fd0c8583b46d")


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
