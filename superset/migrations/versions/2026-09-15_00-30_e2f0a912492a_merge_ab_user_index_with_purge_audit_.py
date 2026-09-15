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
"""merge ab_user username index with purge audit pruning coordination

Two migrations landed as siblings rather than in a chain, leaving the
revision graph with two heads and failing every ``superset db upgrade``
with "Multiple head revisions are present":

* ``88a01c781622`` — functional index on ``ab_user(lower(username))``
  (apache/superset#43939)
* ``c7f53d184ea2`` — purge-audit pruning coordination
  (apache/superset#43490)

Neither depends on the other, so this is an empty merge: it only rejoins
the graph. No schema change, and nothing to undo on downgrade beyond
restoring the two heads.

Revision ID: e2f0a912492a
Revises: ('88a01c781622', 'c7f53d184ea2')
Create Date: 2026-09-15 00:30:00.000000

"""

# revision identifiers, used by Alembic.
revision = "e2f0a912492a"
down_revision = ("88a01c781622", "c7f53d184ea2")


def upgrade():
    pass


def downgrade():
    pass
