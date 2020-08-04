import * as ts from 'typescript';
interface DataShape {
    source: ts.SourceFile;
    linted: boolean;
    lints: any[];
}
export declare class FilesRegister {
    files: {
        [filePath: string]: {
            mtime: number;
            data: DataShape;
        };
    };
    dataFactory: (_data?: any) => DataShape;
    constructor(dataFactory: (_data?: any) => DataShape);
    keys(): string[];
    add(filePath: string): void;
    remove(filePath: string): void;
    has(filePath: string): boolean;
    get(filePath: string): {
        mtime: number;
        data: DataShape;
    };
    ensure(filePath: string): void;
    getData(filePath: string): DataShape;
    mutateData(filePath: string, mutator: (data: DataShape) => void): void;
    getMtime(filePath: string): number;
    setMtime(filePath: string, mtime: number): void;
}
export {};
