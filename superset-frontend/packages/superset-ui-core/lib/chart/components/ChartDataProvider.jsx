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
/* eslint react/sort-comp: 'off' */
import React from 'react';
import ChartClient from '../clients/ChartClient';
class ChartDataProvider extends React.PureComponent {
    chartClient;
    constructor(props) {
        super(props);
        this.state = { status: 'uninitialized' };
        this.chartClient = new ChartClient({ client: props.client });
    }
    componentDidMount() {
        this.handleFetchData();
    }
    componentDidUpdate(prevProps) {
        const { formData, sliceId } = this.props;
        if (formData !== prevProps.formData || sliceId !== prevProps.sliceId) {
            this.handleFetchData();
        }
    }
    extractSliceIdAndFormData() {
        const { formData, sliceId } = this.props;
        return formData ? { formData } : { sliceId: sliceId };
    }
    handleFetchData = () => {
        const { loadDatasource, formDataRequestOptions, datasourceRequestOptions, queryRequestOptions, } = this.props;
        this.setState({ status: 'loading' }, () => {
            try {
                this.chartClient
                    .loadFormData(this.extractSliceIdAndFormData(), formDataRequestOptions)
                    .then(formData => Promise.all([
                    loadDatasource
                        ? this.chartClient.loadDatasource(formData.datasource, datasourceRequestOptions)
                        : Promise.resolve(undefined),
                    this.chartClient.loadQueryData(formData, queryRequestOptions),
                ]).then(([datasource, queriesData]) => 
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                ({
                    datasource,
                    formData,
                    queriesData,
                })))
                    .then(this.handleReceiveData)
                    .catch(this.handleError);
            }
            catch (error) {
                this.handleError(error);
            }
        });
    };
    handleReceiveData = (payload) => {
        const { onLoaded } = this.props;
        if (onLoaded)
            onLoaded(payload);
        this.setState({ payload, status: 'loaded' });
    };
    handleError = (error) => {
        const { onError } = this.props;
        if (onError)
            onError(error);
        this.setState({ error, status: 'error' });
    };
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
                return null;
        }
    }
}
export default ChartDataProvider;
//# sourceMappingURL=ChartDataProvider.jsx.map