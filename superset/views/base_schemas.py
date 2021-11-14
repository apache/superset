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
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Union

from flask import current_app, g
from flask_appbuilder import Model
from marshmallow import post_load, pre_load, Schema, ValidationError
from sqlalchemy.orm.exc import NoResultFound


def validate_owner(value: int) -> None:
    try:
        (
            current_app.appbuilder.get_session.query(
                current_app.appbuilder.sm.user_model.id
            )
            .filter_by(id=value)
            .one()
        )
    except NoResultFound as ex:
        raise ValidationError(f"User {value} does not exist") from ex


class BaseSupersetSchema(Schema):
    """
    Extends Marshmallow schema so that we can pass a Model to load
    (following marshamallow-sqlalchemy pattern). This is useful
    to perform partial model merges on HTTP PUT
    """

    __class_model__: Model = None

    def __init__(self, **kwargs: Any) -> None:
        self.instance: Optional[Model] = None
        super().__init__(**kwargs)

    def load(  # pylint: disable=arguments-differ
        self,
        data: Union[Mapping[str, Any], Iterable[Mapping[str, Any]]],
        many: Optional[bool] = None,
        partial: Union[bool, Sequence[str], Set[str], None] = None,
        instance: Optional[Model] = None,
        **kwargs: Any,
    ) -> Any:
        self.instance = instance
        if many is None:
            many = False
        if partial is None:
            partial = False
        return super().load(data, many=many, partial=partial, **kwargs)

    @post_load
    def make_object(
        self, data: Dict[Any, Any], discard: Optional[List[str]] = None
    ) -> Model:
        """
        Creates a Model object from POST or PUT requests. PUT will use self.instance
        previously fetched from the endpoint handler

        :param data: Schema data payload
        :param discard: List of fields to not set on the model
        """
        discard = discard or []
        if not self.instance:
            self.instance = self.__class_model__()  # pylint: disable=not-callable
        for field in data:
            if field not in discard:
                setattr(self.instance, field, data.get(field))
        return self.instance


class BaseOwnedSchema(BaseSupersetSchema):
    """
    Implements owners validation,pre load and post_load
    (to populate the owners field) on Marshmallow schemas
    """

    owners_field_name = "owners"

    @post_load
    def make_object(
        self, data: Dict[str, Any], discard: Optional[List[str]] = None
    ) -> Model:
        discard = discard or []
        discard.append(self.owners_field_name)
        instance = super().make_object(data, discard)
        if "owners" not in data and g.user not in instance.owners:
            instance.owners.append(g.user)
        if self.owners_field_name in data:
            self.set_owners(instance, data[self.owners_field_name])
        return instance

    @pre_load
    def pre_load(self, data: Dict[Any, Any]) -> None:
        # if PUT request don't set owners to empty list
        if not self.instance:
            data[self.owners_field_name] = data.get(self.owners_field_name, [])

    @staticmethod
    def set_owners(instance: Model, owners: List[int]) -> None:
        owner_objs = []
        if g.user.get_id() not in owners:
            owners.append(g.user.get_id())
        for owner_id in owners:
            user = current_app.appbuilder.get_session.query(
                current_app.appbuilder.sm.user_model
            ).get(owner_id)
            owner_objs.append(user)
        instance.owners = owner_objs
