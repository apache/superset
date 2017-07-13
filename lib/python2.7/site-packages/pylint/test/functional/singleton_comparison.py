# pylint: disable=missing-docstring, invalid-name, misplaced-comparison-constant,literal-comparison
x = 42
a = x is None
b = x == None  # [singleton-comparison]
c = x == True  # [singleton-comparison]
d = x == False  # [singleton-comparison]
e = True == True  # [singleton-comparison]
f = x is 1
g = 123 is "123"
h = None is x
i = None == x  # [singleton-comparison]
