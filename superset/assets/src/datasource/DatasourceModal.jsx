import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Modal } from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';
import $ from 'jquery';

import { t } from '../locales';
import DatasourceEditor from '../datasource/DatasourceEditor';
import withToasts from '../messageToasts/enhancers/withToasts';


const propTypes = {
  onChange: PropTypes.func,
  datasource: PropTypes.object.isRequired,
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func,
  onDatasourceSave: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
};

const defaultProps = {
  onChange: () => {},
  onHide: () => {},
  onDatasourceSave: () => {},
  show: false,
};

class DatasourceModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errors: [],
      showDatasource: false,
      datasource: props.datasource,
    };
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.setSearchRef = this.setSearchRef.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.onClickSave = this.onClickSave.bind(this);
    this.onConfirmSave = this.onConfirmSave.bind(this);
    this.setDialogRef = this.setDialogRef.bind(this);
  }
  onClickSave() {
    this.dialog.show({
      title: t('Confirm save'),
      bsSize: 'medium',
      actions: [
        Dialog.CancelAction(),
        Dialog.OKAction(this.onConfirmSave),
      ],
      body: this.renderSaveDialog(),
    });
  }
  onConfirmSave() {
    const url = '/datasource/save/';
    const that = this;
    $.ajax({
      url,
      type: 'POST',
      data: {
        data: JSON.stringify(this.state.datasource),
      },
      success: (data) => {
        this.props.addSuccessToast(t('The datasource has been saved'));
        this.props.onDatasourceSave(data);
        this.props.onHide();
      },
      error(err) {
        let msg = t('An error has occurred');
        if (err.responseJSON && err.responseJSON.error) {
          msg = err.responseJSON.error;
        }
        that.dialog.show({
          title: 'Error',
          bsSize: 'medium',
          bsStyle: 'danger',
          actions: [
            Dialog.DefaultAction('Ok', () => {}, 'btn-danger'),
          ],
          body: msg,
        });
      },
    });
  }
  onDatasourceChange(datasource, errors) {
    this.setState({ datasource, errors });
  }
  setSearchRef(searchRef) {
    this.searchRef = searchRef;
  }
  setDialogRef(ref) {
    this.dialog = ref;
  }
  toggleShowDatasource() {
    this.setState({ showDatasource: !this.state.showDatasource });
  }
  renderSaveDialog() {
    return (
      <div>
        <Alert bsStyle="warning" className="pointer" onClick={this.hideAlert}>
          <div>
            <i className="fa fa-exclamation-triangle" />{' '}
            {t(`The data source configuration exposed here
                affects all the charts using this datasource.
                Be mindful that changing settings
                here may affect other charts
                in undesirable ways.`)}
          </div>
        </Alert>
        {t('Are you sure you want to save and apply changes?')}
      </div>
    );
  }
  render() {
    return (
      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        bsSize="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <div>
              <span className="float-left">
                {t('Datasource Editor for ')}
                <strong>{this.props.datasource.name}</strong>
              </span>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.props.show &&
            <DatasourceEditor
              datasource={this.props.datasource}
              onChange={this.onDatasourceChange}
            />}
        </Modal.Body>
        <Modal.Footer>
          <span className="float-right">
            <Button
              bsSize="sm"
              bsStyle="primary"
              className="m-r-5"
              onClick={this.onClickSave}
              disabled={this.state.errors.length > 0}
            >
              {t('Save')}
            </Button>
            <Button bsSize="sm" onClick={this.props.onHide}>{t('Cancel')}</Button>
            <Dialog ref={this.setDialogRef} />
          </span>
        </Modal.Footer>
      </Modal>);
  }
}

DatasourceModal.propTypes = propTypes;
DatasourceModal.defaultProps = defaultProps;
export default withToasts(DatasourceModal);
