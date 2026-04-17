import React, { useMemo, ChangeEvent } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';

const Container = styled.div`
  margin-bottom: ${({ theme }: any) => theme.gridUnit * 4}px;
  padding: ${({ theme }: any) => theme.gridUnit * 4}px;
  background-color: ${({ theme }: any) =>
    theme.colors?.grayscale?.light4 || '#f0f0f0'};
  border-radius: ${({ theme }: any) => theme.borderRadius || 4}px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }: any) => theme.gridUnit * 2}px;
  gap: ${({ theme }: any) => theme.gridUnit * 2}px;
`;

interface LabelColorMappingProps {
  jsonMetadata: string;
  onJsonMetadataChange: (value: string) => void;
}

// eslint-disable-next-line theme-colors/no-literal-colors
const DEFAULT_NEW_COLOR = '#000000';

const LabelColorMapping: React.FC<LabelColorMappingProps> = ({
  jsonMetadata,
  onJsonMetadataChange,
}) => {
  // Safely parse the current JSON metadata
  const metadataObj = useMemo(() => {
    try {
      return jsonMetadata ? JSON.parse(jsonMetadata) : {};
    } catch (e) {
      return {}; // Fallback if JSON is currently invalid in the AceEditor
    }
  }, [jsonMetadata]);

  const labelColors = metadataObj.label_colors || {};
  const colorEntries = Object.entries(labelColors);

  const updateLabelColors = (newLabelColors: Record<string, string>) => {
    const updatedMetadata = {
      ...metadataObj,
      label_colors: newLabelColors,
    };
    onJsonMetadataChange(JSON.stringify(updatedMetadata, null, 2));
  };

  const handleUpdate = (
    oldLabel: string,
    newLabel: string,
    newColor: string,
  ) => {
    const newColors = { ...labelColors };
    if (oldLabel !== newLabel) {
      delete newColors[oldLabel];
    }
    newColors[newLabel] = newColor;
    updateLabelColors(newColors);
  };

  const handleDelete = (label: string) => {
    const newColors = { ...labelColors };
    delete newColors[label];
    updateLabelColors(newColors);
  };

  const handleAdd = () => {
    const newColors = { ...labelColors, 'New Label': DEFAULT_NEW_COLOR };
    updateLabelColors(newColors);
  };

  return (
    <Container>
      <h4>{t('Label Colors (GUI)')}</h4>
      <p
        css={(theme: any) => ({
          marginBottom: theme.gridUnit * 4,
          fontSize: theme.typography?.sizes?.s,
        })}
      >
        {t(
          'Map specific labels to colors. This automatically updates the JSON below.',
        )}
      </p>

      {colorEntries.map(([label, color], index) => (
        <Row key={`${label}-${index}`}>
          <input
            type="text"
            value={label}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleUpdate(label, e.target.value, color as string)
            }
            placeholder={t('Label (e.g., Boys)')}
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
          <input
            type="color"
            value={color as string}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleUpdate(label, label, e.target.value)
            }
            style={{
              cursor: 'pointer',
              height: '32px',
              width: '50px',
              padding: '0',
              border: 'none',
            }}
          />
          <button
            onClick={() => handleDelete(label)}
            style={{
              padding: '4px 12px',
              cursor: 'pointer',
              backgroundColor: '#e04355',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {t('Remove')}
          </button>
        </Row>
      ))}

      <button
        onClick={handleAdd}
        style={{
          padding: '6px 16px',
          cursor: 'pointer',
          backgroundColor: '#20a7c9',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        + {t('Add Color Mapping')}
      </button>
    </Container>
  );
};

export default LabelColorMapping;
