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
import { t } from '@superset-ui/translation';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ProgressBar } from 'react-bootstrap';
import Button from 'src/components/Button';
import FormInfo from 'src/components/FormInfo';
import FormError from 'src/components/FormError';
import * as Actions from './actions/geocoding';
import './GeocodingProgress.css';

const propTypes = {
  actions: PropTypes.object.isRequired,
  geocoding: PropTypes.object.isRequired,
};

export class GeocodingProgress extends React.Component {
  constructor(props) {
    super(props);
    this.getInfoStatus = this.getInfoStatus.bind(this);
    this.getErrorStatus = this.getErrorStatus.bind(this);
    this.getProgress = this.getProgress.bind(this);
    this.calculateProgress = this.calculateProgress.bind(this);
    this.interruptGeocoding = this.interruptGeocoding.bind(this);
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

  getProgress() {
    if (this.props.geocoding && this.props.geocoding.progress) {
        return this.calculateProgress(this.props.geocoding.progress.progress);
    }
    return 0;
  }

  calculateProgress(progress) {
      return Math.round(progress * 100);
  }

  interruptGeocoding() {
      this.props.actions.interruptGeocoding();
      setTimeout(this.props.actions.geocodingProgress, 100);
  }

  render() {
    return (
      <div className="container">
        <FormInfo status={this.getInfoStatus()} />
        <FormError status={this.getErrorStatus()} />
        <div className="panel panel-primary">
          <div className="panel-heading">
            <h4 className="panel-title">{t('Geocoding Progress')}</h4>
          </div>
          <div id="Home" className="tab-pane active">
            <div className="progressContainer">
              <p>{t('The geocoding is currently in progress, this may take a while!')}</p>
              <ProgressBar striped now={this.getProgress()} label={`${this.getProgress()} %`} />
              <p>{t('You can cancel the process by clicking on the Cancel button')}</p>
              <Button bsStyle="danger" onClick={this.interruptGeocoding}>
                {t('Stop Geocoding')} <i className="fa fa-ban" />
              </Button>
              <Button href="/back">
                {t('Back')} <i className="fa fa-arrow-left" />
              </Button>
              <div className="spacer" />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

GeocodingProgress.propTypes = propTypes;

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
)(GeocodingProgress);
