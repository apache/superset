import React from 'react';
import { OnSelectChange } from '../onSelectChange';

export type ChangeSchema = ({
  currentDbId,
  selectedSchema,
  force,
}: {
  currentDbId: number | null;
  selectedSchema: { value: string; label: string; title: string };
  force?: boolean;
}) => void;

export const factoryChangeSchema = ({
  onSelectChange,
  setCurrentSchema,
  onSchemaChange,
  getTableList,
}: {
  onSelectChange: React.MutableRefObject<OnSelectChange>;
  setCurrentSchema: (schema: string | null | undefined) => void;
  onSchemaChange?: (arg0?: any) => {};
  getTableList?: (
    dbId: number | null,
    schema: string | null,
    force: boolean,
  ) => {};
}): ChangeSchema => ({ currentDbId, selectedSchema, force }) => {
  /**
   * This validation already existed in this function, so I kept the validation and updated the types to support a possible null
   */
  const schema = selectedSchema?.value || null;
  if (onSchemaChange) {
    onSchemaChange(schema);
  }
  setCurrentSchema(schema);
  onSelectChange.current({ dbId: currentDbId, schema });
  if (getTableList) {
    getTableList(currentDbId, schema, !!force);
  }
};
