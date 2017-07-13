from pandas.compat import PY3


# array compat
if PY3:
    frombytes = lambda obj, data: obj.frombytes(data)
    tobytes = lambda obj: obj.tobytes()
else:
    frombytes = lambda obj, data: obj.fromstring(data)
    tobytes = lambda obj: obj.tostring()
