import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { AssistantHome, AssistantProps } from './AssistantHome';
import { AssistantContextBuilder } from './ContextBuilder';



/**
 * title: string;
    suggestion: string;
    backgroundColor?: string;
 */



function Assistant(props: AssistantProps) {

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  return (
   <>
    <SubMenu
      name="Assistant"
    />
    {/* <AssistantHome {...props} /> */}
    <AssistantContextBuilder {...props} />
   </>
  );
}

export default withToasts(Assistant);