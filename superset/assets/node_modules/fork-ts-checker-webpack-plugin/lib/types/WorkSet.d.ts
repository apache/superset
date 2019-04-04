import * as ts from 'typescript';
export declare class WorkSet {
    workDomain: ReadonlyArray<ts.SourceFile> | string[];
    workNumber: number;
    workDivision: number;
    workSize: number;
    workBegin: number;
    workEnd: number;
    constructor(workDomain: ReadonlyArray<ts.SourceFile> | string[], workNumber: number, workDivision: number);
    forEach(callback: (workDomainItem: any, index: number) => void): void;
}
