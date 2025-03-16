import { List, Typography } from 'antd';
import { FC } from 'react';
import { styled } from '@superset-ui/core';
import Popover from '../../../../../components/Popover';

const RoleText = styled(Typography.Text)`
  cursor: help;
`;

const checkData: Array<string> = [
  'Check available dashboards',
  'Gather insights from charts inside a dashboard',
];

const createData: Array<string> = [
  'Create datasets',
  'Use SQL Lab for your Ad-hoc queries',
];

const vizualizeData: Array<string> = ['Create dashboards', 'Create charts'];

const StyledList = styled(List)`
  & .ant-list-header {
    border: none;
  }

  & .ant-list-item {
    border: none;
  }
`;

const RoleInfo: FC<{ title: string; data: Array<string> }> = ({
  title,
  data,
}) => (
  <Typography.Paragraph>
    <StyledList
      header={
        <>
          <Typography.Title level={5}>{title}</Typography.Title>
          <Typography.Text underline>
            What can you do with this role:
          </Typography.Text>
        </>
      }
      dataSource={data}
      renderItem={(item: string) => <List.Item>{item}</List.Item>}
    />
  </Typography.Paragraph>
);

const content = (
  <>
    <RoleInfo title="readonly" data={checkData} />
    <RoleInfo title="Create Data" data={createData} />
    <RoleInfo title="Vizualize Data" data={vizualizeData} />
  </>
);

const RoleInformation = () => (
  <span>
    <Typography.Text type="secondary">
      You can read about Superset roles&nbsp;
    </Typography.Text>
    <Popover
      content={content}
      title={
        <Typography.Title level={4}>Superset roles overview</Typography.Title>
      }
    >
      <RoleText underline>here</RoleText>
    </Popover>
  </span>
);

export { RoleInformation };
