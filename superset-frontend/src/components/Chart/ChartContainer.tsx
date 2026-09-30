/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch, AnyAction } from 'redux';

import { selectAsyncModeOverride } from 'src/utils/asyncMode';
import type { StateWithAsyncModeOverride } from 'src/utils/asyncMode';
import * as actions from './chartAction';
import { logEvent } from '../../logger/actions';
import Chart from './Chart';
import { updateDataMask } from '../../dataMask/actions';

// Read the per-dashboard `async_mode` override here (the connected boundary) so
// the presentational Chart/ChartRenderer stay store-agnostic. Undefined outside a
// dashboard (e.g. Explore), which resolves to the deployment default. This lets
// self-contained charts (StatefulChart / the Matrixify path) honor the override
// the Redux chart path already applies.
function mapStateToProps(state: StateWithAsyncModeOverride) {
  return { asyncModeOverride: selectAsyncModeOverride(state) };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
  return {
    actions: bindActionCreators(
      {
        ...actions,
        updateDataMask,
        logEvent,
      } as any,
      dispatch,
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
