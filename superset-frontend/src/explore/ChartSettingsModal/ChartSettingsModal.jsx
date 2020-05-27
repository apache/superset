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
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Row, Col, InputNumber, Select, Button } from 'antd';
import { t } from '@superset-ui/translation';
import { useChart } from './chartHooks';
import ChartSettingsForm from './ChartSettingsForm';
import ChartSettingsSkeleton from './ChartSettingsSkeleton';

//Work around for antd components that add themselves to the body.
const tempContainer = () => document.getElementById('antdPortal');

const ChartSettingsModal = ({ id = 95 }) => {
  const [{ data: chart, error, isLoading }, setChart] = useChart(id);
  const [form] = Form.useForm();

  return (
    <div className="antd">
      <Modal
        title={t('Edit Chart Properties')}
        visible={false}
        style={{ width: '600px' }}
        bodyStyle={{ maxHeight: '500px', overflow: 'auto' }}
        getContainer={tempContainer}
        footer={[
          <Button key="cancel" disabled={isLoading}>Cancel</Button>,
          <Button
            key="submit"
            type="primary"
            disabled={isLoading}
            loading={isLoading && chart}
            onClick={() => form.submit()}
          >
            Submit
          </Button>,
        ]}
      >
        {chart ? (
          <ChartSettingsForm
            form={form}
            chart={chart}
            error={error}
            onFinish={values => setChart({ id, ...values })}
          />
        ) : (
          <ChartSettingsSkeleton />
        )}
      </Modal>
    </div>
  );
};
export default ChartSettingsModal;