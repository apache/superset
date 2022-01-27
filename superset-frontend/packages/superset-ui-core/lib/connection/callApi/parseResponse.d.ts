import { ParseMethod, TextResponse, JsonResponse } from '../types';
export default function parseResponse<T extends ParseMethod = 'json'>(apiPromise: Promise<Response>, parseMethod?: T): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? JsonResponse : T extends "text" ? TextResponse : never>;
//# sourceMappingURL=parseResponse.d.ts.map