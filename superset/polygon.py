class PolygonEncoding:

    @classmethod
    def for_json(cls):
        return [cls.__name__, cls.name]

    @classmethod
    def get_deser(cls, codes, cache):
        polygons = dict(zip(codes, cls.to_polygon(codes, cache)))

        def deser(code):
            return polygons[code]
        
        return deser

    @classmethod
    def to_location(codes, cache):
        raise NotImplementedError('Subclasses MUST implement to_location')

    @classmethod
    def to_polygon(codes, cache):
        raise NotImplementedError('Subclasses MUST implement to_polygon')
