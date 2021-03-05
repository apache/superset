export type OnSelectChange = ({
  dbId,
  schema,
}: {
  dbId: number | null;
  schema?: string;
}) => void;

export const factoryOnSelectChange = ({
  setCurrentDbId,
  setCurrentSchema,
  onChange,
}: {
  setCurrentDbId: (dbId: number) => void;
  setCurrentSchema: (schema: string | undefined) => void;
  onChange?: ({
    dbId,
    schema,
  }: {
    dbId: number | null;
    schema?: string;
    tableName?: string;
  }) => void;
}): OnSelectChange => ({ dbId, schema }) => {
  setCurrentDbId(dbId);
  setCurrentSchema(schema);
  if (onChange) {
    onChange({ dbId, schema, tableName: undefined });
  }
};
