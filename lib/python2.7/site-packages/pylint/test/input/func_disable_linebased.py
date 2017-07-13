# This is a very very very very very very very very very very very very very very very very very very very very very long line.
# pylint: disable=line-too-long
"""Make sure enable/disable pragmas work for messages that are applied to lines and not syntax nodes.

A disable pragma for a message that applies to nodes is applied to the whole
block if it comes before the first statement (excluding the docstring). For
line-based messages, this behavior needs to be altered to really only apply to
the enclosed lines.
"""
# pylint: enable=line-too-long

from __future__ import print_function

print('This is a very long line which the linter will warn about, now that line-too-long has been enabled again.')
