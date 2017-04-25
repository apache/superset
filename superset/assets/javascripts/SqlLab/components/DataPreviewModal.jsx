import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Modal } from 'react-bootstrap';

import * as Actions from '../actions';
import ResultSet from './ResultSet';

const propTypes = {
  queries: PropTypes.object,
  actions: PropTypes.object,
  showDataPreviewModal: PropTypes.bool,
  dataPreviewQueryId: PropTypes.string,
};

class DataPreviewModal extends React.PureComponent {
  hide() {
    this.props.actions.hideDataPreview();
  }
  render() {
    if (this.props.showDataPreviewModal && this.props.dataPreviewQueryId) {
      const query = this.props.queries[this.props.dataPreviewQueryId];
      return (
        <Modal
          show={this.props.showDataPreviewModal}
          onHide={this.hide.bind(this)}
          bsStyle="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Data preview for <strong>{query.tableName}</strong>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ResultSet
              query={query}
              visualize={false}
              csv={false}
              actions={this.props.actions}
              height={400}
            />
          </Modal.Body>
        </Modal>
      );
    }
    return null;
  }
}
DataPreviewModal.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    queries: state.queries,
    showDataPreviewModal: state.showDataPreviewModal,
    dataPreviewQueryId: state.dataPreviewQueryId,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DataPreviewModal);
