# pylint: disable=C,R,W
from pyhive import hive
from TCLIService import ttypes
from thrift import Thrift


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
