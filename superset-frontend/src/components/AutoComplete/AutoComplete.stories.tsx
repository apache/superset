import { useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import AutoComplete, { AntAutoCompleteProps } from './index';
import { Input } from '../Input';

export default {
  title: 'Components/AutoComplete',
  component: AutoComplete,
} as Meta;

const getRandomInt = (max: number, min = 0) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const searchResult = (query: string) =>
  Array.from({ length: getRandomInt(5) }).map((_, idx) => {
    const category = `${query}${idx}`;
    return {
      value: category,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Found {query} on{' '}
            <a
              href={`https://github.com/apache/superset?q=${query}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {category}
            </a>
          </span>
          <span>{getRandomInt(200, 100)} results</span>
        </div>
      ),
    };
  });

const Template: StoryFn<AntAutoCompleteProps> = args => {
  const [options, setOptions] = useState<AntAutoCompleteProps['options']>([]);

  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };

  return <AutoComplete {...args} options={options} onSearch={handleSearch} />;
};

export const Default = Template.bind({});
Default.args = {
  style: { width: 300 },
  placeholder: 'Type to search...',
};

export const WithInputSearch = () => {
  const [options, setOptions] = useState<AntAutoCompleteProps['options']>([]);

  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };

  return (
    <AutoComplete
      popupMatchSelectWidth={252}
      style={{ width: 300 }}
      options={options}
      onSearch={handleSearch}
    >
      <Input.Search size="large" placeholder="input here" enterButton />
    </AutoComplete>
  );
};

export const Disabled = Template.bind({});
Disabled.args = {
  style: { width: 300 },
  placeholder: 'Disabled AutoComplete',
  disabled: true,
};

export const CustomRender = () => {
  const [options, setOptions] = useState<AntAutoCompleteProps['options']>([]);

  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };

  return (
    <AutoComplete
      style={{ width: 300 }}
      options={options}
      onSearch={handleSearch}
    >
      <Input placeholder="Custom Render" />
    </AutoComplete>
  );
};
