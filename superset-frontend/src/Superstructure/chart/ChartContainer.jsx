// DODO-changed
 import { connect } from 'react-redux';
 import { bindActionCreators } from 'redux';
 
 import * as actions from 'src/Superstructure/chart/chartAction';
 import { logEvent } from '../../logger/actions';
 import Chart from 'src/Superstructure/chart/Chart';
 import { updateDataMask } from '../../dataMask/actions';
 
 function mapDispatchToProps(dispatch) {
   return {
     actions: bindActionCreators(
       {
         ...actions,
         updateDataMask,
         logEvent,
       },
       dispatch,
     ),
   };
 }
 
 export default connect(null, mapDispatchToProps)(Chart);
 