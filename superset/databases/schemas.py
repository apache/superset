from marshmallow import fields, Schema


class TableMetadataOptionsResponseSchema(Schema):
    deferrable = fields.Bool()
    initially = fields.Bool()
    match = fields.Bool()
    ondelete = fields.Bool()
    onupdate = fields.Bool()


class TableMetadataColumnsResponseSchema(Schema):
    keys = fields.List(fields.String(), description="")
    longType = fields.String(description="The actual backend long type for the column")
    name = fields.String(description="The column name")
    type = fields.String(description="The column type")
    duplicates_constraint = fields.String(required=False)


class TableMetadataForeignKeysIndexesResponseSchema(Schema):
    column_names = fields.List(
        fields.String(
            description="A list of column names that compose the foreign key or index"
        )
    )
    name = fields.String(description="The name of the foreign key or index")
    options = fields.Nested(TableMetadataOptionsResponseSchema)
    referred_columns = fields.List(fields.String())
    referred_schema = fields.String()
    referred_table = fields.String()
    type = fields.String()


class TableMetadataPrimaryKeyResponseSchema(Schema):
    column_names = fields.List(
        fields.String(description="A list of column names that compose the primary key")
    )
    name = fields.String(description="The primary key index name")
    type = fields.String()


class TableMetadataResponseSchema(Schema):
    name = fields.String(description="The name of the table")
    columns = fields.List(
        fields.Nested(TableMetadataColumnsResponseSchema),
        description="A list of columns and their metadata",
    )
    foreignKeys = fields.List(
        fields.Nested(TableMetadataForeignKeysIndexesResponseSchema),
        description="A list of foreign keys and their metadata",
    )
    indexes = fields.List(
        fields.Nested(TableMetadataForeignKeysIndexesResponseSchema),
        description="A list of indexes and their metadata",
    )
    primaryKey = fields.Nested(
        TableMetadataPrimaryKeyResponseSchema, description="Primary keys metadata"
    )
    selectStar = fields.String(description="SQL select star")


class SelectStarResponseSchema(Schema):
    result = fields.String(description="SQL select star")
