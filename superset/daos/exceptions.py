# dodo was here
from superset.exceptions import SupersetException


class DAOException(SupersetException):
    """
    Base DAO exception class
    """


# dodo added 44211751
class DAOCreateFailedError(DAOException):
    """
    DAO Create failed
    """

    message = "Create failed"


# dodo added 44211751
class DAOUpdateFailedError(DAOException):
    """
    DAO Update failed
    """

    message = "Update failed"


# dodo added 44211751
class DAODeleteFailedError(DAOException):
    """
    DAO Delete failed
    """

    message = "Delete failed"


class DatasourceTypeNotSupportedError(DAOException):
    """
    DAO datasource query source type is not supported
    """

    status = 422
    message = "DAO datasource query source type is not supported"


class DatasourceNotFound(DAOException):
    status = 404
    message = "Datasource does not exist"
