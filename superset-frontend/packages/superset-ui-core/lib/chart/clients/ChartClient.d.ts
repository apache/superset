import { SupersetClientInterface, RequestConfig, SupersetClientClass, QueryFormData, Datasource } from '../..';
import { QueryData } from '../types/QueryResponse';
import { AnnotationLayerMetadata } from '../types/Annotation';
import { PlainObject } from '../types/Base';
declare type AtLeastOne<All, Each = {
    [K in keyof All]: Pick<All, K>;
}> = Partial<All> & Each[keyof Each];
export declare type SliceIdAndOrFormData = AtLeastOne<{
    sliceId: number;
    formData: Partial<QueryFormData>;
}>;
interface AnnotationData {
    [key: string]: PlainObject;
}
export interface ChartData {
    annotationData: AnnotationData;
    datasource: PlainObject;
    formData: QueryFormData;
    queriesData: QueryData[];
}
export default class ChartClient {
    readonly client: SupersetClientInterface | SupersetClientClass;
    constructor(config?: {
        client?: SupersetClientInterface | SupersetClientClass;
    });
    loadFormData(input: SliceIdAndOrFormData, options?: Partial<RequestConfig>): Promise<QueryFormData>;
    loadQueryData(formData: QueryFormData, options?: Partial<RequestConfig>): Promise<QueryData[]>;
    loadDatasource(datasourceKey: string, options?: Partial<RequestConfig>): Promise<Datasource>;
    loadAnnotation(annotationLayer: AnnotationLayerMetadata): Promise<AnnotationData>;
    loadAnnotations(annotationLayers?: AnnotationLayerMetadata[]): Promise<AnnotationData>;
    loadChartData(input: SliceIdAndOrFormData): Promise<ChartData>;
}
export {};
//# sourceMappingURL=ChartClient.d.ts.map