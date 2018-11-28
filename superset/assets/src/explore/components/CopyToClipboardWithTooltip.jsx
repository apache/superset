import {t} from "@superset-ui/translation";
import {CopyToClipboard} from "react-copy-to-clipboard";
import React from "react";

import PropTypes from 'prop-types';
import {OverlayTrigger, Tooltip} from "react-bootstrap";

const propTypes = {
  children: PropTypes.node.isRequired,
  textToCopyFunc: PropTypes.func,
  activeStateProps: PropTypes.object,
  inactiveStateProps: PropTypes.object,
};

const defaultProps = {
  textToCopyFunc: null,
  activeStateProps: {},
  inactiveStateProps: {},
};

const dataReadyMessage = t('Copy to clipboard');
const fetchingDataMessage = t('Fetching data...');
const copiedMessage = t('Copied!');

export default class CopyToClipboardWithTooltip extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
        dataReady: false,
        data: '',
        tooltipMessage: fetchingDataMessage,
    };
  }

  componentDidMount() {
    this.props.textToCopyFunc()
      .then(
        (result) => {
          this.setState({
            dataReady: true,
            data: result,
            tooltipMessage: dataReadyMessage
          });
        },
        (error) => {
          this.setState({
            tooltipMessage: error.toString()
          });
        }
      )
  }

  render() {
    const child = React.cloneElement(
      React.Children.only(this.props.children),
      this.state.dataReady ? this.props.activeStateProps : this.props.inactiveStateProps
    );
    const tooltip = (
      <Tooltip id="tooltip">
        {this.state.tooltipMessage}
      </Tooltip>
    );
    const tooltipOverlay = (
        this.state.tooltipMessage ?
        <OverlayTrigger placement="top" overlay={tooltip}>
          {child}
        </OverlayTrigger> : child
    );

    return (
      this.state.dataReady ?
      <CopyToClipboard text={this.state.data}
        onCopy={() => {
          this.setState({tooltipMessage: copiedMessage});
          setTimeout(
            function() {
              this.setState({tooltipMessage: dataReadyMessage});
            }
            .bind(this),
            3000
          );
      }}>
          {tooltipOverlay}
      </CopyToClipboard> : tooltipOverlay
    );
  }
}

CopyToClipboardWithTooltip.propTypes = propTypes;
CopyToClipboardWithTooltip.defaultProps = defaultProps;
