import $ from 'jquery';
import React from 'react';

export default class DownloadButton extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      message: '',
    };
  }

  doPrint() {
    const bdhtml = window.document.body.innerHTML;
    // remove scroll and change style
    $('.slice_container').attr('class', 'mySlice');
    if ($('.dataTables_scrollBody').length > 0) {
      $('.dataTables_scrollHead').attr('style', 'border: 0px;');
      $('.dataTables_scrollBody').attr('style', '');
    }
    const html = $('.mySlice').parent().parent()
                .html();
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
