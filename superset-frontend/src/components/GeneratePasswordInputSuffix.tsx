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
import { t } from '@apache-superset/core/translation';
import { Button, Icons } from '@superset-ui/core/components';

export interface GeneratePasswordInputSuffixProps {
  onGenerate: () => void;
}

/**
 * Compact control for use as ``Input.Password`` ``suffix`` (after the visibility icon).
 */
export function GeneratePasswordInputSuffix({
  onGenerate,
}: GeneratePasswordInputSuffixProps) {
  return (
    <Button
      htmlType="button"
      buttonStyle="link"
      buttonSize="xsmall"
      tooltip={t('Generate password')}
      aria-label={t('Generate password')}
      icon={<Icons.ThunderboltOutlined iconSize="m" />}
      showMarginRight={false}
      onMouseDown={event => {
        event.preventDefault();
      }}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onGenerate();
      }}
    />
  );
}
