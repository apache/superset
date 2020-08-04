import { Datasource } from '../../types/Datasource';
import { BaseParams } from '../types';
export interface Params extends BaseParams {
    datasourceKey: string;
}
export default function getDatasourceMetadata({ client, datasourceKey, requestConfig, }: Params): Promise<Datasource>;
//# sourceMappingURL=getDatasourceMetadata.d.ts.map