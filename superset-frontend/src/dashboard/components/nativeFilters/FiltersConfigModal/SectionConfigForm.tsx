import React from 'react';
import { FormItem } from 'src/components/Form';
import { Input, TextArea } from 'src/common/components';
import { styled } from '@superset-ui/core';
import { NativeFilterType } from '../types';

interface Props {
  componentId: string;
  section?: {
    title: string;
    description: string;
  };
}
const Container = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 4}px;
  `}
`;

const SectionConfigForm: React.FC<Props> = ({ componentId, section }) => (
  <Container>
    <FormItem
      initialValue={section ? section.title : ''}
      label="Title"
      name={['filters', componentId, 'title']}
    >
      <Input />
    </FormItem>
    <FormItem
      initialValue={section ? section.description : ''}
      label="Description"
      name={['filters', componentId, 'description']}
    >
      <TextArea rows={4} />
    </FormItem>
    <FormItem
      hidden
      name={['filters', componentId, 'type']}
      initialValue={NativeFilterType.SECTION}
    />
  </Container>
);

export default SectionConfigForm;
