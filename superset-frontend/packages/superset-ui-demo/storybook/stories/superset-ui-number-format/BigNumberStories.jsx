/* eslint-disable jsx-a11y/label-has-associated-control */
import React from 'react';
import { formatNumber } from '@superset-ui/core';

const propTypes = {};
const defaultProps = {};

class NumberFormatValidator extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      formatString: '.3~s',
      testValues: [
        987654321,
        12345.6789,
        3000,
        400.14,
        70.00002,
        1,
        0,
        -1,
        -70.00002,
        -400.14,
        -3000,
        -12345.6789,
        -987654321,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        NaN,
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
              This <code>@superset-ui/number-format</code> package enriches <code>d3-format</code>
              to handle invalid formats as well as edge case values. Use the validator below to
              preview outputs from the specified format string. See
              <a
                href="https://github.com/d3/d3-format#locale_format"
                target="_blank"
                rel="noopener noreferrer"
              >
                D3 Format Reference
              </a>
              for how to write a D3 format string.
            </p>
          </div>
        </div>
        <div className="row" style={{ margin: '10px 0 30px 0' }}>
          <div className="col-sm" />
          <div className="col-sm-8">
            <div className="form">
              <div className="form-group">
                <label>Enter D3 format string:&nbsp;&nbsp;</label>
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
                  <th>Input (number)</th>
                  <th>Formatted output (string)</th>
                </tr>
              </thead>
              <tbody>
                {testValues.map(v => (
                  <tr key={v}>
                    <td>
                      <code>{`${v}`}</code>
                    </td>
                    <td>
                      <code>&quot;{formatNumber(formatString, v)}&quot;</code>
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

NumberFormatValidator.propTypes = propTypes;
NumberFormatValidator.defaultProps = defaultProps;

export default {
  title: 'Core Packages|@superset-ui/number-format',
};

export const validator = () => <NumberFormatValidator />;
