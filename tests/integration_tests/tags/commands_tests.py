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
import itertools
from unittest.mock import MagicMock, patch

import pytest
import yaml
from werkzeug.utils import secure_filename

from superset import db, security_manager
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.export import (
    append_charts,
    ExportDashboardsCommand,
    get_default_position,
)
from superset.commands.dashboard.importers import v0, v1
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.commands.tag.create import CreateCustomTagCommand
from superset.commands.tag.delete import DeleteTaggedObjectCommand, DeleteTagsCommand
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tags.models import ObjectType, Tag, TaggedObject, TagType
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    dashboard_config,
    dashboard_export,
    dashboard_metadata_config,
    database_config,
    dataset_config,
    dataset_metadata_config,
)
from tests.integration_tests.fixtures.tags import with_tagging_system_feature
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)


# test create command
class TestCreateCustomTagCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_create_custom_tag_command(self):
        example_dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        example_tags = ["create custom tag example 1", "create custom tag example 2"]
        command = CreateCustomTagCommand(
            ObjectType.dashboard.value, example_dashboard.id, example_tags
        )
        command.run()

        created_tags = (
            db.session.query(Tag)
            .join(TaggedObject)
            .filter(
                TaggedObject.object_id == example_dashboard.id,
                Tag.type == TagType.custom,
            )
            .all()
        )
        assert example_tags == [tag.name for tag in created_tags]

        # cleanup
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tags))
        db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_([tag.id for tag in tags])
        ).delete()
        tags.delete()
        db.session.commit()


# test delete tags command
class TestDeleteTagsCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_delete_tags_command(self):
        example_dashboard = (
            db.session.query(Dashboard)
            .filter_by(dashboard_title="World Bank's Data")
            .one()
        )
        example_tags = ["create custom tag example 1", "create custom tag example 2"]
        command = CreateCustomTagCommand(
            ObjectType.dashboard.value, example_dashboard.id, example_tags
        )
        command.run()

        created_tags = (
            db.session.query(Tag)
            .join(TaggedObject)
            .filter(
                TaggedObject.object_id == example_dashboard.id,
                Tag.type == TagType.custom,
            )
            .all()
        )
        assert example_tags == [tag.name for tag in created_tags]

        command = DeleteTagsCommand(example_tags)
        command.run()
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tags))
        assert tags.count() == 0


# test delete tagged objects command
class TestDeleteTaggedObjectCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_delete_tags_command(self):
        # create tagged objects
        example_dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        example_tags = ["create custom tag example 1", "create custom tag example 2"]
        command = CreateCustomTagCommand(
            ObjectType.dashboard.value, example_dashboard.id, example_tags
        )
        command.run()

        tagged_objects = (
            db.session.query(TaggedObject)
            .join(Tag)
            .filter(
                TaggedObject.object_id == example_dashboard.id,
                TaggedObject.object_type == ObjectType.dashboard.name,
                Tag.name.in_(example_tags),
            )
        )
        assert tagged_objects.count() == 2
        # delete one of the tagged objects
        command = DeleteTaggedObjectCommand(
            object_type=ObjectType.dashboard.value,
            object_id=example_dashboard.id,
            tag=example_tags[0],
        )
        command.run()
        tagged_objects = (
            db.session.query(TaggedObject)
            .join(Tag)
            .filter(
                TaggedObject.object_id == example_dashboard.id,
                TaggedObject.object_type == ObjectType.dashboard.name,
                Tag.name.in_(example_tags),
            )
        )
        assert tagged_objects.count() == 1

        # cleanup
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tags))
        db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_([tag.id for tag in tags])
        ).delete()
        tags.delete()
        db.session.commit()
