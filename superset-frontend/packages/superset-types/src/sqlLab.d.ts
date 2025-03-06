import { Event } from './core';

export namespace sqlLab {
  export interface Column {
    name: string;
    type: string;
  }
  export interface Table {
    name: string;
    columns: Column[];
  }

  export interface Catalog {}

  export interface Schema {
    tables: Table[];
  }

  export interface Database {
    name: string;
    catalogs: Catalog[];
    schemas: Schema[];
  }

  export interface Editor {}

  export interface Panel {
    /**
     * Show the panel in the UI.
     *
     * @param preserveFocus When `true` the panel will not take focus.
     */
    show(preserveFocus?: boolean): void;

    /**
     * Hide the panel if it's currently showing.
     */
    hide(): void;

    /**
     * Dispose and free associated resources.
     */
    dispose(): void;
  }

  export declare const databases: Database[];

  // Examples of database events

  export declare const onDidChangeActiveDatabase: Event<Database>;

  export declare const onDidChangeDatabase: Event<Database>;

  // Examples of schema events

  export declare const onDidRefreshSchema: Event<Schema>;

  // Examples of table events

  export declare const onDidRefreshTable: Event<Table>;

  export declare const editors: Editor[];

  export declare const panels: Panel[];

  // Examples of panel events

  export declare const onDidChangeActivePanel: Event<Panel | undefined>;

  export declare const onDidOpenPanel: Event<Panel>;

  export declare const onDidClosePanel: Event<Panel>;

  export declare const onDidChangePanelState: Event<Panel>;
}
