# dodo added 44120742

from typing import Any


def translate_dashboards_to_russian(dashboards: list[dict[str, Any]]) -> None:
    for dataset in dashboards:
        verbose_map = dataset.get("verbose_map")

        for column in dataset.get("columns", []):
            if isinstance(column, dict) and column.get("verbose_name_ru"):
                column["verbose_name"] = column.get("verbose_name_ru")
                if isinstance(verbose_map, dict) and verbose_map.get(
                    column.get("column_name")
                ):
                    verbose_map[column.get("column_name")] = column.get(
                        "verbose_name_ru"
                    )

        for metric in dataset.get("metrics", []):
            if isinstance(metric, dict) and metric.get("verbose_name_ru"):
                metric["verbose_name"] = metric.get("verbose_name_ru")
                if isinstance(verbose_map, dict) and verbose_map.get(
                    metric.get("metric_name")
                ):
                    verbose_map[metric.get("metric_name")] = metric.get(
                        "verbose_name_ru"
                    )


def _translate_labels(columns: dict[str, str]) -> None:
    for column in columns:
        if isinstance(column, dict) and column.get("labelRU"):
            column["label"] = column.get("labelRU")


def translate_charts_to_russian(charts: list[dict[str, Any]]) -> None:
    column_config_dict = {}
    for chart in charts:
        form_data = chart.get("form_data", {})

        _translate_labels(form_data.get("all_columns", []))
        _translate_labels(form_data.get("groupby", []))

        for metric in form_data.get("metrics", {}):
            if isinstance(metric, dict) and metric.get("labelRU"):
                metric["label"] = metric.get("labelRU")
                column_config_dict[metric.get("labelEN")] = metric.get("labelRU")
                column = metric.get("column")
                if isinstance(column, dict) and column.get("verbose_name_ru"):
                    column["verbose_name"] = column.get("verbose_name_ru")

        for cfm in form_data.get("conditional_formatting_message", []):
            if isinstance(cfm, dict) and cfm.get("messageRU"):
                cfm["message"] = cfm.get("messageRU")

        column_config = form_data.get("column_config", {})
        config_dict = {}

        for k, v in column_config.items():
            config_dict[column_config_dict.get(k, k)] = v
        chart_form_data = chart.get("form_data", {})
        chart_form_data["column_config"] = config_dict

        for item in form_data.get("conditional_formatting", []):
            column = item.get("column")
            item["column"] = column_config_dict.get(column, column)
