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
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import './AdvancedOptionsStyles.css';

const propTypes = {
    children: PropTypes.node,
};

export default class AdvancedOptions extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            hide: true,
        };
        this.handleChildren = this.handleChildren.bind(this);
    }

    handleChildren() {
        const currentState = this.state.hide;
        this.setState({ hide: !currentState });
    }


    render() {
        return (
          <div>
            <div className={'title ' + (this.state.hide ? 'openTitle' : 'closeTitle')} onClick={this.handleChildren}>
              <span>{t('Advanced Options')}</span>
            </div>
            <div className={this.state.hide ? 'hide' : null}>
              {this.props.children}
            </div>
          </div>
        );
    }
}

AdvancedOptions.propTypes = propTypes;
