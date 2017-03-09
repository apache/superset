from pyhive import hive
from pythrifthiveapi.TCLIService import ttypes
from pythrifthiveapi.TCLIService import TCLIService

import contextlib
import thrift.protocol.TBinaryProtocol
import thrift.transport.TSocket
import thrift.transport.TTransport


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
        logs = self._connection.client.GetLog(req)
        return logs
    except ttypes.TApplicationException as e:  # raised if Hive is used
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
            assert not (
                response.results.rows, 'expected data in columnar format'
            )
            assert len(response.results.columns) == 1, response.results.columns
            new_logs = hive._unwrap_column(response.results.columns[0])
            logs += new_logs
            if not new_logs:
                break
        return logs


# Connection init
def __init__(self, host, port=10000, username=None, database='default', auth='NONE',
             configuration=None):
    """Connect to HiveServer2

    :param auth: The value of hive.server2.authentication used by HiveServer2
    """
    socket = thrift.transport.TSocket.TSocket(host, port)
    configuration = configuration or {}
    self._transport = thrift.transport.TTransport.TBufferedTransport(socket)
    protocol = thrift.protocol.TBinaryProtocol.TBinaryProtocol(self._transport)
    self._client = TCLIService.Client(protocol)
    protocol_version = ttypes.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V6

    try:
        self._transport.open()
        open_session_req = ttypes.TOpenSessionReq(
            client_protocol=protocol_version,
            configuration=configuration,
        )
        # fixes working with multiple engines
        self._transport.close()
        self._transport.open()
        response = self._client.OpenSession(open_session_req)
        hive._check_status(response)
        assert response.sessionHandle is not None, "Expected a session from OpenSession"
        self._sessionHandle = response.sessionHandle
        assert response.serverProtocolVersion == protocol_version, \
            "Unable to handle protocol version {}".format(response.serverProtocolVersion)
        with contextlib.closing(self.cursor()) as cursor:
            cursor.execute('USE `{}`'.format(database))
    except Exception as e:
        self._transport.close()
        raise e

