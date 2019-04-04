describe("jQuery.fn.inspect", function(){
  it("returns the outer HTML of the first matched element", function(){
    $('<div class="foo"></div>').inspect().should.equal('<div class="foo"></div>');
  });

  it("respects depth", function(){
    $('<div class="foo"><one><two><three></three></two><two>Three</two></one></div>').inspect(2)
      .should.equal('<div class="foo"><one><two>...</two><two>...</two></one></div>');
  });
});
