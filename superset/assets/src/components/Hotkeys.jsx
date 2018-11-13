import React from 'react';
import PropTypes from 'prop-types';
import Mousetrap from 'mousetrap';
import { OverlayTrigger, Popover } from 'react-bootstrap';

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
    const { header, hotkeys } = this.props;

    return (
      <Popover title={header} style={{ width: '300px' }}>
        <table className="table table-condensed">
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {hotkeys.map(({ key, descr }) => (
              <tr>
                <td><code>{key}</code></td>
                <td>{descr}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
