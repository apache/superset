// DODO was here

/**
 *
 * Изменил стили относительно оригинального компонента
 * убрал фиксировнную ширину и высоту, чтобы растягивался по горизнтели и вертикали
 *
 */

import React from 'react';
import PropTypes from 'prop-types';
import { SketchPicker } from 'react-color';
import { getCategoricalSchemeRegistry, styled } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  // DODO added
  isHex: PropTypes.bool,
};

const defaultProps = {
  onChange: () => {},
  // DODO added
  isHex: false,
};

const swatchCommon = {
  position: 'absolute',
  height: '20px',
  top: '0px',
  left: '0px',
  right: '0px',
  bottom: '0px',
};

const StyledSwatch = styled.div`
  ${({ theme }) => `
      height: 20px;
      position: relative;
      padding: ${theme.gridUnit}px;
      borderRadius: ${theme.borderRadius}px;
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
export default class ColorPickerControlDodo extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }

  onChange(col) {
    // DODO changed
    this.props.onChange(this.props.isHex ? col.hex : col.rgb);
  }

  renderPopover() {
    const presetColors = getCategoricalSchemeRegistry()
      .get()
      .colors.filter((s, i) => i < 7);
    return (
      <div id="filter-popover" className="color-popover">
        <SketchPicker
          color={this.props.value}
          onChange={this.onChange}
          presetColors={presetColors}
        />
      </div>
    );
  }

  render() {
    // DODO changed
    const c = this.props.isHex
      ? this.props.value
      : this.props.value || { r: 0, g: 0, b: 0, a: 0 };
    const colStyle = {
      ...styles.color,
      // DODO changed
      background: this.props.isHex
        ? this.props.value
        : `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`,
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
            <div style={styles.checkerboard} />
            <div style={colStyle} />
          </StyledSwatch>
        </Popover>
      </div>
    );
  }
}

ColorPickerControlDodo.propTypes = propTypes;
ColorPickerControlDodo.defaultProps = defaultProps;
