import React, { useState } from 'react';
import {
  Row,
  Avatar,
  Col,
  Checkbox,
  Typography,
  Button,
  Drawer,
  Space,
  Input,
  Divider,
} from 'antd';
import {
  ShareAltOutlined,
  SettingOutlined,
  DownloadOutlined,
  DownOutlined,
  GlobalOutlined,
  DeleteOutlined,
  FilterOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { SupersetTheme, useTheme, SupersetClient } from '@superset-ui/core';
import { CheckboxChangeEvent } from 'antd/lib/checkbox';

const { Title } = Typography;
interface IProsp {
  onShowUploadUI: () => void;
}
const HeaderPage = (props: IProsp) => {
  const theme: SupersetTheme = useTheme();
  const { onShowUploadUI } = props;
  const [isSelectTable, setIsSelectTable] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [userList, setUserList] = useState<any>([]);
  const [tableList, setTableList] = useState<any>([]);
  const [isSelectPeople, setIsSelectPeople] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchTable, setSearchTable] = useState('');
  const [shareTable, setShareTable] = useState<any>([]);
  const handleSetOpen = () => {
    setShareOpen(true);
  };
  const handleCancel = () => {
    setShareOpen(false);
    setShareTable([]);
    setIsSelectPeople(false);
    setIsSelectTable(false);
    setSharePeople([]);
  };
  const handleSelectPeople = () => {
    SupersetClient.get({
      endpoint: `/api/v1/users/all`,
    }).then(async ({ json = {} }) => {
      setUserList(
        json.result.filter((user: any) => {
          const index = sharePeople.findIndex(
            (people: any) => people.id === user.id,
          );
          if (index === -1) return true;
          sharePeople[index].email = user.email;
          return false;
        }),
      );
    });
    setIsSelectPeople(true);
  };
  const [sharePeople, setSharePeople] = useState<any>([]);
  const handleUserSearch = (ev: React.ChangeEvent<HTMLInputElement>) => {
    setSearchUser(ev.target.value);
  };
  const handleTableSearch = (ev: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTable(ev.target.value);
  };

  const cancelSelectPeople = () => {
    setIsSelectPeople(false);
  };
  const cancelSelectTable = () => {
    setIsSelectTable(false);
  };
  const handleSelectTable = () => {
    SupersetClient.get({
      endpoint: `/api/v1/dataset/`,
    }).then(async ({ json = {} }) => {
      // setTableList(json.result);
      setTableList(
        json.result.filter((res: any) => {
          const index = shareTable.findIndex(
            (table: any) => table.id === res.id,
          );
          if (index === -1) return true;
        }),
      );
    });
    setIsSelectTable(true);
  };
  const onChangeCheck = (e: CheckboxChangeEvent) => {
    if (e.target.checked) {
      const index = userList.findIndex(
        (user: any) => user.id.toString() === e.target.value,
      );
      setSharePeople(sharePeople.concat(userList[index]));
      let temp_userList = [...userList];
      temp_userList.splice(index, 1);
      setUserList(temp_userList);
    }
  };
  const onChangeTableCheck = (e: CheckboxChangeEvent) => {
    if (e.target.checked) {
      const index = tableList.findIndex(
        (table: any) => table.id.toString() === e.target.value,
      );
      setShareTable(shareTable.concat(tableList[index]));
      let temp_tableList = [...tableList];
      temp_tableList.splice(index, 1);
      setTableList(temp_tableList);
    }
  };

  return (
    <Row>
      <Col span="12">
        <Title>Data Management</Title>
      </Col>
      <Col span="12" style={{ display: 'inline-block' }}>
        <Row style={{ float: 'right' }}>
          <Button
            type="primary"
            icon={<ShareAltOutlined />}
            size="large"
            onClick={handleSetOpen}
            style={{
              marginRight: '8px',
              background: theme.colors.quotron.gray_white,
              color: theme.colors.quotron.black,
            }}
          />
          <Button
            type="primary"
            icon={<SettingOutlined />}
            size="large"
            style={{
              marginRight: '8px',
              background: theme.colors.quotron.gray_white,
              color: theme.colors.quotron.black,
            }}
          >
            Manage Data
          </Button>
          <Button
            type="primary"
            onClick={onShowUploadUI}
            icon={<DownloadOutlined />}
            size="large"
            style={{
              background: theme.colors.quotron.black,
              color: theme.colors.quotron.gray_white,
            }}
          >
            Import Data
          </Button>
        </Row>
      </Col>
      <Drawer
        width="75%"
        placement="right"
        onClose={handleCancel}
        visible={shareOpen}
        closable={false}
      >
        {isSelectPeople ? (
          <Col>
            <br />
            <Row>
              <Button type="link" onClick={cancelSelectPeople}>
                <Title level={4}>{'<- Select People'}</Title>
              </Button>
            </Row>
            <Row>
              <Col span={16}>
                <Row>
                  <Col span={16}>
                    <Title level={5} style={{ marginTop: '24px' }}>
                      Add people by email id or names
                    </Title>
                  </Col>
                  <Col span={8} style={{ float: 'right' }}>
                    <Space style={{ float: 'right' }}>
                      <Title level={5} style={{ marginTop: '24px' }}>
                        Can edit
                        <DownOutlined />
                      </Title>
                    </Space>
                  </Col>
                </Row>
                <Row>
                  <Col
                    style={{
                      border: '1px solid black',
                      borderRadius: 10,
                      width: '100%',
                      height: '400px',
                    }}
                  >
                    <Input
                      placeholder="Add Emails and Addresses to share access with"
                      bordered={false}
                      size="large"
                      style={{
                        background: theme.colors.quotron.gray_white,
                        borderRadius: 10,
                      }}
                      value={searchUser}
                      onChange={handleUserSearch}
                    />
                    <Col style={{ borderTop: '1px solid black' }}>
                      {userList.length !== 0 &&
                        userList
                          .filter(
                            ({
                              first_name: firstName,
                              last_name: lastName,
                              ...rest
                            }: any) =>
                              firstName
                                .toUpperCase()
                                .includes(searchUser.toUpperCase()) ||
                              lastName
                                .toUpperCase()
                                .includes(searchUser.toUpperCase()),
                          )
                          .map((user: any, index: number) => (
                            <Row
                              align="middle"
                              style={{ marginLeft: '20px' }}
                              key={user.id.toString()}
                            >
                              <Col span={2}>
                                <Checkbox
                                  value={user.id.toString()}
                                  onChange={onChangeCheck}
                                />
                              </Col>
                              <Col span={2}>
                                <Avatar icon={<UserOutlined />} />
                              </Col>
                              <Col>
                                <Row>
                                  <Title level={5}>{user.username}</Title>
                                </Row>
                                <Row>{user.email}</Row>
                              </Col>
                            </Row>
                          ))}
                    </Col>
                  </Col>
                </Row>
              </Col>
              <Col span={8}>
                <Row>
                  <Title
                    level={5}
                    style={{ marginTop: '24px', marginLeft: 20 }}
                  >
                    Selected People
                  </Title>
                </Row>
                <Row>
                  <Col span={24}>
                    {sharePeople.length !== 0 &&
                      sharePeople.map((user: any) => (
                        <Row align="middle" style={{ marginLeft: '20px' }}>
                          <Col span={4}>
                            <Avatar icon={<UserOutlined />} />
                          </Col>
                          <Col span={16}>
                            <Row>
                              <Title level={5}>{user.username}</Title>
                            </Row>
                            <Row>{user.email}</Row>
                          </Col>
                          <Col span={4}>
                            <DeleteOutlined />
                          </Col>
                        </Row>
                      ))}
                  </Col>
                </Row>
              </Col>
            </Row>
            <Row>
              <Title level={4}>General Access</Title>
            </Row>
            <Row
              style={{ width: '100%' }}
              justify="space-between"
              align="middle"
            >
              <Col>
                <GlobalOutlined />
              </Col>
              <Col>
                <Row>
                  <Title level={5}>People With the Link</Title>
                </Row>
                <Row>anyone on the internet with the link can edit</Row>
              </Col>
              <Col>
                <Button
                  size={'large'}
                  style={{ fontSize: '20px', height: 50, borderRadius: 5 }}
                >
                  Copy Link
                </Button>
              </Col>
              <Col>
                can edit
                <DownOutlined />
              </Col>
            </Row>
            <Row justify="space-between" style={{ marginTop: '24px' }}>
              <Col>
                <Title level={5}>Invites will be shared by email</Title>
              </Col>
              <Col>
                <Button
                  size={'large'}
                  style={{
                    background: theme.colors.quotron.black,
                    borderRadius: 10,
                    fontSize: 20,
                    color: 'white',
                    height: 50,
                  }}
                >
                  {'Share access->'}
                </Button>
              </Col>
            </Row>
          </Col>
        ) : isSelectTable ? (
          <Col>
            <br />
            <Row>
              <Button type="link" onClick={cancelSelectTable}>
                <Title level={4}>{'<- Select Tables'}</Title>
              </Button>
            </Row>
            <Row>
              <Col span={15}>
                <Row>
                  <Col span={16}>
                    <Title level={5} style={{ marginTop: '24px' }}>
                      Filter or search tables by department or categories
                    </Title>
                  </Col>
                </Row>
                <Row
                  style={{
                    border: `5px solid ${theme.colors.quotron.gray_white}`,
                    borderRadius: 10,
                    height: 50,
                  }}
                  justify="space-between"
                  align="middle"
                >
                  <Col
                    span={22}
                    style={{
                      overflow: 'auto',
                    }}
                  >
                    {shareTable.length !== 0 && (
                      <Space>
                        {shareTable.map((table: any) => (
                          <Button
                            style={{ marginLeft: '20px' }}
                            shape="round"
                            type="default"
                          >
                            {table.table_name}
                          </Button>
                        ))}
                      </Space>
                    )}
                  </Col>
                  <Col span={2}>
                    <Row justify="center">
                      <FilterOutlined />
                    </Row>
                  </Col>
                </Row>
                <Row>
                  <Col
                    style={{
                      // borderRadius: 10,
                      width: '100%',
                      height: '400px',
                      overflow: 'auto',
                    }}
                  >
                    <Input
                      placeholder="Search Tables"
                      size="large"
                      style={{
                        border: '1px solid black',
                        background: theme.colors.quotron.gray_white,
                        borderRadius: 10,
                        height: 50,
                      }}
                      value={searchTable}
                      onChange={handleTableSearch}
                    />
                    <Col
                      style={{
                        borderRadius: 10,
                        boxShadow: 'inset 0 0 5px grey',
                      }}
                    >
                      {tableList.length !== 0 &&
                        tableList
                          .filter(
                            ({
                              table_name: tablename,
                              kind: table_kind,
                              ...rest
                            }: any) =>
                              tablename
                                .toUpperCase()
                                .includes(searchTable.toUpperCase()) ||
                              table_kind
                                .toUpperCase()
                                .includes(searchTable.toUpperCase()),
                          )
                          .map((table: any, index: number) => (
                            <Row
                              align="middle"
                              style={{
                                marginLeft: '20px',
                                borderBottom: `2px solid ${theme.colors.quotron.gray_white}`,
                              }}
                              key={table.id.toString()}
                            >
                              <Col span={2}>
                                <Checkbox
                                  value={table.id.toString()}
                                  onChange={onChangeTableCheck}
                                />
                              </Col>
                              <Col span={2}>
                                <Avatar icon={<UserOutlined />} />
                              </Col>
                              <Col>
                                <Row>
                                  <Title level={5}>{table.table_name}</Title>
                                </Row>
                                <Row>{table.kind}</Row>
                              </Col>
                            </Row>
                          ))}
                    </Col>
                  </Col>
                </Row>
              </Col>
              <Col
                span={1}
                style={{
                  borderRight: `1px solid ${theme.colors.quotron.gray_white} `,
                }}
              ></Col>
              <Col span={8}>
                <Row>
                  <Title
                    level={5}
                    style={{ marginTop: '24px', marginLeft: 20 }}
                  >
                    Selected Tables
                  </Title>
                </Row>
                <Row>
                  <Col span={24}>
                    {shareTable.length !== 0 &&
                      shareTable.map((table: any) => (
                        <Row align="middle" style={{ marginLeft: '20px' }}>
                          <Col span={20}>
                            <Row>
                              <Title level={5}>{table.table_name}</Title>
                            </Row>
                            <Row>{table.kind}</Row>
                          </Col>
                          <Col span={4}>
                            <DeleteOutlined />
                          </Col>
                        </Row>
                      ))}
                  </Col>
                </Row>
              </Col>
            </Row>
            <Row>
              <Title level={4}>General Access</Title>
            </Row>
            <Row
              style={{ width: '100%' }}
              justify="space-between"
              align="middle"
            >
              <Col>
                <GlobalOutlined />
              </Col>
              <Col>
                <Row>
                  <Title level={5}>People With the Link</Title>
                </Row>
                <Row>anyone on the internet with the link can edit</Row>
              </Col>
              <Col>
                <Button
                  size={'large'}
                  style={{ fontSize: '20px', height: 50, borderRadius: 5 }}
                >
                  Copy Link
                </Button>
              </Col>
              <Col>
                can edit
                <DownOutlined />
              </Col>
            </Row>
            <Row justify="space-between" style={{ marginTop: '24px' }}>
              <Col>
                <Title level={5}>Invites will be shared by email</Title>
              </Col>
              <Col>
                <Button
                  size={'large'}
                  style={{
                    background: theme.colors.quotron.black,
                    borderRadius: 10,
                    fontSize: 20,
                    color: 'white',
                    height: 50,
                  }}
                >
                  {'Share access->'}
                </Button>
              </Col>
            </Row>
          </Col>
        ) : (
          <Col>
            <br />
            <Row>
              <Title level={3}>Share Tables</Title>
            </Row>
            <Title level={4} style={{ marginTop: '24px' }}>
              Select Tables
            </Title>
            <Row>
              <Col
                style={{
                  background: theme.colors.quotron.gray_white,
                  color: theme.colors.quotron.black,
                  width: '100%',
                  height: '150px',
                  border: '1px solid black',
                  borderRadius: 10,
                  overflow: 'auto',
                }}
              >
                {shareTable.length !== 0 ? (
                  <Row justify="center">
                    <Space align="center">
                      {shareTable.map((table: any) => (
                        <Button
                          style={{ margin: '10px 0 0 5px' }}
                          shape="round"
                          type="default"
                        >
                          {table.table_name}
                        </Button>
                      ))}
                    </Space>
                  </Row>
                ) : (
                  <Row style={{ marginTop: '30px' }} justify="center">
                    Select Tables To Get Started
                  </Row>
                )}
                <Row justify="center">
                  <Title level={5}>
                    <Button type="link" onClick={handleSelectTable}>
                      <Title level={5}>Select Table</Title>
                    </Button>
                  </Title>
                </Row>
              </Col>
            </Row>
            <Title level={4} style={{ marginTop: '24px' }}>
              Select People
            </Title>

            <Row>
              <Col
                style={{
                  background: theme.colors.quotron.gray_white,
                  color: theme.colors.quotron.black,
                  width: '100%',
                  height: '150px',
                  border: '1px solid black',
                  borderRadius: 10,
                  overflow: 'auto',
                }}
              >
                {sharePeople.length !== 0 ? (
                  <Row justify="center">
                    <Space align="center">
                      {sharePeople.map((people: any) => (
                        <Button
                          style={{ margin: '15px 0 0 15px' }}
                          shape="round"
                          type="default"
                        >
                          {people.username}
                        </Button>
                      ))}
                    </Space>
                  </Row>
                ) : (
                  <Row justify="center" style={{ marginTop: '30px' }}>
                    Select people to get started
                  </Row>
                )}
                <Row justify="center">
                  <Button type="link" onClick={handleSelectPeople}>
                    <Title level={5}>Select People</Title>
                  </Button>
                </Row>
              </Col>
            </Row>
          </Col>
        )}
        {/* </Modal> */}
      </Drawer>
    </Row>
  );
};

export default HeaderPage;
