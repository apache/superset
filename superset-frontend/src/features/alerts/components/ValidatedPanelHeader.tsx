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
import { t, useTheme } from '@superset-ui/core';
import { Icons } from 'src/components/Icons';
import { Space } from 'src/components/Space';
import Typography from 'src/components/Typography';

const ValidatedPanelHeader = ({
  title,
  subtitle,
  validateCheckStatus,
  testId,
}: {
  title: string;
  subtitle: string;
  validateCheckStatus: boolean;
  testId?: string;
}): JSX.Element => {
  const theme = useTheme();
  const checkmark = (
    <Icons.CheckCircleOutlined
      iconSize="m"
      iconColor={theme.colors.success.base}
    />
  );
  return (
    <div>
      <Space size="small" data-test={testId}>
        <Typography.Title
          level={5}
          style={{
            margin: 0,
          }}
        >
          {t(title)}
        </Typography.Title>
        {validateCheckStatus ? (
          <span>{checkmark}</span>
        ) : (
          <span
            style={{
              color: theme.colors.error.base,
              fontSize: theme.fontSizeLG,
            }}
          >
            *
          </span>
        )}
      </Space>
      <Typography.Paragraph
        style={{
          margin: 0,
        }}
      >
        {subtitle ? t(subtitle) : undefined}
      </Typography.Paragraph>
    </div>
  );
};

export default ValidatedPanelHeader;
