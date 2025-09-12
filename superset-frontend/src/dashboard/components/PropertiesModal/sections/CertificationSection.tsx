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
import { t } from '@superset-ui/core';
import { FormItem, Input } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';

interface CertificationSectionProps {
  isLoading: boolean;
}

const CertificationSection = ({ isLoading }: CertificationSectionProps) => (
  <>
    <ModalFormField
      label={t('Certified by')}
      helperText={t('Person or group that has certified this dashboard.')}
    >
      <FormItem name="certifiedBy" noStyle>
        <Input type="text" disabled={isLoading} />
      </FormItem>
    </ModalFormField>
    <ModalFormField
      label={t('Certification details')}
      helperText={t(
        'Any additional detail to show in the certification tooltip.',
      )}
      bottomSpacing={false}
    >
      <FormItem name="certificationDetails" noStyle>
        <Input type="text" disabled={isLoading} />
      </FormItem>
    </ModalFormField>
  </>
);

export default CertificationSection;
