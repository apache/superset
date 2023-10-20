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
from typing import Optional

from superset.db_engine_specs.type_parsing.base import Array, Map, Row, Type, TypeParser


class TrinoTypeParser(TypeParser):  # pylint: disable=too-few-public-methods
    """
    Parse ROW, ARRAY types into a structured type definition

    Since these types can be highly nested, this requires a tokenisation
    approach along with recursion to fully parse inner types.

    N.B:
        The type description provided by trino is limited and ambiguous in certain
        edge cases due to the possibility of including arbitrary special characters
        in field names within a ROW type. Trino will not quote ROW field names even
        when they contain spaces, commas, close brackets, and other characters which
        appear within the structured type definition. Fields including these characters
        produce strings which can be legally interpreted multiple ways, so it's
        impossible to handle them.

        As a result, this parser may FAIL in cases where spaces or brackets are
        included in field names within a ROW. We should fall back to abandoning any
        data expansion being attempted using the parser if that happens.
    """

    @classmethod
    # pylint: disable=invalid-name
    def _get_tokens(cls, s: str, sep: str = ",") -> list[str]:
        """
        Break the given string into comma-separated fields. We create tokens by looking
        for comma-separated values in the provided string, ensuring we're only
        considering top-level tokens by respecting bracket pairs as we go.

        This is useful for a single field in a ROW, to separate types in a MAP,
        and other cases. We can also use a different separator character rather
        than a comma, e.g. to separate field name from type in ROW fields.

        Examples:

            "a varchar, b varchar"          --> ["a varchar", "b varchar"]
            "a row(b int, c int), d int"    --> ["a row(b int, c int)", "d int"]
            "varchar, varchar"              --> ["varchar", "varchar"]
            "row(a int, b int), row(c int)" --> ["row(a int, b int)", "row(c int)"]
            "field1 row(int, int)"          --> ["field1", "row(int, int)"]
            "row(int, int, int)"            --> ["row(int, int, int)"]
        """
        depth = 0
        tokens = []
        curr_token = ""
        end_chars = {sep, ")"}

        for c in s:  # pylint: disable=invalid-name
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1

            if depth < 0:
                raise ValueError(f"Could not tokenise: invalid bracket pairings: [{s}]")

            if depth == 0 and c in end_chars:
                if c != sep:
                    curr_token += c

                if curr_token:
                    tokens.append(curr_token)
                curr_token = ""
            else:
                curr_token += c

        if curr_token:
            tokens.append(curr_token)

        return [t.strip() for t in tokens]

    @classmethod
    def _split_name_type(cls, field_def: str) -> tuple[Optional[str], str]:
        """
        Split the name of a field and its type, as seen in ROW definitions.
        Unfortuately we have to assume the name does not contain a space, even though
        it's possible, as trino does not quote the name and thus produces ambiguous
        type definitions. See class documentation.

        Further, trino ROW fields may or may not be named, so we have to
        account for only having a type here. We therefore use a tokenisation
        approach again, with a space as the separator, and expect to find
        either 1 or 2 tokens in the output.
        """
        tokens = cls._get_tokens(field_def, sep=" ")
        if len(tokens) > 2:
            raise ValueError(
                "Found more than 2 distinct tokens in a ROW field definition; this is "
                "most likely due to special characters appearing in ROW field names "
                "and is not recoverable"
            )

        if len(tokens) == 1:
            return None, tokens[0]

        return tokens[0], tokens[1]

    def _parse_row(self, typedef: str) -> Row:
        fields: list[str] = self._get_tokens(typedef[len("row(") : -1])
        columns = []

        for field in fields:
            name, coltype = self._split_name_type(field)
            columns.append((name, self.parse_type(coltype)))

        return Row(columns)

    def _parse_array(self, typedef: str) -> Array:
        inner_type = self.parse_type(typedef[len("array(") : -1])
        return Array(inner_type)

    def _parse_map(self, typedef: str) -> Map:
        key_typedef, value_typedef = self._get_tokens(typedef[len("map(") : -1])
        return Map(self.parse_type(key_typedef), self.parse_type(value_typedef))

    def parse_type(self, typedef: str) -> Type:
        if typedef.lower().startswith("row("):
            return self._parse_row(typedef)

        if typedef.lower().startswith("array("):
            return self._parse_array(typedef)

        if typedef.lower().startswith("map("):
            return self._parse_map(typedef)

        return Type(typedef.lower())
