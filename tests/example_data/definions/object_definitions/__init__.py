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
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Union

from ....common.logger_utils import log


def filter_definition_factory(
    subject_as_left_operand: str, comparator_as_right_operand: str, operator: str = "=="
) -> Dict[str, Union[bool, str]]:
    return {
        "clause": "WHERE",
        "comparator": comparator_as_right_operand,
        "expressionType": "SIMPLE",
        "operator": operator,
        "subject": subject_as_left_operand,
    }


class ExampleDataDefinitionsHolder(ABC):
    @abstractmethod
    def get_dashboard_positions(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def get_default_dashboard_metadata(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def get_slices_definitions(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def get_default_slice_params(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def get_default_slice_query_context(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def get_example_table_columns(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_table_metrics(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_aggregated_example_columns(self) -> List[Dict[str, Any]]:
        ...


DEFAULT_TABLE_METRICS = [
    {
        "metric_name": "count",
        "verbose_name": "COUNT(*)",
        "metric_type": "count",
        "expression": "COUNT(*)",
    }
]


@log
class BaseExampleDataDefinitionsHolder(ExampleDataDefinitionsHolder, ABC):
    _example_table_columns_supplier: Callable[[], List[Dict[str, Any]]]

    def __init__(
        self, example_table_columns_supplier: Callable[[], List[Dict[str, Any]]]
    ):
        self._example_table_columns_supplier = (  # type: ignore
            example_table_columns_supplier
        )

    def get_example_table_columns(self) -> List[Dict[str, Any]]:
        return self._example_table_columns_supplier()  # type: ignore

    def get_table_metrics(self) -> List[Dict[str, Any]]:
        return DEFAULT_TABLE_METRICS.copy()
