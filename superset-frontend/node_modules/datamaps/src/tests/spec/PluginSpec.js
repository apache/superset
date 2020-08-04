describe("Plugin", function() {

  var $el = $("#container1");
   
  it("should add a 'datamaps' function to $.prototype", function() {
    expect($.fn.datamap).toBeDefined();
  });

  describe("Rendering elements", function() {
    beforeEach(function() {
      $el.datamap();
    });

    afterEach(function() {
      $el.html("");
    });

    it("should insert an <svg> element into #root", function() {
      expect( $("svg").length ).toBeGreaterThan(0);
    });

    it("should have inserted a <g> tag with an ID of #states", function() {
      expect( $("g#states").length ).toBeGreaterThan(0);    
    });

    it("should have a bunch of <path> elements", function() {
      expect( $("path").length ).toBeGreaterThan(35);
    });
  });
});