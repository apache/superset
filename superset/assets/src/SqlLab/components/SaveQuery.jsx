import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, FormGroup, Row, Col } from 'react-bootstrap';

import Button from '../../components/Button';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const propTypes = {
  defaultLabel: PropTypes.string,
  sql: PropTypes.string,
  schema: PropTypes.string,
  dbId: PropTypes.number,
  animation: PropTypes.bool,
  onSave: PropTypes.func,
};
const defaultProps = {
  defaultLabel: t('Undefined'),
  animation: true,
  onSave: () => {},
};

class SaveQuery extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      description: '',
      label: props.defaultLabel,
      showSave: false,
    };
    this.toggleSave = this.toggleSave.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.onDescriptionChange = this.onDescriptionChange.bind(this);
  }
  onSave() {
    const query = {
      label: this.state.label,
      description: this.state.description,
      db_id: this.props.dbId,
      schema: this.props.schema,
      sql: this.props.sql,
    };
    this.props.onSave(query);
    this.saveModal.close();
  }
  onCancel() {
    this.saveModal.close();
  }
  onLabelChange(e) {
    this.setState({ label: e.target.value });
  }
  onDescriptionChange(e) {
    this.setState({ description: e.target.value });
  }
  toggleSave(e) {
    this.setState({ target: e.target, showSave: !this.state.showSave });
  }
  renderModalBody() {
    return (
      <FormGroup bsSize="small">
        <Row>
          <Col md={12}>
            <small>
              <label className="control-label" htmlFor="embed-height">
                {t('Label')}
              </label>
            </small>
            <FormControl
              type="text"
              placeholder={t('Label for your query')}
              value={this.state.label}
              onChange={this.onLabelChange}
            />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <small>
              <label className="control-label" htmlFor="embed-height">{t('Description')}</label>
            </small>
            <FormControl
              componentClass="textarea"
              placeholder={t('Write a description for your query')}
              value={this.state.description}
              onChange={this.onDescriptionChange}
            />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <Button
              bsStyle="primary"
              onClick={this.onSave}
              className="m-r-3"
            >
              {t('Save')}
            </Button>
            <Button onClick={this.onCancel} className="cancelQuery">
              {t('Cancel')}
            </Button>
          </Col>
        </Row>
      </FormGroup>
    );
  }
  render() {
    return (
      <span className="SaveQuery">
        <ModalTrigger
          ref={(ref) => { this.saveModal = ref; }}
          modalTitle={t('Save Query')}
          modalBody={this.renderModalBody()}
          triggerNode={
            <Button bsSize="small" className="toggleSave" onClick={this.toggleSave}>
              <i className="fa fa-save" /> {t('Save Query')}
            </Button>
          }
          bsSize="small"
        />
      </span>
    );
  }
}
SaveQuery.propTypes = propTypes;
SaveQuery.defaultProps = defaultProps;

export default SaveQuery;
