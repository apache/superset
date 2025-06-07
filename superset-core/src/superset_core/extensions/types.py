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
