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
import { Dropdown, MenuItem } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import Dialog from 'react-bootstrap-dialog';

import Card from './Card.jsx';

const propTypes = {
  chart: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
  cardWidth: PropTypes.number.isRequired,
};


export default class ChartCard extends React.PureComponent {
  constructor(props) {
    super(props);
    this.openChart = this.openChart.bind(this);
    this.deleteDialog = this.deleteDialog.bind(this);
  }
  openChart() {
    window.open(this.props.chart.slice_url);
  }
  deleteDialog() {
    const onOk = () => {
      this.props.onDelete(this.props.chart);
      this.dialog.hide();
    };
    this.dialog.show({
      title: t('Delete Chart'),
      body: t('Are you sure you want to delete this chart?'),
      actions: [
        Dialog.CancelAction(diag => diag.hide()),
        Dialog.DefaultAction('Ok', onOk, 'btn-danger'),
      ],
      bsSize: 'small',
      onHide: (dialog) => {
        dialog.hide();
      },
    });
  }
  renderDropdownMenu() {
    const { chart } = this.props;
    return (
      <Dropdown.Menu>
        <MenuItem href={`/chart/edit/${chart.id}`} target="_blank">
          {t('Edit chart metadata')}
        </MenuItem>
        <MenuItem onClick={this.deleteDialog}>
          {t('Delete Chart')}
        </MenuItem>
      </Dropdown.Menu>
    );
  }
  renderCardBody() {
    const { chart } = this.props;
    return (
      <small className="text-muted">
        <span>Modified {chart.changed_on_humanized}</span>
        <br />
        <span style={{ lineHeight: '26px' }}>
          {t('Created by')} {chart.created_by_name || t('N/A')}
        </span>
        <Dialog
          ref={(el) => {
            this.dialog = el;
          }}
        />
      </small>
    );
  }
  render() {
    const { chart } = this.props;
    return (
      <Card
        title={chart.slice_name}
        body={this.renderCardBody()}
        dropdownMenu={this.renderDropdownMenu()}
        onTitleClick={this.openChart}
        imageSource={chart.thumbnail_url}
        cardWidth={this.props.cardWidth}
      />);
  }
}
ChartCard.propTypes = propTypes;
