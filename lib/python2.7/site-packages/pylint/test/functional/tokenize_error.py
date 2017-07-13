"""A module that is accepted by Python but rejected by tokenize.

The problem is the trailing line continuation at the end of the line,
which produces a TokenError."""
# +2: [syntax-error]
""\
