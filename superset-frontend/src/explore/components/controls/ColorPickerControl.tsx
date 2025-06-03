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
import { Component } from 'react';
import PropTypes from 'prop-types';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'reac... Remove this comment to see the full error message
import { SketchPicker } from 'react-color';
import { getCategoricalSchemeRegistry, styled, css } from '@superset-ui/core';
import { Popover } from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
};

const swatchCommon = {
  position: 'absolute',
  width: '50px',
  height: '20px',
  top: '0px',
  left: '0px',
  right: '0px',
  bottom: '0px',
};

const StyledSwatch = styled.div`
  ${({ theme }) => `
      width: 50px;
      height: 20px;
      position: relative;
      padding: ${theme.sizeUnit}px;
      borderRadius: ${theme.borderRadius}px;
      display: inline-block;
      cursor: pointer;
    `}
`;

const styles = {
  color: {
    ...swatchCommon,
    borderRadius: '2px',
  },
  checkerboard: {
    ...swatchCommon,
    background:
      'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center',
  },
};
export default class ColorPickerControl extends Component {
  constructor(props: $TSFixMe) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }

  onChange(col: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(col.rgb);
  }

  renderPopover() {
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    const presetColors = getCategoricalSchemeRegistry()
      .get()
      .colors.filter((s, i) => i < 9);
    return (
      <div id="filter-popover" className="color-popover">
        <SketchPicker
          css={css`
            // We need to use important here as these are element level styles
            padding: 0 !important;
            box-shadow: none !important;
          `}
          width={235}
          // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
          color={this.props.value}
          onChange={this.onChange}
          presetColors={presetColors}
        />
      </div>
    );
  }

  render() {
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const c = this.props.value || { r: 0, g: 0, b: 0, a: 0 };
    const colStyle = {
      ...styles.color,
      background: `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`,
    };
    return (
      <div>
        <ControlHeader {...this.props} />
        <Popover
          trigger="click"
          placement="right"
          content={this.renderPopover()}
        >
          <StyledSwatch>
            // @ts-expect-error TS(2322): Type '{ background: string; position: string; widt... Remove this comment to see the full error message
            <div style={styles.checkerboard} />
            // @ts-expect-error TS(2322): Type '{ background: string; borderRadius: string; ... Remove this comment to see the full error message
            <div style={colStyle} />
          </StyledSwatch>
        </Popover>
      </div>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
ColorPickerControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
ColorPickerControl.defaultProps = defaultProps;
