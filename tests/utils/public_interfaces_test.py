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
# pylint: disable=no-self-use
from superset.sql_lab import dummy_sql_query_mutator
from superset.utils.public_interfaces import compute_hash, get_warning_message
from tests.base_tests import SupersetTestCase

# These are public interfaces exposed by Superset. Make sure
# to only change the interfaces and update the hashes in new
# major versions of Superset.
hashes = {
    dummy_sql_query_mutator: "?1Y~;3l_|ss3^<`P;lWt",
}


class PublicInterfacesTest(SupersetTestCase):

    """Test that public interfaces have not been accidentally changed."""

    def test_dummy_sql_query_mutator(self):
        for interface, expected_hash in hashes.items():
            current_hash = compute_hash(dummy_sql_query_mutator)
            assert current_hash == expected_hash, get_warning_message(
                dummy_sql_query_mutator, current_hash
            )
