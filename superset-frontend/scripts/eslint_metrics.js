module.exports = results => {
  const byRuleId = results.reduce((map, current) => {
    current.messages.forEach(({ ruleId, line, column }) => {
      if (!map[ruleId]) {
        map[ruleId] = [];
      }

      const occurrence = `${current.filePath}:${line}:${column}`;
      map[ruleId].push(occurrence);
    });
    return map;
  }, {});

  const enforcedRules = {
    'react-prefer-function-component/react-prefer-function-component' : {
      description: "We prefer function components to class-based components",
    },
    'react/jsx-filename-extension' : {
      description: "We prefer Typescript - all JSX files should be converted to TSX",
    },
  };

  const metricsByRule = Object.entries(byRuleId)
    .filter(([ruleId, occurrences]) => enforcedRules[ruleId] || false)
    .map(
      ([ruleId, occurrences]) => `
    \t{
    \t\t"issue": "${enforcedRules[ruleId].description}",
    \t\t"eslint rule": "${ruleId}",
    \t\t"count": ${occurrences.length},
    \t\t"files": [
    \t\t\t"${occurrences.join('",\n\t\t\t\t"')}"
    \t\t]
    \t}`,
    )
    .join(',');

  return `{\n\t"metrics": [\t\t${metricsByRule}\n\t]\n}`;
};

// use via `eslint -f ./eslint_metrics.js`
