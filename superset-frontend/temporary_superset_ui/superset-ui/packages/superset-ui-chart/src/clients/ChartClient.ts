import { isDefined } from '@superset-ui/core';
import {
  SupersetClient,
  SupersetClientInterface,
  RequestConfig,
  Json,
  SupersetClientClass,
} from '@superset-ui/connection';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import { AnnotationLayerMetadata } from '../types/Annotation';
import { ChartFormData } from '../types/ChartFormData';
import { QueryData } from '../models/ChartProps';
import { Datasource } from '../types/Datasource';

// This expands to Partial<All> & (union of all possible single-property types)
type AtLeastOne<All, Each = { [K in keyof All]: Pick<All, K> }> = Partial<All> & Each[keyof Each];

export type SliceIdAndOrFormData = AtLeastOne<{
  sliceId: number;
  formData: Partial<ChartFormData>;
}>;

interface AnnotationData {
  [key: string]: object;
}

export interface ChartData {
  annotationData: AnnotationData;
  datasource: object;
  formData: ChartFormData;
  queryData: QueryData;
}

export default class ChartClient {
  readonly client: SupersetClientInterface | SupersetClientClass;

  constructor(
    config: {
      client?: SupersetClientInterface | SupersetClientClass;
    } = {},
  ) {
    const { client = SupersetClient } = config;
    this.client = client;
  }

  loadFormData(
    input: SliceIdAndOrFormData,
    options?: Partial<RequestConfig>,
  ): Promise<ChartFormData> {
    /* If sliceId is provided, use it to fetch stored formData from API */
    if ('sliceId' in input) {
      const promise = this.client
        .get({
          endpoint: `/api/v1/formData/?slice_id=${input.sliceId}`,
          ...options,
        } as RequestConfig)
        .then(response => response.json as Json)
        .then(json => json.form_data);

      /*
       * If formData is also specified, override API result
       * with user-specified formData
       */
      return promise.then((dbFormData: ChartFormData) => ({
        ...dbFormData,
        ...input.formData,
      }));
    }

    /* If sliceId is not provided, returned formData wrapped in a Promise */
    return input.formData
      ? Promise.resolve(input.formData as ChartFormData)
      : Promise.reject(new Error('At least one of sliceId or formData must be specified'));
  }

  async loadQueryData(formData: ChartFormData, options?: Partial<RequestConfig>): Promise<object> {
    const { viz_type: visType } = formData;
    const metaDataRegistry = getChartMetadataRegistry();
    const buildQueryRegistry = getChartBuildQueryRegistry();

    if (metaDataRegistry.has(visType)) {
      const { useLegacyApi } = metaDataRegistry.get(visType)!;
      const buildQuery = (await buildQueryRegistry.get(visType)) || (() => formData);

      return this.client
        .post({
          endpoint: useLegacyApi ? '/superset/explore_json/' : '/api/v1/query/',
          postPayload: {
            [useLegacyApi ? 'form_data' : 'query_context']: buildQuery(formData),
          },
          ...options,
        } as RequestConfig)
        .then(response => response.json as Json);
    }

    return Promise.reject(new Error(`Unknown chart type: ${visType}`));
  }

  loadDatasource(datasourceKey: string, options?: Partial<RequestConfig>): Promise<Datasource> {
    return this.client
      .get({
        endpoint: `/superset/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
        ...options,
      } as RequestConfig)
      .then(response => response.json as Datasource);
  }

  loadAnnotation(annotationLayer: AnnotationLayerMetadata): Promise<object> {
    /* When annotation does not require query */
    if (!isDefined(annotationLayer.sourceType)) {
      return Promise.resolve({});
    }

    // TODO: Implement
    return Promise.reject(new Error('This feature is not implemented yet.'));
  }

  loadAnnotations(annotationLayers?: AnnotationLayerMetadata[]): Promise<AnnotationData> {
    if (Array.isArray(annotationLayers) && annotationLayers.length > 0) {
      return Promise.all(annotationLayers.map(layer => this.loadAnnotation(layer))).then(results =>
        annotationLayers.reduce((prev, layer, i) => {
          const output: AnnotationData = prev;
          output[layer.name] = results[i];

          return output;
        }, {}),
      );
    }

    return Promise.resolve({});
  }

  loadChartData(input: SliceIdAndOrFormData): Promise<ChartData> {
    return this.loadFormData(input).then(formData =>
      Promise.all([
        this.loadAnnotations(formData.annotation_layers),
        this.loadDatasource(formData.datasource),
        this.loadQueryData(formData),
      ]).then(([annotationData, datasource, queryData]) => ({
        annotationData,
        datasource,
        formData,
        queryData,
      })),
    );
  }
}
