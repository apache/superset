import { FormData } from './formData';

enum DatasourceType {
  Table = 'table',
  Druid = 'druid',
}

export interface Datasource {
  id: number;
  type: DatasourceType;
}

// Declaration merging with the interface above. No need to redeclare id and type.
export class Datasource {
  constructor(key: string) {
    const [ idStr, typeStr ] = key.split('__');
    this.id = parseInt(idStr, 10);
    this.type = typeStr === 'table' ? DatasourceType.Table : DatasourceType.Druid;
  }

  public toKey() {
    return `${this.id}__${this.type}`;
  }

  public toObject() {
    return {
      id: this.id,
      type: this.type,
    };
  }
}

export default function buildDatasource(formData: FormData) {
  return new Datasource(formData.datasource).toObject();
}
