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
# pylint: disable=isinstance-second-argument-not-valid-type
from typing import Any, Dict, List, Optional, Type, Union

from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import SQLAlchemyError, StatementError
from sqlalchemy.orm import Session

from superset.dao.exceptions import (
    DAOConfigError,
    DAOCreateFailedError,
    DAODeleteFailedError,
    DAOUpdateFailedError,
)
from superset.extensions import db


class BaseDAO:
    """
    Base DAO, implement base CRUD sqlalchemy operations
    """

    model_cls: Optional[Type[Model]] = None
    """
    Child classes need to state the Model class so they don't need to implement basic
    create, update and delete methods
    """
    base_filter: Optional[BaseFilter] = None
    """
    Child classes can register base filtering to be aplied to all filter methods
    """
    id_column_name = "id"

    @classmethod
    def find_by_id(
        cls,
        model_id: Union[str, int],
        session: Session = None,
        skip_base_filter: bool = False,
    ) -> Optional[Model]:
        """
        Find a model by id, if defined applies `base_filter`
        """
        session = session or db.session
        query = session.query(cls.model_cls)
        if cls.base_filter and not skip_base_filter:
            data_model = SQLAInterface(cls.model_cls, session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        id_column = getattr(cls.model_cls, cls.id_column_name)
        try:
            return query.filter(id_column == model_id).one_or_none()
        except StatementError:
            # can happen if int is passed instead of a string or similar
            return None

    @classmethod
    def find_by_ids(
        cls,
        model_ids: Union[List[str], List[int]],
        session: Session = None,
        skip_base_filter: bool = False,
    ) -> List[Model]:
        """
        Find a List of models by a list of ids, if defined applies `base_filter`
        """
        id_col = getattr(cls.model_cls, cls.id_column_name, None)
        if id_col is None:
            return []
        session = session or db.session
        query = session.query(cls.model_cls).filter(id_col.in_(model_ids))
        if cls.base_filter and not skip_base_filter:
            data_model = SQLAInterface(cls.model_cls, session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.all()

    @classmethod
    def find_all(cls) -> List[Model]:
        """
        Get all that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.all()

    @classmethod
    def find_one_or_none(cls, **filter_by: Any) -> Optional[Model]:
        """
        Get the first that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.filter_by(**filter_by).one_or_none()

    @classmethod
    def create(cls, properties: Dict[str, Any], commit: bool = True) -> Model:
        """
        Generic for creating models
        :raises: DAOCreateFailedError
        """
        if cls.model_cls is None:
            raise DAOConfigError()
        model = cls.model_cls()  # pylint: disable=not-callable
        for key, value in properties.items():
            setattr(model, key, value)
        try:
            db.session.add(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAOCreateFailedError(exception=ex) from ex
        return model

    @classmethod
    def save(cls, instance_model: Model, commit: bool = True) -> Model:
        """
        Generic for saving models
        :raises: DAOCreateFailedError
        """
        if cls.model_cls is None:
            raise DAOConfigError()
        if not isinstance(instance_model, cls.model_cls):
            raise DAOCreateFailedError(
                "the instance model is not a type of the model class"
            )
        try:
            db.session.add(instance_model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAOCreateFailedError(exception=ex) from ex
        return instance_model

    @classmethod
    def update(
        cls, model: Model, properties: Dict[str, Any], commit: bool = True
    ) -> Model:
        """
        Generic update a model
        :raises: DAOCreateFailedError
        """
        for key, value in properties.items():
            setattr(model, key, value)
        try:
            db.session.merge(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAOUpdateFailedError(exception=ex) from ex
        return model

    @classmethod
    def delete(cls, model: Model, commit: bool = True) -> Model:
        """
        Generic delete a model
        :raises: DAODeleteFailedError
        """
        try:
            db.session.delete(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAODeleteFailedError(exception=ex) from ex
        return model
