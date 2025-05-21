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
import { useState } from 'react';
import { useTheme } from '@superset-ui/core';

import Icons from 'src/components/Icons';
import { Input } from 'src/components/Input';
import { Button } from 'src/components';

import useEffectEvent from 'src/hooks/useEffectEvent';

type Props = {
  disabled: boolean;
  onSubmit: (prompt: string) => void;
};

const PromptInput = ({ disabled, onSubmit }: Props) => {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  const [hasError, setHasError] = useState(false);

  const showError = hasError && prompt.length === 0;
  const handleSubmit = useEffectEvent(() => {
    if (!prompt) {
      setHasError(true);
    } else {
      onSubmit(prompt);
      setPrompt('');
      setHasError(false);
    }
  });

  return (
    <Input
      id="prompt"
      variant="outlined"
      size="large"
      disabled={disabled}
      onChange={({ target }) => setPrompt(target.value)}
      onKeyDown={({ code }) => {
        if (code === 'Enter') handleSubmit();
      }}
      value={prompt}
      {...(showError && {
        status: 'error',
        placeholder: 'Please type a prompt to configure your chart',
      })}
      autoFocus
      suffix={
        showError ? (
          <Icons.InfoCircleOutlined />
        ) : (
          <Button buttonStyle="primary" shape="circle" onClick={handleSubmit}>
            <Icons.SendOutlined
              iconSize="l"
              iconColor={theme.colors.grayscale.light5}
            />
          </Button>
        )
      }
    />
  );
};

export default PromptInput;
