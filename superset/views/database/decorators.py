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
import functools
import logging
from typing import Optional

from flask import g
from flask_babel import lazy_gettext as _

from superset.models.core import Database
from superset.utils.core import parse_js_uri_path_item

logger = logging.getLogger(__name__)


def check_datasource_access(f):
    """
    A Decorator that checks if a user has datasource access
    """

    def wraps(self, pk: int, table_name: str, schema_name: Optional[str] = None):
        schema_name_parsed = parse_js_uri_path_item(schema_name, eval_undefined=True)
        table_name_parsed = parse_js_uri_path_item(table_name)
        if not table_name_parsed:
            return self.response_422(message=_("Table name undefined"))
        database: Database = self.datamodel.get(pk)
        if not database:
            self.stats_logger.incr(
                f"database_not_found_{self.__class__.__name__}.select_star"
            )
            return self.response_404()
        # Check that the user can access the datasource
        if not self.appbuilder.sm.can_access_datasource(
            database, table_name_parsed, schema_name_parsed
        ):
            self.stats_logger.incr(
                f"permisssion_denied_{self.__class__.__name__}.select_star"
            )
            logger.warning(
                f"Permission denied for user {g.user} on table: {table_name_parsed} "
                f"schema: {schema_name_parsed}"
            )
            return self.response_404()
        return f(self, database, table_name_parsed, schema_name_parsed)

    return functools.update_wrapper(wraps, f)
