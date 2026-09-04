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
from sqlalchemy import DateTime, Integer, String

from tests.consts.birth_names import (
    DS,
    GENDER,
    NAME,
    NUM,
    NUM_BOYS,
    NUM_GIRLS,
    STATE,
    TABLE_NAME,
)
from tests.example_data.data_loading.data_definitions.types import (
    TableMetaData,
    TableMetaDataFactory,
)

BIRTH_NAMES_COLUMNS = {
    DS: DateTime,
    GENDER: String(16),
    NAME: String(255),
    NUM: Integer,
    STATE: String(10),
    NUM_BOYS: Integer,
    NUM_GIRLS: Integer,
}

BIRTH_NAMES_COLUMNS_WITHOUT_DATETIME = {
    DS: String(255),
    GENDER: String(16),
    NAME: String(255),
    NUM: Integer,
    STATE: String(10),
    NUM_BOYS: Integer,
    NUM_GIRLS: Integer,
}


class BirthNamesMetaDataFactory(TableMetaDataFactory):
    _datetime_type_support: bool

    def __init__(self, datetime_type_support: bool = True):
        self._datetime_type_support = datetime_type_support

    def make(self) -> TableMetaData:
        if self._datetime_type_support:
            return TableMetaData(TABLE_NAME, BIRTH_NAMES_COLUMNS.copy())
        return TableMetaData(TABLE_NAME, BIRTH_NAMES_COLUMNS_WITHOUT_DATETIME.copy())
