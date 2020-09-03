import { SupersetClient } from '../../../connection';
import { Datasource } from '../../types/Datasource';
import { BaseParams } from '../types';

export interface Params extends BaseParams {
  datasourceKey: string;
}

export default function getDatasourceMetadata({
  client = SupersetClient,
  datasourceKey,
  requestConfig,
}: Params) {
  return client
    .get({
      endpoint: `/superset/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
      ...requestConfig,
    })
    .then(response => response.json as Datasource);
}
