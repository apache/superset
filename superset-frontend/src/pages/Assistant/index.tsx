import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { AssistantHome, AssistantProps } from './AssistantHome';
import { useState } from 'react';
import { DatasourceProps } from './ContextBuilder/Datasource';
import { AssistantContextBuilder } from './ContextBuilder';
import { Tabs } from 'antd';
import { QueryResultTable } from './PreviewBuilder';
import * as actions from './actions';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

/**
 * title: string;
    suggestion: string;
    backgroundColor?: string;
 */



function Assistant(props: AssistantProps) {

  // data selection state
  const [datasources, setDatasources] = useState<DatasourceProps[]>([]);

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  return (
    <>
      {console.log("Assistant Props", datasources)}
      <SubMenu
        name="Assistant"
      />
      {/* Tabs */}
      <Tabs tabBarStyle={{
        padding: '24px',
      }} defaultActiveKey="1" >
        <Tabs.TabPane tab={
          <span>
            &nbsp;Assistant Chat&nbsp;
          </span>
        } key="1">
          <AssistantHome {...{
            ...props,
            data: datasources
          }} />
        </Tabs.TabPane>
        <Tabs.TabPane tab={
          <span>
            &nbsp;Context Builder&nbsp;
          </span>
        } key="2">
          <AssistantContextBuilder {...props} onChange={(data) => {
            setDatasources(data);
          }} />
        </Tabs.TabPane>
        <Tabs.TabPane tab={ 
          <span>
            &nbsp;Result Test&nbsp;
          </span>
         } key="3">
          <QueryResultTable />
        </Tabs.TabPane>
      </Tabs>
    </>
  );
}

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch: any) {
  
  return {
    actions: bindActionCreators(actions, dispatch)
  };
}

export default connect(
  null,mapDispatchToProps
)(withToasts(Assistant));