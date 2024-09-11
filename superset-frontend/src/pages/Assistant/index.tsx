import SubMenu from 'src/features/home/SubMenu';
import { AssistantHome, AssistantProps } from './AssistantHome';
import { useState } from 'react';
import { AssistantContextBuilder } from './ContextBuilder';
import { Modal } from 'antd-v5';
import { actions } from './actions';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from '@superset-ui/core';
import { Button } from 'antd';
import { BuildFilled, CloseOutlined, SettingFilled } from '@ant-design/icons';
import Settings from './Settings';


/**
 * title: string;
    suggestion: string;
    backgroundColor?: string;
 */



function Assistant(props: AssistantProps) {

  console.log("Assistant Props", props);

  // data selection state
  const [isContextBuilderOpen, setContextBuilderOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const handleContextBuilderOpen = () => {
    setContextBuilderOpen(true);
  }

  const handleContextBuilderClose = () => {
    setContextBuilderOpen(false);
  }

  const assistantContextBuilderModal = () => {
    return (
      <Modal
        width={'90vw'}
        styles={{
          body: {
            padding: 0,
            height: '90vh',
          },
          content: {
            padding: 0,
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }
        }}
        closable={false}
        footer={null}
        centered
        zIndex={1000}
        open={isContextBuilderOpen}
      >
        <div
          style={{
            height: '100%',
            width: '100%',
          }}
        >
          <Button
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '5px 10px',
              borderRadius: '5px',
            }}
            onClick={handleContextBuilderClose}
          >
            <CloseOutlined /> Close
          </Button>
          <AssistantContextBuilder
            datasources={props.data || []}
            actions={props.actions}
            onChange={(data) => {
              
            }} />
          
        </div>

      </Modal>
    )
  }

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  return (
    <>
      <SubMenu
        name="Assistant"
        buttons={[
          {
            name: (
              <>
                <BuildFilled height={'24px'} width={'24px'} /> {t('Context Builder')}
              </>
            ),
            onClick: () => {handleContextBuilderOpen() },
            buttonStyle: 'secondary'
          },
          {
            name: (
              <>
              <SettingFilled height={'24px'} width={'24px'} /> {t('Settings')}
              </>
            ),
            onClick: () => { setSettingsOpen(true) },
            buttonStyle: 'primary'
          }
        ]}
      />
      <AssistantHome {...{
        ...props,
      }} />
      {assistantContextBuilderModal()}
      <Settings isOpen={isSettingsOpen} onClose={()=>{
        setSettingsOpen(false)
      }} />
    </>
  );
}

function mapStateToProps(state: any) {
  console.log("Assistant State", state);
  const { assistant } = state;
  return {
    ...assistant
  };
}

function mapDispatchToProps(dispatch: any) {

  return {
    actions: bindActionCreators(actions, dispatch)
  };
}

export default connect(
  mapStateToProps, mapDispatchToProps
)(Assistant)