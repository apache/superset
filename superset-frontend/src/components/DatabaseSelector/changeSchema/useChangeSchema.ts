import React, { useEffect, useRef } from 'react';

import { OnSelectChange } from '../onSelectChange';
import { factoryChangeSchema } from './factoryChangeSchema';

export const useChangeSchema = ({
  setCurrentSchema,
  onSchemaChange,
  getTableList,
  onSelectChange,
}: {
  setCurrentSchema: (schema: string | undefined) => void;
  onSchemaChange?: (arg0?: any) => {};
  getTableList?: (dbId: number, schema: string, force: boolean) => {};
  onSelectChange: React.MutableRefObject<OnSelectChange>;
}) => {
  const changeSchema = useRef(
    factoryChangeSchema({
      setCurrentSchema,
      onSchemaChange,
      getTableList,
      onSelectChange,
    }),
  );
  useEffect(() => {
    changeSchema.current = factoryChangeSchema({
      setCurrentSchema,
      onSchemaChange,
      getTableList,
      onSelectChange,
    });
  }, [getTableList, onSchemaChange, setCurrentSchema, onSelectChange]);

  return changeSchema;
};
