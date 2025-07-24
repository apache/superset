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

import { ComponentType } from 'react';
import { isRequired, Plugin, QueryFormData } from '../..';
import ChartMetadata from './ChartMetadata';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartControlPanelRegistry from '../registries/ChartControlPanelRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
import { BuildQueryFunction, TransformProps } from '../types/TransformFunction';
import { ChartControlPanel } from './ChartControlPanel';
import { ChartProps } from '..';

function IDENTITY<T>(x: T) {
  return x;
}

const EMPTY = {};

export type PromiseOrValue<T> = Promise<T> | T;
export type PromiseOrValueLoader<T> = () => PromiseOrValue<T>;
export type ChartType = ComponentType<any>;
type ValueOrModuleWithValue<T> = T | { default: T };

interface ChartPluginConfig<
  FormData extends QueryFormData = QueryFormData,
  Props extends ChartProps = ChartProps,
> {
  metadata: ChartMetadata;
  /** Use buildQuery for immediate value. For lazy-loading, use loadBuildQuery. */
  buildQuery?: BuildQueryFunction<FormData>;
  /** Use loadBuildQuery for dynamic import (lazy-loading) */
  loadBuildQuery?: PromiseOrValueLoader<
    ValueOrModuleWithValue<BuildQueryFunction<FormData>>
  >;
  /** Use transformProps for immediate value. For lazy-loading, use loadTransformProps.  */
  transformProps?: TransformProps<Props>;
  /** Use loadTransformProps for dynamic import (lazy-loading) */
  loadTransformProps?: PromiseOrValueLoader<
    ValueOrModuleWithValue<TransformProps<Props>>
  >;
  /** Use Chart for immediate value. For lazy-loading, use loadChart. */
  Chart?: ChartType;
  /** Use loadChart for dynamic import (lazy-loading) */
  loadChart?: PromiseOrValueLoader<ValueOrModuleWithValue<ChartType>>;
  /** Control panel configuration object */
  controlPanel?: ChartControlPanel;
}

/**
 * Loaders of the form `() => import('foo')` may return esmodules
 * which require the value to be extracted as `module.default`
 * */
function sanitizeLoader<T extends object>(
  loader: PromiseOrValueLoader<ValueOrModuleWithValue<T>>,
): PromiseOrValueLoader<T> {
  return () => {
    const loaded = loader();

    return loaded instanceof Promise
      ? (loaded.then(
          module => ('default' in module && module.default) || module,
        ) as Promise<T>)
      : (loaded as T);
  };
}

export default class ChartPlugin<
  FormData extends QueryFormData = QueryFormData,
  Props extends ChartProps = ChartProps,
> extends Plugin {
  controlPanel: ChartControlPanel;

  metadata: ChartMetadata;

  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction<FormData>>;

  loadTransformProps: PromiseOrValueLoader<TransformProps<Props>>;

  loadChart: PromiseOrValueLoader<ChartType>;

  constructor(config: ChartPluginConfig<FormData, Props>) {
    super();
    const {
      metadata,
      buildQuery,
      loadBuildQuery,
      transformProps = IDENTITY,
      loadTransformProps,
      Chart,
      loadChart,
      controlPanel = EMPTY,
    } = config;
    this.controlPanel = controlPanel;
    this.metadata = metadata;
    this.loadBuildQuery =
      (loadBuildQuery && sanitizeLoader(loadBuildQuery)) ||
      (buildQuery && sanitizeLoader(() => buildQuery)) ||
      undefined;
    this.loadTransformProps = sanitizeLoader(
      loadTransformProps ?? (() => transformProps),
    );

    if (loadChart) {
      this.loadChart = sanitizeLoader<ChartType>(loadChart);
    } else if (Chart) {
      this.loadChart = () => Chart;
    } else {
      throw new Error('Chart or loadChart is required');
    }
  }

  register() {
    const key: string = this.config.key || isRequired('config.key');
    getChartMetadataRegistry().registerValue(key, this.metadata);
    getChartComponentRegistry().registerLoader(key, this.loadChart);
    getChartControlPanelRegistry().registerValue(key, this.controlPanel);
    getChartTransformPropsRegistry().registerLoader(
      key,
      this.loadTransformProps,
    );
    if (this.loadBuildQuery) {
      getChartBuildQueryRegistry().registerLoader(key, this.loadBuildQuery);
    }
    return this;
  }

  unregister() {
    const key: string = this.config.key || isRequired('config.key');
    getChartMetadataRegistry().remove(key);
    getChartComponentRegistry().remove(key);
    getChartControlPanelRegistry().remove(key);
    getChartTransformPropsRegistry().remove(key);
    getChartBuildQueryRegistry().remove(key);
    return this;
  }

  configure(config: { [key: string]: unknown }, replace?: boolean) {
    super.configure(config, replace);

    return this;
  }
}
