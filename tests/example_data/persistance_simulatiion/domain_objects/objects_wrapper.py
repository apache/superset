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
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional, TYPE_CHECKING, Union

if TYPE_CHECKING:
    from ..domain_objects import DomainObjectTypeNames, SupersetDomain


class DomainObjectsWrapper(ABC):
    _wrapped_type: DomainObjectTypeNames

    def __init__(self, _wrapped_type: DomainObjectTypeNames):
        self._wrapped_type = _wrapped_type

    def get_wrapped_type(self) -> DomainObjectTypeNames:
        return self._wrapped_type

    @abstractmethod
    def get_parent_objects(self) -> List[SupersetDomain]:
        ...

    @abstractmethod
    def get_children_objects(self) -> List[SupersetDomain]:
        ...


class DomainObjectsWrapperBuilder(DomainObjectsWrapper):
    _parents: List[SupersetDomain]
    _children_wrappers: List[DomainObjectsWrapper]
    _children_objects: List[SupersetDomain]

    def __init__(
        self,
        _wrapped_type: DomainObjectTypeNames,
        parents: Union[List[SupersetDomain], SupersetDomain],
    ):
        super().__init__(_wrapped_type)
        self._parents = []
        self._children_wrappers = []
        self._children_objects = []
        self._add_parents(parents)

    def get_parent_objects(self) -> List[SupersetDomain]:
        return self._parents.copy()

    def get_children_objects(self) -> List[SupersetDomain]:
        return self._children_objects.copy()

    def _add_parents(
        self, parents_objects: Union[List[SupersetDomain], SupersetDomain]
    ) -> DomainObjectsWrapperBuilder:
        if not isinstance(parents_objects, list):
            self._parents.append(parents_objects)
        else:
            self._parents.extend(parents_objects)
        return self

    def add_children(self, children: List[SupersetDomain]) -> None:
        self._children_objects.extend(children)

    def build(self) -> DomainObjectsWrapper:
        return self
