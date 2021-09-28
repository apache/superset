"""
A docstring
"""
import ipaddress
import pprint
from typing import Callable, Dict
from flask.wrappers import Response
from flask_appbuilder.api import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset.business_types.business_type_request import BusinessTypeRequest
from superset.business_types.business_type_response import BusinessTypeResponse
from superset.extensions import event_logger
from superset.connectors.sqla.models import SqlaTable
from superset.views.base_api import BaseSupersetModelRestApi


# additional port mappings take from /etc/services - perhaps that should be used to populate this dictionary?
port_conversion_dict: Dict[
    str, list,
] = {
    "http": [80],
    "ssh": [22],
    "https": [443],
    "ftp": [20, 21],
    "ftps": [989, 990],
    "telnet": [23],
    "telnets": [992],
    "smtp": [25],
    "submissions": [465], # aka smtps, ssmtp, urd
    "kerberos": [88],
    "kerberos-adm": [749],
    "pop3": [110],
    "pop3s": [995],
    "nntp": [119],
    "nntps": [563],
    "ntp": [123],
    "snmp": [161],
    "ldap": [389],
    "ldaps": [636],
    "imap2": [143], # aka imap
    "imaps": [993],
}


class BusinessTypeRestApi(BaseSupersetModelRestApi):
    """
    A docstring
    """
    datamodel = SQLAInterface(SqlaTable)
    #include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET
    resource_name = "business_type"

    @expose("/checkport/<port>", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False, # pylint: disable-arguments-renamed
    )
    def check_port(self, port: str) -> Response:
        """
        Gets a port response
        """
        bus_resp: BusinessTypeResponse = BUSINESS_TYPE_ADDONS["port"]({
           "business_type": "port",
           "value": int(port)
        })
        return self.response(200, result=bus_resp)

        # resp: Response = {
        #     "output": "Hello",
        # }
        # return self.response(200, result=resp)




def cidr_func(req: BusinessTypeRequest) -> BusinessTypeResponse:
    resp: BusinessTypeResponse = {}
    try: 
        ip_range = ipaddress.ip_network(req["value"])
        resp["status"] = "valid"
        resp["value"] = { "start" : int(ip_range[0]), "end" : int(ip_range[-1]) } if ip_range[0] != ip_range[-1] else int(ip_range[0])
        resp["formatted_value"] = req["value"]
        resp["valid_filter_operators"] = ["IN"] if  ip_range[0] != ip_range[-1] else ["==", "<=", "<", "IN", ">=", ">"]
    except:
        resp["status"] = "invalid"
        resp["value"] = None
        resp["formatted_value"] = None
        resp["valid_filter_operators"] = []
    return resp


def port_func(req: BusinessTypeRequest) -> BusinessTypeResponse:
    resp: BusinessTypeResponse = {}
    print("in port_func")
    if req["value"] in port_conversion_dict:
        print("in if") 
        resp["status"] = "valid"
        resp["value"] = port_conversion_dict[req["value"]]()
        resp["formatted_value"] = req["value"]
        resp["valid_filter_operators"] = ["==", "<=", "<", ">=", ">"] if len(req["value"]) == 1 else ["IN"] 
    elif req["value"] and (0 <= req["value"] <= 65535): # Not sure if we care about this case  
        print("in elif")
        resp["status"] = "valid"
        resp["value"] = req["value"]
        resp["formatted_value"] = req["value"]
        resp["valid_filter_operators"] = ["==", "<=", "<", ">=", ">"]
    else: 
        print("in else")
        resp["status"] = "invalid"
        resp["value"] = None
        resp["formatted_value"] = None
        resp["valid_filter_operators"] = []
    print("leaving port_func")
    return resp

# the business type key should correspond to that set in the column metadata
BUSINESS_TYPE_ADDONS: Dict[
    str, Callable[[BusinessTypeRequest], BusinessTypeResponse]
] = {
    "cidr": cidr_func,
    "port": port_func
}
