import datetime
from superset.dashboards.dashboard_agentic_query.utils import refactor_input, extract_int_if_possible

def convert_unix_to_human_readable(unix_timestamp):
    unix_timestamp = refactor_input(unix_timestamp)
    unix_timestamp = extract_int_if_possible(unix_timestamp)
    if(len(unix_timestamp) > 10):
        unix_timestamp = unix_timestamp[:10]
    
    unix_timestamp = int(unix_timestamp)
    # Convert the Unix timestamp to a datetime object
    dt_object = datetime.datetime.fromtimestamp(unix_timestamp)
    
    # Format the datetime object to a human-readable string
    human_readable_date = dt_object.strftime('%Y-%m-%d %H:%M:%S')
    
    return human_readable_date
