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

import sqlglot

from superset.sql.dialects.firebolt import Firebolt


def test_not_sql() -> None:  # pylint: disable=invalid-name
    """
    Test the `not_sql` method in the generator.
    """
    # use generic parser, since the Firebolt dialect will parenthesize
    ast = sqlglot.parse_one("SELECT * FROM t WHERE NOT col IN (1, 2)")

    # make sure generated SQL is parenthesized
    assert (
        Firebolt().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM t
WHERE
  NOT (col IN (1, 2))
            """.strip()
    )
