"""Implementation of the class that registers and notifies listeners."""
from flake8.plugins import _trie


class Notifier(object):
    """Object that tracks and notifies listener objects."""

    def __init__(self):
        """Initialize an empty notifier object."""
        self.listeners = _trie.Trie()

    def listeners_for(self, error_code):
        """Retrieve listeners for an error_code.

        There may be listeners registered for E1, E100, E101, E110, E112, and
        E126. To get all the listeners for one of E100, E101, E110, E112, or
        E126 you would also need to incorporate the listeners for E1 (since
        they're all in the same class).

        Example usage:

        .. code-block:: python

            from flake8 import notifier

            n = notifier.Notifier()
            # register listeners
            for listener in n.listeners_for('W102'):
                listener.notify(...)
        """
        path = error_code
        while path:
            node = self.listeners.find(path)
            listeners = getattr(node, 'data', [])
            for listener in listeners:
                yield listener
            path = path[:-1]

    def notify(self, error_code, *args, **kwargs):
        """Notify all listeners for the specified error code."""
        for listener in self.listeners_for(error_code):
            listener.notify(error_code, *args, **kwargs)

    def register_listener(self, error_code, listener):
        """Register a listener for a specific error_code."""
        self.listeners.add(error_code, listener)
