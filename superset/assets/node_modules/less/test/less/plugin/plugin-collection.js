var collection = [];

functions.add('store', function(val) {
    collection.push(val);  // imma store this for later
    return false;
});
functions.add('list', function() {
    return less.value(collection);
});