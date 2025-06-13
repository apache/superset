/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file * to you under the Apache License, Version 2.0 (the
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
import { useTheme } from '@superset-ui/core';
import { Typography } from '@superset-ui/core/components/Typography';
import { Icons } from '@superset-ui/core/components';

interface CollapseLabelInModalProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  validateCheckStatus?: boolean;
  testId?: string;
}

export const CollapseLabelInModal: React.FC<CollapseLabelInModalProps> = ({
  title,
  subtitle,
  validateCheckStatus = false,
  testId,
}) => {
  const theme = useTheme();

  return (
    <div data-test={testId}>
      <Typography.Title
        style={{
          marginTop: 0,
          marginBottom: theme.sizeUnit / 2,
          fontSize: theme.fontSizeLG,
        }}
      >
        {title}{' '}
        {validateCheckStatus ? (
          <Icons.CheckCircleOutlined
            style={{ color: theme.colorSuccess }}
            aria-label="check-circle"
            role="img"
          />
        ) : (
          <span
            style={{
              color: theme.colorErrorText,
              fontSize: theme.fontSizeLG,
            }}
          >
            *
          </span>
        )}
      </Typography.Title>
      <Typography.Paragraph
        style={{
          margin: 0,
          fontSize: theme.fontSizeSM,
          color: theme.colorTextDescription,
        }}
      >
        {subtitle}
      </Typography.Paragraph>
    </div>
  );
};

export type { CollapseLabelInModalProps };
