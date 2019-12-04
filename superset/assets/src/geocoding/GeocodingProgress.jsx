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
import * as Actions from './actions/geocoding';
import './GeocodingProgress.css';

const propTypes = {
  actions: PropTypes.object.isRequired,
  geocoding: PropTypes.object.isRequired,
};

export class GeocodingProgress extends React.Component {
  constructor(props) {
    super(props);
    this.getProgress = this.getProgress.bind(this);
    this.getSuccessCounter = this.getSuccessCounter.bind(this);
    this.getDoubtCounter = this.getDoubtCounter.bind(this);
    this.getFailedCounter = this.getFailedCounter.bind(this);
    this.calculateProgress = this.calculateProgress.bind(this);
    this.interruptGeocoding = this.interruptGeocoding.bind(this);
  }

  getProgress() {
    if (this.props.geocoding && this.props.geocoding.progress) {
        return this.calculateProgress(this.props.geocoding.progress.progress);
    }
    return 0;
  }

  getSuccessCounter() {
    if (this.props.geocoding && this.props.geocoding.progress) {
      return this.props.geocoding.progress.success_counter;
    }
    return 0;
  }

  getDoubtCounter() {
    if (this.props.geocoding && this.props.geocoding.progress) {
      return this.props.geocoding.progress.doubt_counter;
    }
    return 0;
  }

  getFailedCounter() {
    if (this.props.geocoding && this.props.geocoding.progress) {
      return this.props.geocoding.progress.failed_counter;
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
      <div className="panel panel-primary">
        <div className="panel-heading">
          <h4 className="panel-title">{t('Geocoding Progress')}</h4>
        </div>
        <div id="Home" className="tab-pane active">
          <div className="progressContainer">
            <p>{t('The geocoding is currently in progress, this may take a while!')}</p>
            <ProgressBar striped now={this.getProgress()} label={`${this.getProgress()} %`} />
<<<<<<< HEAD
            <p className="success">Success: {this.getSuccessCounter()}</p>
            <p className="doubt">Doubt: {this.getDoubtCounter()}</p>
            <p className="failed">Failed: {this.getFailedCounter()}</p>
            <p>{t('You can cancel the process by clicking on the Cancel button')}</p>
=======
>>>>>>> a35e0d9ac2cdd331a0c7ba0e8dbfdbd20b619dd5
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
