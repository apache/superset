"""This is gramatically correct, but it's still a SyntaxError"""
yield 1  # [yield-outside-function]

LAMBDA_WITH_YIELD = lambda: (yield)
