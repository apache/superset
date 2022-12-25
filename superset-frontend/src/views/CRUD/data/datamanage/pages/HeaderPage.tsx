import React from 'react';
import { Row, Col, Typography, Button } from 'antd';
import { ShareAltOutlined, SettingOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

const HeaderPage = () => {
	return(
		<Row>
			<Col span="12">
				<Title>Data Management</Title>
			</Col>
			<Col span="12" style={{display: "inline-block"}}>
				<Row style={{float: "right"}}>
				<Button type="primary" icon={<ShareAltOutlined />} size={'large'} style={{marginRight: "8px", background: "#fafafa", color: "black"}}/>
				<Button type="primary" icon={<SettingOutlined />} size={'large'} style={{marginRight: "8px", background: "#fafafa", color: "black"}}>
		            Manage Data
		        </Button>
		        <Button type="primary" icon={<DownloadOutlined />} size={'large'} style={{background: "black", color: "#fafafa"}}>
		            Import Data
		        </Button>
		        </Row>
			</Col>
		</Row>
	)
}

export default HeaderPage;