import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

/* eslint react/sort-comp: 'off' */
import React from 'react';






import ChartClient from '../clients/ChartClient';









































class ChartDataProvider extends React.PureComponent


{


  constructor(props) {
    super(props);this.chartClient = void 0;this.




















    handleFetchData = () => {
      const {
        loadDatasource,
        formDataRequestOptions,
        datasourceRequestOptions,
        queryRequestOptions } =
      this.props;

      this.setState({ status: 'loading' }, () => {
        try {
          this.chartClient.
          loadFormData(
          this.extractSliceIdAndFormData(),
          formDataRequestOptions).

          then((formData) =>
          Promise.all([
          loadDatasource ?
          this.chartClient.loadDatasource(
          formData.datasource,
          datasourceRequestOptions) :

          Promise.resolve(undefined),
          this.chartClient.loadQueryData(formData, queryRequestOptions)]).
          then(
          ([datasource, queriesData]) => (

          {
            datasource,
            formData,
            queriesData }))).



          then(this.handleReceiveData).
          catch(this.handleError);
        } catch (error) {
          this.handleError(error);
        }
      });
    };this.

    handleReceiveData = (payload) => {
      const { onLoaded } = this.props;
      if (onLoaded) onLoaded(payload);
      this.setState({ payload, status: 'loaded' });
    };this.

    handleError = (error) => {
      const { onError } = this.props;
      if (onError) onError(error);
      this.setState({ error, status: 'error' });
    };this.state = { status: 'uninitialized' };this.chartClient = new ChartClient({ client: props.client });}componentDidMount() {this.handleFetchData();}componentDidUpdate(prevProps) {const { formData, sliceId } = this.props;if (formData !== prevProps.formData || sliceId !== prevProps.sliceId) {this.handleFetchData();}}extractSliceIdAndFormData() {const { formData, sliceId } = this.props;return formData ? { formData } : { sliceId: sliceId };}

  render() {
    const { children } = this.props;
    const { status, payload, error } = this.state;

    switch (status) {
      case 'loading':
        return children({ loading: true });
      case 'loaded':
        return children({ payload });
      case 'error':
        return children({ error });
      case 'uninitialized':
      default:
        return null;}

  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}ChartDataProvider.propTypes = { children: _pt.func.isRequired, loadDatasource: _pt.bool, onError: _pt.func, onLoaded: _pt.func };const _default =
ChartDataProvider;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ChartDataProvider, "ChartDataProvider", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/ChartDataProvider.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/ChartDataProvider.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();