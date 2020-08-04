import { Message } from './Message';
export declare class WorkResult {
    workResult: {};
    workDomain: any[];
    constructor(workDomain: any[]);
    supports(workName: number): boolean;
    set(workName: number, result: any): void;
    has(workName: number): boolean;
    get(workName: number): any;
    hasAll(): boolean;
    clear(): void;
    reduce(reducer: (m1: Message, m2: Message) => Message, initial: Message): any;
}
