import React, { PropTypes } from 'react';
import ModalTrigger from './../../components/ModalTrigger';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';

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
        const modalBody = data.language ?
          <SyntaxHighlighter language={data.language} style={github}>
            {data.query}
          </SyntaxHighlighter>
          :
          <pre>{data.query}</pre>;
        this.setState({ modalBody });
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
        bsSize="large"
        beforeOpen={this.beforeOpen.bind(this)}
        modalBody={this.state.modalBody}
      />
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
