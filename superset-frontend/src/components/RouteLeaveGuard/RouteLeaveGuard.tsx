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

import React, { useEffect, useRef } from 'react';
import { Prompt } from 'react-router-dom';
import { PromptProps } from 'react-router';

const handleUnloadEvent = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = 'Controls changed';
};

export const RouteLeaveGuard = ({ message, when }: PromptProps) => {
  const isBeforeUnloadActive = useRef(false);

  useEffect(() => {
    if (when && !isBeforeUnloadActive.current) {
      window.addEventListener('beforeunload', handleUnloadEvent);
      isBeforeUnloadActive.current = true;
    }
    if (!when && isBeforeUnloadActive.current) {
      window.removeEventListener('beforeunload', handleUnloadEvent);
      isBeforeUnloadActive.current = false;
    }
  }, [when]);

  // cleanup beforeunload event listener
  // we use separate useEffect to call it only on component unmount instead of on every form data change
  useEffect(
    () => () => {
      window.removeEventListener('beforeunload', handleUnloadEvent);
    },
    [],
  );

  const promptProps = {
    message,
    ...(typeof message === 'string' && { when }),
  };
  return <Prompt {...promptProps} />;
};
