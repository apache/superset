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
import { Button } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import SelectControl from './SelectControl';
import PopoverSection from '../../../components/PopoverSection';
import TextControl from './TextControl';
import CheckboxControl from './CheckboxControl';
import { nonEmpty } from '../../validators';
import { uniq } from 'lodash';

const propTypes = {
  name: PropTypes.string,
  sliceId: PropTypes.number,
  subscribe_columns: PropTypes.arrayOf(PropTypes.object),
  publishedSliceColumns: PropTypes.arrayOf(PropTypes.object),
  vizType: PropTypes.string,
  sliceOptions: PropTypes.arrayOf(PropTypes.object),
  lastAddedRowId: PropTypes.number,
  error: PropTypes.string,
  addSubscriberLayer: PropTypes.func,
  removeSubscriberLayer: PropTypes.func,
  close: PropTypes.func,
  addNewRow: PropTypes.bool,
  enableRowSelection: PropTypes.bool,
  useAsModal: PropTypes.bool,
};

const defaultProps = {
  name: '',
  overrides: {},
  subscribe_columns: [],
  publishedSliceColumns: [],
  addNewRow: false,
  enableRowSelection: false,
  lastAddedRowId: 0,
  useAsModal: false,
  addSubscriberLayer: () => { },
  removeSubscriberLayer: () => { },
  close: () => { },
};

export default class SubscriberLayer extends React.PureComponent {
  constructor(props) {
    super(props);
    const {
      name,
      sliceId,
      subscribe_columns,
      sliceOptions,
      publishedSliceColumns,
      addNewRow,
      lastAddedRowId,
      enableRowSelection,
      useAsModal
    } = props;

    this.state = {
      name,
      oldName: !this.props.name ? null : name,
      sliceOptions,
      sliceId,
      addNewRow,
      lastAddedRowId,
      enableRowSelection,
      subscribe_columns,
      publishedSliceColumns,
      isNew: !this.props.name,
      validationErrors: {},
      useAsModal
    };

    this.state.subscribe_columns = this.state.isNew ? [{ col: '', op: '', actions: [], id: this.state.lastAddedRowId }] : this.state.subscribe_columns;
    this.state.addNewRow = this.isAllSubscribersValid();

    this.handleSliceType = this.handleSliceType.bind(this);
    this.submitSubscription = this.submitSubscription.bind(this);
    this.deleteSubscriber = this.deleteSubscriber.bind(this);
    this.applySubscription = this.applySubscription.bind(this);
    this.isValidForm = this.isValidForm.bind(this);
    this.addMoreColumns = this.addMoreColumns.bind(this);
    this.getSupportedOperators = this.getSupportedOperators.bind(this);
    this.getActions = this.getActions.bind(this);
    this.getPublishedColumns = this.getPublishedColumns.bind(this);
    this.getPublishedSlices = this.getPublishedSlices.bind(this);
    this.getRefactoredPublishedColumns = this.getRefactoredPublishedColumns.bind(this);
  }

  getSupportedOperators() {
    return [
      { label: 'equals', value: '==' },
      { label: 'not equal to', value: '!=' },
      { label: '>', value: '>' },
      { label: '<', value: '<' },
      { label: '>=', value: '>=' },
      { label: '<=', value: '<=' },
      { label: 'in', value: 'in' },
      { label: 'not in', value: 'not in' },
      { label: 'like', value: 'like' },
      { label: 'IS NOT NULL', value: 'IS NOT NULL' },
      { label: 'IS NULL', value: 'IS NULL' }];
  }

  getActions() {
    return [
      { label: 'APPLY FILTER', value: 'APPLY_FILTER' },
      { label: 'INCLUDE IN TITLE', value: 'INCLUDE_IN_TITLE' }];
  }

  getPublishedSlices() {
    return this.props.sliceOptions;
  }

  getPublishedColumns(sliceId) {
    let sliceColumns = [];
    this.props.sliceOptions.forEach(slice => {
      if (slice.value === sliceId) {
        sliceColumns = slice.columns;
        return sliceColumns;
      }
    });
    return sliceColumns;
  }

  getRefactoredPublishedColumns(pubSliceCols) {
    let publishSliceCols = [];

    pubSliceCols.forEach(element => {
      publishSliceCols.push({ label: element, value: element })
    });

    return publishSliceCols;
  }

  isValidForm() {
    const { sliceId, name } = this.state;
    const errors = [nonEmpty(sliceId), nonEmpty(name)];

    if (this.state.subscribe_columns) {
      errors.push(!this.state.subscribe_columns.length)
    }
    errors.push(!this.state.enableRowSelection);
    errors.push(!this.isAllSubscribersValid());

    return !errors.filter(x => x).length;
  }

  resetSubscriptionFields() {
    const newData = { col: '', op: '', actions: [], id: 0 }

    this.setState({
      enableRowSelection: true,
      addNewRow: false,
      subscribe_columns: [newData]
    });
  }

  handleSliceType(sliceId) {
    let publishedSliceColumns = this.getPublishedColumns(sliceId);
    publishedSliceColumns = this.getRefactoredPublishedColumns(publishedSliceColumns);

    this.resetSubscriptionFields();

    this.setState({
      sliceId,
      enableRowSelection: true,
      publishedSliceColumns,
    });
  }

  updateSelectedValue(value, prop, id) {
    let subscribe_columns = this.state.subscribe_columns;

    subscribe_columns.forEach(item => {
      if (item.id == id) {
        item[prop] = value;
        return;
      }
    })

    this.setState({
      subscribe_columns,
      addNewRow: this.isAllSubscribersValid()
    });

    this.forceUpdate();
  }

  addMoreColumns() {
    this.state.lastAddedRowId += 1;
    const newData = { col: '', op: '', actions: [], id: this.state.lastAddedRowId };

    this.setState(prevState => ({ subscribe_columns: [...prevState.subscribe_columns, newData] }))
    this.setState({
      addNewRow: false,
    })
  }

  removeColumn(e, column) {
    this.state.subscribe_columns.forEach((item, index) => {
      if (item.id === column.id) {
        this.state.subscribe_columns.splice(index, 1);
      }
    });

    this.setState({
      addNewRow: this.isAllSubscribersValid(),
    })
    this.forceUpdate();
  }

  isAllSubscribersValid() {
    let isValid = true;
    let publishedSliceColumns;

    if (this.state.sliceId) {
      publishedSliceColumns = this.getPublishedColumns(this.state.sliceId);
    }

     this.state.subscribe_columns.forEach(item => {
      isValid = publishedSliceColumns ? publishedSliceColumns.indexOf(item['col']) >= 0 : false;
      isValid = isValid && item['col'] && item['op'] &&  item['actions'].length > 0 ? true : false;
     })

     return isValid;
  }

  deleteSubscriber() {
    this.props.close();
    if (!this.state.isNew) {
      this.props.removeSubscriberLayer(this.state);
    }
  }

  applySubscription() {
    if (this.state.name.length && this.state.sliceId) {
      const subscription = {};

      Object.keys(this.state).forEach((k) => {
        if (this.state[k] !== null) {
          subscription[k] = this.state[k];
        }
      });

      subscription['actions'] = this.getUniqueActions(this.state.subscribe_columns);

      if (subscription['useAsModal']) {
        subscription['actions'].push('USE_AS_MODAL')
      }

      this.props.addSubscriberLayer(subscription);
      this.setState({ isNew: false, oldName: this.state.name });
    }
  }

  getUniqueActions(subscribe_columns) {
    let uniqActions = [];
    let allActions = [];

    subscribe_columns.map(function (column) {
      allActions.push(column['actions']);
    })

    let flattenedActions = allActions.flat(Infinity);
    uniqActions = uniq(flattenedActions);

    return uniqActions;
  }

  submitSubscription() {
    this.applySubscription();
    this.props.close();
  }

  renderSingleSubscription(subscriptionData) {
    const { col, op, actions, id } = subscriptionData;
    const { enableRowSelection } = this.state;

    const operators = this.getSupportedOperators();
    const allActions = this.getActions();
    const publishedSlices = this.state.sliceId ? this.getRefactoredPublishedColumns(this.getPublishedColumns(this.state.sliceId)) : this.state.publishedSliceColumns;

    return (
      <div key={id} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '885px', marginTop: '10px' }}>

        <SelectControl
          hovered
          autosize={false}
          description="Choose the Column"
          disabled={!enableRowSelection}
          label="Select Column"
          name="column-source-type"
          options={publishedSlices}
          value={col}
          onChange={(e) => this.updateSelectedValue(e, 'col', id)}
        />

        <SelectControl
          hovered
          autosize={false}
          description="Choose the Operator"
          disabled={!enableRowSelection}
          label="Select Operator"
          name="operator-source-type"
          options={operators}
          value={op}
          valueKey='value'
          onChange={(e) => this.updateSelectedValue(e, 'op', id)}
        />

        <SelectControl
          multi={true}
          hovered
          autosize={false}
          description="Select Actions"
          disabled={!enableRowSelection}
          label="Select Actions"
          name="action-source-type"
          options={allActions}
          value={actions}
          valueKey='value'
          onChange={(e) => this.updateSelectedValue(e, 'actions', id)}
        />

        <Button title="Remove subscription columns and operators" bsSize="sm"
              disabled={ this.state.subscribe_columns.length === 1 }
              style={{ height: '30px', marginTop: '25px', marginLeft: '10px' }}
              onClick={(e) => this.removeColumn(e, subscriptionData)}>
          {'-'}
        </Button>

      </div>
    );
  }

  render() {
    const { isNew, sliceId, name, addNewRow, useAsModal } = this.state;
    const isValid = this.isValidForm();

    const publishedSlices = this.getPublishedSlices();

    return (
      <div>
        {this.props.error && <span style={{ color: 'red' }}>ERROR: {this.props.error}</span>}
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ marginRight: '2rem' }}>
            <PopoverSection
              isSelected
              onSelect={() => { }}
              title={t('Subscription Configuration')}
              info={t('Configure Subscription')}
            >
              <TextControl
                name="subscriber-layer-name"
                label={t('Name')}
                placeholder=""
                value={name}
                onChange={v => this.setState({ name: v })}
                validationErrors={!name ? [t('Mandatory')] : []}
              />

              <CheckboxControl
                hovered
                name="subscriber-use-modal"
                label="Use as modal"
                description={'This option enables to add this slice in dashboard only as a Modal.'}
                value={useAsModal}
                onChange={v => this.setState({ useAsModal: v })}
              />


              <SelectControl
                hovered
                description={t('Choose the chart to subscribe')}
                label={t('Select chart')}
                name="publised-layer-name"
                options={publishedSlices}
                value={sliceId}
                onChange={this.handleSliceType}
              />

              <div style={{ overflow: 'auto', height: '100px' }}> {
                this.state.subscribe_columns.map(subscription => {
                  return (
                    this.renderSingleSubscription(subscription)
                  )
                })
              }
              </div>

              <Button title="Add subscription columns and operators" bsSize="sm" disabled={!addNewRow} onClick={this.addMoreColumns} style={{ marginTop: '10px' }}>
                {'+'}
              </Button>

            </PopoverSection>
          </div>

        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button bsSize="sm" onClick={this.deleteSubscriber}>
            {!isNew ? t('Remove') : t('Cancel')}
          </Button>
          <div>
            <Button bsSize="sm" disabled={!isValid} onClick={this.submitSubscription}>
              {t('Save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

SubscriberLayer.propTypes = propTypes;
SubscriberLayer.defaultProps = defaultProps;
