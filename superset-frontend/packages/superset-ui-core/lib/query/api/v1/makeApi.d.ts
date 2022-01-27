import { Payload as SupersetPayload, JsonObject, ParseMethod, Endpoint, Method, RequestBase } from '../../../connection';
import { SupersetApiRequestOptions, ParsedResponseType } from './types';
interface SupersetApiFactoryOptions extends Omit<RequestBase, 'url'> {
    /**
     * API endpoint, must be relative.
     */
    endpoint: Endpoint;
    /**
     * Request method: 'GET' | 'POST' | 'DELETE' | 'PUT' | ...
     */
    method: Method;
    /**
     * How to send the payload:
     *  - form: set request.body as FormData
     *  - json: as JSON string with request Content-Type header set to application/json
     *  - search: add to search params
     */
    requestType?: 'form' | 'json' | 'search' | 'rison';
}
/**
 * Generate an API caller with predefined configs/typing and consistent
 * return values.
 */
export default function makeApi<Payload = SupersetPayload, Result = JsonObject, T extends ParseMethod = ParseMethod>({ endpoint, method, requestType: requestType_, responseType, processResponse, ...requestOptions }: SupersetApiFactoryOptions & {
    /**
     * How to parse response, choose from: 'json' | 'text' | 'raw'.
     */
    responseType?: T;
    /**
     * Further process parsed response
     */
    processResponse?(result: ParsedResponseType<T>): Result;
}): {
    (payload: Payload, { client }?: SupersetApiRequestOptions): Promise<Result>;
    method: string | undefined;
    endpoint: string;
    requestType: "json" | "search" | "form" | "rison";
};
export {};
//# sourceMappingURL=makeApi.d.ts.map