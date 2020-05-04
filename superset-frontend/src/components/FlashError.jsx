import React from 'react';
import PropTypes from 'prop-types'
import {t} from '@superset-ui/translation'
import withToasts from 'src/messageToasts/enhancers/withToasts';

const propTypes = {
    children: PropTypes.node.isRequired,
    common: PropTypes.object.isRequired, 
};

const flashObj = {
    info: 'addInfoToast',
    danger: 'addDangerToast',
    warning: 'addWarningToast',
    success: 'addSuccessToast',
};
  

class FlashError extends React.PureComponent {
    componentDidMount() {
      let flashArr = this.props.common.flash_messages;
      if(flashArr.length > 0){
        flashArr.forEach((e,i)=>{
          let type = flashArr[i][0];
          let text = flashArr[i][1];
          let flash = flashObj[type]
          this.props[flash](t(text));
        })
      }
    }
    render() {
        return this.props.children;
    }
}

export default withToasts(FlashError);