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
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union

ThemeAlgorithmCombination = List[
    Union[Literal["default"], Literal["dark"], Literal["compact"]]
]


ThemeAlgorithmOption = Union[
    Literal["default"], Literal["dark"], Literal["compact"], ThemeAlgorithmCombination
]


class Theme(TypedDict, total=False):
    """
    Represents a theme configuration.
    token: Optional[Dict[str, Any]]
    components: Optional[Dict[str, Any]]
    algorithm: Optional[ThemeAlgorithmOption]
    hashed: Optional[bool]
    inherit: Optional[bool]
    """

    token: Dict[str, Any]
    components: Optional[Dict[str, Any]]
    algorithm: Optional[ThemeAlgorithmOption]
    hashed: Optional[bool]
    inherit: Optional[bool]


class ThemeMode(str, Enum):
    DEFAULT = "default"
    DARK = "dark"
    SYSTEM = "system"
    COMPACT = "compact"
