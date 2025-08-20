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
"""Unit tests for Rison filter parser."""

from unittest.mock import patch

from superset.utils.rison_filters import merge_rison_filters, RisonFilterParser


class TestRisonFilterParser:
    """Test the RisonFilterParser class."""

    def test_simple_equality(self):
        """Test simple equality filter."""
        parser = RisonFilterParser()
        result = parser.parse("(country:USA)")

        assert len(result) == 1
        assert result[0]["expressionType"] == "SIMPLE"
        assert result[0]["clause"] == "WHERE"
        assert result[0]["subject"] == "country"
        assert result[0]["operator"] == "=="
        assert result[0]["comparator"] == "USA"

    def test_multiple_filters_and(self):
        """Test multiple filters with AND logic."""
        parser = RisonFilterParser()
        result = parser.parse("(country:USA,year:2024)")

        assert len(result) == 2
        assert result[0]["subject"] == "country"
        assert result[0]["comparator"] == "USA"
        assert result[1]["subject"] == "year"
        assert result[1]["comparator"] == 2024

    def test_list_in_operator(self):
        """Test list values for IN operator."""
        parser = RisonFilterParser()
        result = parser.parse("(country:!(USA,Canada))")

        assert len(result) == 1
        assert result[0]["subject"] == "country"
        assert result[0]["operator"] == "IN"
        assert result[0]["comparator"] == ["USA", "Canada"]

    def test_not_operator(self):
        """Test NOT operator."""
        parser = RisonFilterParser()
        result = parser.parse("(NOT:(country:USA))")

        assert len(result) == 1
        assert result[0]["subject"] == "country"
        assert result[0]["operator"] == "!="
        assert result[0]["comparator"] == "USA"

    def test_not_in_operator(self):
        """Test NOT IN operator."""
        parser = RisonFilterParser()
        result = parser.parse("(NOT:(country:!(USA,Canada)))")

        assert len(result) == 1
        assert result[0]["subject"] == "country"
        assert result[0]["operator"] == "NOT IN"
        assert result[0]["comparator"] == ["USA", "Canada"]

    def test_or_operator(self):
        """Test OR operator creates SQL expression."""
        parser = RisonFilterParser()
        result = parser.parse("(OR:!((status:active),(priority:high)))")

        assert len(result) == 1
        assert result[0]["expressionType"] == "SQL"
        assert result[0]["clause"] == "WHERE"
        assert "status = 'active' OR priority = 'high'" in result[0]["sqlExpression"]

    def test_comparison_operators(self):
        """Test various comparison operators."""
        parser = RisonFilterParser()

        # Greater than
        result = parser.parse("(sales:(gt:100000))")
        assert result[0]["operator"] == ">"
        assert result[0]["comparator"] == 100000

        # Greater than or equal
        result = parser.parse("(age:(gte:18))")
        assert result[0]["operator"] == ">="
        assert result[0]["comparator"] == 18

        # Less than
        result = parser.parse("(temp:(lt:32))")
        assert result[0]["operator"] == "<"
        assert result[0]["comparator"] == 32

        # Less than or equal
        result = parser.parse("(price:(lte:1000))")
        assert result[0]["operator"] == "<="
        assert result[0]["comparator"] == 1000

    def test_between_operator(self):
        """Test BETWEEN operator."""
        parser = RisonFilterParser()
        result = parser.parse("(date:(between:!(2024-01-01,2024-12-31)))")

        assert len(result) == 1
        assert result[0]["operator"] == "BETWEEN"
        assert result[0]["comparator"] == ["2024-01-01", "2024-12-31"]

    def test_like_operator(self):
        """Test LIKE operator."""
        parser = RisonFilterParser()
        result = parser.parse("(name:(like:'%smith%'))")

        assert len(result) == 1
        assert result[0]["operator"] == "LIKE"
        assert result[0]["comparator"] == "%smith%"

    def test_complex_combination(self):
        """Test complex filter combination."""
        parser = RisonFilterParser()
        result = parser.parse(
            "(year:2024,region:!(North,South),NOT:(status:test),revenue:(gt:100000))"
        )

        assert len(result) == 4

        # Check year filter
        year_filter = next(f for f in result if f["subject"] == "year")
        assert year_filter["operator"] == "=="
        assert year_filter["comparator"] == 2024

        # Check region filter
        region_filter = next(f for f in result if f["subject"] == "region")
        assert region_filter["operator"] == "IN"
        assert region_filter["comparator"] == ["North", "South"]

        # Check NOT status filter
        status_filter = next(f for f in result if f["subject"] == "status")
        assert status_filter["operator"] == "!="
        assert status_filter["comparator"] == "test"

        # Check revenue filter
        revenue_filter = next(f for f in result if f["subject"] == "revenue")
        assert revenue_filter["operator"] == ">"
        assert revenue_filter["comparator"] == 100000

    def test_empty_filter(self):
        """Test empty or missing filter parameter."""
        parser = RisonFilterParser()

        assert parser.parse("") == []
        assert parser.parse(None) == []
        assert parser.parse("()") == []

    def test_invalid_rison(self):
        """Test invalid Rison syntax returns empty list."""
        parser = RisonFilterParser()

        # Invalid Rison should not crash but return empty list
        assert parser.parse("invalid rison") == []
        assert parser.parse("(unclosed") == []

    @patch("superset.utils.rison_filters.request")
    def test_parse_from_request(self, mock_request):
        """Test parsing from request args."""
        mock_request.args = {"f": "(country:USA)"}

        parser = RisonFilterParser()
        result = parser.parse()  # No argument, should get from request

        assert len(result) == 1
        assert result[0]["subject"] == "country"
        assert result[0]["comparator"] == "USA"

    def test_merge_rison_filters(self):
        """Test merging Rison filters into form_data."""
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "existing",
                    "operator": "==",
                    "comparator": "value",
                }
            ]
        }

        with patch("superset.utils.rison_filters.request") as mock_request:
            mock_request.args = {"f": "(country:USA)"}
            merge_rison_filters(form_data)

        # Should have both existing and new filter
        assert len(form_data["adhoc_filters"]) == 2
        assert form_data["adhoc_filters"][0]["subject"] == "existing"
        assert form_data["adhoc_filters"][1]["subject"] == "country"

    def test_merge_rison_filters_empty(self):
        """Test merging with no Rison filters."""
        form_data = {"adhoc_filters": []}

        with patch("superset.utils.rison_filters.request") as mock_request:
            mock_request.args = {}
            merge_rison_filters(form_data)

        # Should remain empty
        assert form_data["adhoc_filters"] == []
