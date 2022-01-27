import { ClientConfig, ClientTimeout, Credentials, CsrfPromise, CsrfToken, FetchRetryOptions, Headers, Host, Mode, Protocol, RequestConfig, ParseMethod } from './types';
export default class SupersetClientClass {
    credentials: Credentials;
    csrfToken?: CsrfToken;
    csrfPromise?: CsrfPromise;
    fetchRetryOptions?: FetchRetryOptions;
    baseUrl: string;
    protocol: Protocol;
    host: Host;
    headers: Headers;
    mode: Mode;
    timeout: ClientTimeout;
    constructor({ baseUrl, host, protocol, headers, fetchRetryOptions, mode, timeout, credentials, csrfToken, }?: ClientConfig);
    init(force?: boolean): CsrfPromise;
    reAuthenticate(): Promise<string | undefined>;
    isAuthenticated(): boolean;
    get<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & {
        parseMethod?: T;
    }): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? import("./types").JsonResponse : T extends "text" ? import("./types").TextResponse : never>;
    delete<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & {
        parseMethod?: T;
    }): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? import("./types").JsonResponse : T extends "text" ? import("./types").TextResponse : never>;
    put<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & {
        parseMethod?: T;
    }): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? import("./types").JsonResponse : T extends "text" ? import("./types").TextResponse : never>;
    post<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & {
        parseMethod?: T;
    }): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? import("./types").JsonResponse : T extends "text" ? import("./types").TextResponse : never>;
    request<T extends ParseMethod = 'json'>({ credentials, mode, endpoint, host, url, headers, timeout, fetchRetryOptions, ...rest }: RequestConfig & {
        parseMethod?: T;
    }): Promise<T extends "raw" | null ? Response : T extends "json" | undefined ? import("./types").JsonResponse : T extends "text" ? import("./types").TextResponse : never>;
    ensureAuth(): CsrfPromise;
    getCSRFToken(): Promise<string | undefined>;
    getUrl({ host: inputHost, endpoint, url, }?: {
        endpoint?: string;
        host?: Host;
        url?: string;
    }): string;
    redirectUnauthorized(): void;
}
//# sourceMappingURL=SupersetClientClass.d.ts.map