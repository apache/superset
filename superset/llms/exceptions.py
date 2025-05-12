from superset.exceptions import SupersetException

class NoContextError(SupersetException):
    """Exception raised when no context is provided to the LLM."""
    pass
