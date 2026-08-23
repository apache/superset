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

from superset.db_engine_specs.mariadb import MariaDBEngineSpec
from superset.db_engine_specs.mysql import MySQLEngineSpec


def test_mariadb_inherits_from_mysql() -> None:
    assert issubclass(MariaDBEngineSpec, MySQLEngineSpec)


def test_mariadb_inherits_extended_aggregations() -> None:
    """
    MariaDB is a MySQL fork implementing the same aggregate functions, not a
    materially different query engine, so it inherits `_extended_aggregations`
    from `MySQLEngineSpec` unmodified -- see the comment above that dict.
    """
    assert MariaDBEngineSpec.get_extended_aggregation_func("STDDEV_SAMP") is not None
    assert MariaDBEngineSpec.get_extended_aggregation_func("VAR_SAMP") is not None
    # Same as MySQL, MEDIAN is not supported.
    assert MariaDBEngineSpec.get_extended_aggregation_func("MEDIAN") is None
