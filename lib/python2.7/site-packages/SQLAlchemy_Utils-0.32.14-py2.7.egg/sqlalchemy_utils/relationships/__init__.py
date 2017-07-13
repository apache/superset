import sqlalchemy as sa
from sqlalchemy.sql.util import ClauseAdapter

from .chained_join import chained_join  # noqa


def path_to_relationships(path, cls):
    relationships = []
    for path_name in path.split('.'):
        rel = getattr(cls, path_name)
        relationships.append(rel)
        cls = rel.mapper.class_
    return relationships


def adapt_expr(expr, *selectables):
    for selectable in selectables:
        expr = ClauseAdapter(selectable).traverse(expr)
    return expr


def inverse_join(selectable, left_alias, right_alias, relationship):
    if relationship.property.secondary is not None:
        secondary_alias = sa.alias(relationship.property.secondary)
        return selectable.join(
            secondary_alias,
            adapt_expr(
                relationship.property.secondaryjoin,
                sa.inspect(left_alias).selectable,
                secondary_alias
            )
        ).join(
            right_alias,
            adapt_expr(
                relationship.property.primaryjoin,
                sa.inspect(right_alias).selectable,
                secondary_alias
            )
        )
    else:
        join = sa.orm.join(right_alias, left_alias, relationship)
        onclause = join.onclause
        return selectable.join(right_alias, onclause)


def relationship_to_correlation(relationship, alias):
    if relationship.property.secondary is not None:
        return adapt_expr(
            relationship.property.primaryjoin,
            alias,
        )
    else:
        return sa.orm.join(
            relationship.parent,
            alias,
            relationship
        ).onclause


def chained_inverse_join(relationships, leaf_model):
    selectable = sa.inspect(leaf_model).selectable
    aliases = [leaf_model]
    for index, relationship in enumerate(relationships[1:]):
        aliases.append(sa.orm.aliased(relationship.mapper.class_))
        selectable = inverse_join(
            selectable,
            aliases[index],
            aliases[index + 1],
            relationships[index]
        )

    if relationships[-1].property.secondary is not None:
        secondary_alias = sa.alias(relationships[-1].property.secondary)
        selectable = selectable.join(
            secondary_alias,
            adapt_expr(
                relationships[-1].property.secondaryjoin,
                secondary_alias,
                sa.inspect(aliases[-1]).selectable
            )
        )
        aliases.append(secondary_alias)
    return selectable, aliases


def select_correlated_expression(
    root_model,
    expr,
    path,
    leaf_model,
    from_obj=None,
    order_by=None,
    correlate=True
):
    relationships = list(reversed(path_to_relationships(path, root_model)))

    query = sa.select([expr])
    selectable = sa.inspect(leaf_model).selectable

    if order_by:
        query = query.order_by(
            *[adapt_expr(o, selectable) for o in order_by]
        )

    join_expr, aliases = chained_inverse_join(relationships, leaf_model)
    condition = relationship_to_correlation(
        relationships[-1],
        aliases[-1]
    )

    if from_obj is not None:
        condition = adapt_expr(condition, from_obj)

    query = query.select_from(join_expr.selectable)

    if correlate:
        query = query.correlate(
            from_obj if from_obj is not None else root_model
        )
    return query.where(condition)
