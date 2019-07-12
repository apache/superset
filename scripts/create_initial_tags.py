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

from flask_appbuilder import Model
from sqlalchemy import create_engine
from sqlalchemy.sql import func, functions, join, literal, select, union_all

from superset import app
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
      UNION ALL
      SELECT
        tag.id AS tag_id,
        dashboards.id AS object_id,
        'dashboard' AS object_type
      FROM dashboards
      JOIN tag
      ON tag.name = 'type:dashboard'
      UNION ALL
      SELECT
        tag.id AS tag_id,
        saved_query.id AS object_id,
        'query' AS object_type
      FROM saved_query
      JOIN tag
      ON tag.name = 'type:query';

    """

    tag = metadata.tables['tag']
    tagged_object = metadata.tables['tagged_object']
    slices = metadata.tables['slices']
    dashboards = metadata.tables['dashboards']
    saved_query = metadata.tables['saved_query']

    # add a tag for each object type
    insert = tag.insert()
    for type in ObjectTypes.__members__:
        engine.execute(insert, name=f'type:{type}', type=TagTypes.type)

    charts = select([
        tag.c.id.label('tag_id'),
        slices.c.id.label('object_id'),
        literal(ObjectTypes.chart.name).label('object_type'),
    ]).select_from(join(slices, tag, tag.c.name == 'type:chart'))

    dashboards = select([
        tag.c.id.label('tag_id'),
        dashboards.c.id.label('object_id'),
        literal(ObjectTypes.dashboard.name).label('object_type'),
    ]).select_from(join(dashboards, tag, tag.c.name == 'type:dashboard'))

    saved_queries = select([
        tag.c.id.label('tag_id'),
        saved_query.c.id.label('object_id'),
        literal(ObjectTypes.query.name).label('object_type'),
    ]).select_from(join(saved_query, tag, tag.c.name == 'type:query'))

    combined = union_all(charts, dashboards, saved_queries).alias().select()

    query = tagged_object.insert().from_select([
        'tag_id',
        'object_id',
        'object_type',
    ], combined)

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
      UNION ALL
      SELECT
        tag.id AS tag_id,
        dashboards.id AS object_id,
        'dashboard' AS object_type
      FROM dashboards
      JOIN tag
      ON tag.name = CONCAT('owner:', dashboards.created_by_fk)
      UNION ALL
      SELECT
        tag.id AS tag_id,
        saved_query.id AS object_id,
        'query' AS object_type
      FROM saved_query
      JOIN tag
      ON tag.name = CONCAT('owner:', saved_query.created_by_fk)

    """

    tag = metadata.tables['tag']
    tagged_object = metadata.tables['tagged_object']
    users = metadata.tables['ab_user']
    slices = metadata.tables['slices']
    dashboards = metadata.tables['dashboards']
    saved_query = metadata.tables['saved_query']

    # create a custom tag for each user
    ids = select([users.c.id])
    insert = tag.insert()
    for id_, in engine.execute(ids):
        engine.execute(insert, name=f'owner:{id_}', type=TagTypes.owner)

    charts = select([
        tag.c.id.label('tag_id'),
        slices.c.id.label('object_id'),
        literal(ObjectTypes.chart.name).label('object_type'),
    ]).select_from(
        join(
            slices,
            tag,
            tag.c.name == functions.concat('owner:', slices.c.created_by_fk),
        ),
    )

    dashboards = select([
        tag.c.id.label('tag_id'),
        dashboards.c.id.label('object_id'),
        literal(ObjectTypes.dashboard.name).label('object_type'),
    ]).select_from(
        join(
            dashboards,
            tag,
            tag.c.name == functions.concat('owner:', dashboards.c.created_by_fk),
        ),
    )

    saved_queries = select([
        tag.c.id.label('tag_id'),
        saved_query.c.id.label('object_id'),
        literal(ObjectTypes.query.name).label('object_type'),
    ]).select_from(
        join(
            saved_query,
            tag,
            tag.c.name == functions.concat('owner:', saved_query.c.created_by_fk),
        ),
    )

    combined = union_all(charts, dashboards, saved_queries).alias().select()

    query = tagged_object.insert().from_select([
        'tag_id',
        'object_id',
        'object_type',
    ], combined)

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

    """

    tag = metadata.tables['tag']
    tagged_object = metadata.tables['tagged_object']
    users = metadata.tables['ab_user']
    favstar = metadata.tables['favstar']

    # create a custom tag for each user
    ids = select([users.c.id])
    insert = tag.insert()
    for id_, in engine.execute(ids):
        engine.execute(insert, name=f'favorited_by:{id_}', type=TagTypes.type)

    favstars = select([
        tag.c.id.label('tag_id'),
        favstar.c.obj_id.label('object_id'),
        func.lower(favstar.c.class_name).label('object_type'),
    ]).select_from(
        join(
            favstar,
            tag,
            tag.c.name == functions.concat('favorited_by:', favstar.c.user_id),
        ),
    )

    query = tagged_object.insert().from_select([
        'tag_id',
        'object_id',
        'object_type',
    ], favstars)

    engine.execute(query)


def main():
    engine = create_engine(app.config.get('SQLALCHEMY_DATABASE_URI'))
    metadata = Model.metadata

    # tag all objects as their type
    add_types(engine, metadata)

    # tag all objects based on their owner
    add_owners(engine, metadata)

    # tag favorited objects
    add_favorites(engine, metadata)


if __name__ == '__main__':
    main()
