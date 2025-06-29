from superset.dashboards.dashboard_agentic_query.utils import refactor_input, extract_int_if_possible
import json
from superset.charts.data.api import ChartDataRestApi

def convert_first_k_rows_to_string(chart_data, k=50):
    chart_data_str = ""
    if(len(chart_data)>k):
        chart_data=chart_data[:k]

    for index, row in enumerate(chart_data):
        if(index == 0):
            chart_data_str = 'S.no\t\t\t'
            for key, value in row.items():
                chart_data_str += key
                chart_data_str += '\t\t\t'

        chart_data_str += '\n\n'
        chart_data_str += str(index+1) + "\t\t\t"
        for key, value in row.items():
            chart_data_str += str(value)
            chart_data_str += '\t\t\t'
    return chart_data_str

def get_chart_data(chart_id) -> str:
    chart_id = refactor_input(chart_id)
    chart_id = extract_int_if_possible(chart_id)
    chart_data_rest_api = ChartDataRestApi()
    bytes_response = chart_data_rest_api.get_data(pk=chart_id).response[0]
    response = json.loads(bytes_response.decode('utf-8'))["result"]
    chart_data = response[0]["data"]
    chart_data_result = convert_first_k_rows_to_string(chart_data)
    return chart_data_result
  
