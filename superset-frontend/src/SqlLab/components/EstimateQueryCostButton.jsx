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
import { Table } from 'reactable-arc';
import { Alert } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import Button from 'src/components/Button';
import Loading from '../../components/Loading';
import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  dbId: PropTypes.number.isRequired,
  schema: PropTypes.string.isRequired,
  sql: PropTypes.string.isRequired,
  getEstimate: PropTypes.func.isRequired,
  queryCostEstimate: PropTypes.Object,
  selectedText: PropTypes.string,
  tooltip: PropTypes.string,
  disabled: PropTypes.bool,
};
const defaultProps = {
  queryCostEstimate: [],
  tooltip: '',
  disabled: false,
};

class EstimateQueryCostButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.queryCostModal = React.createRef();
    this.onClick = this.onClick.bind(this);
    this.renderModalBody = this.renderModalBody.bind(this);
  }

  onClick() {
    this.props.getEstimate();
  }

  renderModalBody() {
    if (this.props.queryCostEstimate.error !== null) {
      return (
        <Alert key="query-estimate-error" bsStyle="danger">
          {this.props.queryCostEstimate.error}
        </Alert>
      );
    } else if (this.props.queryCostEstimate.completed) {
      return (
        <Table
          className="table cost-estimate"
          data={this.props.queryCostEstimate.cost}
        />
      );
    }
    return <Loading position="normal" />;
  }

  render() {
    const { disabled, selectedText, tooltip } = this.props;
    const btnText = selectedText
      ? t('Estimate Selected Query Cost')
      : t('Estimate Query Cost');
    return (
      <span className="EstimateQueryCostButton">
        <ModalTrigger
          ref={this.queryCostModal}
          modalTitle={t('Query Cost Estimate')}
          modalBody={this.renderModalBody()}
          triggerNode={
            <Button
              buttonStyle="warning"
              buttonSize="small"
              onClick={this.onClick}
              key="query-estimate-btn"
              tooltip={tooltip}
              disabled={disabled}
            >
              <i className="fa fa-clock-o" /> {btnText}
            </Button>
          }
        />
      </span>
    );
  }
}

EstimateQueryCostButton.propTypes = propTypes;
EstimateQueryCostButton.defaultProps = defaultProps;

export default EstimateQueryCostButton;
