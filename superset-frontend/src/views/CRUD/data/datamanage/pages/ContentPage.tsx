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
  notification,
  AutoComplete,
} from 'antd';
import {
  AppstoreOutlined,
  FilterOutlined,
  PlusOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
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
import { CheckboxChangeEvent } from 'antd/lib/checkbox';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DataProperties {
  changed_by: {};
  changed_by_name: string;
  changed_by_url: string;
  changed_on_delta_humanized: string;
  changed_on_utc: string;
  database: {};
  datasource_type: string;
  default_endpoint: string;
  description: string;
  explore_url: string;
  extra: string;
  id: number;
  kind: string;
  owners: [];
  schema: string;
  sql: string;
  table_name: string;
}

const {
  user: { username },
} = JSON.parse(
  document.getElementById('app')?.getAttribute('data-bootstrap') ?? '{}',
);

const ALL = 'ALL';
const SHARED_WITH_YOU = 'SHARED_WITH_YOU';
const SHARED_BY_YOU = 'SHARED_BY_YOU';

const ContentPage = () => {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState(0);
  const [owner, setOwner] = useState(ALL);
  const [datasourceOne, setDatasourceOne] = useState(false);
  const [btnToggle, setBtnToggle] = useState(true);
  const [tableSelectNum, setTableSelectNum] = useState([]);
  const [data, setData] = useState<DataProperties[]>([]);
  const [tableData, setTableData] = useState(null as any);
  const [filteredTableData, setFilteredTableData] = useState(null as any);
  const [columnData, setColumnData] = useState(null as any);
  const [selectedId, setSelectedId] = useState(0);
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [columnName, setColumnName] = useState('');
  const [columnDescription, setColumnDescription] = useState('');
  const [columnExpression, setColumnExpression] = useState('');
  const [searchtext, setSearchtext] = useState('');

  const [options, setOptions] = useState<{ value: string }[]>([]);

  useEffect(() => {
    if (!data.length) return;
    let tempData: DataProperties[] = [];
    // filter by author
    if (owner === SHARED_WITH_YOU) {
      tempData = data.filter(
        (row: any) =>
          row.owners.filter((owner: any) => owner.username === username).length,
      );
    } else if (owner === SHARED_BY_YOU) {
      tempData = data.filter(
        (row: any) =>
          !row.owners.filter((owner: any) => owner.username === username)
            .length,
      );
    } else {
      tempData = [...data];
    }
    // filter by searchtext
    if (searchtext)
      tempData = tempData.filter((row: any) =>
        row.table_name.includes(searchtext),
      );
    // sort by alphabet
    if (sort) {
      tempData = tempData.sort((a, b) =>
        sort === 1
          ? a.table_name.toUpperCase() > b.table_name.toUpperCase()
            ? 1
            : -1
          : a.table_name.toUpperCase() < b.table_name.toUpperCase()
          ? 1
          : -1,
      );
    }
    // sort by datasource one
    if (datasourceOne) {
      tempData = tempData.filter(
        (row: any) => row.database.database_name !== 'examples',
      );
    }
    // set filtered table data
    setFilteredTableData(tempData);
  }, [searchtext, data, sort, owner, datasourceOne]);

  const handleSearch = (value: string) => {
    // eslint-disable-next-line
    const optionTemp: Array<any> = [];
    tableData.columns.forEach(function (itm: any) {
      optionTemp.push({ value: itm.column_name });
    });

    setOptions(!value ? [] : optionTemp);
  };

  const handleKeyPress = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    console.log('handleKeyPress', ev);
  };

  const onSelect = (value: string) => {
    console.log('onSelect', value);
    setColumnExpression(columnExpression + value);
  };

  const handleChange = (e) => {
    setColumnExpression(e.target.value);
  };

  const handleSearchtext = (ev: React.ChangeEvent<HTMLInputElement>) => {
    setSearchtext(ev.target.value);
  };

  const handleSort = () => {
    setSort((sort + 1) % 3);
  };

  const handleOwner = (ev: any) => {
    setOwner(ev.key);
  };

  const handleDatasourceChange = (ev: CheckboxChangeEvent) => {
    setDatasourceOne(ev.target.checked);
  };
  const theme: SupersetTheme = useTheme();

  const showLargeDrawer = (e: any) => {
    if (e.key === 'drop_edit') {
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showModal = async (column: any) => {
    await setColumnData(column);
    await setColumnName(column.column_name);
    await setColumnDescription(column.description);
    await setColumnExpression(column.expression);
    setIsModalOpen(true);
  };
  const handleOk = () => {
    setIsModalOpen(false);
  };
  const handleCancel = () => {
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
  const handleTableSelect = (id: any) => {
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

  const handleColumnAdd = () => {
    const now = new Date();
    const newElement = {
      advanced_data_type: null,
      changed_on: now.toISOString(),
      column_name: 'New Column',
      created_on: now.toISOString(),
      description: null,
      expression: null,
      extra: '{"warning_markdown":null}',
      filterable: true,
      groupby: true,
      id: -1,
      is_active: null,
      is_dttm: false,
      python_date_format: null,
      type: 'TEXT',
      type_generic: 1,
      uuid: '',
      verbose_name: null,
    };
    setTableData({
      ...tableData,
      columns: [...tableData.columns, newElement],
    });
  };

  const handleColumnSave = async () => {
    await setTableData({
      ...tableData,
      columns: tableData.columns.map((column: any) =>
        column.id === columnData.id
          ? {
              ...columnData,
              column_name: columnName,
              description: columnDescription,
              expression: columnExpression,
            }
          : column,
      ),
    });

    setIsModalOpen(false);
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
          onClick={handleOwner}
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
          <Menu.Item key={ALL}>All</Menu.Item>
          <Menu.Item key="sub2">My Data</Menu.Item>
          <Divider />
          <Menu.Item key="sub3">Favourites</Menu.Item>
          <Menu.Item key="sub4">Datasources</Menu.Item>
          <Menu.Item key="sub5">Files</Menu.Item>
          <Divider />
          <Menu.Item key={SHARED_WITH_YOU}>Shared With You</Menu.Item>
          <Menu.Item key={SHARED_BY_YOU}>Shared By You</Menu.Item>
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
                icon={
                  sort === 2 ? (
                    <SortDescendingOutlined />
                  ) : (
                    <SortAscendingOutlined />
                  )
                }
                style={{
                  background: sort ? 'blue' : 'white',
                  color: sort ? 'white' : theme.colors.quotron.black,
                }}
                onClick={handleSort}
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
          <Input
            placeholder="Search tables"
            value={searchtext}
            onChange={handleSearchtext}
          />
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
            <Checkbox value={datasourceOne} onChange={handleDatasourceChange}>
              DATASOURCE ONE
            </Checkbox>
          </Col>
          <Col span="12" style={{ float: 'right' }}>
            Uploaded on 21 aug 22, 12:00pm IST
          </Col>
        </Row>
        {btnToggle === true ? (
          filteredTableData?.map((row: any) => {
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
                          {row.owners.length ? (
                            row.owners.map((owner: any) => (
                              <Avatar
                                icon={
                                  <div>{`${owner.first_name[0]}${owner.last_name[0]}`}</div>
                                }
                                style={{
                                  backgroundColor: `rgb(${owner.id % 256},${
                                    (owner.id * 2) % 256
                                  },${(owner.id * 3) % 256})`,
                                }}
                              />
                            ))
                          ) : (
                            <>
                              <Avatar icon={<UserOutlined />} />
                              <Avatar icon={<UserOutlined />} />
                              <Avatar icon={<UserOutlined />} />
                            </>
                          )}
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
            {filteredTableData?.map((row: any) => {
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
        <Row
          justify="space-between"
          align="middle"
          style={{ marginTop: '24px' }}
        >
          <Title level={4}>Columes</Title>
          <Button
            icon={<PlusOutlined />}
            size="large"
            onClick={() => handleColumnAdd()}
          />
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
                  {column.expression ? (
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
          placeholder="CAC"
          value={columnName}
          onChange={(e: any) => {
            setColumnName(e.target.value);
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
              defaultChecked
              style={{ float: 'right', background: theme.colors.quotron.black }}
            />
          </Col>
        </Row>
        <AutoComplete
          style={{ width: '100%' }}
          options={options}
          value={columnExpression}
          onSelect={onSelect}
          onSearch={handleSearch}
        >
          <TextArea
            placeholder="input here"
            className="custom"
            style={{ height: 50 }}
            onKeyPress={handleKeyPress}
            onChange={handleChange}
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
