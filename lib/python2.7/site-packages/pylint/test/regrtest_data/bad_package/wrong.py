"""
Test that pylint doesn't crash when a relative import
depends on the local __init__, which contains an expected syntax error.
"""
from . import missing
