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

import pytest

from superset.utils.pdf import build_pdf_from_chart_data

pytest.importorskip("PIL")


def test_build_pdf_from_chart_data_with_rows() -> None:
    pdf_bytes = build_pdf_from_chart_data(
        [
            {"country": "TR", "value": 10},
            {"country": "US", "value": 25},
        ]
    )

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100


def test_build_pdf_from_chart_data_with_empty_rows() -> None:
    pdf_bytes = build_pdf_from_chart_data([])

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100
