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
from typing import Dict, List, Optional

from flask import current_app
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.exceptions import (
    CreateFailedError,
    DeleteFailedError,
    OwnersNotFoundValidationError,
    UpdateFailedError,
)
from superset.extensions import db


def generic_create(model_cls: Model, properties: Dict, commit=True) -> Optional[Model]:
    """
        Generic for creating models
    """
    model = model_cls()
    for key, value in properties.items():
        setattr(model, key, value)
    try:
        db.session.add(model)
        if commit:
            db.session.commit()
    except SQLAlchemyError as e:  # pragma: no cover
        db.session.rollback()
        raise CreateFailedError(exception=e)
    return model


def generic_update(model: Model, properties: Dict, commit=True) -> Optional[Model]:
    """
        Generic update a model
    """
    for key, value in properties.items():
        setattr(model, key, value)
    try:
        db.session.merge(model)
        if commit:
            db.session.commit()
    except SQLAlchemyError as e:  # pragma: no cover
        db.session.rollback()
        raise UpdateFailedError(exception=e)
    return model


def generic_delete(model: Model, commit=True):
    try:
        db.session.delete(model)
        if commit:
            db.session.commit()
    except SQLAlchemyError as e:  # pragma: no cover
        db.session.rollback()
        raise DeleteFailedError(exception=e)
    return model


def get_owner_by_id(owner_id: int) -> Optional[object]:
    """
        Get a user/resource owner by id
    :param owner_id: The user id
    :return: User model or None
    """
    return (
        db.session.query(current_app.appbuilder.sm.user_model)
        .filter_by(id=owner_id)
        .one_or_none()
    )


def populate_owners(user: User, owners_ids: Optional[List[int]] = None) -> List[User]:
    """
    Helper function for commands, will fetch all users from owners id's
    Can raise ValidationError

    :param user: The current user
    :param owners_ids: A List of owners by id's
    """
    owners = list()
    if not owners_ids:
        return [user]
    if user.id not in owners_ids:
        owners.append(user)
    for owner_id in owners_ids:
        owner = get_owner_by_id(owner_id)
        if not owner:
            raise OwnersNotFoundValidationError()
        owners.append(owner)
    return owners
