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
import { StyledColumnOption } from '../../optionRenderers';

interface OptionType {
  saved_metric_name?: string;
  column_name?: string;
  label?: string;
  type?: string;
  [key: string]: unknown;
}

export default function FilterDefinitionOption({
  option,
}: {
  option: OptionType;
}) {
  if (option.saved_metric_name) {
    return (
      <StyledColumnOption
        column={{ column_name: option.saved_metric_name, type: 'metric' }}
        showType
      />
    );
  }
  if (option.column_name) {
    return (
      <StyledColumnOption
        column={option as { column_name: string; type?: string }}
        showType
      />
    );
  }
  if (option.label) {
    return (
      <StyledColumnOption
        column={{ column_name: option.label, type: 'metric' }}
        showType
      />
    );
  }
  return null;
}
