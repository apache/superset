# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from pyhive import hive
from TCLIService import ttypes
from thrift import Thrift

from superset.db_engines.THttpTransport.THttpClientTransport import THttpClientTransport 
from thrift.transport.TTransport import TBufferedTransport

# TODO: contribute back to pyhive.
def fetch_logs(self, max_rows=1024,
               orientation=ttypes.TFetchOrientation.FETCH_NEXT):
    """Mocked. Retrieve the logs produced by the execution of the query.
    Can be called multiple times to fetch the logs produced after
    the previous call.
    :returns: list<str>
    :raises: ``ProgrammingError`` when no query has been started
    .. note::
        This is not a part of DB-API.
    """
    try:
        req = ttypes.TGetLogReq(operationHandle=self._operationHandle)
        logs = self._connection.client.GetLog(req).log
        return logs
    # raised if Hive is used
    except (ttypes.TApplicationException,
            Thrift.TApplicationException):
        if self._state == self._STATE_NONE:
            raise hive.ProgrammingError('No query yet')
        logs = []
        while True:
            req = ttypes.TFetchResultsReq(
                operationHandle=self._operationHandle,
                orientation=ttypes.TFetchOrientation.FETCH_NEXT,
                maxRows=self.arraysize,
                fetchType=1,  # 0: results, 1: logs
            )
            response = self._connection.client.FetchResults(req)
            hive._check_status(response)
            assert not response.results.rows, \
                'expected data in columnar format'
            assert len(response.results.columns) == 1, response.results.columns
            new_logs = hive._unwrap_column(response.results.columns[0])
            logs += new_logs
            if not new_logs:
                break
        return '\n'.join(logs)


def remove_http_params_from(url, connect_args):
    # remove custom  http transport vars not req in phive 
    backend_name = url.get_backend_name()
    http_params = ['principal','transport_mode','mutual_authentication','http_path','service','delegate','force_preemptive','hostname_override','sanitize_mutual_error_response','send_cbt']  
    if(backend_name == 'hive'):
        for param in http_params:
            if( param in connect_args ):
                connect_args.pop(param, None)

def get_updated_connect_args(url , connect_args):
    #  set thrift_transport to handle http transport mode in hive
    updates_in_connect_args = {}
    backend_name = url.get_backend_name()
    if(backend_name == 'hive'):
        thrift_transport = get_http_thrift_transport(url,connect_args)
        if(thrift_transport is not None):
            updates_in_connect_args['thrift_transport'] = thrift_transport
            # reset below value to none as per phive condition to set custom thrift_transport
            updates_in_connect_args['host'] = None
            updates_in_connect_args['port'] = None
            updates_in_connect_args['password'] = None
            updates_in_connect_args['auth'] = None
            updates_in_connect_args['kerberos_service_name'] = None    
   
    return updates_in_connect_args     



def get_prop_value(propname,kwargs,value):

    if(propname in kwargs):
        return  kwargs[propname]
   
    return  value

def get_http_thrift_transport(url , kwargs):
    if ( 'transport_mode' in kwargs  and  kwargs['transport_mode'].lower() == 'http' ):
        host = url.host
        port = url.port
        username = url.username
        
        password = url.password
        if(password is None):
           password = 'x'

        #  expose kerberos specific variables and set default values HTTPKerberosAuth class 
        http_path = get_prop_value('http_path',kwargs,'cliservice')
        principal =  get_prop_value('principal',kwargs,None)
        mutual_authentication = get_prop_value('mutual_authentication',kwargs,'OPTIONAL')
        service = get_prop_value('service',kwargs,'HTTP') 
        delegate = get_prop_value('delegate',kwargs,False)  
        force_preemptive = get_prop_value('force_preemptive',kwargs,False)   
        hostname_override = get_prop_value('hostname_override',kwargs,None)    
        sanitize_mutual_error_response = get_prop_value('sanitize_mutual_error_response',kwargs,True)     
        send_cbt = get_prop_value('send_cbt',kwargs,True)     
        auth = get_prop_value('auth',kwargs,"NONE")       
        
        client = THttpClientTransport("http://{}:{}/{}".format(host, port, http_path))
        if auth == 'KERBEROS':
            client.set_kerberos_auth(mutual_authentication,
            service, delegate, force_preemptive,
            principal, hostname_override,
            sanitize_mutual_error_response, send_cbt)
        else:  
            client.set_basic_auth(username, password)  

        return TBufferedTransport(client)
    else:
         return None
     

  