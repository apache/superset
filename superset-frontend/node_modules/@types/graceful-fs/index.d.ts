// Type definitions for graceful-fs 4.1
// Project: https://github.com/isaacs/node-graceful-fs
// Definitions by: Bart van der Schoor <https://github.com/Bartvds>
//                 BendingBender <https://github.com/BendingBender>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.2

/// <reference types="node" />

import * as fs from 'fs';

export * from 'fs';

/**
 * Use this method to patch the global fs module (or any other fs-like module).
 * NOTE: This should only ever be done at the top-level application layer, in order to delay on
 * EMFILE errors from any fs-using dependencies. You should **not** do this in a library, because
 * it can cause unexpected delays in other parts of the program.
 * @param fsModule The reference to the fs module or an fs-like module.
 */
export function gracefulify<T>(fsModule: T): T & Lutimes;

export interface Lutimes {
    /**
     * Asynchronously change file timestamps of the file referenced by the supplied path.
     * If path refers to a symbolic link, then the link is not dereferenced: instead, the timestamps
     * of the symbolic link are changed.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    lutimes: typeof fs.lutimes;
    /**
     * Synchronously change file timestamps of the file referenced by the supplied path.
     * If path refers to a symbolic link, then the link is not dereferenced: instead, the timestamps
     * of the symbolic link are changed.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    lutimesSync: typeof fs.lutimesSync;
}

declare module 'fs' {
    /**
     * Asynchronously change file timestamps of the file referenced by the supplied path.
     * If path refers to a symbolic link, then the link is not dereferenced: instead, the timestamps
     * of the symbolic link are changed.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    function lutimes(path: PathLike,
                     atime: string | number | Date,
                     mtime: string | number | Date,
                     callback?: (err: NodeJS.ErrnoException | null) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace lutimes {
        /**
         * Asynchronously change file timestamps of the file referenced by the supplied path.
         * If path refers to a symbolic link, then the link is not dereferenced: instead, the timestamps
         * of the symbolic link are changed.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param atime The last access time. If a string is provided, it will be coerced to number.
         * @param mtime The last modified time. If a string is provided, it will be coerced to number.
         */
        function __promisify__(path: PathLike, atime: string | number | Date, mtime: string | number | Date): Promise<void>;
    }

    /**
     * Synchronously change file timestamps of the file referenced by the supplied path.
     * If path refers to a symbolic link, then the link is not dereferenced: instead, the timestamps
     * of the symbolic link are changed.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    function lutimesSync(path: PathLike, atime: string | number | Date, mtime: string | number | Date): void;
}
