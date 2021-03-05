import { useEffect, useRef } from 'react';
import { factoryFetchSchemas } from './factoryFetchSchemas';

export const useFetchSchemas = ({
  setSchemaLoading,
  setSchemaOptions,
  onSchemasLoad,
  handleError,
}: {
  setSchemaLoading: (loading: boolean) => void;
  setSchemaOptions: (options: any[]) => void;
  onSchemasLoad?: (schemas: Array<object>) => void;
  handleError: (msg: string) => void;
}) => {
  const fetchSchemas = useRef(
    factoryFetchSchemas({
      setSchemaOptions,
      onSchemasLoad,
      setSchemaLoading,
      handleError,
    }),
  );
  useEffect(() => {
    fetchSchemas.current = factoryFetchSchemas({
      setSchemaOptions,
      onSchemasLoad,
      setSchemaLoading,
      handleError,
    });
  }, [handleError, onSchemasLoad, setSchemaLoading, setSchemaOptions]);

  return fetchSchemas;
};
