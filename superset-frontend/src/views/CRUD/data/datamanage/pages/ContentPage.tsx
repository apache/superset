import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Menu, Divider, Button, Input, Checkbox, Card, Rate, Avatar, Space, Drawer, Breadcrumb, Alert, Modal, Switch, Dropdown, Image  } from 'antd';
import { AppstoreOutlined, FilterOutlined, SortAscendingOutlined, UserOutlined, MoreOutlined, EyeOutlined, DeleteOutlined, EyeInvisibleOutlined, FolderOutlined, FunctionOutlined, ShareAltOutlined, FormOutlined, BarsOutlined } from '@ant-design/icons';

import { SupersetClient } from '@superset-ui/core';
import { createErrorHandler } from 'src/views/CRUD/utils';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ContentPage = () => {

  const [open, setOpen] = useState(false);
  const [btnToggle, setBtnToggle] = useState(true);
  const [tableSelectNum, setTableSelectNum] = useState([]);
  const [data, setData] = useState([]);

  const showLargeDrawer = (e : any) => {
    if(e.key == "drop_edit")
      setOpen(true);
  };
  const onClose = () => {
    setOpen(false);
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showModal = () => {
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
  }
  const handleTableSelect = (id : any) => {
    console.log("id", id);
    let tmp : any = tableSelectNum;
    if(tmp.includes(id))
      tmp = tmp.filter((item: any) => item!==id);
    else
      tmp = [...tmp, id];
    setTableSelectNum(tmp);
  }
  useEffect(()=>{
    SupersetClient.get({
      endpoint: `/api/v1/datamanage/`,
    })
    .then(
      ({ json = {} }) => {
        setData(json.result);
      },
      createErrorHandler(errMsg =>
        console.log("====Err===", errMsg)
      )
    )
    .finally(() => {
      
    });
  }, []);

  useEffect(()=>{
    setData(data);
  }, [btnToggle]);

  const menu = (
    <Menu onClick={showLargeDrawer}>
      <Menu.Item key="drop_share" icon={<ShareAltOutlined />}>Share</Menu.Item>
      <Menu.Item key="drop_edit" icon={<FormOutlined />}>Edit</Menu.Item>
      <Menu.Item key="drop_hide" icon={<EyeInvisibleOutlined />}>Hide</Menu.Item>
      <Menu.Item key="drop_delete" icon={<DeleteOutlined />}>Delete</Menu.Item>
    </Menu>
  );

  return(
    <Row gutter={48}>
      <Col span={4}>
        <Menu
          mode="inline"
          openKeys={['sub1']}
          style={{
            width: "100%",
            color: "black",
            background: "#fafafa",
            borderRadius: "12px",
            padding: "12px"
          }}
        >
          <Menu.Item key={"sub1"}>All</Menu.Item>
          <Menu.Item key={"sub2"}>My Data</Menu.Item>
          <Divider />
          <Menu.Item key={"sub3"}>Favourites</Menu.Item>
          <Menu.Item key={"sub4"}>Datasources</Menu.Item>
          <Menu.Item key={"sub5"}>Files</Menu.Item>
          <Divider />
          <Menu.Item key={"sub6"}>Shared With You</Menu.Item>
          <Menu.Item key={"sub7"}>Shared By You</Menu.Item>
          <Divider />
          <Menu.Item key={"sub8"}>Hidden</Menu.Item>
        </Menu>
      </Col>
      <Col span={20}>
        <Row>
          <Col span="12"><Title level={3}>All Tables</Title></Col>
          <Col span="12" style={{display: "inline-block"}}>
            <Space style={{float: "right"}}>
            <Button type="primary" icon={<SortAscendingOutlined />} style={{background: "none", color: "black"}}/>
            <Button type="primary" icon={<FilterOutlined />} style={{background: "none", color: "black", marginLeft: "4px"}}/>
            <Button type="primary" icon={ btnToggle ? <AppstoreOutlined /> : <BarsOutlined />} style={{background: "none", color: "black", marginLeft: "4px"}} onClick={handleToggle}/>
            </Space>
          </Col>
        </Row>
        <Row>
          <Input placeholder="Search tables" />
        </Row>
        { tableSelectNum && tableSelectNum.length ? 
          (<Row style={{background: "#fafafa", marginTop: "24px", marginBottom: "12px"}}>
            <Col span="12">
              <Title level={4}>{tableSelectNum && tableSelectNum.length} Tables Selected</Title>
            </Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<ShareAltOutlined />}/>
                <Button icon={<EyeOutlined />} />
                <Button icon={<DeleteOutlined />}/>
                <Button style={{background: "black", color: "#fafafa"}}>
                  View Tables
                </Button>
              </Space>
            </Col>
          </Row>
          ) : ""
        }
          <Row style={{marginTop: "24px", marginBottom: "18px", display: "inline-block", width: "100%"}}>
            <Col span="12"><Checkbox>DATASOURCE ONE</Checkbox></Col>
            <Col span="12" style={{float: "right"}}>Uploaded on 21 aug 22, 12:00pm IST</Col>
          </Row>
        { btnToggle == true ? 
          (data && data.map(row => {
            var description : any = row['description'];
            if(description)
              description = description.slice(0, 50) + "...";
            else
              description = "";
            return(
              <Row style={{marginBottom: "12px"}}  justify="center">
                <Card style={{width: "100%"}}>
                  <Row justify="center">
                    <Col span="1"><Checkbox onChange={() => handleTableSelect(row['id'])}/></Col>
                    <Col span="1"><Rate count={1} /></Col>
                    <Col span="18">
                      <Row><Title level={4}>{row['table_name'] }</Title></Row>
                      <Row>{description}</Row>
                    </Col>
                    <Col span="2" style={{textAlign: "center", display: "inline-block"}}>
                      <Row justify="center">
                        <Avatar.Group>
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                        </Avatar.Group>
                      </Row>
                      <Row style={{display: "inline-block"}}>Author</Row>
                    </Col>
                    <Col span="2">
                      <Dropdown
                        overlay={menu}
                        arrow
                      >
                        <Button type="primary" icon={<MoreOutlined />} style={{background: "none", color: "black"}} />
                      </Dropdown>
                    </Col>
                  </Row>
                </Card>
              </Row>
          )}))
          : 
          (<Row gutter={8}> {
            data && data.map(row => {
              var description : any = row['description'];
              if(description)
                description = description.slice(0, 40) + "...";
              else
                description = "";
              return(
                <Col span={8} style={{marginBottom: "12px"}}>
                  <Card style={{width: "100%"}}>
                    <Row justify="center" style={{width: "100%"}}>
                      <Row justify="center" style={{width: "100%"}}>
                        <img src="https://images.ctfassets.net/ykljvmtfxwdz/yJwSakG0SOXzwSWwSnx4p/d6cc1a7be234d09465bbe4e8862555f2/thumbnail_flask.png?w=1504&h=845&q=100&fm=png" style={{ width: "100%", padding: "12px"}}/>
                        <Row style={{width: "80%",position: "absolute", marginTop: "24px", marginLeft: "12px", marginRight: "12px"}}>
                          <Col span={1}><Checkbox style={{width: "36px !important;", height: "36px !important;"}}/></Col>
                          <Col span={1} offset={1}><Rate count={1} style={{width: "36px", height: "36px"}} /></Col>
                          <Col span={21} style={{display: "inline-block"}}>
                            <Dropdown
                              overlay={menu}
                              arrow
                            >
                              <Button type="primary" icon={<MoreOutlined />} style={{background: "none", color: "white", float: "right"}} />
                            </Dropdown>                
                          </Col>
                        </Row>
                      </Row>
                      
                      <Row justify="center">
                        <Title level={4}>{row['table_name'] }</Title>
                        <Text>{description}</Text>
                      </Row>
                      <Row justify="center">
                        <Avatar.Group>
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                          <Avatar icon={<UserOutlined />} />
                        </Avatar.Group>
                      </Row>
                      <br/>
                      <Row justify="center" style={{width: "100%", marginTop: "12px"}}>
                        <Button style={{background: "#fafafa", color: "black", width: "100%"}}>View</Button>
                      </Row>
                    </Row>
                  </Card>
                </Col>
              )
              
            }
          )}
          </Row>)
        }
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
            <Row><Title level={3}>Sales India</Title></Row>
          </Col>
          <Col span="12" style={{display: "inline-block"}}>
            <Space style={{float: "right"}}>
              <Button icon={<EyeOutlined />} size={'large'} />
              <Button icon={<DeleteOutlined />} size={'large'}/>
            </Space>
          </Col>
        </Row>
        <Alert
          message="Warning Text"
          description="Warning Description Warning Description Warning Description Warning Description"
          type="warning"
          style={{background: "#fafafa"}}
        />
        <Title level={4} style={{marginTop: "12px"}}>Table Name</Title>
        <Input placeholder="Sales India"/>
        <Title level={4} style={{marginTop: "12px"}}>Table Description</Title>
        <TextArea rows={4} />
        <Title level={4} style={{marginTop: "24px"}}>Columes</Title>

        <Card style={{width: "100%", marginBottom: "12px", marginTop: "12px"}}>
          <Row justify="center">
            <Col span="1"><FolderOutlined /></Col>
            <Col span="11"><Text strong>Product Cost</Text></Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<EyeInvisibleOutlined />} size={'large'} />
                <Button icon={<DeleteOutlined />} size={'large'}/>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card style={{width: "100%", marginBottom: "12px", marginTop: "12px"}}>
          <Row justify="center">
            <Col span="1"><FolderOutlined /></Col>
            <Col span="11"><Text strong>Sales Cost</Text></Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<EyeInvisibleOutlined />} size={'large'} />
                <Button icon={<DeleteOutlined />} size={'large'}/>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card style={{width: "100%", marginBottom: "12px", marginTop: "12px"}}>
          <Row justify="center">
            <Col span="1"><FolderOutlined /></Col>
            <Col span="11"><Text strong>No Of New Customers</Text></Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<EyeInvisibleOutlined />} size={'large'} />
                <Button icon={<DeleteOutlined />} size={'large'}/>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card style={{width: "100%", marginBottom: "12px", marginTop: "12px"}}>
          <Row justify="center">
            <Col span="1"><FolderOutlined /></Col>
            <Col span="11"><Text strong>CAC</Text></Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<FunctionOutlined />} size={'large'} onClick={showModal}/>
                <Button icon={<EyeInvisibleOutlined />} size={'large'} />
                <Button icon={<DeleteOutlined />} size={'large'}/>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card style={{width: "100%", marginBottom: "12px", marginTop: "12px"}}>
          <Row justify="center">
            <Col span="1"><FolderOutlined /></Col>
            <Col span="11"><Text strong>Averge</Text></Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<FunctionOutlined />} size={'large'} onClick={showModal}/>
                <Button icon={<EyeInvisibleOutlined />} size={'large'} />
                <Button icon={<DeleteOutlined />} size={'large'}/>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card style={{width: "100%", marginBottom: "12px", marginTop: "12px"}}>
          <Row justify="center">
            <Col span="1"><FolderOutlined /></Col>
            <Col span="11"><Text strong>Sum</Text></Col>
            <Col span="12" style={{display: "inline-block"}}>
              <Space style={{float: "right"}}>
                <Button icon={<FunctionOutlined />} size={'large'} onClick={showModal}/>
                <Button icon={<EyeInvisibleOutlined />} size={'large'} />
                <Button icon={<DeleteOutlined />} size={'large'}/>
              </Space>
            </Col>
          </Row>
        </Card>
       
        <Row justify="center" gutter={16}>
          <Col span="12"><Button style={{width: "100%", height: "50px"}}>Cancel</Button></Col>
          <Col span="12"><Button type="primary" style={{width: "100%", height: "50px", background: "black", color: "#fafafa"}} >Save</Button></Col>
        </Row>
      </Drawer>

      <Modal 
        visible={isModalOpen} 
        onOk={handleOk} 
        onCancel={handleCancel} 
        closable={false} 
        footer={null}>
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
          <br/>
          <Row>
            <Title level={3}>CAC</Title>
          </Row>
        <Title level={4} style={{marginTop: "24px"}}>Colume Name</Title>
        <Input placeholder="CAC"/>
        <Title level={4} style={{marginTop: "24px"}}>KPI Description</Title>
        <TextArea rows={4} />
        <Row style={{marginTop: "24px"}}>
          <Col span={12}>
            <Title level={4}>KPI</Title>
          </Col>
          <Col span={12}>
            <Switch defaultChecked style={{float: "right", background: "black"}}/>
          </Col>
        </Row>
        <TextArea rows={4} />
        <Row justify="center" gutter={16} style={{marginTop: "24px"}}>
          <Col span="12"><Button style={{width: "100%", height: "50px"}}>Cancel</Button></Col>
          <Col span="12"><Button type="primary" style={{width: "100%", height: "50px", background: "black", color: "#fafafa"}} >Save</Button></Col>
        </Row>
      </Modal>
    </Row>
  )
}

export default ContentPage;