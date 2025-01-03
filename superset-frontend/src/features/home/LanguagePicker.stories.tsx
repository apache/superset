import { MainNav as Menu } from 'src/components/Menu'; // Ensure correct import path
import LanguagePicker from './LanguagePicker'; // Ensure correct import path

export default {
  title: 'Components/LanguagePicker',
  component: LanguagePicker,
  parameters: {
    docs: {
      description: {
        component:
          'The LanguagePicker component allows users to select a language from a dropdown.',
      },
    },
  },
};

const mockedProps = {
  locale: 'en',
  languages: {
    en: {
      flag: 'us',
      name: 'English',
      url: '/lang/en',
    },
    it: {
      flag: 'it',
      name: 'Italian',
      url: '/lang/it',
    },
  },
};

const Template = (args: any) => (
  <Menu disabledOverflow>
    <LanguagePicker {...args} />
  </Menu>
);

export const Default = Template.bind({});
Default.args = mockedProps;
