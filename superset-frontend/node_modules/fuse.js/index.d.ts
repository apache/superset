// Type definitions for Fuse.js 3.2.0

export = Fuse;
export as namespace Fuse;

declare class Fuse<T> {
  constructor(list: ReadonlyArray<T>, options?: Fuse.FuseOptions<T>)
  search(pattern: string): T[];

  setCollection(list: ReadonlyArray<T>): ReadonlyArray<T>;
}

declare namespace Fuse {
  export interface FuseOptions<T> {
    id?: string;
    caseSensitive?: boolean;
    includeMatches?: boolean;
    includeScore?: boolean;
    shouldSort?: boolean;
    sortFn?: (a: { score: number }, b: { score: number }) => number;
    getFn?: (obj: any, path: string) => any;
    keys?: (keyof T)[] | { name: keyof T; weight: number }[];
    verbose?: boolean;
    tokenize?: boolean;
    tokenSeparator?: RegExp;
    matchAllTokens?: boolean;
    location?: number;
    distance?: number;
    threshold?: number;
    maxPatternLength?: number;
    minMatchCharLength?: number;
    findAllMatches?: boolean;
  }
}
