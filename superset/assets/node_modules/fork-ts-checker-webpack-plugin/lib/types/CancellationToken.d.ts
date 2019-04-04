interface CancellationTokenData {
    isCancelled: boolean;
    cancellationFileName: string;
}
export declare class CancellationToken {
    isCancelled: boolean;
    cancellationFileName: string;
    lastCancellationCheckTime: number;
    constructor(cancellationFileName: string, isCancelled: boolean);
    static createFromJSON(json: CancellationTokenData): CancellationToken;
    toJSON(): {
        cancellationFileName: string;
        isCancelled: boolean;
    };
    getCancellationFilePath(): string;
    isCancellationRequested(): boolean;
    throwIfCancellationRequested(): void;
    requestCancellation(): void;
    cleanupCancellation(): void;
}
export {};
