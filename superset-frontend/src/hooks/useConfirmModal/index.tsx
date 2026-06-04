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
import { useState, useCallback, ReactNode } from 'react';
import { ConfirmModal } from '@superset-ui/core/components';

export interface ConfirmConfig {
  title: string;
  body: string | ReactNode;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  confirmButtonStyle?: 'primary' | 'danger' | 'dashed';
  icon?: ReactNode;
}

export const useConfirmModal = () => {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const showConfirm = useCallback((options: ConfirmConfig) => {
    setConfig(options);
  }, []);

  const handleHide = useCallback(() => {
    if (!loading) {
      setConfig(null);
    }
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    if (!config) return;

    try {
      setLoading(true);
      await config.onConfirm();
      setConfig(null);
    } catch (error) {
      // Let the error propagate but keep modal open
      // eslint-disable-next-line no-console
      console.error('Confirm action failed:', error);
    } finally {
      setLoading(false);
    }
  }, [config]);

  const ConfirmModalComponent = config ? (
    <ConfirmModal
      show={!!config}
      onHide={handleHide}
      onConfirm={handleConfirm}
      title={config.title}
      body={config.body}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      confirmButtonStyle={config.confirmButtonStyle}
      icon={config.icon}
      loading={loading}
    />
  ) : null;

  return { showConfirm, ConfirmModal: ConfirmModalComponent };
};
