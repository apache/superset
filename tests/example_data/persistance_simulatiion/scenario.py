#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional

from .. import DataName


class CaseType(Enum):
    FULL_DASHBOARD = 1
    ONLY_DASHBOARD = 2
    FULL_SLICES = 3
    ONLY_SLICES = 4
    MISC_SLICES = 5


@dataclass
class Scenario:
    name: Optional[str]
    case_name: CaseType
    data_name: DataName
    actor: Optional[str]
    configurations: Optional[Dict[str, Any]]
