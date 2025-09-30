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
MySQL ANSI dialect for Apache Pinot.

This dialect is based on MySQL but follows ANSI SQL quoting conventions where
double quotes are used for identifiers instead of string literals.
"""

from __future__ import annotations

from sqlglot.dialects.mysql import MySQL


class Pinot(MySQL):
    """
    MySQL ANSI dialect used by Apache Pinot.

    The main difference from standard MySQL is that double quotes (") are used for
    identifiers instead of string literals, following ANSI SQL conventions.

    See: https://calcite.apache.org/javadocAggregate/org/apache/calcite/config/Lex.html#MYSQL_ANSI
    """

    class Tokenizer(MySQL.Tokenizer):
        QUOTES = ["'"]  # Only single quotes for strings
        IDENTIFIERS = ['"', "`"]  # Backticks and double quotes for identifiers
        STRING_ESCAPES = ["'", "\\"]  # Remove double quote from string escapes
