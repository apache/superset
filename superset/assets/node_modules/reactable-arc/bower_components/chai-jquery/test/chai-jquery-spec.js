describe("jQuery assertions", function(){
  var inspect;

  chai.use(function (chai, utils) {
    inspect = utils.objDisplay;

    chai.Assertion.addMethod('fail', function (message) {
      var obj = utils.flag(this, 'object');

      new chai.Assertion(obj).is.a('function');

      try {
        obj();
      } catch (err) {
        this.assert(
            err instanceof chai.AssertionError
          , 'expected #{this} to fail, but it threw ' + inspect(err));
        this.assert(
            err.message === message
          , 'expected #{this} to fail with ' + inspect(message) + ', but got ' + inspect(err.message));
        return;
      }

      this.assert(false, 'expected #{this} to fail');
    });
  });

  describe("attr", function(){
    var subject = $('<div name="foo"></div>');

    describe("when only attribute name is provided", function(){
      it("passes when the element has the attribute", function(){
        subject.should.have.attr('name');
      });

      it("passes negated when the element does not have the attribute", function(){
        subject.should.not.have.attr('bar');
      });

      it("fails when the element does not have the attribute", function(){
        (function(){
          subject.should.have.attr('bar');
        }).should.fail("expected " + inspect(subject) + " to have a 'bar' attribute");
      });

      it("fails negated when the element has the attribute", function(){
        (function(){
          subject.should.not.have.attr('name');
        }).should.fail("expected " + inspect(subject) + " not to have a 'name' attribute");
      });
    });

    describe("when attribute name and value are provided", function(){
      it("passes when the element has the attribute with the given value", function(){
        subject.should.have.attr('name', 'foo');
      });

      it("passes negated when the element does not have the attribute", function(){
        subject.should.not.have.attr('bar', 'foo');
      });

      it("passes negated when the element has the attribute with a different value", function(){
        subject.should.not.have.attr('name', 'bar');
      });

      it("fails when the element does not have the attribute", function(){
        (function(){
          subject.should.have.attr('bar', 'foo');
        }).should.fail("expected " + inspect(subject) + " to have a 'bar' attribute");
      });

      it("fails when the element has the attribute with a different value", function(){
        (function(){
          subject.should.have.attr('name', 'bar');
        }).should.fail("expected " + inspect(subject) + " to have a 'name' attribute with the value 'bar', but the value was 'foo'")
      });

      it("fails negated when the element has the attribute with the given value", function(){
        (function(){
          subject.should.not.have.attr('name', 'foo');
        }).should.fail("expected " + inspect(subject) + " not to have a 'name' attribute with the value 'foo'")
      });
    });

    it("chains", function(){
      subject.should.have.attr('name').equal('foo');
    });
  });

  describe("data", function(){
    var subject = $('<div data-name="foo"></div>');

    describe("when only key is provided", function(){
      it("passes when the element's data has the key", function(){
        subject.should.have.data('name');
      });

      it("passes negated when the element's data does not have the key", function(){
        subject.should.not.have.data('bar');
      });

      it("fails when the element's data does not have the key", function(){
        (function(){
          subject.should.have.data('bar');
        }).should.fail("expected { name: 'foo' } to have a property 'bar'");
      });

      it("fails negated when the element's data has the key", function(){
        (function(){
          subject.should.not.have.data('name');
        }).should.fail("expected { name: 'foo' } to not have property 'name'");
      });
    });

    describe("when key and value are provided", function(){
      it("passes when the element's data has the key with the given value", function(){
        subject.should.have.data('name', 'foo');
      });

      it("passes negated when the element's data does not have the key", function(){
        subject.should.not.have.data('bar', 'foo');
      });

      it("passes negated when the element's data has the key with a different value", function(){
        subject.should.not.have.data('name', 'bar');
      });

      it("fails when the element's data does not have the key", function(){
        (function(){
          subject.should.have.data('bar', 'foo');
        }).should.fail("expected { name: 'foo' } to have a property 'bar'");
      });

      it("fails when the element's data has the key with a different value", function(){
        (function(){
          subject.should.have.data('name', 'bar');
        }).should.fail("expected { name: 'foo' } to have a property 'name' of 'bar', but got 'foo'")
      });

      it("fails negated when the element's data has the key with the given value", function(){
        (function(){
          subject.should.not.have.data('name', 'foo');
        }).should.fail("expected { name: 'foo' } to not have a property 'name' of 'foo'")
      });
    });

    it("chains", function(){
      subject.should.have.data('name').equal('foo');
    });
  });

  describe("css", function(){
    var subject = $('<div style="position:absolute;"></div>');

    describe("when only property name is provided", function(){
      it("passes when the element's css has the property", function(){
        subject.should.have.css('position');
      });

      it("passes negated when the element's css does not have the property", function(){
        subject.should.not.have.css('nonexistent');
      });

      it("fails when the element's css does not have the property", function(){
        (function(){
          subject.should.have.css('nonexistent');
        }).should.fail("expected " + inspect(subject) + " to have a 'nonexistent' CSS property");
      });

      it("fails negated when the element's css has the property", function(){
        (function(){
          subject.should.not.have.css('position');
        }).should.fail("expected " + inspect(subject) + " not to have a 'position' CSS property");
      });
    });

    describe("when property name and value are provided", function(){
      it("passes when the element's css has the property with the given value", function(){
        subject.should.have.css('position', 'absolute');
      });

      it("passes negated when the element's css does not have the given property", function(){
        subject.should.not.have.css('display', 'none');
      });

      it("passes negated when the element's css has the property with a different value", function(){
        subject.should.not.have.css('position', 'relative');
      });

      it("fails when the element's css does not have the property", function(){
        (function(){
          subject.should.have.css('nonexistent', 'none');
        }).should.fail("expected " + inspect(subject) + " to have a 'nonexistent' CSS property");
      });

      it("fails when the element's css has the property with a different value", function(){
        (function(){
          subject.should.have.css('position', 'relative');
        }).should.fail("expected " + inspect(subject) + " to have a 'position' CSS property with the value 'relative', but the value was 'absolute'")
      });

      it("fails negated when the element's css has the property with the given value", function(){
        (function(){
          subject.should.not.have.css('position', 'absolute');
        }).should.fail("expected " + inspect(subject) + " not to have a 'position' CSS property with the value 'absolute'")
      });
    });

    it("chains", function(){
      subject.should.have.css('position').equal('absolute');
    });
  });

  describe("prop", function(){
    var subject = $('<input type="checkbox" checked></input>');

    describe("when only property name is provided", function(){
      it("passes when the element has the property", function(){
        subject.should.have.prop('checked');
      });

      it("passes when the property exists by default", function(){
        subject.should.have.prop('disabled');
      });

      it("passes negated when the property does not exists by default", function(){
        subject.should.not.have.prop('selectedIndex');
      });

      it("fails negated when the element has the property", function(){
        (function(){
          subject.should.not.have.prop('checked');
        }).should.fail("expected " + inspect(subject) + " not to have a 'checked' property");
      });

      it("fails negated when the property exists by default", function(){
        (function(){
          subject.should.not.have.prop('disabled');
        }).should.fail("expected " + inspect(subject) + " not to have a 'disabled' property");
      });

      it("fails when the element does not have the property", function(){
        (function(){
          subject.should.have.prop('selectedIndex');
        }).should.fail("expected " + inspect(subject) + " to have a 'selectedIndex' property")
      });
    });

    describe("when property name and value are provided", function(){
      it("passes when the element has the property with the given value", function(){
        subject.should.have.prop('checked', true);
      });

      it("passes when the property has the given value by default", function(){
        subject.should.have.prop('disabled', false);
      });

      it("passes negated when the element has the property with a different value", function(){
        subject.should.not.have.prop('checked', false);
      });

      it("passes negated when the property has a different value by default", function(){
        subject.should.not.have.prop('disabled', true);
      });

      it("passes negated when the property does not exists by default", function(){
        subject.should.not.have.prop('selectedIndex', 0);
      });

      it("fails when the element has the property with a different value", function(){
        (function(){
          subject.should.have.prop('checked', false);
        }).should.fail("expected " + inspect(subject) + " to have a 'checked' property with the value false, but the value was true")
      });

      it("fails when the property has a different value by default", function(){
        (function(){
          subject.should.have.prop('disabled', true);
        }).should.fail("expected " + inspect(subject) + " to have a 'disabled' property with the value true, but the value was false")
      });

      it("fails when the property does not exist by default", function(){
        (function(){
          subject.should.have.prop('selectedIndex', 0);
        }).should.fail("expected " + inspect(subject) + " to have a 'selectedIndex' property");
      });

      it("fails negated when the element has the property with the given value", function(){
        (function(){
          subject.should.not.have.prop('checked', true);
        }).should.fail("expected " + inspect(subject) + " not to have a 'checked' property with the value true")
      });

      it("fails negated when the property has the given value by default", function(){
        (function(){
          subject.should.not.have.prop('disabled', false);
        }).should.fail("expected " + inspect(subject) + " not to have a 'disabled' property with the value false")
      });
    });

    it("chains", function(){
      subject.should.have.prop('checked').equal(true);
    });
  });

  describe("class", function(){
    var subject = $('<div class="foo"></div>');

    it("passes when the element has the class", function(){
      subject.should.have.class('foo');
    });

    it("passes negated when the element does not have the class", function(){
      subject.should.not.have.class('bar');
    });

    it("fails when the element does not have the class", function(){
      (function(){
        subject.should.have.class('bar');
      }).should.fail("expected " + inspect(subject) + " to have class 'bar'")
    });

    it("fails negated when the element has the class", function(){
      (function(){
        subject.should.not.have.class('foo');
      }).should.fail("expected " + inspect(subject) + " not to have class 'foo'");
    });
  });

  describe("id", function(){
    var subject = $('<div id="foo"></div>');

    it("passes when the element has the id", function(){
      subject.should.have.id('foo');
    });

    it("passes negated when the element does not have the id", function(){
      subject.should.not.have.id('bar');
    });

    it("passes negated when the element does not have an id", function(){
      $('<div></div>').should.not.have.id('bar');
    });

    it("fails when the element does not have the id", function(){
      (function(){
        subject.should.have.id('bar');
      }).should.fail("expected " + inspect(subject) + " to have id 'bar'");
    });

    it("fails negated when the element has the id", function(){
      (function(){
        subject.should.not.have.id('foo');
      }).should.fail("expected " + inspect(subject) + " not to have id 'foo'");
    });

    it("fails when the element does not have an id", function(){
      var subject = $('<div></div>');
      (function(){
        subject.should.have.id('foo');
      }).should.fail("expected " + inspect(subject) + " to have id 'foo'");
    });
  });

  describe("html", function(){
    var subject = $('<div><span>span</span></div>');

    it("passes when the HTML matches", function(){
      subject.should.have.html("<span>span</span>")
    });

    it("passes negated when the HTML doesn't match", function(){
      subject.should.not.have.html("<span>div</span>");
    });

    it("fails when the HTML doesn't match", function(){
      (function(){
        subject.should.have.html("<span>div</span>");
      }).should.fail("expected " + inspect(subject) + " to have HTML '<span>div</span>', but the HTML was '<span>span</span>'");
    });

    it("fails negated when the HTML matches", function(){
      (function(){
        subject.should.not.have.html("<span>span</span>");
      }).should.fail("expected " + inspect(subject) + " not to have HTML '<span>span</span>'");
    });
  });

  describe("text", function(){
    var subject = $('<div>foo</div>');

    it("passes when the text matches", function(){
      subject.should.have.text("foo")
    });

    it("passes negated when the text doesn't match", function(){
      subject.should.not.have.text("bar");
    });

    it("fails when the text doesn't match", function(){
      (function(){
        subject.should.have.text("bar");
      }).should.fail("expected " + inspect(subject) + " to have text 'bar', but the text was 'foo'");
    });

    it("fails negated when the text matches", function(){
      (function(){
        subject.should.not.have.text("foo");
      }).should.fail("expected " + inspect(subject) + " not to have text 'foo'");
    });
  });

  describe("value", function(){
    var subject = $('<input value="foo">');

    it("passes when the value matches", function(){
      subject.should.have.value("foo");
    });

    it("passes negated when the value doesn't match", function(){
      subject.should.not.have.value("bar");
    });

    it("fails when the value doesn't match", function(){
      (function(){
        subject.should.have.value("bar");
      }).should.fail("expected " + inspect(subject) + " to have value 'bar', but the value was 'foo'");
    });

    it("fails negated when the value matches", function(){
      (function(){
        subject.should.not.have.value("foo");
      }).should.fail("expected " + inspect(subject) + " not to have value 'foo'");
    });
  });

  describe("visible", function(){
    var visible = $('<div></div>');
    var hidden  = $('<div style="display: none;"></div>');

    beforeEach(function() {
      $(visible, hidden).appendTo('#mocha');
    });

    afterEach(function() {
      $(visible, hidden).remove();
    });

    it("passes when the element is visible", function(){
      visible.should.be.visible;
    });

    it("passes negated when the element is hidden", function(){
      hidden.should.not.be.visible;
    });

    it("fails when the element is hidden", function(){
      (function(){
        hidden.should.be.visible;
      }).should.fail("expected " + inspect(hidden) + " to be visible");
    });

    it("fails negated when element is visible", function(){
      (function(){
        visible.should.not.be.visible;
      }).should.fail("expected " + inspect(visible) + " not to be visible");
    });
  });

  describe("hidden", function(){
    var visible = $('<div></div>');
    var hidden  = $('<div style="display: none;"></div>');

    beforeEach(function() {
      $(visible, hidden).appendTo('#mocha');
    });

    afterEach(function() {
      $(visible, hidden).remove();
    });

    it("passes when the element is hidden", function(){
      hidden.should.be.hidden;
    });

    it("passes negated when the element is visible", function(){
      visible.should.not.be.hidden;
    });

    it("fails when the element is visible", function(){
      (function(){
        visible.should.be.hidden;
      }).should.fail("expected " + inspect(visible) + " to be hidden");
    });

    it("fails negated when element is hidden", function(){
      (function(){
        hidden.should.not.be.hidden;
      }).should.fail("expected " + inspect(hidden) + " not to be hidden");
    });
  });

  describe("selected", function(){
    var selected    = $('<option selected="selected"></option>');
    var unselected  = $('<option></option>');

    it("passes when the element is selected", function(){
      selected.should.be.selected;
    });

    it("passes negated when the element is not selected", function(){
      unselected.should.not.be.selected;
    });

    it("fails when the element is not selected", function(){
      (function(){
        unselected.should.be.selected;
      }).should.fail("expected " + inspect(unselected) + " to be selected");
    });

    it("fails negated when element is selected", function(){
      (function(){
        selected.should.not.be.selected;
      }).should.fail("expected " + inspect(selected) + " not to be selected");
    });
  });

  describe("checked", function(){
    var checked    = $('<input type="checkbox" checked="checked">');
    var unchecked  = $('<input>');

    it("passes when the element is checked", function(){
      checked.should.be.checked;
    });

    it("passes negated when the element is not checked", function(){
      unchecked.should.not.be.checked;
    });

    it("fails when the element is not checked", function(){
      (function(){
        unchecked.should.be.checked;
      }).should.fail("expected " + inspect(unchecked) + " to be checked");
    });

    it("fails negated when element is checked", function(){
      (function(){
        checked.should.not.be.checked;
      }).should.fail("expected " + inspect(checked) + " not to be checked");
    });
  });

  describe("enabled", function(){
    var disabled = $('<input disabled="disabled">');
    var enabled  = $('<input>');

    it("passes when the element is enabled", function(){
      enabled.should.be.enabled;
    });

    it("passes negated when the element is disabled", function(){
      disabled.should.not.be.enabled;
    });

    it("fails when the element is disabled", function(){
      (function(){
        disabled.should.be.enabled;
      }).should.fail("expected " + inspect(disabled) + " to be enabled");
    });

    it("fails negated when element is enabled", function(){
      (function(){
        enabled.should.not.be.enabled;
      }).should.fail("expected " + inspect(enabled) + " not to be enabled");
    });
  });

  describe("disabled", function(){
    var disabled = $('<input disabled="disabled">');
    var enabled  = $('<input>');

    it("passes when the element is disabled", function(){
      disabled.should.be.disabled;
    });

    it("passes negated when the element is enabled", function(){
      enabled.should.not.be.disabled;
    });

    it("fails when the element is enabled", function(){
      (function(){
        enabled.should.be.disabled;
      }).should.fail("expected " + inspect(enabled) + " to be disabled");
    });

    it("fails negated when element is disabled", function(){
      (function(){
        disabled.should.not.be.disabled;
      }).should.fail("expected " + inspect(disabled) + " not to be disabled");
    });
  });

  describe("exist", function(){
    it("preserves existing behavior on non-jQuery objects", function(){
      ({}).should.exist;
    });

    var existent, nonexistent;

    beforeEach(function(){
      existent = $('#mocha');
      nonexistent = $('#foo');
    });

    it("passes when the selection isn't empty", function(){
      existent.should.exist;
    });

    it("passes negated when the selection is empty", function(){
      nonexistent.should.not.exist;
    });

    it("fails when the selection is empty", function(){
      (function(){
        nonexistent.should.exist;
      }).should.fail("expected '#foo' to exist");
    });

    it("fails negated when the selection isn't empty", function(){
      (function(){
        existent.should.not.exist;
      }).should.fail("expected '#mocha' not to exist");
    });
  });

  describe("empty", function(){
    it("preserves existing behavior on non-jQuery objects", function(){
      ({}).should.be.empty;
    });

    var empty    = $('<div></div>');
    var nonempty = $('<div><span></span></div>');

    it("passes when the elment has no children", function(){
      empty.should.be.empty;
    });

    it("passes negated when the elment has children", function(){
      nonempty.should.not.be.empty;
    });

    it("fails when the elment has children", function(){
      (function(){
        nonempty.should.be.empty;
      }).should.fail("expected " + inspect(nonempty) + " to be empty");
    });

    it("fails negated when the elment has no children", function(){
      (function(){
        empty.should.not.be.empty;
      }).should.fail("expected " + inspect(empty) + " not to be empty");
    });
  });

  describe("match", function(){
    it("preserves existing behavior on non-jQuery objects", function(){
      ("hello").should.match(/ello/);
    });

    var subject = $('<div id="foo"></div>');

    it("passes when the selection matches the given selector", function(){
      subject.should.match('#foo');
    });

    it("passes negated when the selection does not match the given selector", function(){
      subject.should.not.match('#bar');
    });

    it("fails when the selection does not match the given selector", function(){
      (function(){
        subject.should.match('#bar');
      }).should.fail("expected " + inspect(subject) + " to match '#bar'");
    });

    it("fails negated when the selection matches the given selector", function(){
      (function(){
        subject.should.not.match("#foo");
      }).should.fail("expected " + inspect(subject) + " not to match '#foo'");
    });
  });

  describe("be", function(){
    it("preserves existing behavior on non-jQuery objects", function(){
      ("hello").should.be.equal("hello");
    });

    it("preserves length assertion on non-jQuery objects", function(){
      (['foo','bar']).should.be.of.length(2);
    });

    it("preserves existing behavior when used incorrectly", function(){
      (function(){
        (1 + 1).should.be(3);
      }).should.throw(TypeError, "is not a function");
    });

    var subject = $('<div></div>');

    it("passes when the selection matches the given selector", function(){
      subject.should.be(':empty');
    });

    it("passes negated when the selection does not match the given selector", function(){
      subject.should.not.be(':parent');
    });

    it("fails when the selection does not match the given selector", function(){
      (function(){
        subject.should.be(':parent');
      }).should.fail("expected " + inspect(subject) + " to be ':parent'");
    });

    it("fails negated when the selection matches the given selector", function(){
      (function(){
        subject.should.not.be(":empty");
      }).should.fail("expected " + inspect(subject) + " not to be ':empty'");
    });
  });

  describe("contain", function(){
    it("preserves existing behavior on non-jQuery objects", function(){
      "example text".should.contain('example');
      "foo".should.not.contain('bar');
      ({foo: 1, bar: 2}).should.contain.keys('foo');

      (function(){
        "foo".should.contain('bar');
      }).should.fail("expected 'foo' to include 'bar'");

      (function(){
        "foo".should.not.contain('bar').and.not.contain('foo');
      }).should.fail("expected 'foo' to not include 'foo'");
    });

    var subject = $('<div><span>example text</span></div>');

    it("passes when the selection contains the given text", function(){
      subject.should.contain('example');
    });

    it("passes negated when the selection does not contain the given text", function(){
      subject.should.not.contain('nonesuch');
    });

    it("fails when the selection does not contain the given text", function(){
      (function(){
        subject.should.contain('nonesuch');
      }).should.fail("expected " + inspect(subject) + " to contain 'nonesuch'");
    });

    it("fails negated when the selection contains the given text", function(){
      (function(){
        subject.should.not.contain("example");
      }).should.fail("expected " + inspect(subject) + " not to contain 'example'");
    });

    it("handles quotes", function(){
      $('<div>"quote"</div>').should.contain('"quote"');
      $("<div>'quote'</div>").should.contain("'quote'");
    });
  });

  describe("have", function(){
    it("preserves existing behavior on non-jQuery objects", function(){
      ({foo: 1, bar: 2}).should.have.property('foo');
    });

    it("preserves length assertion on non-jQuery objects", function(){
      (['foo','bar']).should.have.length(2);
    });

    var subject = $('<div><span></span></div>');

    it("passes when the selection has the given selector", function(){
      subject.should.have('span');
    });

    it("passes negated when the selection does not have the given selector", function(){
      subject.should.not.have('div');
    });

    it("fails when the selection does not have the given selector", function(){
      (function(){
        subject.should.have('div');
      }).should.fail("expected " + inspect(subject) + " to have 'div'");
    });

    it("fails negated when the selection has the given selector", function(){
      (function(){
        subject.should.not.have("span");
      }).should.fail("expected " + inspect(subject) + " not to have 'span'");
    });
  });
});
