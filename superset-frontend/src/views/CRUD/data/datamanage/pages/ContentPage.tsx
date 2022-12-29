import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Typography,
  Menu,
  Divider,
  Button,
  Input,
  Checkbox,
  Card,
  Rate,
  Avatar,
  Space,
  Drawer,
  Breadcrumb,
  Alert,
  Modal,
  Switch,
  Dropdown,
  AutoComplete,
  notification,
} from 'antd';
import {
  AppstoreOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  UserOutlined,
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  FolderOutlined,
  FunctionOutlined,
  ShareAltOutlined,
  FormOutlined,
  BarsOutlined,
} from '@ant-design/icons';

import { SupersetClient, SupersetTheme, useTheme } from '@superset-ui/core';
import { createErrorHandler } from 'src/views/CRUD/utils';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ContentPage = () => {
  const [open, setOpen] = useState(false);
  const [btnToggle, setBtnToggle] = useState(true);
  const [tableSelectNum, setTableSelectNum] = useState([]);
  const [data, setData] = useState([]);
  const [tableData, setTableData] = useState(null as any);
  const [columnData, setColumnData] = useState(null as any);
  const [selectedId, setSelectedId] = useState(0);
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [columnName, setColumnName] = useState('');
  const [columnDescription, setColumnDescription] = useState('');
  const [columnExpression, setColumnExpression] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKPIChecked, setIsKPIChecked] = useState(false);
  const [options, setOptions] = useState([] as any[]);
  const [isRequiredField, setIsRequiredField] = useState(false);

  const handleTextAreaOnChange = (ev: any) => {
    setColumnExpression(ev.target.value);
  };
  const onSelect = (value: any) => {
    console.log('onSelect', value);
  };

  const handleSearch = () => {
    options.map((option: any) => {
      option.value.toUpperCase().indexOf(columnExpression.toUpperCase()) !== -1;
    });
  };

  const theme: SupersetTheme = useTheme();

  const showLargeDrawer = (e: any) => {
    if (e.key === 'drop_edit') {
      console.log('eeeeeee', selectedId);
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${selectedId}`,
      }).then(
        async ({ json = {} }) => {
          await setTableData(json.result);
          await setTableName(json.result.table_name);
          await setTableDescription(json.result.description);

          setOpen(true);
        },
        createErrorHandler(errMsg => console.log('====Err===', errMsg)),
      );
    }
  };

  const onClose = () => {
    setOpen(false);
  };

  const initColumnData = async () => {
    await setColumnName('');
    await setColumnDescription('');
    await setColumnExpression('');
  };
  const showModal = async (column: any) => {
    await setColumnData(column);
    await setColumnName(column.column_name);
    await setColumnDescription(column.description);
    await setColumnExpression(column.expression);
    setIsModalOpen(true);
  };
  const ShowAddColumnModal = async () => {
    await initColumnData();
    await setIsKPIChecked(false);
    await tableData?.columns.map((column: any) => {
      if (column.expression) {
        setOptions([...options, { value: column.expression }]);
      }
    });
    await setColumnData({
      id: 10000,
    });
    tableData.columns = [...tableData.columns, { id: 10000 }];
    setIsModalOpen(true);
  };
  const handleOk = () => {
    setIsModalOpen(false);
  };
  const handleCancel = async () => {
    initColumnData();
    setIsModalOpen(false);
  };
  const handleToggle = () => {
    setBtnToggle(!btnToggle);
  };
  const handleRowAction = (id: any) => {
    setSelectedId(id);
  };
  const handleInputChange = (e: any) => {
    setTableName(e.target.value);
  };
  const handleSwitchOnChange = async () => {
    await setIsKPIChecked(!isKPIChecked);
    if (isKPIChecked) {
      await setColumnExpression('');
    }
  };
  const handleTableSelect = (id: any) => {
    console.log('id', id);
    let tmp: any = tableSelectNum;
    if (tmp.includes(id)) tmp = tmp.filter((item: any) => item !== id);
    else tmp = [...tmp, id];
    setTableSelectNum(tmp);
  };

  const actionTableSave = async () => {
    await SupersetClient.post({
      endpoint: '/datasource/save/',
      postPayload: {
        data: {
          ...tableData,
          type: 'table',
          table_name: tableName,
          description: tableDescription,
        },
      },
    })
      .then(async ({ json }) => {
        console.log(' ======== Success =======', json);
        notification.success({
          message: 'Success',
          description: 'Changed table name successfully',
        });
        await actionGetData();
        setOpen(false);
      })
      .catch(err => {
        console.log('====== Save error ========', err);
      });
  };

  const actionGetData = async () => {
    await SupersetClient.get({
      endpoint: `/api/v1/dataset/`,
    })
      .then(
        ({ json = {} }) => {
          setData(json.result);
        },
        createErrorHandler(errMsg => console.log('====Err===', errMsg)),
      )
      .finally(() => {});
  };

  const handleColumnSave = async () => {
    if (columnName) {
      await setTableData({
        ...tableData,
        columns: tableData.columns.map((column: any) =>
          column.id === columnData.id
            ? {
                ...columnData,
                column_name: columnName,
                description: columnDescription,
                expression: JSON.stringify(options).includes(columnExpression)
                  ? ''
                  : columnExpression,
              }
            : column,
        ),
      });

      setIsModalOpen(false);
      setIsRequiredField(false);
    } else {
      setIsRequiredField(true);
    }
  };
  const handleEditTableSave = () => {
    actionTableSave();
  };

  useEffect(() => {
    actionGetData();
  }, []);

  useEffect(() => {
    setData(data);
  }, [btnToggle]);

  const menu = (
    <Menu onClick={showLargeDrawer}>
      <Menu.Item key="drop_share" icon={<ShareAltOutlined />}>
        Share
      </Menu.Item>
      <Menu.Item key="drop_edit" icon={<FormOutlined />}>
        Edit
      </Menu.Item>
      <Menu.Item key="drop_hide" icon={<EyeInvisibleOutlined />}>
        Hide
      </Menu.Item>
      <Menu.Item key="drop_delete" icon={<DeleteOutlined />}>
        Delete
      </Menu.Item>
    </Menu>
  );

  return (
    <Row gutter={48}>
      <Col span={4}>
        <Menu
          mode="inline"
          openKeys={['sub1']}
          style={{
            width: '100%',
            color: theme.colors.quotron.black,
            background: theme.colors.quotron.gray_white,
            borderRadius: '12px',
            padding: '12px',
          }}
        >
          <Menu.Item key="sub1">All</Menu.Item>
          <Menu.Item key="sub2">My Data</Menu.Item>
          <Divider />
          <Menu.Item key="sub3">Favourites</Menu.Item>
          <Menu.Item key="sub4">Datasources</Menu.Item>
          <Menu.Item key="sub5">Files</Menu.Item>
          <Divider />
          <Menu.Item key="sub6">Shared With You</Menu.Item>
          <Menu.Item key="sub7">Shared By You</Menu.Item>
          <Divider />
          <Menu.Item key="sub8">Hidden</Menu.Item>
        </Menu>
      </Col>
      <Col span={20}>
        <Row>
          <Col span="12">
            <Title level={3}>All Tables</Title>
          </Col>
          <Col span="12" style={{ display: 'inline-block' }}>
            <Space style={{ float: 'right' }}>
              <Button
                type="primary"
                icon={<SortAscendingOutlined />}
                style={{
                  background: 'none',
                  color: theme.colors.quotron.black,
                }}
              />
              <Button
                type="primary"
                icon={<FilterOutlined />}
                style={{
                  background: 'none',
                  color: theme.colors.quotron.black,
                  marginLeft: '4px',
                }}
              />
              <Button
                type="primary"
                icon={btnToggle ? <AppstoreOutlined /> : <BarsOutlined />}
                style={{
                  background: 'none',
                  color: theme.colors.quotron.black,
                  marginLeft: '4px',
                }}
                onClick={handleToggle}
              />
            </Space>
          </Col>
        </Row>
        <Row>
          <Input placeholder="Search tables" />
        </Row>
        {tableSelectNum?.length ? (
          <Row
            style={{
              background: theme.colors.quotron.gray_white,
              marginTop: '24px',
              marginBottom: '12px',
            }}
          >
            <Col span="12">
              <Title level={4}>{tableSelectNum?.length} Tables Selected</Title>
            </Col>
            <Col span="12" style={{ display: 'inline-block' }}>
              <Space style={{ float: 'right' }}>
                <Button icon={<ShareAltOutlined />} />
                <Button icon={<EyeOutlined />} />
                <Button icon={<DeleteOutlined />} />
                <Button
                  style={{
                    background: theme.colors.quotron.black,
                    color: theme.colors.quotron.gray_white,
                  }}
                >
                  View Tables
                </Button>
              </Space>
            </Col>
          </Row>
        ) : (
          ''
        )}
        <Row
          style={{
            marginTop: '24px',
            marginBottom: '18px',
            display: 'inline-block',
            width: '100%',
          }}
        >
          <Col span="12">
            <Checkbox>DATASOURCE ONE</Checkbox>
          </Col>
          <Col span="12" style={{ float: 'right' }}>
            Uploaded on 21 aug 22, 12:00pm IST
          </Col>
        </Row>
        {btnToggle === true ? (
          data?.map((row: any) => {
            let description: any = row?.description;
            if (description) description = `${description.slice(0, 50)}...`;
            else description = '';
            return (
              <Row style={{ marginBottom: '12px' }} justify="center">
                <Card style={{ width: '100%' }}>
                  <Row justify="center">
                    <Col span="1">
                      <Checkbox onChange={() => handleTableSelect(row?.id)} />
                    </Col>
                    <Col span="1">
                      <Rate count={1} />
                    </Col>
                    <Col span="18">
                      <Row>
                        <Title level={4}>{row?.table_name}</Title>
                      </Row>
                      <Row>{description}</Row>
                    </Col>
                    <Col
                      span="2"
                      style={{ textAlign: 'center', display: 'inline-block' }}
                    >
                      <Row justify="center">
                        <Avatar.Group>
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                        </Avatar.Group>
                      </Row>
                      <Row style={{ display: 'inline-block' }}>Author</Row>
                    </Col>
                    <Col span="2">
                      <Dropdown overlay={menu} trigger={['click']} arrow>
                        <Button
                          type="primary"
                          icon={<MoreOutlined />}
                          style={{
                            background: 'none',
                            color: theme.colors.quotron.black,
                          }}
                          onClick={() => handleRowAction(row?.id)}
                        />
                      </Dropdown>
                    </Col>
                  </Row>
                </Card>
              </Row>
            );
          })
        ) : (
          <Row gutter={8}>
            {' '}
            {data?.map((row: any) => {
              let description: any = row?.description;
              if (description) description = `${description.slice(0, 40)}...`;
              else description = '';
              return (
                <Col span={8} style={{ marginBottom: '12px' }}>
                  <Card style={{ width: '100%' }}>
                    <Row justify="center" style={{ width: '100%' }}>
                      <Row justify="center" style={{ width: '100%' }}>
                        <img
                          src="https://images.ctfassets.net/ykljvmtfxwdz/yJwSakG0SOXzwSWwSnx4p/d6cc1a7be234d09465bbe4e8862555f2/thumbnail_flask.png?w=1504&h=845&q=100&fm=png"
                          style={{ width: '100%', padding: '12px' }}
                          alt=""
                        />
                        <Row
                          style={{
                            width: '80%',
                            position: 'absolute',
                            marginTop: '24px',
                            marginLeft: '12px',
                            marginRight: '12px',
                          }}
                        >
                          <Col span={1}>
                            <Checkbox
                              style={{
                                width: '36px !important;',
                                height: '36px !important;',
                              }}
                            />
                          </Col>
                          <Col span={1} offset={1}>
                            <Rate
                              count={1}
                              style={{ width: '36px', height: '36px' }}
                            />
                          </Col>
                          <Col span={21} style={{ display: 'inline-block' }}>
                            <Dropdown overlay={menu} trigger={['click']} arrow>
                              <Button
                                type="primary"
                                icon={<MoreOutlined />}
                                style={{
                                  background: 'none',
                                  color: theme.colors.quotron.white,
                                  float: 'right',
                                }}
                                onClick={() => handleRowAction(row?.id)}
                              />
                            </Dropdown>
                          </Col>
                        </Row>
                      </Row>
                      <Row justify="center">
                        <Title level={4}>{row?.table_name}</Title>
                        <Text>{description}</Text>
                      </Row>
                      <Row justify="center">
                        <Avatar.Group>
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                        </Avatar.Group>
                      </Row>
                      <br />
                      <Row
                        justify="center"
                        style={{ width: '100%', marginTop: '12px' }}
                      >
                        <Button
                          style={{
                            background: theme.colors.quotron.gray_white,
                            color: theme.colors.quotron.black,
                            width: '100%',
                          }}
                        >
                          View
                        </Button>
                      </Row>
                    </Row>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Col>
      <Drawer
        width={736}
        placement="right"
        onClose={onClose}
        visible={open}
        closable={false}
      >
        <Row>
          <Col span="12">
            <Row>
              <Breadcrumb>
                <Breadcrumb.Item>
                  <a href="">DATA MANAGEMENT</a>
                </Breadcrumb.Item>
                <Breadcrumb.Item>
                  <a href="">TABLE DETAILS</a>
                </Breadcrumb.Item>
              </Breadcrumb>
            </Row>
            <Row>
              <Title level={3}>{tableData?.table_name || ''}</Title>
            </Row>
          </Col>
          <Col span="12" style={{ display: 'inline-block' }}>
            <Space style={{ float: 'right' }}>
              <Button icon={<EyeOutlined />} size="large" />
              <Button icon={<DeleteOutlined />} size="large" />
            </Space>
          </Col>
        </Row>
        <Alert
          message="Please note that any changes made to table details would be persisted on"
          description="Quotron only, it will not affect anything orignal data source"
          type="warning"
          style={{ background: theme.colors.quotron.gray_white }}
        />
        <Title level={4} style={{ marginTop: '12px' }}>
          Table Name
        </Title>
        <Input
          placeholder="Sales India"
          value={tableName}
          onChange={handleInputChange}
        />
        <Title level={4} style={{ marginTop: '12px' }}>
          Table Description
        </Title>
        <TextArea
          rows={4}
          value={tableDescription}
          onChange={e => {
            setTableDescription(e.target.value);
          }}
        />
        <Row align="middle" style={{ marginTop: '24px' }}>
          <Col span={12}>
            <Title level={4}>Columes</Title>
          </Col>
          <Col span={12} style={{ display: 'inline-block' }}>
            <Button
              style={{ float: 'right' }}
              onClick={ShowAddColumnModal}
              type="primary"
            >
              Add Column
            </Button>
          </Col>
        </Row>
        {tableData?.columns?.map((column: any) => (
          <Card
            style={{ width: '100%', marginBottom: '12px', marginTop: '12px' }}
          >
            <Row justify="center">
              <Col span="1">
                <FolderOutlined />
              </Col>
              <Col span="11">
                <Text strong>{column.column_name}</Text>
              </Col>
              <Col span="12" style={{ display: 'inline-block' }}>
                <Space style={{ float: 'right' }}>
                  {column.expression?.length ? (
                    <Button
                      icon={<FunctionOutlined />}
                      size="large"
                      onClick={() => showModal(column)}
                    />
                  ) : (
                    ''
                  )}
                  <Button icon={<EyeInvisibleOutlined />} size="large" />
                  <Button icon={<DeleteOutlined />} size="large" />
                </Space>
              </Col>
            </Row>
          </Card>
        ))}

        <Row justify="center" gutter={16}>
          <Col span="12">
            <Button style={{ width: '100%', height: '50px' }} onClick={onClose}>
              Cancel
            </Button>
          </Col>
          <Col span="12">
            <Button
              type="primary"
              style={{
                width: '100%',
                height: '50px',
                background: theme.colors.quotron.black,
                color: theme.colors.quotron.gray_white,
              }}
              onClick={handleEditTableSave}
            >
              Save
            </Button>
          </Col>
        </Row>
      </Drawer>

      <Modal
        visible={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        closable={false}
        footer={null}
      >
        <Row>
          <Breadcrumb>
            <Breadcrumb.Item>
              <a href="">TABLE DETAILS</a>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <a href="">KPI</a>
            </Breadcrumb.Item>
          </Breadcrumb>
        </Row>
        <br />
        <Row>
          <Title level={3}>CAC</Title>
        </Row>
        <Title level={4} style={{ marginTop: '24px' }}>
          Colume Name
        </Title>
        <Input
          placeholder="This field is required."
          value={columnName}
          onChange={(e: any) => {
            setColumnName(e.target.value);
          }}
          style={{
            background: isRequiredField ? theme.colors.error.base : '',
          }}
        />
        <Title level={4} style={{ marginTop: '24px' }}>
          KPI Description
        </Title>
        <TextArea
          rows={4}
          value={columnDescription}
          onChange={(e: any) => {
            setColumnDescription(e.target.value);
          }}
        />
        <Row style={{ marginTop: '24px' }}>
          <Col span={12}>
            <Title level={4}>KPI</Title>
          </Col>
          <Col span={12}>
            <Switch
              checked={isKPIChecked}
              style={{
                float: 'right',
              }}
              onChange={handleSwitchOnChange}
            />
          </Col>
        </Row>
        <AutoComplete
          options={options}
          onSelect={onSelect}
          onSearch={handleSearch}
          style={{ width: '100%' }}
          value={columnExpression}
        >
          <TextArea
            rows={4}
            value={columnExpression}
            onChange={handleTextAreaOnChange}
            style={{ display: isKPIChecked ? 'block' : 'none', width: '100%' }}
          />
        </AutoComplete>

        <Row justify="center" gutter={16} style={{ marginTop: '24px' }}>
          <Col span="12">
            <Button
              style={{ width: '100%', height: '50px' }}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Col>
          <Col span="12">
            <Button
              type="primary"
              style={{
                width: '100%',
                height: '50px',
                background: theme.colors.quotron.black,
                color: theme.colors.quotron.gray_white,
              }}
              onClick={handleColumnSave}
            >
              Save
            </Button>
          </Col>
        </Row>
      </Modal>
    </Row>
  );
};

export default ContentPage;
