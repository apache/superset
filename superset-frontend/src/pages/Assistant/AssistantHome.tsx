import { Button, Card, Col, Row, Typography } from "antd";
import './AssistantHome.css';

/**
 * This is the main page for the Assistant: Superset. This page will be the first page that the user sees when they open the Assistant.
 * @param props 
 * @returns 
 */

const { Title } = Typography;

function AssistantHome(props: any) {
    return (
        <div className="container">
        <Title level={2} style={{ textAlign: "center"}}>
          Welcome to the Assistant: Superset
        </Title>
        <Title level={5} style={{ textAlign: "center"}}>
          What do you want to visualize today?
        </Title>
        
      </div>
    );
};

export default AssistantHome;