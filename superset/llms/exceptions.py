from superset.exceptions import SupersetException

class NoContextError(SupersetException):
    """Exception raised when no context is provided to the LLM."""
    pass

class NoProviderError(SupersetException):
    """Exception raised when an appropriate LLM provider can't be found."""
    pass
