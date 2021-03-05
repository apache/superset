import { useEffect, useRef } from 'react';
import { factoryOnSelectChange } from './factoryOnSelectChange';

export const useOnSelectChange = ({
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
    dbId: number;
    schema?: string;
    tableName?: string;
  }) => void;
}) => {
  const onSelectChange = useRef(
    factoryOnSelectChange({
      setCurrentDbId,
      setCurrentSchema,
      onChange,
    }),
  );
  useEffect(() => {
    onSelectChange.current = factoryOnSelectChange({
      setCurrentDbId,
      setCurrentSchema,
      onChange,
    });
  }, [onChange, setCurrentDbId, setCurrentSchema]);

  return onSelectChange;
};
