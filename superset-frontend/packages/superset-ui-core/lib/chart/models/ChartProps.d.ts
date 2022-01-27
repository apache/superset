import { AppSection, Behavior, Datasource, FilterState, JsonObject } from '../..';
import { HandlerFunction, PlainObject, SetDataMaskHook } from '../types/Base';
import { QueryData, DataRecordFilters } from '..';
declare type AnnotationData = PlainObject;
declare type SnakeCaseDatasource = PlainObject;
declare type CamelCaseFormData = PlainObject;
declare type SnakeCaseFormData = PlainObject;
declare type RawFormData = CamelCaseFormData | SnakeCaseFormData;
declare type ChartPropsSelector = (c: ChartPropsConfig) => ChartProps;
/** Optional field for event handlers, renderers */
declare type Hooks = {
    /**
     * sync active filters between chart and dashboard, "add" actually
     * also handles "change" and "remove".
     */
    onAddFilter?: (newFilters: DataRecordFilters, merge?: boolean) => void;
    /** handle errors */
    onError?: HandlerFunction;
    /** use the vis as control to update state */
    setControlValue?: HandlerFunction;
    /** handle external filters */
    setDataMask?: SetDataMaskHook;
    /** handle tooltip */
    setTooltip?: HandlerFunction;
} & PlainObject;
/**
 * Preferred format for ChartProps config
 */
export interface ChartPropsConfig {
    annotationData?: AnnotationData;
    /** Datasource metadata */
    datasource?: SnakeCaseDatasource;
    /**
     * Formerly called "filters", which was misleading because it is actually
     * initial values of the filter_box and table vis
     */
    initialValues?: DataRecordFilters;
    /** Main configuration of the chart */
    formData?: RawFormData;
    /** Chart height */
    height?: number;
    /** Programmatic overrides such as event handlers, renderers */
    hooks?: Hooks;
    /** The data returned for all queries objects in the request */
    queriesData?: QueryData[];
    /** Chart width */
    width?: number;
    /** Own chart state that saved in dashboard */
    ownState?: JsonObject;
    /** Filter state that saved in dashboard */
    filterState?: FilterState;
    /** Set of actual behaviors that this instance of chart should use */
    behaviors?: Behavior[];
    /** Application section of the chart on the screen (in what components/screen it placed) */
    appSection?: AppSection;
    /** is the chart refreshing its contents */
    isRefreshing?: boolean;
}
export default class ChartProps<FormData extends RawFormData = RawFormData> {
    static createSelector: () => ChartPropsSelector;
    annotationData: AnnotationData;
    datasource: Datasource;
    rawDatasource: SnakeCaseDatasource;
    initialValues: DataRecordFilters;
    formData: CamelCaseFormData;
    rawFormData: FormData;
    height: number;
    hooks: Hooks;
    ownState: JsonObject;
    filterState: FilterState;
    queriesData: QueryData[];
    width: number;
    behaviors: Behavior[];
    appSection?: AppSection;
    isRefreshing?: boolean;
    constructor(config?: ChartPropsConfig & {
        formData?: FormData;
    });
}
export {};
//# sourceMappingURL=ChartProps.d.ts.map