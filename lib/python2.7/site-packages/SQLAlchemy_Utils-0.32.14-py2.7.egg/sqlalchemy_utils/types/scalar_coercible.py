class ScalarCoercible(object):
    def _coerce(self, value):
        raise NotImplemented

    def coercion_listener(self, target, value, oldvalue, initiator):
        return self._coerce(value)
