"""Test that `continue` is catched when met inside a `finally` clause."""

# pylint: disable=missing-docstring, lost-exception, broad-except

while True:
    try:
        pass
    finally:
        continue # [continue-in-finally]

while True:
    try:
        pass
    finally:
        break

while True:
    try:
        pass
    except Exception:
        pass
    else:
        continue
   