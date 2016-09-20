import React, { PropTypes } from 'react';
import ModalTrigger from './../../components/ModalTrigger';

const propTypes = {
  slice: PropTypes.object.isRequired,
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
      viewSqlQuery: this.props.slice.viewSqlQuery,
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
