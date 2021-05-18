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
import React from 'react';
import ControlHeader from 'src/explore/components/ControlHeader';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import Checkbox from 'src/components/Checkbox';
import { DrillDown } from "@superset-ui/core";

type drillDownProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  chartId: string;
  columns: string[];
  actions: ExploreActions;
};

const checkboxStyle = { paddingRight: '5px' };

export default function DrillDownControl(props: drillDownProps){
  const onChange = () => {
    const chartId = props.chartId.toString();
    if (!props.value) {
      const drilldown = DrillDown.fromHierarchy(props.columns)
      props.actions.updateDataMask(chartId, {ownState: {drilldown: drilldown}});
    } else {
      props.actions.updateDataMask(chartId, {ownState: {}});
    }
    props.onChange(!props.value);
  }

  const renderCheckbox = () => {
    return (
      <Checkbox
        onChange={onChange}
        style={checkboxStyle}
        checked={props.value}
      />
    );
  }

  if (props.label) {
    return (
      <ControlHeader
        {...props}
        leftNode={renderCheckbox()}
        onClick={onChange}
      />
    );
  }
  return renderCheckbox();
}
