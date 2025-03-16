import type { FC } from 'react';
import styled from '@emotion/styled';
import {
  AutoComplete,
  Descriptions,
  Input,
  List,
  Space,
  Typography,
} from 'antd';
import { t, useTheme } from '@superset-ui/core';
import moment from 'moment';
import Popconfirm from 'antd/es/popconfirm';
import Loading from '../../../../components/Loading';
import { useTeamPage } from './useTeamPage';
import CheckboxControl from '../../../../explore/components/controls/CheckboxControl';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';

const Wrapper = styled.div`
  padding: 2rem;
`;

export const TeamPage: FC = () => {
  const theme = useTheme();

  const {
    isLoading,
    data,
    removeFromTeam,
    debouncedLoadMemberList,
    memberList,
    membersIsLoading,
    handleMemberSelect,
    memberToAdd,
    handleOnChangeMember,
    addToTeam,
    addUserPending,
  } = useTeamPage();

  return (
    <Wrapper>
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <Typography.Title level={5}>{t('Team')}</Typography.Title>
          <Descriptions
            size="small"
            bordered
            column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
            labelStyle={{ width: '25%' }}
            contentStyle={{ backgroundColor: theme.colors.grayscale.light5 }}
          >
            <Descriptions.Item label={t('Name')}>
              {data?.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('Franchisee')}>
              <CheckboxControl hovered value={data?.isExternal} disabled />
            </Descriptions.Item>
            <Descriptions.Item label="Slug">{data?.slug}</Descriptions.Item>
            <Descriptions.Item label={t('Roles')}>
              {data?.roles}
            </Descriptions.Item>
            <Descriptions.Item label={t('Members count')}>
              {data?.membersCount}
            </Descriptions.Item>
          </Descriptions>

          <Typography.Title level={5}>{t('Add members')}</Typography.Title>
          <Space>
            <AutoComplete
              value={memberToAdd ? memberToAdd.label : undefined}
              options={memberList}
              style={{ minWidth: '500px' }}
              onSearch={debouncedLoadMemberList}
              onSelect={handleMemberSelect}
              onChange={handleOnChangeMember}
            >
              <Input.Search
                placeholder={t('select member')}
                loading={membersIsLoading}
                allowClear
                size="middle"
              />
            </AutoComplete>
            {memberToAdd && (
              <Button
                onClick={addToTeam}
                disabled={addUserPending}
              >{`Add to team: ${memberToAdd?.label}`}</Button>
            )}
          </Space>

          <Typography.Title level={5}>{t('Members')}</Typography.Title>
          <List
            grid={{
              gutter: 16,
              xs: 1,
              sm: 1,
              md: 2,
              lg: 2,
              xl: 3,
              xxl: 4,
            }}
            dataSource={data?.participants}
            renderItem={item => (
              <List.Item>
                <Card
                  style={{
                    backgroundColor: theme.colors.grayscale.light5,
                    padding: '0.5rem',
                  }}
                >
                  <Descriptions
                    size="small"
                    bordered
                    column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
                    contentStyle={{
                      backgroundColor: theme.colors.grayscale.light5,
                    }}
                  >
                    <Descriptions.Item label={t('Username')}>
                      {item?.username}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('First name')}>
                      {item?.firstName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('Last name')}>
                      {item?.lastName}
                    </Descriptions.Item>
                    <Descriptions.Item label="email">
                      {item?.email}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('Created on')}>
                      {moment(item?.createdOn).format('DD/MM/YYYY HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('Login count')}>
                      {item?.loginCount}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('Last login date')}>
                      {moment(item?.lastLogin).format('DD/MM/YYYY HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="">
                      <Popconfirm
                        title={`${item?.username} will be deleted from team ${data?.name}`}
                        onConfirm={() => removeFromTeam(item.id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button>{t('REMOVE FROM TEAM')}</Button>
                      </Popconfirm>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </List.Item>
            )}
          />
        </>
      )}
    </Wrapper>
  );
};
