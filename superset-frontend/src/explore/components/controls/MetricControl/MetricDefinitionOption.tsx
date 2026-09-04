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
import {
  StyledColumnOption,
  StyledMetricOption,
} from 'src/explore/components/optionRenderers';
import withToasts from 'src/components/MessageToasts/withToasts';
import AggregateOption from './AggregateOption';

interface MetricDefinitionOptionProps {
  option: {
    metric_name?: string;
    column_name?: string;
    aggregate_name?: string;
    [key: string]: unknown;
  };
  addWarningToast: (message: string) => void;
}

function MetricDefinitionOption({
  option,
  addWarningToast,
}: MetricDefinitionOptionProps) {
  if (option.metric_name) {
    return <StyledMetricOption metric={option as any} showType />;
  }
  if (option.column_name) {
    return <StyledColumnOption column={option as any} showType />;
  }
  if (option.aggregate_name) {
    return (
      <AggregateOption
        aggregate={{ aggregate_name: option.aggregate_name }}
        showType
      />
    );
  }
  addWarningToast(
    'You must supply either a saved metric, column or aggregate to MetricDefinitionOption',
  );
  return null;
}

export default withToasts(MetricDefinitionOption);
