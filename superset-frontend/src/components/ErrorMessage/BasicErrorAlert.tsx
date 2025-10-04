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
  ErrorLevel,
  styled,
  useTheme,
  getColorVariants,
} from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components';

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
  overflow: hidden;
`;

const StyledTitle = styled.span`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

interface BasicErrorAlertProps {
  title: string;
  body: string;
  level?: ErrorLevel;
}

export function BasicErrorAlert({
  body,
  level = 'error',
  title,
}: BasicErrorAlertProps) {
  const theme = useTheme();
  const variants = getColorVariants(theme, level);
  const style: React.CSSProperties = {
    backgroundColor: variants.bg,
    borderColor: variants.border,
    color: variants.text,
    display: 'flex',
    flexDirection: 'row',
    borderRadius: `${theme.borderRadius}px`,
    padding: `${theme.sizeUnit * 2}px`,
    marginBottom: `${theme.sizeUnit}px`,
    width: '100%',
  };

  return (
    <div style={style} role="alert">
      <Icons.ExclamationCircleFilled iconColor={variants.text} />
      <StyledContent>
        <StyledTitle>{title}</StyledTitle>
        <p>{body}</p>
      </StyledContent>
    </div>
  );
}
