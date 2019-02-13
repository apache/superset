class PolygonEncoding:

    @classmethod
    def for_json(cls):
        return [cls.__name__, cls.name]

    @classmethod
    def get_deser(cls, codes):
        polygons = cls.to_polygon(codes)

        def deser(code):
            return polygons[code]
        
        return deser

    @classmethod
    def to_polygon(codes):
        raise NotImplementedError('Subclasses MUST implement to_polygon')
