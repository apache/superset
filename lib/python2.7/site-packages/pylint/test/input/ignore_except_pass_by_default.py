"""#5575: by default no W0704 warning on bare pass in except"""

try:
    __exception__ = 0
except ValueError:
    pass
