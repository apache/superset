from uuid import uuid4
from typing import Any, Dict, List, Optional, cast

from flask import g
from superset import db
from superset.datasource.dao import DatasourceDAO
from superset.databases.dao import DatabaseDAO
from flask_babel import gettext as __, lazy_gettext as _
from superset.connectors.base.models import BaseDatasource

from superset.connectors.sqla.models import SqlaTable
from superset.views.multi_dataset import CreateMultiDatasetCommand
from superset.datasets.commands.update import UpdateDatasetCommand
from superset.exceptions import SupersetException, SupersetGenericDBErrorException


TMP_TABLE_NAME_PREFIX = 'tmp__'

SPECIAL_CHARACTERS = {
    '$': "",
    "-": "_"
}

SMALLCASE_A_ASCII_CODE = 97
SQL_POSTFIX_SCHEMA = 'WHERE 1=2'

class ExploreResponse():
    def __init__(self, form_data: Dict[str, Any]):
        self.form_data = form_data

    def single_dataset(self, datasource_id: int, datasource_type: str):
        datasource: Optional[BaseDatasource] = None

        if datasource_id is not None:
            try:
                datasource = DatasourceDAO.get_datasource(
                    db.session, cast(str, datasource_type), datasource_id
                )
            except SupersetException:
                datasource_id = None
                datasource_type = SqlaTable.type

        datasource_name = datasource.name if datasource else _("[Missing Dataset]")

        return datasource, datasource_name

    @staticmethod
    def __getDatasourcesData(datasources: List):
        """
        Returns Datasource IDs and Types in seperate Lists
        """
        datasourceIds: List[int] = []
        datasourceTypes: List[str] = []

        for datasource in datasources:
                datasourceId, datasourceType = datasource.split("__")
                datasourceIds.append(int(datasourceId))
                datasourceTypes.append(datasourceType)

        return datasourceIds, datasourceTypes

    @staticmethod
    def __getBaseDatasources(datasourceIds: List[int], datasourceTypes: List[str]) -> List[BaseDatasource]:
        """
        Gets a List of Datasets given ID's
        """
        datasources: Optional[List[BaseDatasource]] = []
        for index, value in enumerate(datasourceIds):
            newDatasource = DatasourceDAO.get_datasource(
                db.session, cast(str, datasourceTypes[index]), value
            )
            datasources.append(newDatasource)
        return datasources

    @staticmethod
    def __getTableName(datasources: List[BaseDatasource]) -> str:
        """
        Creates a Table name by combining all dataset names along with a Unique ID
        """
        TMP_TABLE_NAME = TMP_TABLE_NAME_PREFIX
        for datasource in datasources:
            tableName =  datasource.data["table_name"]
            TMP_TABLE_NAME += tableName + "__"
        TMP_TABLE_NAME += str(uuid4())[:4]
        return TMP_TABLE_NAME

    @staticmethod
    def __replaceSpecialCharacters(column: str) -> str:
        for char, replacedChar in SPECIAL_CHARACTERS.items():
            column.replace(char, replacedChar )
        return column

    @staticmethod
    def __getCalculatedColumnExpression(columns: List[Dict[str, Any]], column_expression: str, alias: str) -> str:
        changed_expression = column_expression
        for column in columns:
            column_name = column["column_name"]
            changed_expression = changed_expression.replace(column_name, "{}.{}".format(alias, column_name))
        return changed_expression

    @staticmethod
    def __getColumnAliases(columns: List[Dict[str, Any]], alias: str) -> List[str]:
        """
        Returns a list of Column names as Aliases for a SELECT Query
        """
        renamedColumns = []
        columnExpressions = {}
        for column in columns:
            column_name = column["column_name"]
            expression = column["expression"]
            if expression:
                columnName = ExploreResponse.__getCalculatedColumnExpression(columns, expression, alias)
                columnExpressions[column_name] = columnName
            else:
                columnName = "{}.{}".format(alias, column_name)
            columnAlias = "{}_{}".format(alias, ExploreResponse.__replaceSpecialCharacters(column_name))
            renamedColumns.append("{} {}".format(columnName, columnAlias))
        return renamedColumns, columnExpressions

    @staticmethod
    def __mapAndGetColumnNames(datasources: List[BaseDatasource]) -> List[str]:
        """
        Iterates through Datasets and returns Column Aliases for each Dataset
        """
        tableColumnExpressions: Dict = {}
        mappedColumns: list[str] = []
        for index, datasource in enumerate(datasources):
            tableName = datasource.data["table_name"]
            columns: list[Dict[str, Any]] = datasource.data["columns"]
            renamedColumns, expressionColumns  = ExploreResponse.__getColumnAliases(
                columns, chr(SMALLCASE_A_ASCII_CODE + index)
            )
            columnAliases = ",".join(renamedColumns)
            mappedColumns.append(columnAliases)
            tableColumnExpressions[tableName] = expressionColumns
        return mappedColumns, tableColumnExpressions

    @staticmethod
    def __columnJoin(tableExpressions: Dict, columnJoin: str, table: str) -> str:
        return tableExpressions[columnJoin] if columnJoin in tableExpressions else "{}.{}".format(table, columnJoin)

    @staticmethod
    def __getSingleColumnJoin(firstTable: str, secondTable: str, columnJoins: List,
        firstTableExpressions: Dict, secondTableExpressions:Dict
    ) -> str:
        join = columnJoins.pop()
        firstColumnJoin = join["first_column"]
        secondColumnJoin = join["second_column"]
        leftJoin = ExploreResponse.__columnJoin(firstTableExpressions, firstColumnJoin, firstTable)
        rightJoin = ExploreResponse.__columnJoin(secondTableExpressions, secondColumnJoin, secondTable)
        return "{}={}".format(leftJoin, rightJoin)

    @staticmethod
    def __getMultipleColumnJoin(firstTable: str, secondTable: str, columnJoins: List,
        firstTableExpressions: Dict, secondTableExpressions:Dict) -> str:
        joinStatement = ''
        lastJoin = columnJoins.pop()
        lastJoinFirstColumn = lastJoin["first_column"]
        lastJoinSecondColumn = lastJoin["second_column"]
        lastLeftJoin = ExploreResponse.__columnJoin(firstTableExpressions, lastJoinFirstColumn, firstTable)
        lastRightJoin = ExploreResponse.__columnJoin(secondTableExpressions, lastJoinSecondColumn, secondTable)

        for count, join in enumerate(columnJoins):
            firstColumnJoin = join["first_column"]
            secondColumnJoin = join["second_column"]
            leftJoin = ExploreResponse.__columnJoin(firstTableExpressions, firstColumnJoin, firstTable)
            rightJoin = ExploreResponse.__columnJoin(secondTableExpressions, secondColumnJoin, secondTable)
            joinString = "{}={}".format(
                leftJoin, rightJoin
            ) if count == len(columnJoins) - 1 else "{}={}, ".format(leftJoin, rightJoin)
            joinStatement += joinString
        joinStatement += ' AND ' + "{}={}".format(lastLeftJoin, lastRightJoin)

        return joinStatement

    @staticmethod
    def __getJoinQuery(datasetJoins: List, joins: List,
        datasources: List[BaseDatasource], tableColumnExpressions: Dict) -> str:
        JOIN_STATEMENT = ""
        for index, columnJoins in enumerate(datasetJoins):
            tableJoin = ''
            firstDataset = datasources[index]
            secondDataset = datasources[index + 1]
            firstTableNameAlias = chr(SMALLCASE_A_ASCII_CODE + index)
            secondTableNameAlias = chr(SMALLCASE_A_ASCII_CODE + index + 1)
            firstTableExpressions = tableColumnExpressions[datasources[index].data["table_name"]]
            secondTableExpressions = tableColumnExpressions[datasources[index].data["table_name"]]
            if len(columnJoins) == 1:
                tableJoin += ExploreResponse.__getSingleColumnJoin(firstTableNameAlias,
                    secondTableNameAlias, columnJoins, firstTableExpressions, secondTableExpressions)
            else:
                tableJoin += ExploreResponse.__getMultipleColumnJoin(firstTableNameAlias,
                    secondTableNameAlias, columnJoins, firstTableExpressions, secondTableExpressions)
            if index == 0:
                JOIN_STATEMENT += "{} {} {} {} {} ON {} ".format(
                    firstDataset.name, firstTableNameAlias, joins[index],
                    secondDataset.name, secondTableNameAlias, tableJoin
                )
            else:
                JOIN_STATEMENT += "{} {} {} ON {} ".format(
                    joins[index], secondDataset.name, secondTableNameAlias, tableJoin
                )
        return JOIN_STATEMENT

    def multiple_dataset(self):
        joins:list = self.form_data.get("joins")
        dataset_joins:list = self.form_data.get("column_joins")
        first_datasource:str = self.form_data.get("first_datasource")
        additional_datasources:list = self.form_data.get("additional_datasources")

        additional_datasources.insert(0, first_datasource)
        datasource_ids, datasource_types  = self.__getDatasourcesData(additional_datasources)

        datasources = self.__getBaseDatasources(datasource_ids, datasource_types)

        table_name = self.__getTableName(datasources)
        mapped_columns, table_column_expressions = self.__mapAndGetColumnNames(datasources)

        column_aliases = ",".join(mapped_columns)
        join_statement = self.__getJoinQuery(dataset_joins, joins, datasources, table_column_expressions)

        sql_query = "SELECT {} FROM {} ".format(column_aliases, join_statement)

        presto_database = DatabaseDAO.get_database_by_name(datasources[0].data["database"]["name"])

        try:
            new_model = CreateMultiDatasetCommand(g.user, {
                "table_name": table_name,
                "database": presto_database,
                "database_id": presto_database.id,
                "sql": "{} {}".format(sql_query, SQL_POSTFIX_SCHEMA)
            }).run()
        except Exception as ex:
            raise SupersetGenericDBErrorException(message=ex.message)

        changed_model = UpdateDatasetCommand(new_model.id, {"sql": sql_query}).run()

        datasource = DatasourceDAO.get_datasource(
             db.session, cast(str, changed_model.type), changed_model.id
        )

        return datasource, datasource.name
