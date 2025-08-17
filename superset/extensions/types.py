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

from dataclasses import dataclass

from superset_core.extensions.types import Manifest


@dataclass
class BundleFile:
    name: str
    content: bytes


@dataclass
class LoadedExtension:
    name: str
    manifest: Manifest
    frontend: dict[str, bytes]
    backend: dict[str, bytes]
    enabled: bool
    id: int | None = None
    _checksum_cache: str | None = None

    @property
    def checksum(self) -> str:
        """Calculate deterministic checksum for this extension (cached)."""
        if self._checksum_cache is None:
            from superset.extensions.checksum import ExtensionChecksumService

            self._checksum_cache = ExtensionChecksumService.calculate_checksum(
                self.name, self.manifest, self.frontend, self.backend
            )
        return self._checksum_cache
