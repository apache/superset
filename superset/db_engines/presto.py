from pyhive import presto


# TODO(bogdan): Remove this when new pyhive release will be available.
def cancel(self):
    if self._state == self._STATE_NONE:
        raise presto.ProgrammingError("No query yet")
    if self._nextUri is None:
        assert self._state == self._STATE_FINISHED, \
            "Should be finished if nextUri is None"
        return

    response = presto.requests.delete(self._nextUri)
    if response.status_code != presto.requests.codes.no_content:
        fmt = "Unexpected status code after cancel {}\n{}"
        raise presto.OperationalError(
            fmt.format(response.status_code, response.content))
    self._state = self._STATE_FINISHED
    return
