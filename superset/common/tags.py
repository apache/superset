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

from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import and_, func, functions, join, literal, select

from superset.models.tags import ObjectTypes, TagTypes


def add_types(engine, metadata):
    """
    Tag every object according to its type:

      INSERT INTO tagged_object (tag_id, object_id, object_type)
      SELECT
        tag.id AS tag_id,
        slices.id AS object_id,
        'chart' AS object_type
      FROM slices
      JOIN tag
        ON tag.name = 'type:chart'
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = slices.id
        AND tagged_object.object_type = 'chart'
      WHERE tagged_object.tag_id IS NULL;

      INSERT INTO tagged_object (tag_id, object_id, object_type)
      SELECT
        tag.id AS tag_id,
        dashboards.id AS object_id,
        'dashboard' AS object_type
      FROM dashboards
      JOIN tag
      ON tag.name = 'type:dashboard'
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = dashboards.id
        AND tagged_object.object_type = 'dashboard'
      WHERE tagged_object.tag_id IS NULL;

      INSERT INTO tagged_object (tag_id, object_id, object_type)
      SELECT
        tag.id AS tag_id,
        saved_query.id AS object_id,
        'query' AS object_type
      FROM saved_query
      JOIN tag
      ON tag.name = 'type:query';
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = saved_query.id
        AND tagged_object.object_type = 'query'
      WHERE tagged_object.tag_id IS NULL;

    """

    tag = metadata.tables["tag"]
    tagged_object = metadata.tables["tagged_object"]
    slices = metadata.tables["slices"]
    dashboards = metadata.tables["dashboards"]
    saved_query = metadata.tables["saved_query"]
    columns = ["tag_id", "object_id", "object_type"]

    # add a tag for each object type
    insert = tag.insert()
    for type_ in ObjectTypes.__members__:
        try:
            engine.execute(insert, name=f"type:{type_}", type=TagTypes.type)
        except IntegrityError:
            pass  # already exists

    charts = (
        select(
            [
                tag.c.id.label("tag_id"),
                slices.c.id.label("object_id"),
                literal(ObjectTypes.chart.name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(slices, tag, tag.c.name == "type:chart"),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == slices.c.id,
                    tagged_object.c.object_type == "chart",
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, charts)
    engine.execute(query)

    dashboards = (
        select(
            [
                tag.c.id.label("tag_id"),
                dashboards.c.id.label("object_id"),
                literal(ObjectTypes.dashboard.name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(dashboards, tag, tag.c.name == "type:dashboard"),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == dashboards.c.id,
                    tagged_object.c.object_type == "dashboard",
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, dashboards)
    engine.execute(query)

    saved_queries = (
        select(
            [
                tag.c.id.label("tag_id"),
                saved_query.c.id.label("object_id"),
                literal(ObjectTypes.query.name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(saved_query, tag, tag.c.name == "type:query"),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == saved_query.c.id,
                    tagged_object.c.object_type == "query",
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, saved_queries)
    engine.execute(query)


def add_owners(engine, metadata):
    """
    Tag every object according to its owner:

      INSERT INTO tagged_object (tag_id, object_id, object_type)
      SELECT
        tag.id AS tag_id,
        slices.id AS object_id,
        'chart' AS object_type
      FROM slices
      JOIN tag
      ON tag.name = CONCAT('owner:', slices.created_by_fk)
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = slices.id
        AND tagged_object.object_type = 'chart'
      WHERE tagged_object.tag_id IS NULL;

      SELECT
        tag.id AS tag_id,
        dashboards.id AS object_id,
        'dashboard' AS object_type
      FROM dashboards
      JOIN tag
      ON tag.name = CONCAT('owner:', dashboards.created_by_fk)
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = dashboards.id
        AND tagged_object.object_type = 'dashboard'
      WHERE tagged_object.tag_id IS NULL;

      SELECT
        tag.id AS tag_id,
        saved_query.id AS object_id,
        'query' AS object_type
      FROM saved_query
      JOIN tag
      ON tag.name = CONCAT('owner:', saved_query.created_by_fk)
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = saved_query.id
        AND tagged_object.object_type = 'query'
      WHERE tagged_object.tag_id IS NULL;

    """

    tag = metadata.tables["tag"]
    tagged_object = metadata.tables["tagged_object"]
    users = metadata.tables["ab_user"]
    slices = metadata.tables["slices"]
    dashboards = metadata.tables["dashboards"]
    saved_query = metadata.tables["saved_query"]
    columns = ["tag_id", "object_id", "object_type"]

    # create a custom tag for each user
    ids = select([users.c.id])
    insert = tag.insert()
    for (id_,) in engine.execute(ids):
        try:
            engine.execute(insert, name=f"owner:{id_}", type=TagTypes.owner)
        except IntegrityError:
            pass  # already exists

    charts = (
        select(
            [
                tag.c.id.label("tag_id"),
                slices.c.id.label("object_id"),
                literal(ObjectTypes.chart.name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(
                    slices,
                    tag,
                    tag.c.name == functions.concat("owner:", slices.c.created_by_fk),
                ),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == slices.c.id,
                    tagged_object.c.object_type == "chart",
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, charts)
    engine.execute(query)

    dashboards = (
        select(
            [
                tag.c.id.label("tag_id"),
                dashboards.c.id.label("object_id"),
                literal(ObjectTypes.dashboard.name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(
                    dashboards,
                    tag,
                    tag.c.name
                    == functions.concat("owner:", dashboards.c.created_by_fk),
                ),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == dashboards.c.id,
                    tagged_object.c.object_type == "dashboard",
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, dashboards)
    engine.execute(query)

    saved_queries = (
        select(
            [
                tag.c.id.label("tag_id"),
                saved_query.c.id.label("object_id"),
                literal(ObjectTypes.query.name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(
                    saved_query,
                    tag,
                    tag.c.name
                    == functions.concat("owner:", saved_query.c.created_by_fk),
                ),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == saved_query.c.id,
                    tagged_object.c.object_type == "query",
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, saved_queries)
    engine.execute(query)


def add_favorites(engine, metadata):
    """
    Tag every object that was favorited:

      INSERT INTO tagged_object (tag_id, object_id, object_type)
      SELECT
        tag.id AS tag_id,
        favstar.obj_id AS object_id,
        LOWER(favstar.class_name) AS object_type
      FROM favstar
      JOIN tag
      ON tag.name = CONCAT('favorited_by:', favstar.user_id)
      LEFT OUTER JOIN tagged_object
        ON tagged_object.tag_id = tag.id
        AND tagged_object.object_id = favstar.obj_id
        AND tagged_object.object_type = LOWER(favstar.class_name)
      WHERE tagged_object.tag_id IS NULL;

    """

    tag = metadata.tables["tag"]
    tagged_object = metadata.tables["tagged_object"]
    users = metadata.tables["ab_user"]
    favstar = metadata.tables["favstar"]
    columns = ["tag_id", "object_id", "object_type"]

    # create a custom tag for each user
    ids = select([users.c.id])
    insert = tag.insert()
    for (id_,) in engine.execute(ids):
        try:
            engine.execute(insert, name=f"favorited_by:{id_}", type=TagTypes.type)
        except IntegrityError:
            pass  # already exists

    favstars = (
        select(
            [
                tag.c.id.label("tag_id"),
                favstar.c.obj_id.label("object_id"),
                func.lower(favstar.c.class_name).label("object_type"),
            ]
        )
        .select_from(
            join(
                join(
                    favstar,
                    tag,
                    tag.c.name == functions.concat("favorited_by:", favstar.c.user_id),
                ),
                tagged_object,
                and_(
                    tagged_object.c.tag_id == tag.c.id,
                    tagged_object.c.object_id == favstar.c.obj_id,
                    tagged_object.c.object_type == func.lower(favstar.c.class_name),
                ),
                isouter=True,
                full=False,
            )
        )
        .where(tagged_object.c.tag_id.is_(None))
    )
    query = tagged_object.insert().from_select(columns, favstars)
    engine.execute(query)
