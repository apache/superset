import React, { PropTypes } from 'react';
import ModalTrigger from './../../components/ModalTrigger';
const $ = window.$ = require('jquery');

const propTypes = {
  queryEndpoint: PropTypes.string.isRequired,
};

export default class DisplayQueryButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      modalBody: <pre />,
    };
  }
  beforeOpen() {
    this.setState({
      modalBody:
        (<img
          className="loading"
          alt="Loading..."
          src="/static/assets/images/loading.gif"
        />),
    });
    $.ajax({
      type: 'GET',
      url: this.props.queryEndpoint,
      success: (data) => {
        this.setState({ modalBody: (<pre>{data.query}</pre>) });
      },
      error(data) {
        this.setState({ modalBody: (<pre>{data.error}</pre>) });
      },
    });
  }
  render() {
    return (
      <ModalTrigger
        isButton
        triggerNode={<span>Query</span>}
        modalTitle="Query"
        beforeOpen={this.beforeOpen.bind(this)}
        modalBody={this.state.modalBody}
      />
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
