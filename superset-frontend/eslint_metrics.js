module.exports = results => {
  const byRuleId = results.reduce(
    (map, current) => {
      current.messages.forEach(({ ruleId, line, column }) => {
        if (!map[ruleId]) {
          map[ruleId] = [];
        }

        const occurrence = `${current.filePath}:${line}:${column}`;
        map[ruleId].push(occurrence);
      });
      return map;
    }, {}
  );

  const enforcedRules = [
    "@typescript-eslint/no-non-null-assertion",
  ];

  const metricsByRule = Object.entries(byRuleId)
    .filter(([ruleId, occurrences]) => enforcedRules.includes(ruleId) )
    .map(([ruleId, occurrences]) => `
    \t{
    \t\t"rule": "${ruleId}",
    \t\t"count": ${occurrences.length},
    \t\t"files": [
    \t\t\t"${occurrences.join('",\n\t\t\t\t"')}"
    \t\t]
    \t}`)
    .join(',\n');

    return `{\n\t"metrics": [\t\t${metricsByRule}\n\t]\n}`;
};
  

// use via `eslint -f ./eslint_metrics.js`