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
import { bindActionCreators, Dispatch, AnyAction } from 'redux';
import { connect } from 'react-redux';
import { fetchSlices, updateSlices } from '../actions/sliceEntities';
import SliceAdder from '../components/SliceAdder';
import { RootState } from 'src/dashboard/types';

interface OwnProps {
  height?: number;
}

function mapStateToProps(
  { sliceEntities, dashboardInfo, dashboardState }: RootState,
  ownProps: OwnProps,
) {
  return {
    height: ownProps.height,
    userId: +dashboardInfo.userId,
    dashboardId: dashboardInfo.id,
    selectedSliceIds: dashboardState.sliceIds,
    slices: sliceEntities.slices,
    isLoading: sliceEntities.isLoading,
    errorMessage: sliceEntities.errorMessage,
    lastUpdated: sliceEntities.lastUpdated,
    editMode: dashboardState.editMode,
  };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
  return bindActionCreators(
    {
      fetchSlices,
      updateSlices,
    } as any,
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(SliceAdder as any);
