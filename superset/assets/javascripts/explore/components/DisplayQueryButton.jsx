import React, { PropTypes } from 'react';
import ModalTrigger from './../../components/ModalTrigger';

const propTypes = {
  query: PropTypes.string,
};

const defaultProps = {
  query: '',
};

export default class DisplayQueryButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      viewSqlQuery: '',
    };
    this.beforeOpen = this.beforeOpen.bind(this);
  }

  beforeOpen() {
    this.setState({
      viewSqlQuery: this.props.query,
    });
  }

  render() {
    const modalBody = (<pre>{this.state.viewSqlQuery}</pre>);
    return (
      <ModalTrigger
        isButton
        triggerNode={<span>Query</span>}
        modalTitle="Query"
        modalBody={modalBody}
        beforeOpen={this.beforeOpen}
      />
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
