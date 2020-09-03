import { DatasourceType } from './types/Datasource';

export default class DatasourceKey {
  readonly id: number;

  readonly type: DatasourceType;

  constructor(key: string) {
    const [idStr, typeStr] = key.split('__');
    this.id = parseInt(idStr, 10);
    this.type = typeStr === 'table' ? DatasourceType.Table : DatasourceType.Druid;
  }

  public toString() {
    return `${this.id}__${this.type}`;
  }

  public toObject() {
    return {
      id: this.id,
      type: this.type,
    };
  }
}
