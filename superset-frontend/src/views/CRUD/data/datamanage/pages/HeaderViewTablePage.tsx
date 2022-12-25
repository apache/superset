import React from 'react';
import { Row, Col, Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Text } = Typography;

const HeaderViewTablePage = () => {
	return(
		<Row >
			<Col style={{marginRight: "12px"}}>
		  		<Button icon={<ArrowLeftOutlined />} style={{background: "none", color: "black"}}/>
			</Col>
			<Col >
				<Text strong style={{fontSize: "36px"}}>View Table</Text>
			</Col>
		</Row>
	)
}

export default HeaderViewTablePage;