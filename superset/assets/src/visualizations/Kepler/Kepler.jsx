/**
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
import React from 'react';
import { connect, Provider } from 'react-redux';
import PropTypes from 'prop-types';
import KeplerGl from 'kepler.gl';
import KeplerGlSchema from 'kepler.gl/schemas';
import { addDataToMap } from 'kepler.gl/actions';
import Processors from 'kepler.gl/processors';
import shortid from 'shortid';
import { createStore, combineReducers } from 'redux';
import keplerGlReducer from 'kepler.gl/reducers';

import './Kepler.css';

const propTypes = {
  height: PropTypes.number,
  setControlValue: PropTypes.func,
  readonly: PropTypes.boolean,
};
const reducers = combineReducers({
  // <-- mount kepler.gl reducer in your app
  keplerGl: keplerGlReducer,
  readonly: false,
});

class Kepler extends React.PureComponent {
  constructor(props) {
    super(props);
    this.setMapConfig = this.setMapConfig.bind(this);
    this.state = {
      keplerId: shortid.generate(),
    };
  }
  componentDidMount() {
    this.addDataToMap(this.props);
    this.setMapConfig();
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.features !== this.props.features) {
      this.addDataToMap(nextProps, false);
      this.setMapConfig();
    }
  }
  getCurrentConfig() {
    try {
      const { keplerGl } = this.props;
      return KeplerGlSchema.getConfigToSave(keplerGl[this.state.keplerId]);
    } catch (e) {
      return null;
    }
  }
  setMapConfig() {
    const { setControlValue } = this.props;
    const config = this.getCurrentConfig();
    if (config) {
      setControlValue('config', JSON.stringify(this.getCurrentConfig(), null, 2));
    }
  }
  addDataToMap(props, useControlConfig = true) {
    let config = props.config;
    if (!config) {
      config = null;
    } else {
      config = useControlConfig ? JSON.parse(config) : this.getCurrentConfig();
    }
    const data = Processors.processRowObject(props.features);
    const datasets = [{
      data,
      info: {
        id: 'main',
        label: 'Superset Data',
      },
    }];
    const options = { readOnly: this.props.readonly };
    if (this.props.autozoom) {
      options.centerMap = true;
      if (config && config.config) {
        config.config.mapState = {};
      }
    }
    props.dispatch(addDataToMap({ datasets, config, options }));
  }
  render() {
    return (
      <div>
        <KeplerGl
          id={this.state.keplerId}
          onSaveMap={this.setMapConfig}
          {...this.props}
        />
      </div>);
  }
}

Kepler.displayName = 'Kepler';
Kepler.propTypes = propTypes;

const mapStateToProps = state => ({ keplerGl: state.keplerGl });
const dispatchToProps = dispatch => ({ dispatch });
const KeplerConnected = connect(mapStateToProps, dispatchToProps)(Kepler);

// eslint-disable-next-line react/no-multi-comp
export default class SubApp extends React.Component {
  constructor(props) {
    super(props);
    this.store = createStore(reducers);
  }
  render() {
    return (
      <Provider store={this.store}>
        <KeplerConnected {...this.props} />
      </Provider>
    );
  }
}
