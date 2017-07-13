"""Bad continuations in dictionary comprehensions."""

__revision__ = 0

# Dictionary comprehensions should not require extra indentation when breaking
# before the 'for', which is not part of the value
C1 = {'key{}'.format(x): 'value{}'.format(x)
      for x in range(3)}

C2 = {'key{}'.format(x): 'value{}'.format(x) for x in
      range(3)}

# Dictionary comprehensions with multiple loops broken in different places
C3 = {x*y: (x, y) for x in range(3) for y in range(3)}

C4 = {x*y: (x, y)
      for x in range(3) for y in range(3)}

C5 = {x*y: (x, y) for x
      in range(3) for y in range(3)}

C6 = {x*y: (x, y) for x in range(3)
      for y in range(3)}

C7 = {key:
          key ** 2
      for key in range(10)}

C8 = {
    key: key ** 2
    for key in range(10)}

# Misaligned cases for dict comprehensions
C9 = {'key{}'.format(x): 'value{}'.format(x)
    for x in range(3)}  # [bad-continuation]

C9 = {'key{}'.format(x): 'value{}'.format(x)
          for x in range(3)}  # [bad-continuation]
