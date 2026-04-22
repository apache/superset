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

"""
OpenSearch SQL dialect.

OpenSearch SQL is syntactically close to MySQL but accepts both backticks and
double-quotes as identifier delimiters. Treating ``"`` as an identifier (rather
than a string delimiter, as MySQL does) is what keeps mixed-case column names
from being emitted as string literals after a SQLGlot round-trip.
"""

from __future__ import annotations

from sqlglot.dialects.mysql import MySQL


class OpenSearch(MySQL):
    class Tokenizer(MySQL.Tokenizer):
        IDENTIFIERS = ['"', "`"]
