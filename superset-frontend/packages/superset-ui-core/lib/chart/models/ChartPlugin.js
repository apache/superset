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
import { isRequired, Plugin } from '../..';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartControlPanelRegistry from '../registries/ChartControlPanelRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
function IDENTITY(x) {
    return x;
}
const EMPTY = {};
/**
 * Loaders of the form `() => import('foo')` may return esmodules
 * which require the value to be extracted as `module.default`
 * */
function sanitizeLoader(loader) {
    return () => {
        const loaded = loader();
        return loaded instanceof Promise
            ? loaded.then(module => ('default' in module && module.default) || module)
            : loaded;
    };
}
export default class ChartPlugin extends Plugin {
    controlPanel;
    metadata;
    loadBuildQuery;
    loadTransformProps;
    loadChart;
    constructor(config) {
        super();
        const { metadata, buildQuery, loadBuildQuery, transformProps = IDENTITY, loadTransformProps, Chart, loadChart, controlPanel = EMPTY, } = config;
        this.controlPanel = controlPanel;
        this.metadata = metadata;
        this.loadBuildQuery =
            (loadBuildQuery && sanitizeLoader(loadBuildQuery)) ||
                (buildQuery && sanitizeLoader(() => buildQuery)) ||
                undefined;
        this.loadTransformProps = sanitizeLoader(loadTransformProps ?? (() => transformProps));
        if (loadChart) {
            this.loadChart = sanitizeLoader(loadChart);
        }
        else if (Chart) {
            this.loadChart = () => Chart;
        }
        else {
            throw new Error('Chart or loadChart is required');
        }
    }
    register() {
        const key = this.config.key || isRequired('config.key');
        getChartMetadataRegistry().registerValue(key, this.metadata);
        getChartComponentRegistry().registerLoader(key, this.loadChart);
        getChartControlPanelRegistry().registerValue(key, this.controlPanel);
        getChartTransformPropsRegistry().registerLoader(key, this.loadTransformProps);
        if (this.loadBuildQuery) {
            getChartBuildQueryRegistry().registerLoader(key, this.loadBuildQuery);
        }
        return this;
    }
    unregister() {
        const key = this.config.key || isRequired('config.key');
        getChartMetadataRegistry().remove(key);
        getChartComponentRegistry().remove(key);
        getChartControlPanelRegistry().remove(key);
        getChartTransformPropsRegistry().remove(key);
        getChartBuildQueryRegistry().remove(key);
        return this;
    }
    configure(config, replace) {
        super.configure(config, replace);
        return this;
    }
}
//# sourceMappingURL=ChartPlugin.js.map