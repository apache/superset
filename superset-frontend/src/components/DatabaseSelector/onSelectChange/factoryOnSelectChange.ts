export type OnSelectChange = ({
  dbId,
  schema,
}: {
  dbId: number | null;
  schema?: string | null;
}) => void;

export const factoryOnSelectChange = ({
  setCurrentDbId,
  setCurrentSchema,
  onChange,
}: {
  setCurrentDbId: (dbId: number | null) => void;
  setCurrentSchema: (schema: string | undefined | null) => void;
  onChange?: ({
    dbId,
    schema,
  }: {
    dbId: number | null;
    schema?: string | null;
    tableName?: string;
  }) => void;
}): OnSelectChange => ({ dbId, schema }) => {
  setCurrentDbId(dbId);
  setCurrentSchema(schema);
  if (onChange) {
    onChange({ dbId, schema, tableName: undefined });
  }
};
