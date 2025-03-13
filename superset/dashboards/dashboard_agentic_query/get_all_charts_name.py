from superset.daos.dashboard import DashboardDAO
from superset.dashboards.dashboard_agentic_query.utils import refactor_input, extract_int_if_possible
from superset.charts.schemas import ChartEntityResponseSchema

def get_charts_list(dashboard_id) -> str:
  chart_entity_response_schema = ChartEntityResponseSchema()

  dashboard_id = refactor_input(dashboard_id)
  dashboard_id = extract_int_if_possible(dashboard_id)
  
  charts_list = DashboardDAO.get_charts_for_dashboard(dashboard_id)
  result = [chart_entity_response_schema.dump(chart) for chart in charts_list]
  charts = []
  for chart_metadata in result:
      charts.append({
        "chart_name": chart_metadata["slice_name"],
        "chart_id": chart_metadata["id"]
      })
  
  return charts
