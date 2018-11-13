import * as datasourceBuilder from './datasourceBuilder';
import build from './queryContextBuilder';
import * as queryObjectBuilder from './queryObjectBuilder';

describe('queryContextBuilder', () => {
  const formData = {
    datasource: '5__table',
    groupby: ['foo'],
  };
  const datasourceBuilderSpy = jest.spyOn(datasourceBuilder, 'default');
  const queryObjectBuilderSpy = jest.spyOn(queryObjectBuilder, 'default');

  beforeEach(() => {
    build(formData);
  });

  it('should call datasourceBuilder to build datasource', () => {
    expect(datasourceBuilderSpy).toHaveBeenCalled();
  });

  it('should call queryObjectBuilder to build queries', () => {
    expect(queryObjectBuilderSpy).toHaveBeenCalled();
  });
});
