import rison from 'rison';
import { SupersetClient, t } from '@superset-ui/core';

export type FetchSchemas = ({
  databaseId,
  forceRefresh,
}: {
  databaseId: number | null;
  forceRefresh?: boolean | undefined;
}) => Promise<void>;

export const factoryFetchSchemas = ({
  setSchemaLoading,
  setSchemaOptions,
  onSchemasLoad,
  handleError,
}: {
  setSchemaLoading: (loading: boolean) => void;
  setSchemaOptions: (options: any[]) => void;
  onSchemasLoad?: (schemas: Array<object>) => void;
  handleError: (msg: string) => void;
}): FetchSchemas => async ({ databaseId, forceRefresh }) => {
  if (!databaseId) return;
  const queryParams = rison.encode({ force: !!forceRefresh });
  const endpoint = `/api/v1/database/${databaseId}/schemas/?q=${queryParams}`;
  try {
    const { json } = await SupersetClient.get({ endpoint });
    const options = json.result.map((s: string) => ({
      value: s,
      label: s,
      title: s,
    }));
    setSchemaOptions(options);
    if (onSchemasLoad) {
      onSchemasLoad(options);
    }
  } catch {
    setSchemaOptions([]);
    handleError(t('Error while fetching schema list'));
  }
  setSchemaLoading(false);
};
