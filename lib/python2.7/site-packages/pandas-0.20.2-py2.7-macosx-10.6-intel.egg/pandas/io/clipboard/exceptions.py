import ctypes


class PyperclipException(RuntimeError):
    pass


class PyperclipWindowsException(PyperclipException):

    def __init__(self, message):
        message += " (%s)" % ctypes.WinError()
        super(PyperclipWindowsException, self).__init__(message)
