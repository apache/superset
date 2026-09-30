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
Locally vendored ``BigQueryContainer``.

testcontainers-python has no released ``BigQueryContainer``: adding one is
still an open, unmerged upstream PR (testcontainers/testcontainers-python
#1121, tracking the older #393/#925) as of this writing, and the class does
not exist in any published release (including the latest, 4.15.0) or on the
project's default branch. Rather than depend on an unreleased upstream
class, this follows the same pattern this test suite already uses for
StarRocks and ClickHouse (see test_starrocks.py): wrap the container image
directly with ``testcontainers.core.container.DockerContainer``. Delete this
file and import from ``testcontainers.community.google`` instead once that
PR ships in a release.

Wraps `goccy/bigquery-emulator <https://github.com/goccy/bigquery-emulator>`_,
a GoogleSQL implementation over an embedded SQLite database. It is not
BigQuery itself, so treat query results as a strong signal rather than a
guarantee for anything outside standard GoogleSQL (BigQuery-specific
services like BigQuery ML, row access policies, or external tables are out
of scope).
"""

from google.auth.credentials import AnonymousCredentials
from google.cloud import bigquery
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs


class BigQueryContainer(DockerContainer):
    def __init__(
        self,
        image: str = "ghcr.io/goccy/bigquery-emulator:latest",
        project: str = "test-project",
        port: int = 9050,
        grpc_port: int = 9060,
        **kwargs: object,
    ) -> None:
        super().__init__(image=image, **kwargs)
        self.project = project
        self.port = port
        self.grpc_port = grpc_port
        self.with_exposed_ports(self.port, self.grpc_port)
        self.with_command(f"--project={project} --port={port} --grpc-port={grpc_port}")

    def get_rest_endpoint(self) -> str:
        return (
            f"http://{self.get_container_host_ip()}:{self.get_exposed_port(self.port)}"
        )

    def get_client(self, **kwargs: object) -> bigquery.Client:
        wait_for_logs(self, "REST server listening at", timeout=30.0)
        kwargs.setdefault("project", self.project)
        kwargs.setdefault("credentials", AnonymousCredentials())
        kwargs.setdefault("client_options", {"api_endpoint": self.get_rest_endpoint()})
        return bigquery.Client(**kwargs)
