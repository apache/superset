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
from collections import OrderedDict
from datetime import datetime
from distutils.version import StrictVersion
import logging
import re
import textwrap
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib import parse

from sqlalchemy import Column, literal_column
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.result import RowProxy
from sqlalchemy.sql.expression import ColumnClause, Select

from superset import is_feature_enabled
from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import SupersetTemplateException
from superset.models.sql_types.presto_sql_types import type_map as presto_type_map
from superset.utils import core as utils

QueryStatus = utils.QueryStatus


class PrestoEngineSpec(BaseEngineSpec):
    engine = "presto"

    _time_grain_functions = {
        None: "{col}",
        "PT1S": "date_trunc('second', CAST({col} AS TIMESTAMP))",
        "PT1M": "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        "PT1H": "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        "P1D": "date_trunc('day', CAST({col} AS TIMESTAMP))",
        "P1W": "date_trunc('week', CAST({col} AS TIMESTAMP))",
        "P1M": "date_trunc('month', CAST({col} AS TIMESTAMP))",
        "P0.25Y": "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        "P1Y": "date_trunc('year', CAST({col} AS TIMESTAMP))",
        "P1W/1970-01-03T00:00:00Z": "date_add('day', 5, date_trunc('week', "
        "date_add('day', 1, CAST({col} AS TIMESTAMP))))",
        "1969-12-28T00:00:00Z/P1W": "date_add('day', -1, date_trunc('week', "
        "date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    @classmethod
    def get_view_names(cls, inspector: Inspector, schema: Optional[str]) -> List[str]:
        """Returns an empty list

        get_table_names() function returns all table names and view names,
        and get_view_names() is not implemented in sqlalchemy_presto.py
        https://github.com/dropbox/PyHive/blob/e25fc8440a0686bbb7a5db5de7cb1a77bdb4167a/pyhive/sqlalchemy_presto.py
        """
        return []

    @classmethod
    def _create_column_info(cls, name: str, data_type: str) -> dict:
        """
        Create column info object
        :param name: column name
        :param data_type: column data type
        :return: column info object
        """
        return {"name": name, "type": f"{data_type}"}

    @classmethod
    def _get_full_name(cls, names: List[Tuple[str, str]]) -> str:
        """
        Get the full column name
        :param names: list of all individual column names
        :return: full column name
        """
        return ".".join(column[0] for column in names if column[0])

    @classmethod
    def _has_nested_data_types(cls, component_type: str) -> bool:
        """
        Check if string contains a data type. We determine if there is a data type by
        whitespace or multiple data types by commas
        :param component_type: data type
        :return: boolean
        """
        comma_regex = r",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)"
        white_space_regex = r"\s(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)"
        return (
            re.search(comma_regex, component_type) is not None
            or re.search(white_space_regex, component_type) is not None
        )

    @classmethod
    def _split_data_type(cls, data_type: str, delimiter: str) -> List[str]:
        """
        Split data type based on given delimiter. Do not split the string if the
        delimiter is enclosed in quotes
        :param data_type: data type
        :param delimiter: string separator (i.e. open parenthesis, closed parenthesis,
               comma, whitespace)
        :return: list of strings after breaking it by the delimiter
        """
        return re.split(
            r"{}(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)".format(delimiter), data_type
        )

    @classmethod
    def _parse_structural_column(
        cls, parent_column_name: str, parent_data_type: str, result: List[dict]
    ) -> None:
        """
        Parse a row or array column
        :param result: list tracking the results
        """
        formatted_parent_column_name = parent_column_name
        # Quote the column name if there is a space
        if " " in parent_column_name:
            formatted_parent_column_name = f'"{parent_column_name}"'
        full_data_type = f"{formatted_parent_column_name} {parent_data_type}"
        original_result_len = len(result)
        # split on open parenthesis ( to get the structural
        # data type and its component types
        data_types = cls._split_data_type(full_data_type, r"\(")
        stack: List[Tuple[str, str]] = []
        for data_type in data_types:
            # split on closed parenthesis ) to track which component
            # types belong to what structural data type
            inner_types = cls._split_data_type(data_type, r"\)")
            for inner_type in inner_types:
                # We have finished parsing multiple structural data types
                if not inner_type and len(stack) > 0:
                    stack.pop()
                elif cls._has_nested_data_types(inner_type):
                    # split on comma , to get individual data types
                    single_fields = cls._split_data_type(inner_type, ",")
                    for single_field in single_fields:
                        single_field = single_field.strip()
                        # If component type starts with a comma, the first single field
                        # will be an empty string. Disregard this empty string.
                        if not single_field:
                            continue
                        # split on whitespace to get field name and data type
                        field_info = cls._split_data_type(single_field, r"\s")
                        # check if there is a structural data type within
                        # overall structural data type
                        if field_info[1] == "array" or field_info[1] == "row":
                            stack.append((field_info[0], field_info[1]))
                            full_parent_path = cls._get_full_name(stack)
                            result.append(
                                cls._create_column_info(
                                    full_parent_path, presto_type_map[field_info[1]]()
                                )
                            )
                        else:  # otherwise this field is a basic data type
                            full_parent_path = cls._get_full_name(stack)
                            column_name = "{}.{}".format(
                                full_parent_path, field_info[0]
                            )
                            result.append(
                                cls._create_column_info(
                                    column_name, presto_type_map[field_info[1]]()
                                )
                            )
                    # If the component type ends with a structural data type, do not pop
                    # the stack. We have run across a structural data type within the
                    # overall structural data type. Otherwise, we have completely parsed
                    # through the entire structural data type and can move on.
                    if not (inner_type.endswith("array") or inner_type.endswith("row")):
                        stack.pop()
                # We have an array of row objects (i.e. array(row(...)))
                elif "array" == inner_type or "row" == inner_type:
                    # Push a dummy object to represent the structural data type
                    stack.append(("", inner_type))
                # We have an array of a basic data types(i.e. array(varchar)).
                elif len(stack) > 0:
                    # Because it is an array of a basic data type. We have finished
                    # parsing the structural data type and can move on.
                    stack.pop()
        # Unquote the column name if necessary
        if formatted_parent_column_name != parent_column_name:
            for index in range(original_result_len, len(result)):
                result[index]["name"] = result[index]["name"].replace(
                    formatted_parent_column_name, parent_column_name
                )

    @classmethod
    def _show_columns(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> List[RowProxy]:
        """
        Show presto column names
        :param inspector: object that performs database schema inspection
        :param table_name: table name
        :param schema: schema name
        :return: list of column objects
        """
        quote = inspector.engine.dialect.identifier_preparer.quote_identifier
        full_table = quote(table_name)
        if schema:
            full_table = "{}.{}".format(quote(schema), full_table)
        columns = inspector.bind.execute("SHOW COLUMNS FROM {}".format(full_table))
        return columns

    @classmethod
    def get_columns(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> List[Dict[str, Any]]:
        """
        Get columns from a Presto data source. This includes handling row and
        array data types
        :param inspector: object that performs database schema inspection
        :param table_name: table name
        :param schema: schema name
        :return: a list of results that contain column info
                (i.e. column name and data type)
        """
        columns = cls._show_columns(inspector, table_name, schema)
        result: List[dict] = []
        for column in columns:
            try:
                # parse column if it is a row or array
                if is_feature_enabled("PRESTO_EXPAND_DATA") and (
                    "array" in column.Type or "row" in column.Type
                ):
                    structural_column_index = len(result)
                    cls._parse_structural_column(column.Column, column.Type, result)
                    result[structural_column_index]["nullable"] = getattr(
                        column, "Null", True
                    )
                    result[structural_column_index]["default"] = None
                    continue
                else:  # otherwise column is a basic data type
                    column_type = presto_type_map[column.Type]()
            except KeyError:
                logging.info(
                    "Did not recognize type {} of column {}".format(
                        column.Type, column.Column
                    )
                )
                column_type = "OTHER"
            column_info = cls._create_column_info(column.Column, column_type)
            column_info["nullable"] = getattr(column, "Null", True)
            column_info["default"] = None
            result.append(column_info)
        return result

    @classmethod
    def _is_column_name_quoted(cls, column_name: str) -> bool:
        """
        Check if column name is in quotes
        :param column_name: column name
        :return: boolean
        """
        return column_name.startswith('"') and column_name.endswith('"')

    @classmethod
    def _get_fields(cls, cols: List[dict]) -> List[ColumnClause]:
        """
        Format column clauses where names are in quotes and labels are specified
        :param cols: columns
        :return: column clauses
        """
        column_clauses = []
        # Column names are separated by periods. This regex will find periods in a
        # string if they are not enclosed in quotes because if a period is enclosed in
        # quotes, then that period is part of a column name.
        dot_pattern = r"""\.                # split on period
                          (?=               # look ahead
                          (?:               # create non-capture group
                          [^\"]*\"[^\"]*\"  # two quotes
                          )*[^\"]*$)        # end regex"""
        dot_regex = re.compile(dot_pattern, re.VERBOSE)
        for col in cols:
            # get individual column names
            col_names = re.split(dot_regex, col["name"])
            # quote each column name if it is not already quoted
            for index, col_name in enumerate(col_names):
                if not cls._is_column_name_quoted(col_name):
                    col_names[index] = '"{}"'.format(col_name)
            quoted_col_name = ".".join(
                col_name if cls._is_column_name_quoted(col_name) else f'"{col_name}"'
                for col_name in col_names
            )
            # create column clause in the format "name"."name" AS "name.name"
            column_clause = literal_column(quoted_col_name).label(col["name"])
            column_clauses.append(column_clause)
        return column_clauses

    @classmethod
    def _filter_out_array_nested_cols(
        cls, cols: List[dict]
    ) -> Tuple[List[dict], List[dict]]:
        """
        Filter out columns that correspond to array content. We know which columns to
        skip because cols is a list provided to us in a specific order where a
        structural column is positioned right before its content.

        Example: Column Name: ColA, Column Data Type: array(row(nest_obj int))
                 cols = [ ..., ColA, ColA.nest_obj, ... ]

        When we run across an array, check if subsequent column names start with the
        array name and skip them.
        :param cols: columns
        :return: filtered list of columns and list of array columns and its nested
        fields
        """
        filtered_cols = []
        array_cols = []
        curr_array_col_name = None
        for col in cols:
            # col corresponds to an array's content and should be skipped
            if curr_array_col_name and col["name"].startswith(curr_array_col_name):
                array_cols.append(col)
                continue
            # col is an array so we need to check if subsequent
            # columns correspond to the array's contents
            elif str(col["type"]) == "ARRAY":
                curr_array_col_name = col["name"]
                array_cols.append(col)
                filtered_cols.append(col)
            else:
                curr_array_col_name = None
                filtered_cols.append(col)
        return filtered_cols, array_cols

    @classmethod
    def select_star(
        cls,
        database,
        table_name: str,
        engine: Engine,
        schema: str = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = True,
        cols: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Include selecting properties of row objects. We cannot easily break arrays into
        rows, so render the whole array in its own row and skip columns that correspond
        to an array's contents.
        """
        cols = cols or []
        presto_cols = cols
        if is_feature_enabled("PRESTO_EXPAND_DATA") and show_cols:
            dot_regex = r"\.(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)"
            presto_cols = [
                col for col in presto_cols if not re.search(dot_regex, col["name"])
            ]
        return super().select_star(
            database,
            table_name,
            engine,
            schema,
            limit,
            show_cols,
            indent,
            latest_partition,
            presto_cols,
        )

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        database = uri.database
        if selected_schema and database:
            selected_schema = parse.quote(selected_schema, safe="")
            if "/" in database:
                database = database.split("/")[0] + "/" + selected_schema
            else:
                database += "/" + selected_schema
            uri.database = database
        return uri

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> str:
        tt = target_type.upper()
        if tt == "DATE":
            return "from_iso8601_date('{}')".format(dttm.isoformat()[:10])
        if tt == "TIMESTAMP":
            return "from_iso8601_timestamp('{}')".format(dttm.isoformat())
        return "'{}'".format(dttm.strftime("%Y-%m-%d %H:%M:%S"))

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def get_all_datasource_names(
        cls, db, datasource_type: str
    ) -> List[utils.DatasourceName]:
        datasource_df = db.get_df(
            "SELECT table_schema, table_name FROM INFORMATION_SCHEMA.{}S "
            "ORDER BY concat(table_schema, '.', table_name)".format(
                datasource_type.upper()
            ),
            None,
        )
        datasource_names: List[utils.DatasourceName] = []
        for unused, row in datasource_df.iterrows():
            datasource_names.append(
                utils.DatasourceName(
                    schema=row["table_schema"], table=row["table_name"]
                )
            )
        return datasource_names

    @classmethod
    def _build_column_hierarchy(
        cls, columns: List[dict], parent_column_types: List[str], column_hierarchy: dict
    ) -> None:
        """
        Build a graph where the root node represents a column whose data type is in
        parent_column_types. A node's children represent that column's nested fields
        :param columns: list of columns
        :param parent_column_types: list of data types that decide what columns can
               be root nodes
        :param column_hierarchy: dictionary representing the graph
        """
        if len(columns) == 0:
            return
        root = columns.pop(0)
        root_info = {"type": root["type"], "children": []}
        column_hierarchy[root["name"]] = root_info
        while columns:
            column = columns[0]
            # If the column name does not start with the root's name,
            # then this column is not a nested field
            if not column["name"].startswith(f"{root['name']}."):
                break
            # If the column's data type is one of the parent types,
            # then this column may have nested fields
            if str(column["type"]) in parent_column_types:
                cls._build_column_hierarchy(
                    columns, parent_column_types, column_hierarchy
                )
                root_info["children"].append(column["name"])
                continue
            else:  # The column is a nested field
                root_info["children"].append(column["name"])
                columns.pop(0)

    @classmethod
    def _create_row_and_array_hierarchy(
        cls, selected_columns: List[dict]
    ) -> Tuple[dict, dict, List[dict]]:
        """
        Build graphs where the root node represents a row or array and its children
        are that column's nested fields
        :param selected_columns: columns selected in a query
        :return: graph representing a row, graph representing an array, and a list
                 of all the nested fields
        """
        row_column_hierarchy: OrderedDict = OrderedDict()
        array_column_hierarchy: OrderedDict = OrderedDict()
        expanded_columns: List[dict] = []
        for column in selected_columns:
            if column["type"].startswith("ROW"):
                parsed_row_columns: List[dict] = []
                cls._parse_structural_column(
                    column["name"], column["type"].lower(), parsed_row_columns
                )
                expanded_columns = expanded_columns + parsed_row_columns[1:]
                filtered_row_columns, array_columns = cls._filter_out_array_nested_cols(
                    parsed_row_columns
                )
                cls._build_column_hierarchy(
                    filtered_row_columns, ["ROW"], row_column_hierarchy
                )
                cls._build_column_hierarchy(
                    array_columns, ["ROW", "ARRAY"], array_column_hierarchy
                )
            elif column["type"].startswith("ARRAY"):
                parsed_array_columns: List[dict] = []
                cls._parse_structural_column(
                    column["name"], column["type"].lower(), parsed_array_columns
                )
                expanded_columns = expanded_columns + parsed_array_columns[1:]
                cls._build_column_hierarchy(
                    parsed_array_columns, ["ROW", "ARRAY"], array_column_hierarchy
                )
        return row_column_hierarchy, array_column_hierarchy, expanded_columns

    @classmethod
    def _create_empty_row_of_data(cls, columns: List[dict]) -> dict:
        """
        Create an empty row of data
        :param columns: list of columns
        :return: dictionary representing an empty row of data
        """
        return {column["name"]: "" for column in columns}

    @classmethod
    def _expand_row_data(cls, datum: dict, column: str, column_hierarchy: dict) -> None:
        """
        Separate out nested fields and its value in a row of data
        :param datum: row of data
        :param column: row column name
        :param column_hierarchy: dictionary tracking structural columns and its
               nested fields
        """
        if column in datum:
            row_data = datum[column]
            row_children = column_hierarchy[column]["children"]
            if row_data and len(row_data) != len(row_children):
                raise Exception(
                    "The number of data values and number of nested"
                    "fields are not equal"
                )
            elif row_data:
                for index, data_value in enumerate(row_data):
                    datum[row_children[index]] = data_value
            else:
                for row_child in row_children:
                    datum[row_child] = ""

    @classmethod
    def _split_array_columns_by_process_state(
        cls, array_columns: List[str], array_column_hierarchy: dict, datum: dict
    ) -> Tuple[List[str], Set[str]]:
        """
        Take a list of array columns and split them according to whether or not we are
        ready to process them from a data set
        :param array_columns: list of array columns
        :param array_column_hierarchy: graph representing array columns
        :param datum: row of data
        :return: list of array columns ready to be processed and set of array columns
                 not ready to be processed
        """
        array_columns_to_process = []
        unprocessed_array_columns = set()
        child_array = None
        for array_column in array_columns:
            if array_column in datum:
                array_columns_to_process.append(array_column)
            elif str(array_column_hierarchy[array_column]["type"]) == "ARRAY":
                child_array = array_column
                unprocessed_array_columns.add(child_array)
            elif child_array and array_column.startswith(child_array):
                unprocessed_array_columns.add(array_column)
            else:
                # array without any data
                array_columns_to_process.append(array_column)
                datum[array_column] = []
        return array_columns_to_process, unprocessed_array_columns

    @classmethod
    def _convert_data_list_to_array_data_dict(
        cls, data: List[dict], array_columns_to_process: List[str]
    ) -> dict:
        """
        Pull out array data from rows of data into a dictionary where the key represents
        the index in the data list and the value is the array data values
        Example:
          data = [
              {'ColumnA': [1, 2], 'ColumnB': 3},
              {'ColumnA': [11, 22], 'ColumnB': 3}
          ]
          data dictionary = {
              0: [{'ColumnA': [1, 2]],
              1: [{'ColumnA': [11, 22]]
          }
        :param data: rows of data
        :param array_columns_to_process: array columns we want to pull out
        :return: data dictionary
        """
        array_data_dict = {}
        for data_index, datum in enumerate(data):
            all_array_datum = {}
            for array_column in array_columns_to_process:
                all_array_datum[array_column] = datum[array_column]
            array_data_dict[data_index] = [all_array_datum]
        return array_data_dict

    @classmethod
    def _process_array_data(
        cls, data: List[dict], all_columns: List[dict], array_column_hierarchy: dict
    ) -> dict:
        """
        Pull out array data that is ready to be processed into a dictionary.
        The key refers to the index in the original data set. The value is
        a list of data values. Initially this list will contain just one value,
        the row of data that corresponds to the index in the original data set.
        As we process arrays, we will pull out array values into separate rows
        and append them to the list of data values.
        Example:
          Original data set = [
              {'ColumnA': [1, 2], 'ColumnB': [3]},
              {'ColumnA': [11, 22], 'ColumnB': [33]}
          ]
          all_array_data (initially) = {
              0: [{'ColumnA': [1, 2], 'ColumnB': [3}],
              1: [{'ColumnA': [11, 22], 'ColumnB': [33]}]
          }
          all_array_data (after processing) = {
              0: [
                  {'ColumnA': 1, 'ColumnB': 3},
                  {'ColumnA': 2, 'ColumnB': ''},
              ],
              1: [
                  {'ColumnA': 11, 'ColumnB': 33},
                  {'ColumnA': 22, 'ColumnB': ''},
              ],
          }
        :param data: rows of data
        :param all_columns: list of columns
        :param array_column_hierarchy: graph representing array columns
        :return: dictionary representing processed array data
        """
        array_columns = list(array_column_hierarchy.keys())
        # Determine what columns are ready to be processed. This is necessary for
        # array columns that contain rows with nested arrays. We first process
        # the outer arrays before processing inner arrays.
        array_columns_to_process, unprocessed_array_columns = cls._split_array_columns_by_process_state(
            array_columns, array_column_hierarchy, data[0]
        )

        # Pull out array data that is ready to be processed into a dictionary.
        all_array_data = cls._convert_data_list_to_array_data_dict(
            data, array_columns_to_process
        )

        for original_data_index, expanded_array_data in all_array_data.items():
            for array_column in array_columns:
                if array_column in unprocessed_array_columns:
                    continue
                # Expand array values that are rows
                if str(array_column_hierarchy[array_column]["type"]) == "ROW":
                    for array_value in expanded_array_data:
                        cls._expand_row_data(
                            array_value, array_column, array_column_hierarchy
                        )
                    continue
                array_data = expanded_array_data[0][array_column]
                array_children = array_column_hierarchy[array_column]
                # This is an empty array of primitive data type
                if not array_data and not array_children["children"]:
                    continue
                # Pull out complex array values into its own row of data
                elif array_data and array_children["children"]:
                    for array_index, data_value in enumerate(array_data):
                        if array_index >= len(expanded_array_data):
                            empty_data = cls._create_empty_row_of_data(all_columns)
                            expanded_array_data.append(empty_data)
                        for index, datum_value in enumerate(data_value):
                            array_child = array_children["children"][index]
                            expanded_array_data[array_index][array_child] = datum_value
                # Pull out primitive array values into its own row of data
                elif array_data:
                    for array_index, data_value in enumerate(array_data):
                        if array_index >= len(expanded_array_data):
                            empty_data = cls._create_empty_row_of_data(all_columns)
                            expanded_array_data.append(empty_data)
                        expanded_array_data[array_index][array_column] = data_value
                # This is an empty array with nested fields
                else:
                    for index, array_child in enumerate(array_children["children"]):
                        for array_value in expanded_array_data:
                            array_value[array_child] = ""
        return all_array_data

    @classmethod
    def _consolidate_array_data_into_data(
        cls, data: List[dict], array_data: dict
    ) -> None:
        """
        Consolidate data given a list representing rows of data and a dictionary
        representing expanded array data
        Example:
          Original data set = [
              {'ColumnA': [1, 2], 'ColumnB': [3]},
              {'ColumnA': [11, 22], 'ColumnB': [33]}
          ]
          array_data = {
              0: [
                  {'ColumnA': 1, 'ColumnB': 3},
                  {'ColumnA': 2, 'ColumnB': ''},
              ],
              1: [
                  {'ColumnA': 11, 'ColumnB': 33},
                  {'ColumnA': 22, 'ColumnB': ''},
              ],
          }
          Final data set = [
               {'ColumnA': 1, 'ColumnB': 3},
               {'ColumnA': 2, 'ColumnB': ''},
               {'ColumnA': 11, 'ColumnB': 33},
               {'ColumnA': 22, 'ColumnB': ''},
          ]
        :param data: list representing rows of data
        :param array_data: dictionary representing expanded array data
        :return: list where data and array_data are combined
        """
        data_index = 0
        original_data_index = 0
        while data_index < len(data):
            data[data_index].update(array_data[original_data_index][0])
            array_data[original_data_index].pop(0)
            data[data_index + 1 : data_index + 1] = array_data[original_data_index]
            data_index = data_index + len(array_data[original_data_index]) + 1
            original_data_index = original_data_index + 1

    @classmethod
    def _remove_processed_array_columns(
        cls, unprocessed_array_columns: Set[str], array_column_hierarchy: dict
    ) -> None:
        """
        Remove keys representing array columns that have already been processed
        :param unprocessed_array_columns: list of unprocessed array columns
        :param array_column_hierarchy: graph representing array columns
        """
        array_columns = list(array_column_hierarchy.keys())
        for array_column in array_columns:
            if array_column in unprocessed_array_columns:
                continue
            else:
                del array_column_hierarchy[array_column]

    @classmethod
    def expand_data(
        cls, columns: List[dict], data: List[dict]
    ) -> Tuple[List[dict], List[dict], List[dict]]:
        """
        We do not immediately display rows and arrays clearly in the data grid. This
        method separates out nested fields and data values to help clearly display
        structural columns.

        Example: ColumnA is a row(nested_obj varchar) and ColumnB is an array(int)
        Original data set = [
            {'ColumnA': ['a1'], 'ColumnB': [1, 2]},
            {'ColumnA': ['a2'], 'ColumnB': [3, 4]},
        ]
        Expanded data set = [
            {'ColumnA': ['a1'], 'ColumnA.nested_obj': 'a1', 'ColumnB': 1},
            {'ColumnA': '',     'ColumnA.nested_obj': '',   'ColumnB': 2},
            {'ColumnA': ['a2'], 'ColumnA.nested_obj': 'a2', 'ColumnB': 3},
            {'ColumnA': '',     'ColumnA.nested_obj': '',   'ColumnB': 4},
        ]
        :param columns: columns selected in the query
        :param data: original data set
        :return: list of all columns(selected columns and their nested fields),
                 expanded data set, listed of nested fields
        """
        if not is_feature_enabled("PRESTO_EXPAND_DATA"):
            return columns, data, []

        all_columns: List[dict] = []
        # Get the list of all columns (selected fields and their nested fields)
        for column in columns:
            if column["type"].startswith("ARRAY") or column["type"].startswith("ROW"):
                cls._parse_structural_column(
                    column["name"], column["type"].lower(), all_columns
                )
            else:
                all_columns.append(column)

        # Build graphs where the root node is a row or array and its children are that
        # column's nested fields
        row_column_hierarchy, array_column_hierarchy, expanded_columns = cls._create_row_and_array_hierarchy(
            columns
        )

        # Pull out a row's nested fields and their values into separate columns
        ordered_row_columns = row_column_hierarchy.keys()
        for datum in data:
            for row_column in ordered_row_columns:
                cls._expand_row_data(datum, row_column, row_column_hierarchy)

        while array_column_hierarchy:
            array_columns = list(array_column_hierarchy.keys())
            # Determine what columns are ready to be processed.
            array_columns_to_process, unprocessed_array_columns = cls._split_array_columns_by_process_state(
                array_columns, array_column_hierarchy, data[0]
            )
            all_array_data = cls._process_array_data(
                data, all_columns, array_column_hierarchy
            )
            # Consolidate the original data set and the expanded array data
            cls._consolidate_array_data_into_data(data, all_array_data)
            # Remove processed array columns from the graph
            cls._remove_processed_array_columns(
                unprocessed_array_columns, array_column_hierarchy
            )

        return all_columns, data, expanded_columns

    @classmethod
    def extra_table_metadata(
        cls, database, table_name: str, schema_name: str
    ) -> Dict[str, Any]:
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        cols = indexes[0].get("column_names", [])
        full_table_name = table_name
        if schema_name and "." not in table_name:
            full_table_name = "{}.{}".format(schema_name, table_name)
        pql = cls._partition_query(full_table_name, database)
        col_names, latest_parts = cls.latest_partition(
            table_name, schema_name, database, show_first=True
        )
        latest_parts = latest_parts or tuple([None] * len(col_names))
        return {
            "partitions": {
                "cols": cols,
                "latest": dict(zip(col_names, latest_parts)),
                "partitionQuery": pql,
            }
        }

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Updates progress information"""
        query_id = query.id
        logging.info(f"Query {query_id}: Polling the cursor for progress")
        polled = cursor.poll()
        # poll returns dict -- JSON status information or ``None``
        # if the query is done
        # https://github.com/dropbox/PyHive/blob/
        # b34bdbf51378b3979eaf5eca9e956f06ddc36ca0/pyhive/presto.py#L178
        while polled:
            # Update the object and wait for the kill signal.
            stats = polled.get("stats", {})

            query = session.query(type(query)).filter_by(id=query_id).one()
            if query.status in [QueryStatus.STOPPED, QueryStatus.TIMED_OUT]:
                cursor.cancel()
                break

            if stats:
                state = stats.get("state")

                # if already finished, then stop polling
                if state == "FINISHED":
                    break

                completed_splits = float(stats.get("completedSplits"))
                total_splits = float(stats.get("totalSplits"))
                if total_splits and completed_splits:
                    progress = 100 * (completed_splits / total_splits)
                    logging.info(
                        "Query {} progress: {} / {} "
                        "splits".format(query_id, completed_splits, total_splits)
                    )
                    if progress > query.progress:
                        query.progress = progress
                    session.commit()
            time.sleep(1)
            logging.info(f"Query {query_id}: Polling the cursor for progress")
            polled = cursor.poll()

    @classmethod
    def extract_error_message(cls, e):
        if (
            hasattr(e, "orig")
            and type(e.orig).__name__ == "DatabaseError"
            and isinstance(e.orig[0], dict)
        ):
            error_dict = e.orig[0]
            return "{} at {}: {}".format(
                error_dict.get("errorName"),
                error_dict.get("errorLocation"),
                error_dict.get("message"),
            )
        if (
            type(e).__name__ == "DatabaseError"
            and hasattr(e, "args")
            and len(e.args) > 0
        ):
            error_dict = e.args[0]
            return error_dict.get("message")
        return utils.error_msg_from_exception(e)

    @classmethod
    def _partition_query(
        cls, table_name, database, limit=0, order_by=None, filters=None
    ):
        """Returns a partition query

        :param table_name: the name of the table to get partitions from
        :type table_name: str
        :param limit: the number of partitions to be returned
        :type limit: int
        :param order_by: a list of tuples of field name and a boolean
            that determines if that field should be sorted in descending
            order
        :type order_by: list of (str, bool) tuples
        :param filters: dict of field name and filter value combinations
        """
        limit_clause = "LIMIT {}".format(limit) if limit else ""
        order_by_clause = ""
        if order_by:
            l = []  # noqa: E741
            for field, desc in order_by:
                l.append(field + " DESC" if desc else "")
            order_by_clause = "ORDER BY " + ", ".join(l)

        where_clause = ""
        if filters:
            l = []  # noqa: E741
            for field, value in filters.items():
                l.append(f"{field} = '{value}'")
            where_clause = "WHERE " + " AND ".join(l)

        presto_version = database.get_extra().get("version")

        # Partition select syntax changed in v0.199, so check here.
        # Default to the new syntax if version is unset.
        partition_select_clause = (
            f'SELECT * FROM "{table_name}$partitions"'
            if not presto_version
            or StrictVersion(presto_version) >= StrictVersion("0.199")
            else f"SHOW PARTITIONS FROM {table_name}"
        )

        sql = textwrap.dedent(
            f"""\
            {partition_select_clause}
            {where_clause}
            {order_by_clause}
            {limit_clause}
        """
        )
        return sql

    @classmethod
    def where_latest_partition(
        cls,
        table_name: str,
        schema: str,
        database,
        query: Select,
        columns: Optional[List] = None,
    ) -> Optional[Select]:
        try:
            col_names, values = cls.latest_partition(
                table_name, schema, database, show_first=True
            )
        except Exception:
            # table is not partitioned
            return None

        if values is None:
            return None

        column_names = {column.get("name") for column in columns or []}
        for col_name, value in zip(col_names, values):
            if col_name in column_names:
                query = query.where(Column(col_name) == value)
        return query

    @classmethod
    def _latest_partition_from_df(cls, df) -> Optional[List[str]]:
        if not df.empty:
            return df.to_records(index=False)[0].item()
        return None

    @classmethod
    def latest_partition(
        cls, table_name: str, schema: str, database, show_first: bool = False
    ):
        """Returns col name and the latest (max) partition value for a table

        :param table_name: the name of the table
        :param schema: schema / database / namespace
        :param database: database query will be run against
        :type database: models.Database
        :param show_first: displays the value for the first partitioning key
          if there are many partitioning keys
        :type show_first: bool

        >>> latest_partition('foo_table')
        (['ds'], ('2018-01-01',))
        """
        indexes = database.get_indexes(table_name, schema)
        if len(indexes[0]["column_names"]) < 1:
            raise SupersetTemplateException(
                "The table should have one partitioned field"
            )
        elif not show_first and len(indexes[0]["column_names"]) > 1:
            raise SupersetTemplateException(
                "The table should have a single partitioned field "
                "to use this function. You may want to use "
                "`presto.latest_sub_partition`"
            )
        column_names = indexes[0]["column_names"]
        part_fields = [(column_name, True) for column_name in column_names]
        sql = cls._partition_query(table_name, database, 1, part_fields)
        df = database.get_df(sql, schema)
        return column_names, cls._latest_partition_from_df(df)

    @classmethod
    def latest_sub_partition(cls, table_name, schema, database, **kwargs):
        """Returns the latest (max) partition value for a table

        A filtering criteria should be passed for all fields that are
        partitioned except for the field to be returned. For example,
        if a table is partitioned by (``ds``, ``event_type`` and
        ``event_category``) and you want the latest ``ds``, you'll want
        to provide a filter as keyword arguments for both
        ``event_type`` and ``event_category`` as in
        ``latest_sub_partition('my_table',
            event_category='page', event_type='click')``

        :param table_name: the name of the table, can be just the table
            name or a fully qualified table name as ``schema_name.table_name``
        :type table_name: str
        :param schema: schema / database / namespace
        :type schema: str
        :param database: database query will be run against
        :type database: models.Database

        :param kwargs: keyword arguments define the filtering criteria
            on the partition list. There can be many of these.
        :type kwargs: str
        >>> latest_sub_partition('sub_partition_table', event_type='click')
        '2018-01-01'
        """
        indexes = database.get_indexes(table_name, schema)
        part_fields = indexes[0]["column_names"]
        for k in kwargs.keys():
            if k not in k in part_fields:
                msg = "Field [{k}] is not part of the portioning key"
                raise SupersetTemplateException(msg)
        if len(kwargs.keys()) != len(part_fields) - 1:
            msg = (
                "A filter needs to be specified for {} out of the " "{} fields."
            ).format(len(part_fields) - 1, len(part_fields))
            raise SupersetTemplateException(msg)

        for field in part_fields:
            if field not in kwargs.keys():
                field_to_return = field

        sql = cls._partition_query(
            table_name, database, 1, [(field_to_return, True)], kwargs
        )
        df = database.get_df(sql, schema)
        if df.empty:
            return ""
        return df.to_dict()[field_to_return][0]
