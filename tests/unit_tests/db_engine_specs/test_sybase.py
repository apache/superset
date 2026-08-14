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


def test_identifier_quote_uses_square_brackets() -> None:
    """SAP ASE's `quoted_identifier` option defaults to OFF, so double quotes
    aren't safe for autocomplete-inserted identifiers. Square brackets work
    unconditionally, so SybaseEngineSpec keeps the MssqlEngineSpec default."""
    from superset.db_engine_specs.sybase import SybaseEngineSpec

    assert SybaseEngineSpec.get_public_information()["identifier_quote"] == {
        "start": "[",
        "end": "]",
        "escape_by_doubling": True,
    }
