from pyhive import hive
from TCLIService import ttypes
from thrift import Thrift


old_Connection = hive.Connection

# TODO
# Monkey-patch of PyHive project's pyhive/hive.py which needed to change the constructor.
# Submitted a pull request on October 13, 2017 and waiting for it to be merged.
# https://github.com/dropbox/PyHive/pull/165
class ConnectionProxyUser(hive.Connection):

    def __init__(self, host=None, port=None, username=None, database='default', auth=None,
             configuration=None, kerberos_service_name=None, password=None,
             thrift_transport=None, hive_server2_proxy_user=None):
        configuration = configuration or {}
        if auth is not None and auth in ('LDAP', 'KERBEROS'):
            if hive_server2_proxy_user is not None:
                configuration["hive.server2.proxy.user"] = hive_server2_proxy_user
        # restore the old connection class, otherwise, will recurse on its own __init__ method
        hive.Connection = old_Connection
        hive.Connection.__init__(self, host=host, port=port, username=username, database=database, auth=auth,
                 configuration=configuration, kerberos_service_name=kerberos_service_name, password=password,
                 thrift_transport=thrift_transport)


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
            raise hive.ProgrammingError("No query yet")
        logs = []
        while True:
            req = ttypes.TFetchResultsReq(
                operationHandle=self._operationHandle,
                orientation=ttypes.TFetchOrientation.FETCH_NEXT,
                maxRows=self.arraysize,
                fetchType=1  # 0: results, 1: logs
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
