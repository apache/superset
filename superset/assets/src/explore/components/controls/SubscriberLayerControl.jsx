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
import { OverlayTrigger, Popover, ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { t } from '@superset-ui/translation';
import { getChartKey } from '../../exploreUtils';

import SubscriberLayer from './SubscriberLayer';

const propTypes = {
  subscriberQuery: PropTypes.object,
  vizType: PropTypes.string,
  validationErrors: PropTypes.array,
  name: PropTypes.string.isRequired,
  actions: PropTypes.object,
  value: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func,
};

const defaultProps = {
  vizType: '',
  value: [],
  subscriberQuery: {},
  onChange: () => { },
};

class SubscriberLayerControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.addSubscriberLayer = this.addSubscriberLayer.bind(this);
    this.removeSubscriberLayer = this.removeSubscriberLayer.bind(this);
  }

  addSubscriberLayer(subscriberLayer) {
    const subscriber = subscriberLayer;
    let subscribers = this.props.value.slice();
    const i = subscribers.findIndex(x => x.name === (subscriber.oldName || subscriber.name));
    delete subscriber.oldName;
    if (i > -1) {
      subscribers[i] = subscriber;
    } else {
      subscribers = subscribers.concat(subscriber);
    }
    this.props.onChange(subscribers);
  }

  removeSubscriberLayer(subscriber) {
    const subscribers = this.props.value.slice()
      .filter(x => x.name !== subscriber.oldName);
    this.props.onChange(subscribers);
  }

  renderPopover(parent, subscriber, error) {
    const id = !subscriber ? '_new' : subscriber.name;
    return (
      <Popover
        style={{ maxWidth: 'none' }}
        title={subscriber ? t('Edit Subscribers') : t('Add Subscribers')}
        id={`subscriber-pop-${id}`}
      >
        <SubscriberLayer
          {...subscriber}
          error={error}
          vizType={this.props.vizType}
          sliceOptions={this.props.options}
          addSubscriberLayer={this.addSubscriberLayer}
          removeSubscriberLayer={this.removeSubscriberLayer}
          close={() => this.refs[parent].hide()}
        />
      </Popover>
    );
  }

  renderInfo(subs) {
    const { subscriberQuery } = this.props;
    if (subscriberQuery[subs.name]) {
      return (
        <i className="fa fa-refresh" style={{ color: 'orange' }} aria-hidden />
      );
    }
    return '';
  }

  render() {
    const subscribers = this.props.value.map((subs, i) => (
      <OverlayTrigger
        key={i}
        trigger="click"
        rootClose
        ref={`overlay-${i}`}
        placement="right"
        overlay={this.renderPopover(`overlay-${i}`, subs, '')}
      >
        <ListGroupItem>
          <span>{subs.name}</span>
          <span style={{ float: 'right' }}>
            {this.renderInfo(subs)}
          </span>
        </ListGroupItem>
      </OverlayTrigger>
    ));
    return (
      <div>
        <ListGroup>
          {subscribers}
          <OverlayTrigger
            trigger="click"
            rootClose
            ref="overlay-new"
            placement="right"
            overlay={this.renderPopover('overlay-new')}
          >
            <ListGroupItem>
              <i className="fa fa-plus" /> &nbsp; {t('Add Subscribers')}
            </ListGroupItem>
          </OverlayTrigger>
        </ListGroup>
      </div>
    );
  }
}

SubscriberLayerControl.propTypes = propTypes;
SubscriberLayerControl.defaultProps = defaultProps;

function mapStateToProps({ charts, explore }) {
  const chartKey = getChartKey(explore);
  const chart = charts[chartKey] || charts[0] || {};

  return {
    vizType: explore.controls.viz_type.value,
    subscriberQuery: chart.subscriberQuery,
  };
}

export default connect(mapStateToProps)(SubscriberLayerControl);
