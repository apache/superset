import React, { PropTypes } from 'react';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';

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
    var bdhtml=window.document.body.innerHTML; 
    // 去掉滚动条,改变样式
    $('.slice_container').attr('class', 'mySlice');
    if($('.dataTables_scrollBody').length > 0){
      $('.dataTables_scrollHead').attr('style', 'border: 0px;')
      $('.dataTables_scrollBody').attr('style', '');
    } 
    var html = $('.mySlice').parent().parent().html();
    window.document.body.innerHTML=html; //把需要打印的指定内容赋给body.innerHTML
    window.print(); //调用浏览器的打印功能打印指定区域
    window.document.body.innerHTML=bdhtml;//重新给页面内容赋值；
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
