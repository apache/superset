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
import string
from random import choice

from superset import db
from superset.connectors.sqla.models import SqlaTable


def get_sql_table_by_name(table_name: str):
    return db.session.query(SqlaTable).filter_by(table_name=table_name).one()


def get_random_string(length):
    letters = string.ascii_lowercase
    result_str = "".join(choice(letters) for i in range(length))
    print("Random string of length", length, "is:", result_str)
    return result_str


def random_str():
    return get_random_string(8)
