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

from pathlib import Path

import yaml


def test_image_tag_services_use_bundled_packages() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    compose = yaml.safe_load(
        (repository_root / "docker-compose-image-tag.yml").read_text(),
    )
    image = compose["x-superset-image"]
    image_services = [
        service
        for service in compose["services"].values()
        if service.get("image") == image
    ]

    assert image_services
    assert all(
        service.get("environment", {}).get("DEV_MODE") == "false"
        for service in image_services
    )
    assert all(
        all(
            not isinstance(volume, str) or ":/app/superset-core" not in volume
            for volume in service.get("volumes", [])
        )
        for service in image_services
    )
