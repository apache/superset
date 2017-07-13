"""This is gramatically correct, but it's still a SyntaxError"""
yield from [1, 2]  # [yield-outside-function]

LAMBDA_WITH_YIELD = lambda: (yield from [1, 2])
