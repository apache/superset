/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  isDefined,
  SupersetClient,
  SupersetClientInterface,
  RequestConfig,
  SupersetClientClass,
  QueryFormData,
  Datasource,
} from '../..';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import { QueryData } from '../types/QueryResponse';
import { AnnotationLayerMetadata } from '../types/Annotation';
import { PlainObject } from '../types/Base';

// This expands to Partial<All> & (union of all possible single-property types)
type AtLeastOne<All, Each = { [K in keyof All]: Pick<All, K> }> = Partial<All> &
  Each[keyof Each];

export type SliceIdAndOrFormData = AtLeastOne<{
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
  ): Promise<QueryFormData> {
    /* If sliceId is provided, use it to fetch stored formData from API */
    if ('sliceId' in input) {
      const promise = this.client
        .get({
          endpoint: `/api/v1/form_data/?slice_id=${input.sliceId}`,
          ...options,
        } as RequestConfig)
        .then(response => response.json as QueryFormData);

      /*
       * If formData is also specified, override API result
       * with user-specified formData
       */
      return promise.then((dbFormData: QueryFormData) => ({
        ...dbFormData,
        ...input.formData,
      }));
    }

    /* If sliceId is not provided, returned formData wrapped in a Promise */
    return input.formData
      ? Promise.resolve(input.formData as QueryFormData)
      : Promise.reject(
          new Error('At least one of sliceId or formData must be specified'),
        );
  }

  async loadQueryData(
    formData: QueryFormData,
    options?: Partial<RequestConfig>,
  ): Promise<QueryData[]> {
    const { viz_type: visType } = formData;
    const metaDataRegistry = getChartMetadataRegistry();
    const buildQueryRegistry = getChartBuildQueryRegistry();

    if (metaDataRegistry.has(visType)) {
      const { useLegacyApi } = metaDataRegistry.get(visType)!;
      const buildQuery =
        (await buildQueryRegistry.get(visType)) ?? (() => formData);
      const requestConfig: RequestConfig = useLegacyApi
        ? {
            endpoint: '/superset/explore_json/',
            postPayload: {
              form_data: buildQuery(formData),
            },
            ...options,
          }
        : {
            endpoint: '/api/v1/chart/data',
            jsonPayload: {
              query_context: buildQuery(formData),
            },
            ...options,
          };

      return this.client
        .post(requestConfig)
        .then(response =>
          Array.isArray(response.json) ? response.json : [response.json],
        );
    }

    return Promise.reject(new Error(`Unknown chart type: ${visType}`));
  }

  loadDatasource(
    datasourceKey: string,
    options?: Partial<RequestConfig>,
  ): Promise<Datasource> {
    return this.client
      .get({
        endpoint: `/superset/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
        ...options,
      } as RequestConfig)
      .then(response => response.json as Datasource);
  }

  // eslint-disable-next-line class-methods-use-this
  loadAnnotation(
    annotationLayer: AnnotationLayerMetadata,
  ): Promise<AnnotationData> {
    /* When annotation does not require query */
    if (!isDefined(annotationLayer.sourceType)) {
      return Promise.resolve({} as AnnotationData);
    }

    // TODO: Implement
    return Promise.reject(new Error('This feature is not implemented yet.'));
  }

  loadAnnotations(
    annotationLayers?: AnnotationLayerMetadata[],
  ): Promise<AnnotationData> {
    if (Array.isArray(annotationLayers) && annotationLayers.length > 0) {
      return Promise.all(
        annotationLayers.map(layer => this.loadAnnotation(layer)),
      ).then(results =>
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
    return this.loadFormData(input).then(
      (
        formData: QueryFormData & {
          // eslint-disable-next-line camelcase
          annotation_layers?: AnnotationLayerMetadata[];
        },
      ) =>
        Promise.all([
          this.loadAnnotations(formData.annotation_layers),
          this.loadDatasource(formData.datasource),
          this.loadQueryData(formData),
        ]).then(([annotationData, datasource, queriesData]) => ({
          annotationData,
          datasource,
          formData,
          queriesData,
        })),
    );
  }
}
