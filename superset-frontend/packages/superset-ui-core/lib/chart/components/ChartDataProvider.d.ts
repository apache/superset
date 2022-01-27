import React, { ReactNode } from 'react';
import { SupersetClientInterface, RequestConfig, QueryFormData, Datasource } from '../..';
import ChartClient, { SliceIdAndOrFormData } from '../clients/ChartClient';
import { QueryData } from '../types/QueryResponse';
interface Payload {
    formData: Partial<QueryFormData>;
    queriesData: QueryData[];
    datasource?: Datasource;
}
export interface ProvidedProps {
    payload?: Payload;
    error?: Error;
    loading?: boolean;
}
export declare type ChartDataProviderProps = 
/** User can pass either one or both of sliceId or formData */
SliceIdAndOrFormData & {
    /** Child function called with ProvidedProps */
    children: (provided: ProvidedProps) => ReactNode;
    /** Superset client which is used to fetch data. It should already be configured and initialized. */
    client?: SupersetClientInterface;
    /** Will fetch and include datasource metadata for SliceIdAndOrFormData in the payload. */
    loadDatasource?: boolean;
    /** Callback when an error occurs. Enables wrapping the Provider in an ErrorBoundary. */
    onError?: (error: ProvidedProps['error']) => void;
    /** Callback when data is loaded. */
    onLoaded?: (payload: ProvidedProps['payload']) => void;
    /** Hook to override the formData request config. */
    formDataRequestOptions?: Partial<RequestConfig>;
    /** Hook to override the datasource request config. */
    datasourceRequestOptions?: Partial<RequestConfig>;
    /** Hook to override the queriesData request config. */
    queryRequestOptions?: Partial<RequestConfig>;
};
export declare type ChartDataProviderState = {
    status: 'uninitialized' | 'loading' | 'error' | 'loaded';
    payload?: ProvidedProps['payload'];
    error?: ProvidedProps['error'];
};
declare class ChartDataProvider extends React.PureComponent<ChartDataProviderProps, ChartDataProviderState> {
    readonly chartClient: ChartClient;
    constructor(props: ChartDataProviderProps);
    componentDidMount(): void;
    componentDidUpdate(prevProps: ChartDataProviderProps): void;
    private extractSliceIdAndFormData;
    private handleFetchData;
    private handleReceiveData;
    private handleError;
    render(): React.ReactNode;
}
export default ChartDataProvider;
//# sourceMappingURL=ChartDataProvider.d.ts.map