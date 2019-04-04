console.warn('start spec');
describe('less.js main tests', function() {
    testLessEqualsInDocument();
    it('the global environment', function() {
        expect(window.require).toBe(undefined);
    });
});
