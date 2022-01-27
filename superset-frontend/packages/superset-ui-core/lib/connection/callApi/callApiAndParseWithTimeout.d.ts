import { CallApi, ClientTimeout, ParseMethod } from '../types';
export default function callApiAndParseWithTimeout<T extends ParseMethod = 'json'>({ timeout, parseMethod, ...rest }: {
    timeout?: ClientTimeout;
    parseMethod?: T;
} & CallApi): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? import("../types").JsonResponse : T extends "text" ? import("../types").TextResponse : never>;
//# sourceMappingURL=callApiAndParseWithTimeout.d.ts.map