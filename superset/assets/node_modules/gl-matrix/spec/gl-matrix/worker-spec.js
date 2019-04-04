/* spec tests gl-matrix when embedded into a Web Worker */

// only test with workers if workers are available
if (typeof(Worker) !== 'undefined') {
  describe("Embedded within Web Workers", function() {
    it("should initialize successfully", function() {
      let xhr = new XMLHttpRequest();
      let source = null;
      xhr.onreadystatechange = function() {
        if (this.readyState == this.DONE) {
          if (this.status == 200) {
            source = this.responseText;
          }
        }
      };
      xhr.open("GET", "/dist/gl-matrix-min.js");
      xhr.send();

      let result = null;

      waitsFor(function() {
        if (!source) return false;
        let blob = new Blob([
            source,
            "self.postMessage(vec3.create());"
          ],
          {type: "application/javascript"}
        );

        let worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = function(e) {
          result = e.data;
        };
        return true;
      });

      waitsFor(function() {
        if (!result) return false;
        expect(result).toBeEqualish([0, 0, 0]);
        return true;
      });
    });
  });
}
