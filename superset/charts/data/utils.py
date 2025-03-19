# dodo added 44120742

from superset.common.query_context import QueryContext


def translate_chart_to_russian(query_context: QueryContext) -> None:
    for column in query_context.datasource.columns:
        if column.verbose_name_ru:
            column.verbose_name_en = column.verbose_name
            column.verbose_name = column.verbose_name_ru

    for metric in query_context.datasource.metrics:
        if metric.verbose_name_ru:
            metric.verbose_name_en = metric.verbose_name
            metric.verbose_name = metric.verbose_name_ru


def revert_translate(query_context: QueryContext) -> None:
    for column in query_context.datasource.columns:
        column.verbose_name = column.verbose_name_en
    for metric in query_context.datasource.metrics:
        metric.verbose_name = metric.verbose_name_en
