describe 'NVD3', ->
  describe 'Sankey Chart', ->
    sampleData1 =
      nodes:
        [
          {'node': 1, 'name': 'Test 1'}
          {'node': 2, 'name': 'Test 2'}
          {'node': 3, 'name': 'Test 3'}
          {'node': 4, 'name': 'Test 4'}
          {'node': 5, 'name': 'Test 5'}
          {'node': 6, 'name': 'Test 6'}
        ]
      links:
        [
          {'source': 0, 'target': 1, 'value': 2295}
          {'source': 0, 'target': 5, 'value': 1199}
          {'source': 1, 'target': 2, 'value': 1119}
          {'source': 1, 'target': 5, 'value': 1176}
          {'source': 2, 'target': 3, 'value': 487}
          {'source': 2, 'target': 5, 'value': 632}
          {'source': 3, 'target': 4, 'value': 301}
          {'source': 3, 'target': 5, 'value': 186}
        ]


    options =
      margin:
        top: 30
        right: 20
        bottom: 50
        left: 75
      width: 200
      height: 200
      units: 'test'
      format: ->
      linkTitle: -> 'link title test'
      nodeWidth: 77
      nodePadding: 10
      nodeStyle:
        nodeFillColor: -> '#f00'
        nodeStrokeColor: -> '#00f'
        nodeTitle: -> 'testing the title'

    builder = null
    beforeEach ->
      builder = new ChartBuilder nv.models.sankeyChart()
      builder.build options, sampleData1

    afterEach ->
      builder.teardown()

    it 'api check', ->
      should.exist builder.model.options, 'options exposed'
      for opt of options
        should.exist builder.model[opt](), "#{opt} can be called"

    it 'renders', ->
      wrap = builder.$ 'g.nvd3.nv-sankeyChart'
      should.exist wrap[0]

    it 'has correct structure', ->
      cssClasses = [
        '.node'
        '.link'
      ]

      for cssClass in cssClasses
        do (cssClass) ->
          should.exist builder.$("g.nvd3.nv-sankeyChart #{cssClass}")[0]

    it 'renders nodes', ->
      nodes = builder.$("g.nvd3.nv-sankeyChart .node")
      nodes.should.have.length 6

    it 'nodes has the right width', ->
      should.exist builder.$("g.nvd3.nv-sankeyChart .node rect[width]")[0]
      builder.$("g.nvd3.nv-sankeyChart .node rect[width]")[0].width.animVal.value.should.equal 77

    it 'renders links', ->
      links = builder.$("g.nvd3.nv-sankeyChart .link")
      links.should.have.length 8

    it 'link titles has the test text', ->
      link = builder.$("g.nvd3.nv-sankeyChart .link title")
      link[0].textContent.should.equal 'link title test'
