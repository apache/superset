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
import datetime
from typing import List


class BaseLlm:
    llm_type = "Base"
    max_results = 1000

    def __init__(self, pk, dialect, context):
        self.pk = pk
        self.dialect = dialect
        self.context = context
        self.created_at = datetime.datetime.now(datetime.timezone.utc)

    def __str__(self):
        return f"{self.llm_type} ({self.dialect} DB {self.pk})"

    def __repr__(self):
        return self.__str__()

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if not hasattr(cls, "llm_type"):
            raise TypeError(
                f"Can't instantiate abstract class {cls.__name__} without llm_type attribute"
            )

    def __eq__(self, other):
        return self.__str__() == other.__str__()

    def __hash__(self):
        return hash(self.__str__())

    def generate_sql(
        pk: int, prompt: str, context: str, schemas: List[str] | None
    ) -> str:
        raise NotImplementedError

    def get_system_instructions() -> str:
        raise NotImplementedError

    @staticmethod
    def get_models() -> List[str]:
        """
        Return a list of available models for the LLM.
        """
        raise NotImplementedError

    def get_context_size(self) -> int:
        """
        Return the size of the context in tokens.
        """
        raise NotImplementedError
