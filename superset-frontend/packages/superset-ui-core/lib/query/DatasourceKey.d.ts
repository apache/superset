import { DatasourceType } from './types/Datasource';
export default class DatasourceKey {
    readonly id: number;
    readonly type: DatasourceType;
    constructor(key: string);
    toString(): string;
    toObject(): {
        id: number;
        type: DatasourceType;
    };
}
//# sourceMappingURL=DatasourceKey.d.ts.map