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
from alembic import op
from sqlalchemy import engine_from_config
from sqlalchemy.engine import reflection
from sqlalchemy.exc import NoSuchTableError


def table_has_column(table: str, column: str) -> bool:
    """
    Checks if a column exists in a given table.

    :param table: A table name
    :param column: A column name
    :returns: True iff the column exists in the table
    """

    config = op.get_context().config
    engine = engine_from_config(
        config.get_section(config.config_ini_section), prefix="sqlalchemy."
    )
    insp = reflection.Inspector.from_engine(engine)
    try:
        return any(col["name"] == column for col in insp.get_columns(table))
    except NoSuchTableError:
        return False
