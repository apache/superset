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

import { styled } from '@superset-ui/core';
import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import useEffectEvent from 'src/hooks/useEffectEvent';

type Props = {
  as?: keyof HTMLElementTagNameMap;
  text: string;
  onCompleted?: () => void;
};

function chunkText(text: string, chunkSize: number) {
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

function useAnimatedText(
  text: string,
  options: {
    chunkSize?: number;
    onCompleted?: () => void;
  } = {},
) {
  const [resolvedText, setText] = useState('');
  const chunkSize = options.chunkSize ?? 3;
  const index = useRef(0);
  const chunks = useMemo(() => chunkText(text, chunkSize), [text]);
  const onCompleted = useEffectEvent(() => options.onCompleted?.());

  useEffect(() => {
    if (index.current >= chunks.length) {
      onCompleted();
      return;
    }

    const timer = setTimeout(
      () => {
        index.current += 1;
        setText(chunks.slice(0, index.current).join(''));
      },
      Math.random() * 50 + 50,
    );

    return () => {
      clearTimeout(timer);
    };
  }, [chunks, resolvedText]);

  useEffect(() => {
    index.current = 0;
  }, [text]);

  return resolvedText;
}

const DynamicElementComponent = forwardRef((props: any, ref) => {
  const { as: As } = props;

  return <As ref={ref} {...props} />;
});

const StyledElement = styled(DynamicElementComponent)<{ completed: boolean }>`
  ${({ completed, theme }) =>
    !completed &&
    `
    ::after {
      content: '';
      width: 5px;
      height: 20px;
      background: ${theme.colors.grayscale.light1};
      display: inline-block;
      animation: cursor-blink 1.5s;
    }
  `}

  @keyframes cursor-blink {
    0% {
      opacity: 0;
    }
  }
`;

const LiveText = ({
  as = 'span',
  text,
  onCompleted,
  ...remainingProps
}: Props) => {
  const children = useAnimatedText(text, { onCompleted });

  return (
    <StyledElement
      as={as}
      {...remainingProps}
      children={children}
      completed={text === children}
    />
  );
};

export default LiveText;
