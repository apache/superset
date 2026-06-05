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
import React from 'react';

interface Props {
  onClick: () => void;
}

export const Bubble: React.FC<Props> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-test="reference-chatbot-bubble"
    aria-label="Open Alt chatbot"
    style={{
      width: 56,
      height: 56,
      borderRadius: '50%',
      border: 'none',
      background: '#2da44e',
      color: '#fff',
      fontSize: 24,
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
    }}
  >
    ?
  </button>
);
