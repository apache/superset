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
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { maxBy } from 'lodash';
import { t } from '@superset-ui/translation';
import { getChartKey } from '../../exploreUtils';
import { runAnnotationQuery } from '../../../chart/chartAction';

import Control from '../Control';
import controls from '../../controls';
import Button from '../../../components/Button';
import savedMetricType from '../../propTypes/savedMetricType';
import columnType from '../../propTypes/columnType';

const queriesLimit = 10;

const propTypes = {
  origSelectedValues: PropTypes.object,
  annotationError: PropTypes.object,
  annotationQuery: PropTypes.object,
  vizType: PropTypes.string,
  validationErrors: PropTypes.array,
  name: PropTypes.string.isRequired,
  actions: PropTypes.object,
  value: PropTypes.object,
  onChange: PropTypes.func,
  refreshAnnotationData: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  datasourceType: PropTypes.string,
  datasource: PropTypes.object,
};

const defaultProps = {
  origSelectedValues: {},
  vizType: '',
  value: {},
  annotationError: {},
  annotationQuery: {},
  onChange: () => {},
};

class StepsControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      queries: props.value && props.value.queries || [],
      selectedValues: props.value && props.value.selectedValues || props.origSelectedValues,
    };
    this.addStep = this.addStep.bind(this);
    this.removeStep = this.removeStep.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const { name, annotationError, validationErrors, value } = nextProps;
    if (Object.keys(annotationError).length && !validationErrors.length) {
      this.props.actions.setControlValue(name, value, Object.keys(annotationError));
    }
    if (!Object.keys(annotationError).length && validationErrors.length) {
      this.props.actions.setControlValue(name, value, []);
    }
  }

  onChange(id, controlName, obj) {
    const selectedValues = { ...this.state.selectedValues };
    selectedValues[id] = selectedValues[id] ?
      { ...selectedValues[id], [controlName]: obj }
      : { [controlName]: obj };
    this.setState({ selectedValues }, () => {
        this.props.onChange(this.state);
    });
  }

  getControlData(controlName, id) {
      const { selectedValues } = this.state;
      const control = Object.assign({}, controls[controlName], {
          name: controlName,
          key: `control-${controlName}`,
          value: selectedValues && selectedValues[id] && selectedValues[id][controlName],
          actions: { setControlValue: () => {} },
          onChange: obj => this.onChange(id, controlName, obj),
      });
      const mapFunc = control.mapStateToProps;
      return mapFunc
          ? Object.assign({}, control, mapFunc(this.props))
          : control;
  }

  addStep() {
      const queries = [...this.state.queries];
      const maxId = maxBy(queries, item => item.id);
      const newId = maxId ? parseInt(maxId.id, 10) + 1 : 0;
      queries.push({ id: newId });
      this.setState({ queries });
  }

  removeStep(id) {
   const queries = this.state.queries.filter(item => item.id !== id);
      const selectedValues = { ...this.state.selectedValues };
      delete selectedValues[id];

    this.setState({ queries, selectedValues }, () => {
      this.props.onChange(this.state);
    });
  }

  render() {
    const queries = this.state.queries.map((item, i) => (
      <div key={item.id} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Step {i + 1}</strong>
          <Button
            className="query"
            onClick={() => this.removeStep(item.id)}
            style={{ float: 'right' }}
            bsStyle="default"
          >
            <i className="fa fa-close" /> Remove
          </Button>
        </div>
        <Control {...this.getControlData('step_label', item.id)} />
        <Control {...this.getControlData('metric', item.id)} />
        <Control {...this.getControlData('adhoc_filters', item.id)} />
      </div>
    ));
    return (
      <div>
        <ListGroup>
          {queries}
          {(queries.length < queriesLimit) &&
            (<ListGroupItem onClick={this.addStep}>
              <i className="fa fa-plus" /> &nbsp; {t('Add Step')}
              </ListGroupItem>)
          }
        </ListGroup>
      </div>
    );
  }
}

StepsControl.propTypes = propTypes;
StepsControl.defaultProps = defaultProps;

function mapStateToProps({ charts, explore }) {
  const chartKey = getChartKey(explore);
  const chart = charts[chartKey] || charts[0] || {};

  return {
    annotationError: chart.annotationError,
    annotationQuery: chart.annotationQuery,
    vizType: explore.controls.viz_type.value,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    refreshAnnotationData: annotationLayer => dispatch(runAnnotationQuery(annotationLayer)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(StepsControl);
