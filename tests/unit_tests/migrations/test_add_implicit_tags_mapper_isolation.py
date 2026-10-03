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
import importlib

import sqlalchemy.orm as orm


def test_add_implicit_tags_script_leaves_mappers_configurable() -> None:
    """Importing the migration script must not poison the mapper registry.

    Alembic imports every version script when it walks revision history (the
    unit-test app fixture triggers this via its pending-migration check), so a
    script whose throwaway declarative models cannot be configured breaks
    ``configure_mappers()`` process-wide for whichever test happens to trigger
    mapper configuration next.
    """
    importlib.import_module(
        "superset.migrations.versions.2018-07-26_11-10_c82ee8a39623_add_implicit_tags"
    )

    orm.configure_mappers()
