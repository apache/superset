"""
All custom functions implemented here
If there is custom code elsewhere inside a function, 
the function is from superset so best not to mess with it much :)
"""

def get_error_description(error):
    """Dictionary to return user friendly error description based on error type."""
    common = "Oops, looks like we ran into an error!"
    error_messages = {
        "CONNECTION": "Its a miracle but looks like" \
            " our application is not able to connect" \
                "to our database server! Please try again later",
        "DATA READ": common + \
            " This error usually occurs when the file you are trying to use is corrupted or incomplete.",
        "DATA WRITE":  common + \
            "This usually occurs when there is an unsupported data type being used.",
        "FUNCTION": common + \
            "This usually occurs when there is a type conversion error or \"Flatten\" is misused.",
        "PARSE": common + \
            "This usually occurs when > theres a type in the SQL syntax or" \
                " > trying to reference a missing table or" \
                    " > misusing an SQL keyword or" \
                        " > theres a function name resolution error.",
        "PERMISSION": "Oops! Looks like you don't have access to this data!",
        "PLAN": "There seems to be an error in your SQL query which will result in an error!" \
            " Please try to correct it or contact support support.",
        "RESOURCE": "We ran into a small trouble executing that for you. Can you please run in again?",
        "SYSTEM": "There seems to be an error in your SQL query which will result in an error!" \
            " Please try to correct it or contact support support.",
        "UNSUPPORTED OPERATION": "The operation you are trying is not supported by our system." \
            "Please contact support for support or use the LIVE HELP feature below.",
        "VALIDATION": common + \
            " This error usually occurs when mathematical function are applied to non numeric columns.",
        "OUT OF MEMORY": "Your dataset seems to be a bit too large for our resources." \
            " Can you perhaps break it down into smaller chunks? Contact support if that is not the case.",
        "SCHEMA CHANGE": "This error sometimes resolves itself by re running the query, why not give it a shot! ;)",
        "IO EXCEPTION": "Oops looks like we ran into an error." \
            " Try re running the query, if you till see this error contact support.",
        "CONCURRENT MODIFICATION": "This error sometimes resolves itself by re running the query, why not give it a shot! ;)",
        "INVALID DATASET METADATA": "Dataset metadata seems to be out of date." \
            "Triggering a dataset refresh should resolve this. Contact support to do so!",
        "REFLECTION ERROR": "There seems to be an Internal Reflection Error in our system, if re running the query" \
            " does not resolve this contact support.",
        "SOURCE_BAD_STATE": "Source seems to be in a Bad State, if re running the query" \
            " does not resolve this contact support.",
        "JSON FIELD CHANGE": "This type of error is usually resolved by re running the query." \
            " If it still exists, contact support for assistance.",
        "RESOURCE TIMEOUT": "Your access to this resource has timed out, try re running the query." \
            " If the problem still persists try relogging in or contact support.",
        "RETRY ATTEMPT ERROR": "We tried to run your query again and again, still looks like we are running in an error." \
            "How about contacting support for assistance?",
        "REFRESH DATASET ERROR": "Looks like we had an Internal Error while Refreshing the Dataset." \
            "Try re running the query or contact support for further assisstance.",
        "PDFS RETRIABLE ERROR": "This is a rare incident. Re running the query might solve it! :)"
    }
    return error_messages.get(error, "Looks like we ran into an unknown error. Please contact support for assistance.")


def parse_error_components(response):
    """Fetches components from APIs response and generates a helpful string."""

    breaker = ","

    project = response.json()['project']['name'].strip()
    dataset = response.json()['dataset']['name'].strip()
    chart = response.json()['chart']['name'].strip()
    error = response.json()['error_type'].strip()
    msg = []
    msg.append('We found an error in the query you are trying to run. ')
    if len(project) or len(dataset) or len(chart) or len(error):
        msg.append('Error found in: (')
    if len(project):
        msg.append(f' Project: {project}')
    if len(dataset):
        msg.append(f'{breaker} Dataset: {dataset}')
    if len(chart):
        msg.append(f'{breaker} Chart: {chart}')
    if len(error):
        msg.append(f'{breaker} Error Type: {error} ).')
        msg.append( f' Suggestion: {get_error_description(error)}')
    if (len(project) or len(dataset) or len(chart)) and len(error)==0:
        msg.append(' ).')
    return "".join(msg)