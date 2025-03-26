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
// src/components/IconButton/index.tsx
import { Card, Typography, Tooltip } from 'antd';
import { CardProps } from 'antd/lib/card';
import Icons from 'src/components/Icons';

export interface IconButtonProps extends CardProps {
  buttonText: string;
  icon?: string;
  altText?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  buttonText,
  icon,
  altText,
  ...cardProps
}) => {
  const { Text } = Typography;

  const renderIcon = () => {
    if (icon) {
      return (
        <img
          src={icon}
          alt={altText || buttonText}
          style={{ width: '100%', height: '120px', objectFit: 'contain' }}
        />
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '120px',
        }}
      >
        <Icons.DatabaseOutlined
          style={{ fontSize: '48px', color: 'var(--text-secondary)' }}
          aria-label="default-icon"
        />
      </div>
    );
  };

  return (
    <Card
      hoverable
      {...cardProps}
      cover={renderIcon()}
      bodyStyle={{ padding: '12px', textAlign: 'center' }}
    >
      <Tooltip title={buttonText}>
        <Text ellipsis>{buttonText}</Text>
      </Tooltip>
    </Card>
  );
};

export default IconButton;
