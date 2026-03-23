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
from typing import Optional

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


class InsertChartMixin:
    """
    Implements shared logic for tests to insert charts (slices) in the DB
    """

    def insert_chart(
        self,
        slice_name: str,
        owners: list[int],
        datasource_id: int,
        created_by=None,
        datasource_type: str = "table",
        description: Optional[str] = None,
        viz_type: Optional[str] = None,
        params: Optional[str] = None,
        cache_timeout: Optional[int] = None,
        certified_by: Optional[str] = None,
        certification_details: Optional[str] = None,
    ) -> Slice:
        obj_editors = list()  # noqa: C408
        for owner in owners:
            subject = (
                db.session.query(Subject)
                .filter_by(user_id=owner, type=SubjectType.USER)
                .first()
            )
            if subject:
                obj_editors.append(subject)
        datasource = (
            db.session.query(SqlaTable).filter_by(id=datasource_id).one_or_none()
        )
        slice = Slice(
            cache_timeout=cache_timeout,
            certified_by=certified_by,
            certification_details=certification_details,
            created_by=created_by,
            datasource_id=datasource.id,
            datasource_name=datasource.name,
            datasource_type=datasource.type,
            description=description,
            editors=obj_editors,
            params=params,
            slice_name=slice_name,
            viz_type=viz_type,
        )
        db.session.add(slice)
        db.session.commit()
        return slice
