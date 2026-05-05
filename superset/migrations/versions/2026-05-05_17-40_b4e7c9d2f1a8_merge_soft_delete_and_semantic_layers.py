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
"""merge soft delete and semantic layers heads

Both ``cb39f18af67f`` (sc-103157 soft delete) and ``33d7e0e21daa``
(upstream semantic layers and views) share parent ``ce6bd21901ab``.
This empty merge migration unifies them so ``superset db upgrade head``
has an unambiguous target.

Revision ID: b4e7c9d2f1a8
Revises: cb39f18af67f, 33d7e0e21daa
Create Date: 2026-05-05 17:40:00.000000
"""

revision = "b4e7c9d2f1a8"
down_revision = ("cb39f18af67f", "33d7e0e21daa")


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
