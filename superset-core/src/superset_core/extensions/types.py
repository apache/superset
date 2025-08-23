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

from typing import TypedDict


class ModuleFederationConfig(TypedDict):
    exposes: dict[str, str]
    filename: str
    shared: dict[str, str]
    remotes: dict[str, str]


class FrontendContributionConfig(TypedDict):
    commands: dict[str, list[dict[str, str]]]
    views: dict[str, list[dict[str, str]]]
    menus: dict[str, list[dict[str, str]]]


class FrontendManifest(TypedDict):
    contributions: FrontendContributionConfig
    moduleFederation: ModuleFederationConfig
    remoteEntry: str


class BackendManifest(TypedDict):
    entryPoints: list[str]


class SharedBase(TypedDict, total=False):
    id: str
    name: str
    dependencies: list[str]
    description: str
    version: str
    frontend: FrontendManifest
    permissions: list[str]


class Manifest(SharedBase, total=False):
    backend: BackendManifest


class BackendMetadata(BackendManifest):
    files: list[str]


class Metadata(SharedBase):
    backend: BackendMetadata
