#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from typing import List
from unittest.mock import Mock

from pytest import fixture, raises

from superset.charts.data.query_context_validators import QueryContextValidator
from superset.charts.data.query_context_validators.impl import QueryContextValidatorImpl


@fixture
def access_validator() -> QueryContextValidator:
    return Mock(spec=QueryContextValidator)


@fixture
def validator(access_validator) -> QueryContextValidator:
    return QueryContextValidatorImpl(access_validator)


@fixture
def query_context(queries_object) -> Mock:
    mock = Mock()
    mock.queries = queries_object
    return mock


@fixture
def queries_object() -> List[Mock]:
    return []


class TestQueryContextValidatorImpl:
    def test_when_query_context_is_valid__validation_success(
        self,
        query_context: Mock,
        validator: QueryContextValidator,
        access_validator: Mock,
    ):
        # arrange
        query_context.queries.append(Mock())
        query_context.queries.append(Mock())

        # act
        validator.validate(query_context)

        # assert
        access_validator.validate.assert_called_once_with(query_context)
        for query in query_context.queries:
            query.validate.assert_called_once()

    def test_when_actor_can_not_access__exception_raised(
        self,
        query_context: Mock,
        validator: QueryContextValidator,
        access_validator: Mock,
    ):
        # arrange
        exception = Mock()

        def raise_exception(*args, **kwargs):
            raise exception

        access_validator.validate.side_effect = raise_exception

        # act
        with raises(Exception):
            validator.validate(query_context)

        # assert
        access_validator.validate.assert_called_once_with(query_context)

    def test_when_first_query_object_invalid__exception_raised(
        self, query_context: Mock, validator: QueryContextValidator
    ):
        # arrange
        exception = Mock()

        def raise_exception(*args, **kwargs):
            raise exception

        first_query_object = Mock()
        first_query_object.validate.side_effect = raise_exception
        second_query_object = Mock()
        query_context.queries.append(first_query_object)
        query_context.queries.append(second_query_object)

        # act
        with raises(Exception):
            validator.validate(query_context)

        # assert
        first_query_object.validate.assert_called_once()
        second_query_object.validate.assert_not_called()

    def test_when_second_query_object_invalid__exception_raised(
        self, query_context: Mock, validator: QueryContextValidator
    ):
        # arrange
        exception = Mock()

        def raise_exception(*args, **kwargs):
            raise exception

        first_query_object = Mock()
        second_query_object = Mock()
        second_query_object.validate.side_effect = raise_exception
        query_context.queries.append(first_query_object)
        query_context.queries.append(second_query_object)

        # act
        with raises(Exception):
            validator.validate(query_context)

        # assert
        first_query_object.validate.assert_called_once()
        second_query_object.validate.assert_called_once()
