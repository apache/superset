import $ from 'jquery';
import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import shortid from 'shortid';
import Style from './Style';
import BaseStyle from './BaseStyle';

const propTypes = {
  onHide: React.PropTypes.func.isRequired,
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  styles: React.PropTypes.array,
  baseStyle: React.PropTypes.Object,
};

const defaultProps = {
  styles: [],
};

class StyleModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      flag: true,
      flag2: false,
      flag3: false,
    };
  }
  addStyle() {
    this.props.actions.addStyle({
      id: shortid.generate(),
      metric: null,
      expr: null,
      value: null,
    });
  }
  addInteraction() {
    alert('hello, baby!');
  }
  changeModal(type) {
    if (type === 1) {
      this.setState({ flag: true, flag2: false, flag3: false });
      $('#li').attr('style', 'background: #ccc');
      $('#li2').attr('style', '');
      $('#li3').attr('style', '');
    } else if (type === 2) {
      this.setState({ flag: false, flag2: true, flag3: false });
      $('#li').attr('style', '');
      $('#li2').attr('style', 'background: #ccc');
      $('#li3').attr('style', '');
    } else {
      this.setState({ flag: false, flag2: false, flag3: true });
      $('#li').attr('style', '');
      $('#li2').attr('style', '');
      $('#li3').attr('style', 'background: #ccc');
    }
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
            <div>
              <ul className="nav navbar-nav">
                <li id="li" className="active" style={{ 'background-color': '#ccc' }}>
                  <a onClick={this.changeModal.bind(this, 1)}>基本样式</a>
                </li>
                <li id="li2"><a onClick={this.changeModal.bind(this, 2)}>条件样式</a></li>
                <li id="li3"><a onClick={this.changeModal.bind(this, 3)}>导航交互</a></li>
              </ul>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ 'min-height': '200px' }}>
        {this.state.flag &&
          <div>
            <div>
              <BaseStyle
                key={i}
                actions={this.props.actions}
                form_data={this.props.form_data}
                baseStyle={this.props.baseStyle}
              />
            </div>
          </div>
         }
         {this.state.flag2 &&
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
                   <i className="fa fa-plus" /> &nbsp; 添加条件样式
                 </Button>
               </div>
             </div>
           </div>
         }
         {this.state.flag3 &&
           <div>
             <div className="row space-2">
               <div className="col-lg-2">
                 <Button
                   id="add-button"
                   bsSize="sm"
                   onClick={this.addInteraction.bind(this)}
                 >
                   <i className="fa fa-plus" /> &nbsp; 添加导航交互
                 </Button>
               </div>
             </div>
           </div>
         }
        </Modal.Body>

        <Modal.Footer>
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
    baseStyle: state.viz.form_data.baseStyle,
  };
}

export { StyleModal };
export default connect(mapStateToProps, () => ({}))(StyleModal);
