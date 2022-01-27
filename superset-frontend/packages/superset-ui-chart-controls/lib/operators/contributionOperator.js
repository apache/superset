export const contributionOperator = (formData, queryObject) => {
    if (formData.contributionMode) {
        return {
            operation: 'contribution',
            options: {
                orientation: formData.contributionMode,
            },
        };
    }
    return undefined;
};
//# sourceMappingURL=contributionOperator.js.map