import { Event } from './core';

export namespace environment {
  export interface Clipboard {
    /**
     * Read the current clipboard contents as text.
     * @returns A promise that resolves to a string.
     */
    readText(): Promise<string>;

    /**
     * Writes text into the clipboard.
     * @returns A promise that resolves when writing happened.
     */
    writeText(value: string): Promise<void>;
  }

  /**
   * Log levels
   */
  export enum LogLevel {
    /**
     * No messages are logged with this level.
     */
    Off = 0,

    /**
     * All messages are logged with this level.
     */
    Trace = 1,

    /**
     * Messages with debug and higher log level are logged with this level.
     */
    Debug = 2,

    /**
     * Messages with info and higher log level are logged with this level.
     */
    Info = 3,

    /**
     * Messages with warning and higher log level are logged with this level.
     */
    Warning = 4,

    /**
     * Only error messages are logged with this level.
     */
    Error = 5,
  }

  /**
   * Represents the preferred user-language, like `de-CH`, `fr`, or `en-US`.
   */
  export declare const language: string;

  /**
   * The system clipboard.
   */
  export declare const clipboard: Clipboard;

  /**
   * The current log level of the editor.
   */
  export declare const logLevel: LogLevel;

  /**
   * An {@link Event} which fires when the log level of the editor changes.
   */
  export declare const onDidChangeLogLevel: Event<LogLevel>;

  export function openExternal(target: URL): Promise<boolean>; // TODO: URL or URI?
}
