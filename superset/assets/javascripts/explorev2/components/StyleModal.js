import React from 'react';
import { Modal, Button} from 'react-bootstrap';
import { connect } from 'react-redux';
import shortid from 'shortid';
import Style from './Style';

const propTypes = {
  onHide: React.PropTypes.func.isRequired,
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  styles: React.PropTypes.array,
};

const defaultProps = {
  styles: [],
};

class StyleModal extends React.Component {
  addStyle() {
    this.props.actions.addStyle({
      id: shortid.generate(),
      metric: null,
      expr: null,
      value: null,
    });
  }
  render() {
    const stylesDiv = [];
    let i = 0; 
    this.props.styles.forEach((style) => {
      i++;
      stylesDiv.push(
        <Style
          key={i}
          actions={this.props.actions}
          form_data={this.props.form_data}
          style={style}
        />
      );
    });
    return (
      <Modal
        show
        onHide={this.props.onHide}
        bsStyle="large"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Setting Table Style
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <div>
              {stylesDiv}
            </div>
            <div className="row space-2">
              <div className="col-lg-2">
                <Button
                  id="add-button"
                  bsSize="sm"
                  onClick={this.addStyle.bind(this)}
                >
                  <i className="fa fa-plus" /> &nbsp; Add Style
                </Button>
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            id="btn_modal_save"
            className="btn pull-left"
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

StyleModal.propTypes = propTypes;
StyleModal.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    styles: state.viz.form_data.styles,
  };
}

export { StyleModal };
export default connect(mapStateToProps, () => ({}))(StyleModal);
