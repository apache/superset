def chained_join(*relationships):
    """
    Return a chained Join object for given relationships.
    """
    property_ = relationships[0].property

    if property_.secondary is not None:
        from_ = property_.secondary.join(
            property_.mapper.class_.__table__,
            property_.secondaryjoin
        )
    else:
        from_ = property_.mapper.class_.__table__
    for relationship in relationships[1:]:
        prop = relationship.property
        if prop.secondary is not None:
            from_ = from_.join(
                prop.secondary,
                prop.primaryjoin
            )

            from_ = from_.join(
                prop.mapper.class_,
                prop.secondaryjoin
            )
        else:
            from_ = from_.join(
                prop.mapper.class_,
                prop.primaryjoin
            )
    return from_
