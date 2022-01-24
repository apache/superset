/*
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
import { formatTime } from '@superset-ui/core';

class TimeFormatValidator extends React.PureComponent {
  state: {
    formatString: string;
    testValues: (Date | number | null | undefined)[];
  } = {
    formatString: '%Y-%m-%d %H:%M:%S',
    testValues: [
      new Date(Date.UTC(1986, 5, 14, 8, 30, 53)),
      new Date(Date.UTC(2001, 9, 27, 13, 45, 2, 678)),
      new Date(Date.UTC(2009, 1, 1, 0, 0, 0)),
      new Date(Date.UTC(2018, 1, 1, 10, 20, 33)),
      0,
      null,
      undefined,
    ],
  };

  constructor(props) {
    super(props);
    this.handleFormatChange = this.handleFormatChange.bind(this);
  }

  handleFormatChange(event) {
    this.setState({
      formatString: event.target.value,
    });
  }

  render() {
    const { formatString, testValues } = this.state;

    return (
      <div className="container">
        <div className="row" style={{ margin: '40px 20px 0 20px' }}>
          <div className="col-sm">
            <p>
              This <code>@superset-ui/time-format</code> package enriches
              <code>d3-time-format</code> to handle invalid formats as well as
              edge case values. Use the validator below to preview outputs from
              the specified format string. See
              <a
                href="https://github.com/d3/d3-time-format#locale_format"
                target="_blank"
                rel="noopener noreferrer"
              >
                D3 Time Format Reference
              </a>
              for how to write a D3 time format string.
            </p>
          </div>
        </div>
        <div className="row" style={{ margin: '10px 0 30px 0' }}>
          <div className="col-sm" />
          <div className="col-sm-8">
            <div className="form">
              <div className="form-group">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label>
                  Enter D3 time format string:
                  <input
                    id="formatString"
                    className="form-control form-control-lg"
                    type="text"
                    value={formatString}
                    onChange={this.handleFormatChange}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="col-sm" />
        </div>
        <div className="row">
          <div className="col-sm">
            <table className="table table-striped table-sm">
              <thead>
                <tr>
                  <th>Input (time)</th>
                  <th>Formatted output (string)</th>
                </tr>
              </thead>
              <tbody>
                {testValues.map((v, index) => (
                  <tr key={index}>
                    <td>
                      <code>
                        {v instanceof Date ? v.toUTCString() : `${v}`}
                      </code>
                    </td>
                    <td>
                      <code>&quot;{formatTime(formatString, v)}&quot;</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

export default {
  title: 'Core Packages/@superset-ui-time-format',
};

export const validator = () => <TimeFormatValidator />;
