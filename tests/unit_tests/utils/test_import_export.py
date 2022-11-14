# -*- coding: utf-8 -*-
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

from superset.utils.import_export import get_filename


@pytest.mark.parametrize(
    "model_name,model_id,skip_id,expected_filename",
    [
        ("Energy Sankey", 132, False, "Energy_Sankey_132"),
        ("Energy Sankey", 132, True, "Energy_Sankey"),
        ("folder1/Energy Sankey", 132, True, "folder1_Energy_Sankey"),
        ("D:\\Charts\\Energy Sankey", 132, True, "DChartsEnergy_Sankey"),
        ("🥴🥴🥴", 4751, False, "4751"),
        ("🥴🥴🥴", 4751, True, "4751"),
        ("你好", 475, False, "475"),
        ("你好", 475, True, "475"),
    ],
)
def test_get_filename(
    model_name: str, model_id: int, skip_id: bool, expected_filename: str
) -> None:
    original_filename = get_filename(model_name, model_id, skip_id)
    assert expected_filename == original_filename
