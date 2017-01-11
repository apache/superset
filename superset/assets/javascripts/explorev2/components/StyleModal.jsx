import $ from 'jquery';
import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import shortid from 'shortid';
import Style from './Style';
import BaseStyle from './BaseStyle';
import Compare from './Compare';
import Navigate from './Navigate';

const propTypes = {
  onHide: React.PropTypes.func.isRequired,
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  styles: React.PropTypes.array.isRequired,
  baseStyle: React.PropTypes.Object,
  colStyles: React.PropTypes.array.isRequired,
  compares: React.PropTypes.Object,
  navigates: React.PropTypes.array.isRequired,
  slices: React.PropTypes.object.isRequired,
};

const defaultProps = {
  styles: [],
  baseStyle: null,
  colStyles: [],
  navigates: [],
};

class StyleModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      flag: true,
      flag2: false,
      flag3: false,
      flag4: false,
    };
  }
  addStyle() {
    this.props.actions.addStyle({
      id: shortid.generate(),
      metric: null,
      expr: null,
      value: null,
      icon: null,
    });
  }
  addCompare() {
    this.props.actions.addCompare({
      id: shortid.generate(),
      metricLeft: null,
      metricRight: null,
      expr: null,
      value: null,
    });
  }
  addNavigate() {
    this.props.actions.addNavigate({
      id: shortid.generate(),
      metric: null,
      expr: null,
      slice: null,
      open: 'modal',
    });
  }
  changeModal(type) {
    if (type === 1) {
      this.setState({ flag: true, flag2: false, flag3: false, flag4: false });
      $('ul li').attr('style', '');
      $('#li').attr('style', 'background: #ccc');
    } else if (type === 2) {
      this.setState({ flag: false, flag2: true, flag3: false, flag4: false });
      $('ul li').attr('style', '');
      $('#li2').attr('style', 'background: #ccc');
    } else if (type === 3) {
      this.setState({ flag: false, flag2: false, flag3: true, flag4: false });
      $('ul li').attr('style', '');
      $('#li3').attr('style', 'background: #ccc');
    } else {
      this.setState({ flag: false, flag2: false, flag3: false, flag4: true });
      $('ul li').attr('style', '');
      $('#li4').attr('style', 'background: #ccc');
    }
  }
  render() {
    const stylesDiv = [];
    const compareDiv = [];
    const navigatesDiv = [];

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
    this.props.compares.forEach((compare) => {
      i++;
      compareDiv.push(
        <Compare
          key={i}
          actions={this.props.actions}
          form_data={this.props.form_data}
          compare={compare}
        />
      );
    });
    this.props.navigates.forEach((navigate) => {
      i++;
      navigatesDiv.push(
        <Navigate
          key={i}
          actions={this.props.actions}
          form_data={this.props.form_data}
          navigate={navigate}
          slices={this.props.slices}
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
              <ul className="nav navbar-nav" style={{ fontSize: '14px' }}>
                <li id="li" className="active" style={{ backgroundColor: '#ccc' }}>
                  <a onClick={this.changeModal.bind(this, 1)}>基本样式</a>
                </li>
                <li id="li2"><a onClick={this.changeModal.bind(this, 2)}>条件样式</a></li>
                <li id="li3"><a onClick={this.changeModal.bind(this, 3)}>列间比较</a></li>
                <li id="li4"><a onClick={this.changeModal.bind(this, 4)}>切片导航</a></li>
              </ul>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ minHeight: '300px' }}>
        {this.state.flag &&
          <div>
            <BaseStyle
              key={i}
              actions={this.props.actions}
              form_data={this.props.form_data}
              baseStyle={this.props.baseStyle}
              colStyles={this.props.colStyles}
            />
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
             <div>
               {compareDiv}
             </div>
             <div className="row space-2">
               <div className="col-lg-2">
                 <Button
                   id="add-button"
                   bsSize="sm"
                   onClick={this.addCompare.bind(this)}
                 >
                   <i className="fa fa-plus" /> &nbsp; 添加比较样式
                 </Button>
               </div>
             </div>
           </div>
         }
         {this.state.flag4 &&
           <div>
             <div>
               {navigatesDiv}
             </div>
             <div className="row space-2">
               <div className="col-lg-2">
                 <Button
                   id="add-button"
                   bsSize="sm"
                   onClick={this.addNavigate.bind(this)}
                 >
                   <i className="fa fa-plus" /> &nbsp; 添加导航
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
    navigates: state.viz.form_data.navigates,
  };
}

export { StyleModal };
export default connect(mapStateToProps, () => ({}))(StyleModal);
