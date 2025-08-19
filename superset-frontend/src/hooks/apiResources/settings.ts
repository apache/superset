import { useApiV1Resource } from './apiResources';

export const useDatabaseTables = (id: string | number) =>
  useApiV1Resource<{ [schema: string]: string[] }>(
    `/api/v1/database/${id}/schema_tables/`,
  );
