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
from typing import Any, cast, Dict, List, Optional
from uuid import uuid4

from flask import g
from flask_babel import gettext as __, lazy_gettext as _

from superset import db
from superset.connectors.base.models import BaseDatasource
from superset.connectors.sqla.models import SqlaTable
from superset.databases.dao import DatabaseDAO
from superset.datasets.commands.update import UpdateDatasetCommand
from superset.datasource.dao import DatasourceDAO
from superset.exceptions import SupersetException, SupersetGenericDBErrorException
from superset.views.multi_dataset import CreateMultiDatasetCommand

TMP_TABLE_NAME_PREFIX = "tmp__"

SPECIAL_CHARACTERS = {"$": "", "-": "_"}

SMALLCASE_A_ASCII_CODE = 97
SQL_POSTFIX_SCHEMA = "WHERE 1=2"


class ExploreResponse:
    def __init__(self, form_data: Dict[str, Any]):
        self.form_data = form_data
    @staticmethod
    def get_datasources_data(datasources: List):
        """
        Returns Datasource IDs and Types in seperate Lists
        """
        datasource_ids: List[int] = []
        datasource_typrs: List[str] = []

        for datasource in datasources:
            datasource_id, datasourceType = datasource.split("__")
            datasource_ids.append(int(datasource_id))
            datasource_typrs.append(datasourceType)

        return datasource_ids, datasource_typrs

    @staticmethod
    def get_base_datasources(
        datasource_ids: List[int], datasource_typrs: List[str]
    ) -> List[BaseDatasource]:
        """
        Gets a List of Datasets given ID's
        """
        datasources: Optional[List[BaseDatasource]] = []
        for index, value in enumerate(datasource_ids):
            newDatasource = DatasourceDAO.get_datasource(
                db.session, cast(str, datasource_typrs[index]), value
            )
            datasources.append(newDatasource)
        return datasources

    @staticmethod
    def get_table_name(datasources: List[BaseDatasource]) -> str:
        """
        Creates a Table name by combining all dataset names along with a Unique ID
        """
        TMP_TABLE_NAME = TMP_TABLE_NAME_PREFIX
        for datasource in datasources:
            tableName = datasource.data["table_name"]
            TMP_TABLE_NAME += tableName + "__"
        TMP_TABLE_NAME += str(uuid4())[:4]
        return TMP_TABLE_NAME

    @staticmethod
    def replace_special_characters(column: str) -> str:
        for char, replacedChar in SPECIAL_CHARACTERS.items():
            column.replace(char, replacedChar)
        return column

    @staticmethod
    def get_calculated_column_expression(
        columns: List[Dict[str, Any]], column_expression: str, alias: str
    ) -> str:
        changed_expression = column_expression
        for column in columns:
            column_name = column["column_name"]
            changed_expression = changed_expression.replace(
                column_name, "{}.{}".format(alias, column_name)
            )
        return changed_expression

    @staticmethod
    def get_column_aliases(columns: List[Dict[str, Any]], alias: str) -> List[str]:
        """
        Returns a list of Column names as Aliases for a SELECT Query
        """
        renamedColumns = []
        columnExpressions = {}
        for column in columns:
            column_name = column["column_name"]
            expression = column["expression"]
            if expression:
                columnName = ExploreResponse.get_calculated_column_expression(
                    columns, expression, alias
                )
                columnExpressions[column_name] = columnName
            else:
                columnName = "{}.{}".format(alias, column_name)
            columnAlias = "{}_{}".format(
                alias, ExploreResponse.replace_special_characters(column_name)
            )
            renamedColumns.append("{} {}".format(columnName, columnAlias))
        return renamedColumns, columnExpressions

    @staticmethod
    def map_and_get_column_names(datasources: List[BaseDatasource]) -> List[str]:
        """
        Iterates through Datasets and returns Column Aliases for each Dataset
        """
        tableColumnExpressions: Dict = {}
        mappedColumns: list[str] = []
        for index, datasource in enumerate(datasources):
            tableName = datasource.data["table_name"]
            columns: list[Dict[str, Any]] = datasource.data["columns"]
            renamedColumns, expressionColumns = ExploreResponse.get_column_aliases(
                columns, chr(SMALLCASE_A_ASCII_CODE + index)
            )
            columnAliases = ",".join(renamedColumns)
            mappedColumns.append(columnAliases)
            tableColumnExpressions[tableName] = expressionColumns
        return mappedColumns, tableColumnExpressions

    @staticmethod
    def column_join(tableExpressions: Dict, columnJoin: str, table: str) -> str:
        return (
            tableExpressions[columnJoin]
            if columnJoin in tableExpressions
            else "{}.{}".format(table, columnJoin)
        )

    @staticmethod
    def get_single_column_join(
        firstTable: str,
        secondTable: str,
        columnJoins: List,
        firstTableExpressions: Dict,
        secondTableExpressions: Dict,
    ) -> str:
        join = columnJoins.pop()
        firstColumnJoin = join["first_column"]
        secondColumnJoin = join["second_column"]
        leftJoin = ExploreResponse.column_join(
            firstTableExpressions, firstColumnJoin, firstTable
        )
        rightJoin = ExploreResponse.column_join(
            secondTableExpressions, secondColumnJoin, secondTable
        )
        return "{}={}".format(leftJoin, rightJoin)

    @staticmethod
    def __getMultipleColumnJoin(
        firstTable: str,
        secondTable: str,
        columnJoins: List,
        firstTableExpressions: Dict,
        secondTableExpressions: Dict,
    ) -> str:
        joinStatement = ""
        lastJoin = columnJoins.pop()
        lastJoinFirstColumn = lastJoin["first_column"]
        lastJoinSecondColumn = lastJoin["second_column"]
        lastLeftJoin = ExploreResponse.column_join(
            firstTableExpressions, lastJoinFirstColumn, firstTable
        )
        lastRightJoin = ExploreResponse.column_join(
            secondTableExpressions, lastJoinSecondColumn, secondTable
        )

        for count, join in enumerate(columnJoins):
            firstColumnJoin = join["first_column"]
            secondColumnJoin = join["second_column"]
            leftJoin = ExploreResponse.column_join(
                firstTableExpressions, firstColumnJoin, firstTable
            )
            rightJoin = ExploreResponse.column_join(
                secondTableExpressions, secondColumnJoin, secondTable
            )
            joinString = (
                "{}={}".format(leftJoin, rightJoin)
                if count == len(columnJoins) - 1
                else "{}={}, ".format(leftJoin, rightJoin)
            )
            joinStatement += joinString
        joinStatement += " AND " + "{}={}".format(lastLeftJoin, lastRightJoin)

        return joinStatement

    @staticmethod
    def __getJoinQuery(
        datasetJoins: List,
        joins: List,
        datasources: List[BaseDatasource],
        tableColumnExpressions: Dict,
    ) -> str:
        JOIN_STATEMENT = ""
        for index, columnJoins in enumerate(datasetJoins):
            tableJoin = ""
            firstDataset = datasources[index]
            secondDataset = datasources[index + 1]
            firstTableNameAlias = chr(SMALLCASE_A_ASCII_CODE + index)
            secondTableNameAlias = chr(SMALLCASE_A_ASCII_CODE + index + 1)
            firstTableExpressions = tableColumnExpressions[
                datasources[index].data["table_name"]
            ]
            secondTableExpressions = tableColumnExpressions[
                datasources[index].data["table_name"]
            ]
            if len(columnJoins) == 1:
                tableJoin += ExploreResponse.get_single_column_join(
                    firstTableNameAlias,
                    secondTableNameAlias,
                    columnJoins,
                    firstTableExpressions,
                    secondTableExpressions,
                )
            else:
                tableJoin += ExploreResponse.__getMultipleColumnJoin(
                    firstTableNameAlias,
                    secondTableNameAlias,
                    columnJoins,
                    firstTableExpressions,
                    secondTableExpressions,
                )
            if index == 0:
                JOIN_STATEMENT += "{} {} {} {} {} ON {} ".format(
                    firstDataset.name,
                    firstTableNameAlias,
                    joins[index],
                    secondDataset.name,
                    secondTableNameAlias,
                    tableJoin,
                )
            else:
                JOIN_STATEMENT += "{} {} {} ON {} ".format(
                    joins[index], secondDataset.name, secondTableNameAlias, tableJoin
                )
        return JOIN_STATEMENT

    def multiple_dataset(self):
        joins: list = self.form_data.get("joins")
        dataset_joins: list = self.form_data.get("column_joins")
        first_datasource: str = self.form_data.get("first_datasource")
        additional_datasources: list = self.form_data.get("additional_datasources")

        additional_datasources.insert(0, first_datasource)
        datasource_ids, datasource_types = self.get_datasources_data(
            additional_datasources
        )

        datasources = self.get_base_datasources(datasource_ids, datasource_types)

        table_name = self.get_table_name(datasources)
        mapped_columns, table_column_expressions = self.map_and_get_column_names(
            datasources
        )

        column_aliases = ",".join(mapped_columns)
        join_statement = self.__getJoinQuery(
            dataset_joins, joins, datasources, table_column_expressions
        )

        sql_query = "SELECT {} FROM {} ".format(column_aliases, join_statement)

        presto_database = DatabaseDAO.get_database_by_name(
            datasources[0].data["database"]["name"]
        )

        try:
            new_model = CreateMultiDatasetCommand(
                g.user,
                {
                    "table_name": table_name,
                    "database": presto_database,
                    "database_id": presto_database.id,
                    "sql": "{} {}".format(sql_query, SQL_POSTFIX_SCHEMA),
                },
            ).run()
        except Exception as ex:
            raise SupersetGenericDBErrorException(message=ex.message)

        changed_model = UpdateDatasetCommand(new_model.id, {"sql": sql_query}).run()

        datasource = DatasourceDAO.get_datasource(
            db.session, cast(str, changed_model.type), changed_model.id
        )

        return datasource, datasource.name
