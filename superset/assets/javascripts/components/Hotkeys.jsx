import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { Table } from 'reactable';

import Mousetrap from 'mousetrap';

const propTypes = {
  hotkeys: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    descr: PropTypes.string.isRequired,
    func: PropTypes.func.isRequired,
  })).isRequired,
  header: PropTypes.string,
};

const defaultProps = {
  hotkeys: [],
};

export default class Hotkeys extends React.PureComponent {
  componentDidMount() {
    this.props.hotkeys.forEach((keyConfig) => {
      Mousetrap.bind([keyConfig.key], keyConfig.func);
    });
  }
  renderPopover() {
    return (
      <Popover id="popover-hotkeys" title={this.props.header} style={{ width: '300px' }}>
        <Table
          className="table table-condensed"
          data={this.props.hotkeys.map(keyConfig => ({
            Key: keyConfig.key,
            Action: keyConfig.descr,
          }))}
        />
      </Popover>);
  }
  render() {
    return (
      <OverlayTrigger
        overlay={this.renderPopover()}
        trigger={['hover', 'focus']}
        placement="top"
      >
        <i className="fa fa-keyboard-o fa-lg" />
      </OverlayTrigger>
    );
  }
}

Hotkeys.propTypes = propTypes;
Hotkeys.defaultProps = defaultProps;
