import { ConfigMap, FilterMap } from './types';
export declare const TYPE_FLOW = 1;
export declare const TYPE_SECTION: number;
export declare const TYPE_HEADING: number;
export declare const TYPE_PHRASING: number;
export declare const TYPE_EMBEDDED: number;
export declare const TYPE_INTERACTIVE: number;
export declare const TYPE_PALPABLE: number;
export declare const TAGS: ConfigMap;
export declare const BANNED_TAG_LIST: string[];
export declare const ALLOWED_TAG_LIST: string[];
export declare const FILTER_ALLOW = 1;
export declare const FILTER_DENY = 2;
export declare const FILTER_CAST_NUMBER = 3;
export declare const FILTER_CAST_BOOL = 4;
export declare const FILTER_NO_CAST = 5;
export declare const ATTRIBUTES: FilterMap;
export declare const ATTRIBUTES_TO_PROPS: {
    [key: string]: string;
};
//# sourceMappingURL=constants.d.ts.map