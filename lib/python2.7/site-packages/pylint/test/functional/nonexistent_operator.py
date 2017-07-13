"""check operator use"""
# pylint: disable=invalid-name, pointless-statement
a = 1
a += 5
a = +a
b = ++a # [nonexistent-operator]
++a # [nonexistent-operator]
c = (++a) * b # [nonexistent-operator]

a = 1
a -= 5
b = --a # [nonexistent-operator]
b = a
--a # [nonexistent-operator]
c = (--a) * b # [nonexistent-operator]
