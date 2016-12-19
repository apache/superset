import $ from 'jquery';
import React, { PropTypes } from 'react';

const propTypes = {
  slice: PropTypes.object.isRequired,
};

export default class DownloadButton extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      message: '',
    };
  }

  doPrint() {
    let bdhtml = window.document.body.innerHTML; 
    // remove scroll and change style
    $('.slice_container').attr('class', 'mySlice');
    if($('.dataTables_scrollBody').length > 0) {
      $('.dataTables_scrollHead').attr('style', 'border: 0px;');
      $('.dataTables_scrollBody').attr('style', '');
    }
    let html = $('.mySlice').parent().parent().html();
    window.document.body.innerHTML = html; 
    window.print(); 
    window.document.body.innerHTML = bdhtml;
    window.location.reload();
  }

  render() {
    return (
      <span onClick={this.doPrint.bind(this)} className="btn btn-default btn-sm">
        <i className="fa fa-print"></i> .print
      </span>
    );
  }
}
