describe 'NVD3', ->
    describe 'Sunburst', ->
        sampleData1 = [{
            "name": "flare",
            "children": [
                {
                    "name": "analytics",
                    "children": [
                        {
                            "name": "cluster",
                            "children": [
                                {"name": "AgglomerativeCluster", "size": 3938},
                                {"name": "CommunityStructure", "size": 3812},
                                {"name": "HierarchicalCluster", "size": 6714},
                                {"name": "MergeEdge", "size": 743}
                            ]
                        },
                        {
                            "name": "graph",
                            "children": [
                                {"name": "BetweennessCentrality", "size": 3534},
                                {"name": "LinkDistance", "size": 5731},
                                {"name": "MaxFlowMinCut", "size": 7840},
                                {"name": "ShortestPaths", "size": 5914},
                                {"name": "SpanningTree", "size": 3416}
                            ]
                        },
                        {
                            "name": "optimization",
                            "children": [
                                {"name": "AspectRatioBanker", "size": 7074}
                            ]
                        }
                    ]
                },
                {
                    "name": "physics",
                    "children": [
                        {"name": "DragForce", "size": 1082},
                        {"name": "GravityForce", "size": 1336},
                        {"name": "IForce", "size": 319},
                        {"name": "NBodyForce", "size": 10498},
                        {"name": "Particle", "size": 2822},
                        {"name": "Simulation", "size": 9983},
                        {"name": "Spring", "size": 2213},
                        {"name": "SpringForce", "size": 1681}
                    ]
                },
                {
                    "name": "vis",
                    "children": [
                        {
                            "name": "data",
                            "children": [
                                {"name": "Data", "size": 20544},
                                {"name": "DataList", "size": 19788},
                                {"name": "DataSprite", "size": 10349},
                                {"name": "EdgeSprite", "size": 3301},
                                {"name": "NodeSprite", "size": 19382},
                                {
                                    "name": "render",
                                    "children": [
                                        {"name": "ArrowType", "size": 698},
                                        {"name": "EdgeRenderer", "size": 5569},
                                        {"name": "IRenderer", "size": 353},
                                        {"name": "ShapeRenderer", "size": 2247}
                                    ]
                                },
                                {"name": "ScaleBinding", "size": 11275},
                                {"name": "Tree", "size": 7147},
                                {"name": "TreeBuilder", "size": 9930}
                            ]
                        },
                        {
                            "name": "operator",
                            "children": [
                                {
                                    "name": "distortion",
                                    "children": [
                                        {"name": "BifocalDistortion", "size": 4461},
                                        {"name": "Distortion", "size": 6314},
                                        {"name": "FisheyeDistortion", "size": 3444}
                                    ]
                                },
                                {
                                    "name": "encoder",
                                    "children": [
                                        {"name": "ColorEncoder", "size": 3179},
                                        {"name": "Encoder", "size": 4060},
                                        {"name": "PropertyEncoder", "size": 4138},
                                        {"name": "ShapeEncoder", "size": 1690},
                                        {"name": "SizeEncoder", "size": 1830}
                                    ]
                                },
                                {
                                    "name": "filter",
                                    "children": [
                                        {"name": "FisheyeTreeFilter", "size": 5219},
                                        {"name": "GraphDistanceFilter", "size": 3165},
                                        {"name": "VisibilityFilter", "size": 3509}
                                    ]
                                },
                                {"name": "IOperator", "size": 1286},
                                {
                                    "name": "label",
                                    "children": [
                                        {"name": "Labeler", "size": 9956},
                                        {"name": "RadialLabeler", "size": 3899},
                                        {"name": "StackedAreaLabeler", "size": 3202}
                                    ]
                                },
                                {
                                    "name": "layout",
                                    "children": [
                                        {"name": "AxisLayout", "size": 6725},
                                        {"name": "BundledEdgeRouter", "size": 3727},
                                        {"name": "CircleLayout", "size": 9317},
                                        {"name": "CirclePackingLayout", "size": 12003},
                                        {"name": "DendrogramLayout", "size": 4853},
                                        {"name": "ForceDirectedLayout", "size": 8411},
                                        {"name": "IcicleTreeLayout", "size": 4864},
                                        {"name": "IndentedTreeLayout", "size": 3174},
                                        {"name": "Layout", "size": 7881},
                                        {"name": "NodeLinkTreeLayout", "size": 12870},
                                        {"name": "PieLayout", "size": 2728},
                                        {"name": "RadialTreeLayout", "size": 12348},
                                        {"name": "RandomLayout", "size": 870},
                                        {"name": "StackedAreaLayout", "size": 9121},
                                        {"name": "TreeMapLayout", "size": 9191}
                                    ]
                                },
                                {"name": "Operator", "size": 2490},
                                {"name": "OperatorList", "size": 5248},
                                {"name": "OperatorSequence", "size": 4190},
                                {"name": "OperatorSwitch", "size": 2581},
                                {"name": "SortOperator", "size": 2023}
                            ]
                        },
                        {"name": "Visualization", "size": 16540}
                    ]
                }
            ]
        }]

        options =
            margin:
                top: 30
                right: 20
                bottom: 50
                left: 75
            width: 200
            height: 200
            color: d3.scale.category20c()
            duration: 0

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.sunburst()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

        describe 'renders', ->

            wrap = null

            beforeEach ->
              wrap = builder.$ 'g.nvd3.nv-sunburst'

            it '.nv-pieChart', ->
              should.exist wrap[0]

            it 'can access margin', ->
              builder.model.margin
                top: 31
                right: 21
                bottom: 51
                left: 76

              m = builder.model.margin()
              m.should.deep.equal 
                top: 31
                right: 21
                bottom: 51
                left: 76
