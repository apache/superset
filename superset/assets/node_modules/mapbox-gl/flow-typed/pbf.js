declare module "pbf" {
    declare type ReadFunction<T> = (tag: number, result: T, pbf: Pbf) => void;

    declare class Pbf {
        constructor(buf?: ArrayBuffer | Uint8Array): Pbf;

        readFields<T>(readField: ReadFunction<T>, result: T, end?: number): T;
        readMessage<T>(readField: ReadFunction<T>, result: T): T;

        readFixed32(): number;
        readSFixed32(): number;
        readFixed64(): number;
        readSFixed64(): number;
        readFloat(): number;
        readDouble(): number;
        readVarint(): number;
        readVarint64(): number;
        readSVarint(): number;
        readBoolean(): boolean;
        readString(): string;
        readBytes(): Uint8Array;
    }

    declare module.exports: typeof Pbf
}
