// DODO was here
import { MainNav as Menu } from 'src/components/Menu';
import { styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';

const { SubMenu } = Menu;

export interface Languages {
  [key: string]: {
    flag: string;
    url: string;
    name: string;
  };
}

interface LanguagePickerProps {
  locale: string;
  languages: Languages;
}

const StyledLabel = styled.div`
  display: flex;
  align-items: center;

  & i {
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
  }

  & a {
    display: block;
    width: 150px;
    word-wrap: break-word;
    text-decoration: none;
  }
`;

const StyledFlag = styled.i`
  margin-top: 2px;
`;

export default function LanguagePicker(props: LanguagePickerProps) {
  const { locale, languages, ...rest } = props;
  // DODO added 44120742
  const hardcodedRuEnUrl = Object.fromEntries(
    Object.entries(languages).map(([key, value]) => {
      if (key === 'en') {
        return [key, { ...value, url: '/api/v1/me/change/lang/en' }];
      }
      if (key === 'ru') {
        return [key, { ...value, url: '/api/v1/me/change/lang/ru' }];
      }
      return [key, value];
    }),
  );
  return (
    <SubMenu
      aria-label="Languages"
      title={
        <div className="f16">
          <StyledFlag className={`flag ${languages[locale].flag}`} />
        </div>
      }
      icon={<Icons.TriangleDown />}
      {...rest}
    >
      {Object.keys(languages).map(langKey => (
        <Menu.Item
          key={langKey}
          style={{ whiteSpace: 'normal', height: 'auto' }}
        >
          <StyledLabel className="f16">
            <i className={`flag ${languages[langKey].flag}`} />
            {/* <a href={languages[langKey].url}>{languages[langKey].name}</a> */}
            {/* DODO changed 44120742 */}
            <a href={hardcodedRuEnUrl[langKey].url}>
              {languages[langKey].name}
            </a>
          </StyledLabel>
        </Menu.Item>
      ))}
    </SubMenu>
  );
}
