// DODO was here
import { Component } from 'react';
import PropTypes from 'prop-types';
import { SketchPicker } from 'react-color';
import { getCategoricalSchemeRegistry, styled, css } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import ControlHeader from '../ControlHeader';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  isHex: PropTypes.bool, // DODO added 44728517
};

const defaultProps = {
  onChange: () => {},
  isHex: false, // DODO added 44728517
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
      padding: ${theme.gridUnit}px;
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
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }

  onChange(col) {
    // this.props.onChange(col.rgb);
    this.props.onChange(this.props.isHex ? col.hex : col.rgb); // DODO changed 44728517
  }

  renderPopover() {
    const presetColors = getCategoricalSchemeRegistry()
      .get()
      .colors.filter((s, i) => i < 7);
    return (
      <div id="filter-popover" className="color-popover">
        <SketchPicker
          css={css`
            // We need to use important here as these are element level styles
            padding: 0 !important;
            box-shadow: none !important;
          `}
          color={this.props.value}
          onChange={this.onChange}
          presetColors={presetColors}
        />
      </div>
    );
  }

  render() {
    // const c = this.props.value || { r: 0, g: 0, b: 0, a: 0 };
    // DODO changed 44728517
    const c = this.props.isHex
      ? this.props.value
      : this.props.value || { r: 0, g: 0, b: 0, a: 0 };
    const colStyle = {
      ...styles.color,
      // background: `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`,
      // DODO changed 44728517
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

ColorPickerControl.propTypes = propTypes;
ColorPickerControl.defaultProps = defaultProps;
