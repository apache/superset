"""Test that getmoduleinfo is deprecated."""
import inspect

inspect.getmoduleinfo(inspect) # [deprecated-method]
