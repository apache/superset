import { FormData } from './formData';

enum DatasourceType {
  Table = 'table',
  Druid = 'druid',
}

export interface Datasource {
  id: number;
  type: DatasourceType;
}

export default function buildDatasource(formData: FormData): Datasource {
  const [id, type] = formData.datasource.split('__');
  return {
    id: parseInt(id, 10),
    type: type === 'table' ? DatasourceType.Table : DatasourceType.Druid,
  };
}
