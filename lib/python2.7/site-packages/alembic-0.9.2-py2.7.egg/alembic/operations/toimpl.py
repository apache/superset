from . import ops

from . import Operations
from sqlalchemy import schema as sa_schema


@Operations.implementation_for(ops.AlterColumnOp)
def alter_column(operations, operation):

    compiler = operations.impl.dialect.statement_compiler(
        operations.impl.dialect,
        None
    )

    existing_type = operation.existing_type
    existing_nullable = operation.existing_nullable
    existing_server_default = operation.existing_server_default
    type_ = operation.modify_type
    column_name = operation.column_name
    table_name = operation.table_name
    schema = operation.schema
    server_default = operation.modify_server_default
    new_column_name = operation.modify_name
    nullable = operation.modify_nullable

    def _count_constraint(constraint):
        return not isinstance(
            constraint,
            sa_schema.PrimaryKeyConstraint) and \
            (not constraint._create_rule or
                constraint._create_rule(compiler))

    if existing_type and type_:
        t = operations.schema_obj.table(
            table_name,
            sa_schema.Column(column_name, existing_type),
            schema=schema
        )
        for constraint in t.constraints:
            if _count_constraint(constraint):
                operations.impl.drop_constraint(constraint)

    operations.impl.alter_column(
        table_name, column_name,
        nullable=nullable,
        server_default=server_default,
        name=new_column_name,
        type_=type_,
        schema=schema,
        existing_type=existing_type,
        existing_server_default=existing_server_default,
        existing_nullable=existing_nullable,
        **operation.kw
    )

    if type_:
        t = operations.schema_obj.table(
            table_name,
            operations.schema_obj.column(column_name, type_),
            schema=schema
        )
        for constraint in t.constraints:
            if _count_constraint(constraint):
                operations.impl.add_constraint(constraint)


@Operations.implementation_for(ops.DropTableOp)
def drop_table(operations, operation):
    operations.impl.drop_table(
        operation.to_table(operations.migration_context)
    )


@Operations.implementation_for(ops.DropColumnOp)
def drop_column(operations, operation):
    column = operation.to_column(operations.migration_context)
    operations.impl.drop_column(
        operation.table_name,
        column,
        schema=operation.schema,
        **operation.kw
    )


@Operations.implementation_for(ops.CreateIndexOp)
def create_index(operations, operation):
    idx = operation.to_index(operations.migration_context)
    operations.impl.create_index(idx)


@Operations.implementation_for(ops.DropIndexOp)
def drop_index(operations, operation):
    operations.impl.drop_index(
        operation.to_index(operations.migration_context)
    )


@Operations.implementation_for(ops.CreateTableOp)
def create_table(operations, operation):
    table = operation.to_table(operations.migration_context)
    operations.impl.create_table(table)
    return table


@Operations.implementation_for(ops.RenameTableOp)
def rename_table(operations, operation):
    operations.impl.rename_table(
        operation.table_name,
        operation.new_table_name,
        schema=operation.schema)


@Operations.implementation_for(ops.AddColumnOp)
def add_column(operations, operation):
    table_name = operation.table_name
    column = operation.column
    schema = operation.schema

    t = operations.schema_obj.table(table_name, column, schema=schema)
    operations.impl.add_column(
        table_name,
        column,
        schema=schema
    )
    for constraint in t.constraints:
        if not isinstance(constraint, sa_schema.PrimaryKeyConstraint):
            operations.impl.add_constraint(constraint)
    for index in t.indexes:
        operations.impl.create_index(index)


@Operations.implementation_for(ops.AddConstraintOp)
def create_constraint(operations, operation):
    operations.impl.add_constraint(
        operation.to_constraint(operations.migration_context)
    )


@Operations.implementation_for(ops.DropConstraintOp)
def drop_constraint(operations, operation):
    operations.impl.drop_constraint(
        operations.schema_obj.generic_constraint(
            operation.constraint_name,
            operation.table_name,
            operation.constraint_type,
            schema=operation.schema,
        )
    )


@Operations.implementation_for(ops.BulkInsertOp)
def bulk_insert(operations, operation):
    operations.impl.bulk_insert(
        operation.table, operation.rows, multiinsert=operation.multiinsert)


@Operations.implementation_for(ops.ExecuteSQLOp)
def execute_sql(operations, operation):
    operations.migration_context.impl.execute(
        operation.sqltext,
        execution_options=operation.execution_options
    )
