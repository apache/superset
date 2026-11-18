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
The artifact widget's props: none.

The artifact is the saved widget itself: its UUID is the artifact's id, and
its files and versions live in the store, keyed by that UUID. So the props
name nothing, and any prop is refused: no code, which would reach every
viewer and grow the canvas past its read limits, and no version pin, since
every canvas shows the same artifact and a frozen copy is a fork.
"""

from __future__ import annotations

from pydantic import BaseModel


class ArtifactControls(BaseModel):
    """Controls for the ``artifact`` widget: there are none."""
