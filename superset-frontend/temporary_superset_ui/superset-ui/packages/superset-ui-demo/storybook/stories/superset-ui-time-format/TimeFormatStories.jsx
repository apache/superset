/* eslint-disable jsx-a11y/label-has-associated-control */
import React from 'react';
import { formatTime } from '@superset-ui/core';

const propTypes = {};
const defaultProps = {};

class TimeFormatValidator extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
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
              <code>d3-time-format</code> to handle invalid formats as well as edge case values. Use
              the validator below to preview outputs from the specified format string. See
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
                <label>Enter D3 time format string:&nbsp;&nbsp;</label>
                <input
                  id="formatString"
                  className="form-control form-control-lg"
                  type="text"
                  value={formatString}
                  onChange={this.handleFormatChange}
                />
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
                {testValues.map(v => (
                  <tr key={v}>
                    <td>
                      <code>{v instanceof Date ? v.toUTCString() : `${v}`}</code>
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

TimeFormatValidator.propTypes = propTypes;
TimeFormatValidator.defaultProps = defaultProps;

export default {
  title: 'Core Packages|@superset-ui/time-format',
};

export const validator = () => <TimeFormatValidator />;
