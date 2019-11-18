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
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import FormInfo from 'src/components/FormInfo';
import FormError from 'src/components/FormError';
import GeocodingForm from './GeocodingForm';
import GeocodingProgress from './GeocodingProgress';
import * as Actions from './actions/geocoding';

const propTypes = {
  actions: PropTypes.object.isRequired,
  tables: PropTypes.array.isRequired,
  geocoding: PropTypes.object.isRequired,
};

let interval;
const TIME_BETWEEN_CALLS = 5000;

export class Geocoding extends React.Component {
  constructor(props) {
    super(props);
    this.fetchProgress = this.fetchProgress.bind(this);
  }

  componentDidMount() {
    this.fetchProgress();
  }

  componentWillUnmount() {
    clearTimeout(interval);
  }

  getInfoStatus() {
    const { geocoding } = this.props;
    if (geocoding && geocoding.infoStatus) {
      return geocoding.infoStatus;
    }
    return undefined;
  }

  getErrorStatus() {
    const { geocoding } = this.props;
    if (geocoding && geocoding.errorStatus) {
      return geocoding.errorStatus;
    }
    return undefined;
  }

  fetchProgress() {
    this.props.actions.geocodingProgress();
    interval = setTimeout(this.fetchProgress, TIME_BETWEEN_CALLS);
  }

  render() {
    let form = <></>;
    let progress = <></>;
    if (this.props.geocoding && this.props.geocoding.progress) {
      if (this.props.geocoding.progress.is_in_progress) {
        progress = <GeocodingProgress />;
      } else {
        form = <GeocodingForm tables={this.props.tables} />
      }
    }
    return (
      <>
        <FormInfo status={this.getInfoStatus()} />
        <FormError status={this.getErrorStatus()} />
        {form}
        {progress}
      </>
    );
  }
}

Geocoding.propTypes = propTypes;

function mapStateToProps({ geocoding }) {
  return { geocoding };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Geocoding);
