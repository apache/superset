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
# pylint: disable=C,R,W
import hashlib
import re

from sqlalchemy import literal_column

from superset.db_engine_specs.base import BaseEngineSpec


class BigQueryEngineSpec(BaseEngineSpec):
    """Engine spec for Google's BigQuery

    As contributed by @mxmzdlv on issue #945"""
    engine = 'bigquery'
    max_column_name_length = 128

    """
    https://www.python.org/dev/peps/pep-0249/#arraysize
    raw_connections bypass the pybigquery query execution context and deal with
    raw dbapi connection directly.
    If this value is not set, the default value is set to 1, as described here,
    https://googlecloudplatform.github.io/google-cloud-python/latest/_modules/google/cloud/bigquery/dbapi/cursor.html#Cursor

    The default value of 5000 is derived from the pybigquery.
    https://github.com/mxmzdlv/pybigquery/blob/d214bb089ca0807ca9aaa6ce4d5a01172d40264e/pybigquery/sqlalchemy_bigquery.py#L102
    """
    arraysize = 5000

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'TIMESTAMP_TRUNC({col}, SECOND)',
        'PT1M': 'TIMESTAMP_TRUNC({col}, MINUTE)',
        'PT1H': 'TIMESTAMP_TRUNC({col}, HOUR)',
        'P1D': 'TIMESTAMP_TRUNC({col}, DAY)',
        'P1W': 'TIMESTAMP_TRUNC({col}, WEEK)',
        'P1M': 'TIMESTAMP_TRUNC({col}, MONTH)',
        'P0.25Y': 'TIMESTAMP_TRUNC({col}, QUARTER)',
        'P1Y': 'TIMESTAMP_TRUNC({col}, YEAR)',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "'{}'".format(dttm.strftime('%Y-%m-%d'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def fetch_data(cls, cursor, limit):
        data = super(BigQueryEngineSpec, cls).fetch_data(cursor, limit)
        if data and type(data[0]).__name__ == 'Row':
            data = [r.values() for r in data]
        return data

    @staticmethod
    def mutate_label(label):
        """
        BigQuery field_name should start with a letter or underscore and contain only
        alphanumeric characters. Labels that start with a number are prefixed with an
        underscore. Any unsupported characters are replaced with underscores and an
        md5 hash is added to the end of the label to avoid possible collisions.
        :param str label: the original label which might include unsupported characters
        :return: String that is supported by the database
        """
        label_hashed = '_' + hashlib.md5(label.encode('utf-8')).hexdigest()

        # if label starts with number, add underscore as first character
        label_mutated = '_' + label if re.match(r'^\d', label) else label

        # replace non-alphanumeric characters with underscores
        label_mutated = re.sub(r'[^\w]+', '_', label_mutated)
        if label_mutated != label:
            # add md5 hash to label to avoid possible collisions
            label_mutated += label_hashed

        return label_mutated

    @classmethod
    def truncate_label(cls, label):
        """BigQuery requires column names start with either a letter or
        underscore. To make sure this is always the case, an underscore is prefixed
        to the truncated label.
        """
        return '_' + hashlib.md5(label.encode('utf-8')).hexdigest()

    @classmethod
    def extra_table_metadata(cls, database, table_name, schema_name):
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        partitions_columns = [
            index.get('column_names', []) for index in indexes
            if index.get('name') == 'partition'
        ]
        cluster_columns = [
            index.get('column_names', []) for index in indexes
            if index.get('name') == 'clustering'
        ]
        return {
            'partitions': {
                'cols': partitions_columns,
            },
            'clustering': {
                'cols': cluster_columns,
            },
        }

    @classmethod
    def _get_fields(cls, cols):
        """
        BigQuery dialect requires us to not use backtick in the fieldname which are
        nested.
        Using literal_column handles that issue.
        https://docs.sqlalchemy.org/en/latest/core/tutorial.html#using-more-specific-text-with-table-literal-column-and-column
        Also explicility specifying column names so we don't encounter duplicate
        column names in the result.
        """
        return [literal_column(c.get('name')).label(c.get('name').replace('.', '__'))
                for c in cols]

    @classmethod
    def epoch_to_dttm(cls):
        return 'TIMESTAMP_SECONDS({col})'

    @classmethod
    def epoch_ms_to_dttm(cls):
        return 'TIMESTAMP_MILLIS({col})'
