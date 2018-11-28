import {t} from "@superset-ui/translation";
import React from "react";

import PropTypes from 'prop-types';
import {OverlayTrigger, Tooltip} from "react-bootstrap";
import CopyToClipboard from "./CopyToClipboard";

const propTypes = {
  textToCopyFunc: PropTypes.func,
  activeStateProps: PropTypes.object,
  inactiveStateProps: PropTypes.object,
};

const defaultProps = {
  textToCopyFunc: null,
  activeStateProps: {},
  inactiveStateProps: {},
};

const fetchingDataMessage = t('Fetching data...');
const errorOccurredMessage = t('Data couldn\'t be fetched');

export default class CopyToClipboardAsync extends React.Component {
  constructor(props) {
    super(props);
    let {textToCopyFunc, activeStateProps, inactiveStateProps, copyNode, ...other} = this.props;
    this.propsToPass = other;

    this.state = {
        dataReady: false,
        data: '',
        errorOccurred: false,
    };
  }

  componentDidMount() {
    this.props.textToCopyFunc()
      .then(
        (result) => {
          this.setState({
            dataReady: true,
            errorOccurred: false,
            data: result
          });
        },
        (error) => {
          this.setState({
            dataReady: false,
            errorOccurred: true,
            data: ''
          });
        }
      )
  }

  renderTooltip() {
    let message = '';
    if(this.state.errorOccurred) {
      message = errorOccurredMessage;
    }
    else if(!this.state.dataReady) {
      message = fetchingDataMessage;
    }
    return (message &&
      <Tooltip id="tooltip">
        {message}
      </Tooltip>
    );
  }

  renderCopyNode(copyNode) {
    const tooltip = this.renderTooltip();
    return (
        tooltip ?
        <OverlayTrigger placement="top" overlay={tooltip}>
          {copyNode}
        </OverlayTrigger> : copyNode
    );
  }

  render() {
    let stateProps = this.state.dataReady ? this.props.activeStateProps : this.props.inactiveStateProps;
    let copyNode = React.cloneElement(this.props.copyNode, stateProps);
    return (
      this.state.dataReady ?
      <CopyToClipboard
          text={this.state.data}
          copyNode={copyNode}
          {...this.propsToPass}
      /> : this.renderCopyNode(copyNode)
    );
  }
}

CopyToClipboardAsync.propTypes = propTypes;
CopyToClipboardAsync.defaultProps = defaultProps;
