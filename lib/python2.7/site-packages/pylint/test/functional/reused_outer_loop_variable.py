"""Tests for redefining an outer loop variable."""
from __future__ import print_function
__revision__ = 0

# Simple nested loop
for i in range(10):
    for i in range(10): #[redefined-outer-name]
        print(i)

# When outer loop unpacks a tuple
for i, i_again in enumerate(range(10)):
    for i in range(10): #[redefined-outer-name]
        print(i, i_again)

# When inner loop unpacks a tuple
for i in range(10):
    for i, i_again in range(10): #[redefined-outer-name]
        print(i, i_again)

# With nested tuple unpacks
for (a, (b, c)) in [(1, (2, 3))]:
    for i, a in range(10): #[redefined-outer-name]
        print(i, a, b, c)

# Ignores when in else
for i in range(10):
    print(i)
    if i > 5:
        break
else:
    for i in range(2):
        print(i)

# Ignores dummy variables
for _ in range(10):
    for _ in range(10):
        print("Hello")
