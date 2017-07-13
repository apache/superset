"""Test that not-in-loop is detected properly."""
# pylint: disable=missing-docstring, invalid-name, too-few-public-methods
# pylint: disable=useless-else-on-loop, using-constant-test

while True:
    def ala():
        continue # [not-in-loop]

while True:
    pass
else:
    continue # [not-in-loop]

def lala():
    continue # [not-in-loop]

while True:
    class A(object):
        continue # [not-in-loop]

for _ in range(10):
    pass
else:
    continue # [not-in-loop]

for _ in range(42):
    pass
else:
    break # [not-in-loop]

if True:
    continue # [not-in-loop]
else:
    break # [not-in-loop]

for _ in range(10):
    for _ in range(20):
        pass
    else:
        continue

while True:
    while True:
        break
    else:
        break
    break
else:
    pass

for _ in range(1):
    continue
for _ in range(42):
    break
