module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    replace: {
      world: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.world.js',
        replacements: [{
          from: '\'__WORLD__\'',
          to: '<%= grunt.file.read("src/js/data/world.topo.json") %>'
        }]
      },
      abw: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.abw.js',
        replacements: [{
          from: '\'__ABW__\'',
          to: '<%= grunt.file.read("src/js/data/abw.topo.json") %>'
        }]
      },
      afg: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.afg.js',
        replacements: [{
          from: '\'__AFG__\'',
          to: '<%= grunt.file.read("src/js/data/afg.topo.json") %>'
        }]
      },
      ago: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ago.js',
        replacements: [{
          from: '\'__AGO__\'',
          to: '<%= grunt.file.read("src/js/data/ago.topo.json") %>'
        }]
      },
      aia: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.aia.js',
        replacements: [{
          from: '\'__AIA__\'',
          to: '<%= grunt.file.read("src/js/data/aia.topo.json") %>'
        }]
      },
      alb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.alb.js',
        replacements: [{
          from: '\'__ALB__\'',
          to: '<%= grunt.file.read("src/js/data/alb.topo.json") %>'
        }]
      },
      ald: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ald.js',
        replacements: [{
          from: '\'__ALD__\'',
          to: '<%= grunt.file.read("src/js/data/ald.topo.json") %>'
        }]
      },
      and: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.and.js',
        replacements: [{
          from: '\'__AND__\'',
          to: '<%= grunt.file.read("src/js/data/and.topo.json") %>'
        }]
      },
      are: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.are.js',
        replacements: [{
          from: '\'__ARE__\'',
          to: '<%= grunt.file.read("src/js/data/are.topo.json") %>'
        }]
      },
      arg: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.arg.js',
        replacements: [{
          from: '\'__ARG__\'',
          to: '<%= grunt.file.read("src/js/data/arg.topo.json") %>'
        }]
      },
      arm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.arm.js',
        replacements: [{
          from: '\'__ARM__\'',
          to: '<%= grunt.file.read("src/js/data/arm.topo.json") %>'
        }]
      },
      asm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.asm.js',
        replacements: [{
          from: '\'__ASM__\'',
          to: '<%= grunt.file.read("src/js/data/asm.topo.json") %>'
        }]
      },
      ata: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ata.js',
        replacements: [{
          from: '\'__ATA__\'',
          to: '<%= grunt.file.read("src/js/data/ata.topo.json") %>'
        }]
      },
      atc: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.atc.js',
        replacements: [{
          from: '\'__ATC__\'',
          to: '<%= grunt.file.read("src/js/data/atc.topo.json") %>'
        }]
      },
      atf: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.atf.js',
        replacements: [{
          from: '\'__ATF__\'',
          to: '<%= grunt.file.read("src/js/data/atf.topo.json") %>'
        }]
      },
      atg: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.atg.js',
        replacements: [{
          from: '\'__ATG__\'',
          to: '<%= grunt.file.read("src/js/data/atg.topo.json") %>'
        }]
      },
      aus: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.aus.js',
        replacements: [{
          from: '\'__AUS__\'',
          to: '<%= grunt.file.read("src/js/data/aus.topo.json") %>'
        }]
      },
      aut: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.aut.js',
        replacements: [{
          from: '\'__AUT__\'',
          to: '<%= grunt.file.read("src/js/data/aut.topo.json") %>'
        }]
      },
      aze: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.aze.js',
        replacements: [{
          from: '\'__AZE__\'',
          to: '<%= grunt.file.read("src/js/data/aze.topo.json") %>'
        }]
      },
      bdi: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bdi.js',
        replacements: [{
          from: '\'__BDI__\'',
          to: '<%= grunt.file.read("src/js/data/bdi.topo.json") %>'
        }]
      },
      bel: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bel.js',
        replacements: [{
          from: '\'__BEL__\'',
          to: '<%= grunt.file.read("src/js/data/bel.topo.json") %>'
        }]
      },
      ben: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ben.js',
        replacements: [{
          from: '\'__BEN__\'',
          to: '<%= grunt.file.read("src/js/data/ben.topo.json") %>'
        }]
      },
      bfa: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bfa.js',
        replacements: [{
          from: '\'__BFA__\'',
          to: '<%= grunt.file.read("src/js/data/bfa.topo.json") %>'
        }]
      },
      bgd: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bgd.js',
        replacements: [{
          from: '\'__BGD__\'',
          to: '<%= grunt.file.read("src/js/data/bgd.topo.json") %>'
        }]
      },
      bgr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bgr.js',
        replacements: [{
          from: '\'__BGR__\'',
          to: '<%= grunt.file.read("src/js/data/bgr.topo.json") %>'
        }]
      },
      bhr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bhr.js',
        replacements: [{
          from: '\'__BHR__\'',
          to: '<%= grunt.file.read("src/js/data/bhr.topo.json") %>'
        }]
      },
      bhs: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bhs.js',
        replacements: [{
          from: '\'__BHS__\'',
          to: '<%= grunt.file.read("src/js/data/bhs.topo.json") %>'
        }]
      },
      bih: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bih.js',
        replacements: [{
          from: '\'__BIH__\'',
          to: '<%= grunt.file.read("src/js/data/bih.topo.json") %>'
        }]
      },
      bjn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bjn.js',
        replacements: [{
          from: '\'__BJN__\'',
          to: '<%= grunt.file.read("src/js/data/bjn.topo.json") %>'
        }]
      },
      blm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.blm.js',
        replacements: [{
          from: '\'__BLM__\'',
          to: '<%= grunt.file.read("src/js/data/blm.topo.json") %>'
        }]
      },
      blr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.blr.js',
        replacements: [{
          from: '\'__BLR__\'',
          to: '<%= grunt.file.read("src/js/data/blr.topo.json") %>'
        }]
      },
      blz: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.blz.js',
        replacements: [{
          from: '\'__BLZ__\'',
          to: '<%= grunt.file.read("src/js/data/blz.topo.json") %>'
        }]
      },
      bmu: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bmu.js',
        replacements: [{
          from: '\'__BMU__\'',
          to: '<%= grunt.file.read("src/js/data/bmu.topo.json") %>'
        }]
      },
      bol: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bol.js',
        replacements: [{
          from: '\'__BOL__\'',
          to: '<%= grunt.file.read("src/js/data/bol.topo.json") %>'
        }]
      },
      bra: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bra.js',
        replacements: [{
          from: '\'__BRA__\'',
          to: '<%= grunt.file.read("src/js/data/bra.topo.json") %>'
        }]
      },
      brb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.brb.js',
        replacements: [{
          from: '\'__BRB__\'',
          to: '<%= grunt.file.read("src/js/data/brb.topo.json") %>'
        }]
      },
      brn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.brn.js',
        replacements: [{
          from: '\'__BRN__\'',
          to: '<%= grunt.file.read("src/js/data/brn.topo.json") %>'
        }]
      },
      btn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.btn.js',
        replacements: [{
          from: '\'__BTN__\'',
          to: '<%= grunt.file.read("src/js/data/btn.topo.json") %>'
        }]
      },
      nor: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nor.js',
        replacements: [{
          from: '\'__NOR__\'',
          to: '<%= grunt.file.read("src/js/data/nor.topo.json") %>'
        }]
      },
      bwa: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.bwa.js',
        replacements: [{
          from: '\'__BWA__\'',
          to: '<%= grunt.file.read("src/js/data/bwa.topo.json") %>'
        }]
      },
      caf: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.caf.js',
        replacements: [{
          from: '\'__CAF__\'',
          to: '<%= grunt.file.read("src/js/data/caf.topo.json") %>'
        }]
      },
      can: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.can.js',
        replacements: [{
          from: '\'__CAN__\'',
          to: '<%= grunt.file.read("src/js/data/can.topo.json") %>'
        }]
      },
      che: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.che.js',
        replacements: [{
          from: '\'__CHE__\'',
          to: '<%= grunt.file.read("src/js/data/che.topo.json") %>'
        }]
      },
      chl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.chl.js',
        replacements: [{
          from: '\'__CHL__\'',
          to: '<%= grunt.file.read("src/js/data/chl.topo.json") %>'
        }]
      },
      chn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.chn.js',
        replacements: [{
          from: '\'__CHN__\'',
          to: '<%= grunt.file.read("src/js/data/chn.topo.json") %>'
        }]
      },
      civ: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.civ.js',
        replacements: [{
          from: '\'__CIV__\'',
          to: '<%= grunt.file.read("src/js/data/civ.topo.json") %>'
        }]
      },
      clp: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.clp.js',
        replacements: [{
          from: '\'__CLP__\'',
          to: '<%= grunt.file.read("src/js/data/clp.topo.json") %>'
        }]
      },
      cmr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cmr.js',
        replacements: [{
          from: '\'__CMR__\'',
          to: '<%= grunt.file.read("src/js/data/cmr.topo.json") %>'
        }]
      },
      cod: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cod.js',
        replacements: [{
          from: '\'__COD__\'',
          to: '<%= grunt.file.read("src/js/data/cod.topo.json") %>'
        }]
      },
      cog: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cog.js',
        replacements: [{
          from: '\'__COG__\'',
          to: '<%= grunt.file.read("src/js/data/cog.topo.json") %>'
        }]
      },
      cok: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cok.js',
        replacements: [{
          from: '\'__COK__\'',
          to: '<%= grunt.file.read("src/js/data/cok.topo.json") %>'
        }]
      },
      col: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.col.js',
        replacements: [{
          from: '\'__COL__\'',
          to: '<%= grunt.file.read("src/js/data/col.topo.json") %>'
        }]
      },
      com: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.com.js',
        replacements: [{
          from: '\'__COM__\'',
          to: '<%= grunt.file.read("src/js/data/com.topo.json") %>'
        }]
      },
      cpv: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cpv.js',
        replacements: [{
          from: '\'__CPV__\'',
          to: '<%= grunt.file.read("src/js/data/cpv.topo.json") %>'
        }]
      },
      cri: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cri.js',
        replacements: [{
          from: '\'__CRI__\'',
          to: '<%= grunt.file.read("src/js/data/cri.topo.json") %>'
        }]
      },
      csi: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.csi.js',
        replacements: [{
          from: '\'__CSI__\'',
          to: '<%= grunt.file.read("src/js/data/csi.topo.json") %>'
        }]
      },
      cub: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cub.js',
        replacements: [{
          from: '\'__CUB__\'',
          to: '<%= grunt.file.read("src/js/data/cub.topo.json") %>'
        }]
      },
      cuw: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cuw.js',
        replacements: [{
          from: '\'__CUW__\'',
          to: '<%= grunt.file.read("src/js/data/cuw.topo.json") %>'
        }]
      },
      cym: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cym.js',
        replacements: [{
          from: '\'__CYM__\'',
          to: '<%= grunt.file.read("src/js/data/cym.topo.json") %>'
        }]
      },
      cyn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cyn.js',
        replacements: [{
          from: '\'__CYN__\'',
          to: '<%= grunt.file.read("src/js/data/cyn.topo.json") %>'
        }]
      },
      cyp: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cyp.js',
        replacements: [{
          from: '\'__CYP__\'',
          to: '<%= grunt.file.read("src/js/data/cyp.topo.json") %>'
        }]
      },
      cze: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.cze.js',
        replacements: [{
          from: '\'__CZE__\'',
          to: '<%= grunt.file.read("src/js/data/cze.topo.json") %>'
        }]
      },
      deu: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.deu.js',
        replacements: [{
          from: '\'__DEU__\'',
          to: '<%= grunt.file.read("src/js/data/deu.topo.json") %>'
        }]
      },
      dji: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.dji.js',
        replacements: [{
          from: '\'__DJI__\'',
          to: '<%= grunt.file.read("src/js/data/dji.topo.json") %>'
        }]
      },
      dma: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.dma.js',
        replacements: [{
          from: '\'__DMA__\'',
          to: '<%= grunt.file.read("src/js/data/dma.topo.json") %>'
        }]
      },
      dnk: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.dnk.js',
        replacements: [{
          from: '\'__DNK__\'',
          to: '<%= grunt.file.read("src/js/data/dnk.topo.json") %>'
        }]
      },
      dom: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.dom.js',
        replacements: [{
          from: '\'__DOM__\'',
          to: '<%= grunt.file.read("src/js/data/dom.topo.json") %>'
        }]
      },
      dza: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.dza.js',
        replacements: [{
          from: '\'__DZA__\'',
          to: '<%= grunt.file.read("src/js/data/dza.topo.json") %>'
        }]
      },
      ecu: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ecu.js',
        replacements: [{
          from: '\'__ECU__\'',
          to: '<%= grunt.file.read("src/js/data/ecu.topo.json") %>'
        }]
      },
      egy: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.egy.js',
        replacements: [{
          from: '\'__EGY__\'',
          to: '<%= grunt.file.read("src/js/data/egy.topo.json") %>'
        }]
      },
      eri: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.eri.js',
        replacements: [{
          from: '\'__ERI__\'',
          to: '<%= grunt.file.read("src/js/data/eri.topo.json") %>'
        }]
      },
      esb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.esb.js',
        replacements: [{
          from: '\'__ESB__\'',
          to: '<%= grunt.file.read("src/js/data/esb.topo.json") %>'
        }]
      },
      esp: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.esp.js',
        replacements: [{
          from: '\'__ESP__\'',
          to: '<%= grunt.file.read("src/js/data/esp.topo.json") %>'
        }]
      },
      est: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.est.js',
        replacements: [{
          from: '\'__EST__\'',
          to: '<%= grunt.file.read("src/js/data/est.topo.json") %>'
        }]
      },
      eth: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.eth.js',
        replacements: [{
          from: '\'__ETH__\'',
          to: '<%= grunt.file.read("src/js/data/eth.topo.json") %>'
        }]
      },
      fin: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.fin.js',
        replacements: [{
          from: '\'__FIN__\'',
          to: '<%= grunt.file.read("src/js/data/fin.topo.json") %>'
        }]
      },
      fji: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.fji.js',
        replacements: [{
          from: '\'__FJI__\'',
          to: '<%= grunt.file.read("src/js/data/fji.topo.json") %>'
        }]
      },
      flk: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.flk.js',
        replacements: [{
          from: '\'__FLK__\'',
          to: '<%= grunt.file.read("src/js/data/flk.topo.json") %>'
        }]
      },
      fra: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.fra.js',
        replacements: [{
          from: '\'__FRA__\'',
          to: '<%= grunt.file.read("src/js/data/fra.topo.json") %>'
        }]
      },
      fro: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.fro.js',
        replacements: [{
          from: '\'__FRO__\'',
          to: '<%= grunt.file.read("src/js/data/fro.topo.json") %>'
        }]
      },
      fsm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.fsm.js',
        replacements: [{
          from: '\'__FSM__\'',
          to: '<%= grunt.file.read("src/js/data/fsm.topo.json") %>'
        }]
      },
      gab: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gab.js',
        replacements: [{
          from: '\'__GAB__\'',
          to: '<%= grunt.file.read("src/js/data/gab.topo.json") %>'
        }]
      },
      psx: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.psx.js',
        replacements: [{
          from: '\'__PSX__\'',
          to: '<%= grunt.file.read("src/js/data/psx.topo.json") %>'
        }]
      },
      gbr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gbr.js',
        replacements: [{
          from: '\'__GBR__\'',
          to: '<%= grunt.file.read("src/js/data/gbr.topo.json") %>'
        }]
      },
      geo: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.geo.js',
        replacements: [{
          from: '\'__GEO__\'',
          to: '<%= grunt.file.read("src/js/data/geo.topo.json") %>'
        }]
      },
      ggy: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ggy.js',
        replacements: [{
          from: '\'__GGY__\'',
          to: '<%= grunt.file.read("src/js/data/ggy.topo.json") %>'
        }]
      },
      gha: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gha.js',
        replacements: [{
          from: '\'__GHA__\'',
          to: '<%= grunt.file.read("src/js/data/gha.topo.json") %>'
        }]
      },
      gib: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gib.js',
        replacements: [{
          from: '\'__GIB__\'',
          to: '<%= grunt.file.read("src/js/data/gib.topo.json") %>'
        }]
      },
      gin: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gin.js',
        replacements: [{
          from: '\'__GIN__\'',
          to: '<%= grunt.file.read("src/js/data/gin.topo.json") %>'
        }]
      },
      gmb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gmb.js',
        replacements: [{
          from: '\'__GMB__\'',
          to: '<%= grunt.file.read("src/js/data/gmb.topo.json") %>'
        }]
      },
      gnb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gnb.js',
        replacements: [{
          from: '\'__GNB__\'',
          to: '<%= grunt.file.read("src/js/data/gnb.topo.json") %>'
        }]
      },
      gnq: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gnq.js',
        replacements: [{
          from: '\'__GNQ__\'',
          to: '<%= grunt.file.read("src/js/data/gnq.topo.json") %>'
        }]
      },
      grc: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.grc.js',
        replacements: [{
          from: '\'__GRC__\'',
          to: '<%= grunt.file.read("src/js/data/grc.topo.json") %>'
        }]
      },
      grd: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.grd.js',
        replacements: [{
          from: '\'__GRD__\'',
          to: '<%= grunt.file.read("src/js/data/grd.topo.json") %>'
        }]
      },
      grl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.grl.js',
        replacements: [{
          from: '\'__GRL__\'',
          to: '<%= grunt.file.read("src/js/data/grl.topo.json") %>'
        }]
      },
      gtm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gtm.js',
        replacements: [{
          from: '\'__GTM__\'',
          to: '<%= grunt.file.read("src/js/data/gtm.topo.json") %>'
        }]
      },
      gum: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.gum.js',
        replacements: [{
          from: '\'__GUM__\'',
          to: '<%= grunt.file.read("src/js/data/gum.topo.json") %>'
        }]
      },
      guy: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.guy.js',
        replacements: [{
          from: '\'__GUY__\'',
          to: '<%= grunt.file.read("src/js/data/guy.topo.json") %>'
        }]
      },
      hkg: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.hkg.js',
        replacements: [{
          from: '\'__HKG__\'',
          to: '<%= grunt.file.read("src/js/data/hkg.topo.json") %>'
        }]
      },
      hmd: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.hmd.js',
        replacements: [{
          from: '\'__HMD__\'',
          to: '<%= grunt.file.read("src/js/data/hmd.topo.json") %>'
        }]
      },
      hnd: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.hnd.js',
        replacements: [{
          from: '\'__HND__\'',
          to: '<%= grunt.file.read("src/js/data/hnd.topo.json") %>'
        }]
      },
      hrv: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.hrv.js',
        replacements: [{
          from: '\'__HRV__\'',
          to: '<%= grunt.file.read("src/js/data/hrv.topo.json") %>'
        }]
      },
      hti: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.hti.js',
        replacements: [{
          from: '\'__HTI__\'',
          to: '<%= grunt.file.read("src/js/data/hti.topo.json") %>'
        }]
      },
      hun: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.hun.js',
        replacements: [{
          from: '\'__HUN__\'',
          to: '<%= grunt.file.read("src/js/data/hun.topo.json") %>'
        }]
      },
      idn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.idn.js',
        replacements: [{
          from: '\'__IDN__\'',
          to: '<%= grunt.file.read("src/js/data/idn.topo.json") %>'
        }]
      },
      imn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.imn.js',
        replacements: [{
          from: '\'__IMN__\'',
          to: '<%= grunt.file.read("src/js/data/imn.topo.json") %>'
        }]
      },
      ind: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ind.js',
        replacements: [{
          from: '\'__IND__\'',
          to: '<%= grunt.file.read("src/js/data/ind.topo.json") %>'
        }]
      },
      ioa: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ioa.js',
        replacements: [{
          from: '\'__IOA__\'',
          to: '<%= grunt.file.read("src/js/data/ioa.topo.json") %>'
        }]
      },
      iot: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.iot.js',
        replacements: [{
          from: '\'__IOT__\'',
          to: '<%= grunt.file.read("src/js/data/iot.topo.json") %>'
        }]
      },
      irl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.irl.js',
        replacements: [{
          from: '\'__IRL__\'',
          to: '<%= grunt.file.read("src/js/data/irl.topo.json") %>'
        }]
      },
      irn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.irn.js',
        replacements: [{
          from: '\'__IRN__\'',
          to: '<%= grunt.file.read("src/js/data/irn.topo.json") %>'
        }]
      },
      irq: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.irq.js',
        replacements: [{
          from: '\'__IRQ__\'',
          to: '<%= grunt.file.read("src/js/data/irq.topo.json") %>'
        }]
      },
      isl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.isl.js',
        replacements: [{
          from: '\'__ISL__\'',
          to: '<%= grunt.file.read("src/js/data/isl.topo.json") %>'
        }]
      },
      isr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.isr.js',
        replacements: [{
          from: '\'__ISR__\'',
          to: '<%= grunt.file.read("src/js/data/isr.topo.json") %>'
        }]
      },
      ita: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ita.js',
        replacements: [{
          from: '\'__ITA__\'',
          to: '<%= grunt.file.read("src/js/data/ita.topo.json") %>'
        }]
      },
      jam: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.jam.js',
        replacements: [{
          from: '\'__JAM__\'',
          to: '<%= grunt.file.read("src/js/data/jam.topo.json") %>'
        }]
      },
      jey: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.jey.js',
        replacements: [{
          from: '\'__JEY__\'',
          to: '<%= grunt.file.read("src/js/data/jey.topo.json") %>'
        }]
      },
      jor: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.jor.js',
        replacements: [{
          from: '\'__JOR__\'',
          to: '<%= grunt.file.read("src/js/data/jor.topo.json") %>'
        }]
      },
      jpn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.jpn.js',
        replacements: [{
          from: '\'__JPN__\'',
          to: '<%= grunt.file.read("src/js/data/jpn.topo.json") %>'
        }]
      },
      kab: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kab.js',
        replacements: [{
          from: '\'__KAB__\'',
          to: '<%= grunt.file.read("src/js/data/kab.topo.json") %>'
        }]
      },
      kas: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kas.js',
        replacements: [{
          from: '\'__KAS__\'',
          to: '<%= grunt.file.read("src/js/data/kas.topo.json") %>'
        }]
      },
      kaz: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kaz.js',
        replacements: [{
          from: '\'__KAZ__\'',
          to: '<%= grunt.file.read("src/js/data/kaz.topo.json") %>'
        }]
      },
      ken: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ken.js',
        replacements: [{
          from: '\'__KEN__\'',
          to: '<%= grunt.file.read("src/js/data/ken.topo.json") %>'
        }]
      },
      kgz: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kgz.js',
        replacements: [{
          from: '\'__KGZ__\'',
          to: '<%= grunt.file.read("src/js/data/kgz.topo.json") %>'
        }]
      },
      khm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.khm.js',
        replacements: [{
          from: '\'__KHM__\'',
          to: '<%= grunt.file.read("src/js/data/khm.topo.json") %>'
        }]
      },
      kir: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kir.js',
        replacements: [{
          from: '\'__KIR__\'',
          to: '<%= grunt.file.read("src/js/data/kir.topo.json") %>'
        }]
      },
      kna: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kna.js',
        replacements: [{
          from: '\'__KNA__\'',
          to: '<%= grunt.file.read("src/js/data/kna.topo.json") %>'
        }]
      },
      kor: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kor.js',
        replacements: [{
          from: '\'__KOR__\'',
          to: '<%= grunt.file.read("src/js/data/kor.topo.json") %>'
        }]
      },
      kos: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kos.js',
        replacements: [{
          from: '\'__KOS__\'',
          to: '<%= grunt.file.read("src/js/data/kos.topo.json") %>'
        }]
      },
      kwt: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.kwt.js',
        replacements: [{
          from: '\'__KWT__\'',
          to: '<%= grunt.file.read("src/js/data/kwt.topo.json") %>'
        }]
      },
      lao: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lao.js',
        replacements: [{
          from: '\'__LAO__\'',
          to: '<%= grunt.file.read("src/js/data/lao.topo.json") %>'
        }]
      },
      lbn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lbn.js',
        replacements: [{
          from: '\'__LBN__\'',
          to: '<%= grunt.file.read("src/js/data/lbn.topo.json") %>'
        }]
      },
      lbr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lbr.js',
        replacements: [{
          from: '\'__LBR__\'',
          to: '<%= grunt.file.read("src/js/data/lbr.topo.json") %>'
        }]
      },
      lby: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lby.js',
        replacements: [{
          from: '\'__LBY__\'',
          to: '<%= grunt.file.read("src/js/data/lby.topo.json") %>'
        }]
      },
      lca: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lca.js',
        replacements: [{
          from: '\'__LCA__\'',
          to: '<%= grunt.file.read("src/js/data/lca.topo.json") %>'
        }]
      },
      lie: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lie.js',
        replacements: [{
          from: '\'__LIE__\'',
          to: '<%= grunt.file.read("src/js/data/lie.topo.json") %>'
        }]
      },
      lka: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lka.js',
        replacements: [{
          from: '\'__LKA__\'',
          to: '<%= grunt.file.read("src/js/data/lka.topo.json") %>'
        }]
      },
      lso: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lso.js',
        replacements: [{
          from: '\'__LSO__\'',
          to: '<%= grunt.file.read("src/js/data/lso.topo.json") %>'
        }]
      },
      ltu: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ltu.js',
        replacements: [{
          from: '\'__LTU__\'',
          to: '<%= grunt.file.read("src/js/data/ltu.topo.json") %>'
        }]
      },
      lux: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lux.js',
        replacements: [{
          from: '\'__LUX__\'',
          to: '<%= grunt.file.read("src/js/data/lux.topo.json") %>'
        }]
      },
      lva: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.lva.js',
        replacements: [{
          from: '\'__LVA__\'',
          to: '<%= grunt.file.read("src/js/data/lva.topo.json") %>'
        }]
      },
      mac: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mac.js',
        replacements: [{
          from: '\'__MAC__\'',
          to: '<%= grunt.file.read("src/js/data/mac.topo.json") %>'
        }]
      },
      maf: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.maf.js',
        replacements: [{
          from: '\'__MAF__\'',
          to: '<%= grunt.file.read("src/js/data/maf.topo.json") %>'
        }]
      },
      mar: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mar.js',
        replacements: [{
          from: '\'__MAR__\'',
          to: '<%= grunt.file.read("src/js/data/mar.topo.json") %>'
        }]
      },
      mco: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mco.js',
        replacements: [{
          from: '\'__MCO__\'',
          to: '<%= grunt.file.read("src/js/data/mco.topo.json") %>'
        }]
      },
      mda: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mda.js',
        replacements: [{
          from: '\'__MDA__\'',
          to: '<%= grunt.file.read("src/js/data/mda.topo.json") %>'
        }]
      },
      mdg: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mdg.js',
        replacements: [{
          from: '\'__MDG__\'',
          to: '<%= grunt.file.read("src/js/data/mdg.topo.json") %>'
        }]
      },
      mdv: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mdv.js',
        replacements: [{
          from: '\'__MDV__\'',
          to: '<%= grunt.file.read("src/js/data/mdv.topo.json") %>'
        }]
      },
      mex: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mex.js',
        replacements: [{
          from: '\'__MEX__\'',
          to: '<%= grunt.file.read("src/js/data/mex.topo.json") %>'
        }]
      },
      mhl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mhl.js',
        replacements: [{
          from: '\'__MHL__\'',
          to: '<%= grunt.file.read("src/js/data/mhl.topo.json") %>'
        }]
      },
      mkd: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mkd.js',
        replacements: [{
          from: '\'__MKD__\'',
          to: '<%= grunt.file.read("src/js/data/mkd.topo.json") %>'
        }]
      },
      mli: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mli.js',
        replacements: [{
          from: '\'__MLI__\'',
          to: '<%= grunt.file.read("src/js/data/mli.topo.json") %>'
        }]
      },
      mlt: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mlt.js',
        replacements: [{
          from: '\'__MLT__\'',
          to: '<%= grunt.file.read("src/js/data/mlt.topo.json") %>'
        }]
      },
      mmr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mmr.js',
        replacements: [{
          from: '\'__MMR__\'',
          to: '<%= grunt.file.read("src/js/data/mmr.topo.json") %>'
        }]
      },
      mne: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mne.js',
        replacements: [{
          from: '\'__MNE__\'',
          to: '<%= grunt.file.read("src/js/data/mne.topo.json") %>'
        }]
      },
      mng: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mng.js',
        replacements: [{
          from: '\'__MNG__\'',
          to: '<%= grunt.file.read("src/js/data/mng.topo.json") %>'
        }]
      },
      mnp: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mnp.js',
        replacements: [{
          from: '\'__MNP__\'',
          to: '<%= grunt.file.read("src/js/data/mnp.topo.json") %>'
        }]
      },
      moz: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.moz.js',
        replacements: [{
          from: '\'__MOZ__\'',
          to: '<%= grunt.file.read("src/js/data/moz.topo.json") %>'
        }]
      },
      mrt: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mrt.js',
        replacements: [{
          from: '\'__MRT__\'',
          to: '<%= grunt.file.read("src/js/data/mrt.topo.json") %>'
        }]
      },
      msr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.msr.js',
        replacements: [{
          from: '\'__MSR__\'',
          to: '<%= grunt.file.read("src/js/data/msr.topo.json") %>'
        }]
      },
      mus: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mus.js',
        replacements: [{
          from: '\'__MUS__\'',
          to: '<%= grunt.file.read("src/js/data/mus.topo.json") %>'
        }]
      },
      mwi: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mwi.js',
        replacements: [{
          from: '\'__MWI__\'',
          to: '<%= grunt.file.read("src/js/data/mwi.topo.json") %>'
        }]
      },
      mys: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.mys.js',
        replacements: [{
          from: '\'__MYS__\'',
          to: '<%= grunt.file.read("src/js/data/mys.topo.json") %>'
        }]
      },
      nam: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nam.js',
        replacements: [{
          from: '\'__NAM__\'',
          to: '<%= grunt.file.read("src/js/data/nam.topo.json") %>'
        }]
      },
      ncl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ncl.js',
        replacements: [{
          from: '\'__NCL__\'',
          to: '<%= grunt.file.read("src/js/data/ncl.topo.json") %>'
        }]
      },
      ner: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ner.js',
        replacements: [{
          from: '\'__NER__\'',
          to: '<%= grunt.file.read("src/js/data/ner.topo.json") %>'
        }]
      },
      nfk: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nfk.js',
        replacements: [{
          from: '\'__NFK__\'',
          to: '<%= grunt.file.read("src/js/data/nfk.topo.json") %>'
        }]
      },
      nga: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nga.js',
        replacements: [{
          from: '\'__NGA__\'',
          to: '<%= grunt.file.read("src/js/data/nga.topo.json") %>'
        }]
      },
      nic: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nic.js',
        replacements: [{
          from: '\'__NIC__\'',
          to: '<%= grunt.file.read("src/js/data/nic.topo.json") %>'
        }]
      },
      niu: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.niu.js',
        replacements: [{
          from: '\'__NIU__\'',
          to: '<%= grunt.file.read("src/js/data/niu.topo.json") %>'
        }]
      },
      nld: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nld.js',
        replacements: [{
          from: '\'__NLD__\'',
          to: '<%= grunt.file.read("src/js/data/nld.topo.json") %>'
        }]
      },
      npl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.npl.js',
        replacements: [{
          from: '\'__NPL__\'',
          to: '<%= grunt.file.read("src/js/data/npl.topo.json") %>'
        }]
      },
      nru: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nru.js',
        replacements: [{
          from: '\'__NRU__\'',
          to: '<%= grunt.file.read("src/js/data/nru.topo.json") %>'
        }]
      },
      nul: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nul.js',
        replacements: [{
          from: '\'__NUL__\'',
          to: '<%= grunt.file.read("src/js/data/_nul.topo.json") %>'
        }]
      },
      nzl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.nzl.js',
        replacements: [{
          from: '\'__NZL__\'',
          to: '<%= grunt.file.read("src/js/data/nzl.topo.json") %>'
        }]
      },
      omn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.omn.js',
        replacements: [{
          from: '\'__OMN__\'',
          to: '<%= grunt.file.read("src/js/data/omn.topo.json") %>'
        }]
      },
      pak: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pak.js',
        replacements: [{
          from: '\'__PAK__\'',
          to: '<%= grunt.file.read("src/js/data/pak.topo.json") %>'
        }]
      },
      pan: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pan.js',
        replacements: [{
          from: '\'__PAN__\'',
          to: '<%= grunt.file.read("src/js/data/pan.topo.json") %>'
        }]
      },
      pcn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pcn.js',
        replacements: [{
          from: '\'__PCN__\'',
          to: '<%= grunt.file.read("src/js/data/pcn.topo.json") %>'
        }]
      },
      per: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.per.js',
        replacements: [{
          from: '\'__PER__\'',
          to: '<%= grunt.file.read("src/js/data/per.topo.json") %>'
        }]
      },
      pga: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pga.js',
        replacements: [{
          from: '\'__PGA__\'',
          to: '<%= grunt.file.read("src/js/data/pga.topo.json") %>'
        }]
      },
      phl: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.phl.js',
        replacements: [{
          from: '\'__PHL__\'',
          to: '<%= grunt.file.read("src/js/data/phl.topo.json") %>'
        }]
      },
      plw: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.plw.js',
        replacements: [{
          from: '\'__PLW__\'',
          to: '<%= grunt.file.read("src/js/data/plw.topo.json") %>'
        }]
      },
      png: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.png.js',
        replacements: [{
          from: '\'__PNG__\'',
          to: '<%= grunt.file.read("src/js/data/png.topo.json") %>'
        }]
      },
      pol: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pol.js',
        replacements: [{
          from: '\'__POL__\'',
          to: '<%= grunt.file.read("src/js/data/pol.topo.json") %>'
        }]
      },
      pri: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pri.js',
        replacements: [{
          from: '\'__PRI__\'',
          to: '<%= grunt.file.read("src/js/data/pri.topo.json") %>'
        }]
      },
      prk: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.prk.js',
        replacements: [{
          from: '\'__PRK__\'',
          to: '<%= grunt.file.read("src/js/data/prk.topo.json") %>'
        }]
      },
      prt: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.prt.js',
        replacements: [{
          from: '\'__PRT__\'',
          to: '<%= grunt.file.read("src/js/data/prt.topo.json") %>'
        }]
      },
      pry: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pry.js',
        replacements: [{
          from: '\'__PRY__\'',
          to: '<%= grunt.file.read("src/js/data/pry.topo.json") %>'
        }]
      },
      pyf: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.pyf.js',
        replacements: [{
          from: '\'__PYF__\'',
          to: '<%= grunt.file.read("src/js/data/pyf.topo.json") %>'
        }]
      },
      qat: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.qat.js',
        replacements: [{
          from: '\'__QAT__\'',
          to: '<%= grunt.file.read("src/js/data/qat.topo.json") %>'
        }]
      },
      rou: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.rou.js',
        replacements: [{
          from: '\'__ROU__\'',
          to: '<%= grunt.file.read("src/js/data/rou.topo.json") %>'
        }]
      },
      rus: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.rus.js',
        replacements: [{
          from: '\'__RUS__\'',
          to: '<%= grunt.file.read("src/js/data/rus.topo.json") %>'
        }]
      },
      rwa: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.rwa.js',
        replacements: [{
          from: '\'__RWA__\'',
          to: '<%= grunt.file.read("src/js/data/rwa.topo.json") %>'
        }]
      },
      sah: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sah.js',
        replacements: [{
          from: '\'__SAH__\'',
          to: '<%= grunt.file.read("src/js/data/sah.topo.json") %>'
        }]
      },
      sau: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sau.js',
        replacements: [{
          from: '\'__SAU__\'',
          to: '<%= grunt.file.read("src/js/data/sau.topo.json") %>'
        }]
      },
      scr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.scr.js',
        replacements: [{
          from: '\'__SCR__\'',
          to: '<%= grunt.file.read("src/js/data/scr.topo.json") %>'
        }]
      },
      sdn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sdn.js',
        replacements: [{
          from: '\'__SDN__\'',
          to: '<%= grunt.file.read("src/js/data/sdn.topo.json") %>'
        }]
      },
      sds: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sds.js',
        replacements: [{
          from: '\'__SDS__\'',
          to: '<%= grunt.file.read("src/js/data/sds.topo.json") %>'
        }]
      },
      sen: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sen.js',
        replacements: [{
          from: '\'__SEN__\'',
          to: '<%= grunt.file.read("src/js/data/sen.topo.json") %>'
        }]
      },
      ser: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ser.js',
        replacements: [{
          from: '\'__SER__\'',
          to: '<%= grunt.file.read("src/js/data/ser.topo.json") %>'
        }]
      },
      sgp: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sgp.js',
        replacements: [{
          from: '\'__SGP__\'',
          to: '<%= grunt.file.read("src/js/data/sgp.topo.json") %>'
        }]
      },
      sgs: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sgs.js',
        replacements: [{
          from: '\'__SGS__\'',
          to: '<%= grunt.file.read("src/js/data/sgs.topo.json") %>'
        }]
      },
      shn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.shn.js',
        replacements: [{
          from: '\'__SHN__\'',
          to: '<%= grunt.file.read("src/js/data/shn.topo.json") %>'
        }]
      },
      slb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.slb.js',
        replacements: [{
          from: '\'__SLB__\'',
          to: '<%= grunt.file.read("src/js/data/slb.topo.json") %>'
        }]
      },
      sle: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sle.js',
        replacements: [{
          from: '\'__SLE__\'',
          to: '<%= grunt.file.read("src/js/data/sle.topo.json") %>'
        }]
      },
      slv: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.slv.js',
        replacements: [{
          from: '\'__SLV__\'',
          to: '<%= grunt.file.read("src/js/data/slv.topo.json") %>'
        }]
      },
      smr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.smr.js',
        replacements: [{
          from: '\'__SMR__\'',
          to: '<%= grunt.file.read("src/js/data/smr.topo.json") %>'
        }]
      },
      sol: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sol.js',
        replacements: [{
          from: '\'__SOL__\'',
          to: '<%= grunt.file.read("src/js/data/sol.topo.json") %>'
        }]
      },
      som: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.som.js',
        replacements: [{
          from: '\'__SOM__\'',
          to: '<%= grunt.file.read("src/js/data/som.topo.json") %>'
        }]
      },
      spm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.spm.js',
        replacements: [{
          from: '\'__SPM__\'',
          to: '<%= grunt.file.read("src/js/data/spm.topo.json") %>'
        }]
      },
      srb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.srb.js',
        replacements: [{
          from: '\'__SRB__\'',
          to: '<%= grunt.file.read("src/js/data/srb.topo.json") %>'
        }]
      },
      stp: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.stp.js',
        replacements: [{
          from: '\'__STP__\'',
          to: '<%= grunt.file.read("src/js/data/stp.topo.json") %>'
        }]
      },
      sur: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sur.js',
        replacements: [{
          from: '\'__SUR__\'',
          to: '<%= grunt.file.read("src/js/data/sur.topo.json") %>'
        }]
      },
      svk: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.svk.js',
        replacements: [{
          from: '\'__SVK__\'',
          to: '<%= grunt.file.read("src/js/data/svk.topo.json") %>'
        }]
      },
      svn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.svn.js',
        replacements: [{
          from: '\'__SVN__\'',
          to: '<%= grunt.file.read("src/js/data/svn.topo.json") %>'
        }]
      },
      swe: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.swe.js',
        replacements: [{
          from: '\'__SWE__\'',
          to: '<%= grunt.file.read("src/js/data/swe.topo.json") %>'
        }]
      },
      swz: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.swz.js',
        replacements: [{
          from: '\'__SWZ__\'',
          to: '<%= grunt.file.read("src/js/data/swz.topo.json") %>'
        }]
      },
      sxm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.sxm.js',
        replacements: [{
          from: '\'__SXM__\'',
          to: '<%= grunt.file.read("src/js/data/sxm.topo.json") %>'
        }]
      },
      syc: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.syc.js',
        replacements: [{
          from: '\'__SYC__\'',
          to: '<%= grunt.file.read("src/js/data/syc.topo.json") %>'
        }]
      },
      syr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.syr.js',
        replacements: [{
          from: '\'__SYR__\'',
          to: '<%= grunt.file.read("src/js/data/syr.topo.json") %>'
        }]
      },
      tca: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tca.js',
        replacements: [{
          from: '\'__TCA__\'',
          to: '<%= grunt.file.read("src/js/data/tca.topo.json") %>'
        }]
      },
      tcd: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tcd.js',
        replacements: [{
          from: '\'__TCD__\'',
          to: '<%= grunt.file.read("src/js/data/tcd.topo.json") %>'
        }]
      },
      tgo: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tgo.js',
        replacements: [{
          from: '\'__TGO__\'',
          to: '<%= grunt.file.read("src/js/data/tgo.topo.json") %>'
        }]
      },
      tha: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tha.js',
        replacements: [{
          from: '\'__THA__\'',
          to: '<%= grunt.file.read("src/js/data/tha.topo.json") %>'
        }]
      },
      tjk: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tjk.js',
        replacements: [{
          from: '\'__TJK__\'',
          to: '<%= grunt.file.read("src/js/data/tjk.topo.json") %>'
        }]
      },
      tkm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tkm.js',
        replacements: [{
          from: '\'__TKM__\'',
          to: '<%= grunt.file.read("src/js/data/tkm.topo.json") %>'
        }]
      },
      tls: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tls.js',
        replacements: [{
          from: '\'__TLS__\'',
          to: '<%= grunt.file.read("src/js/data/tls.topo.json") %>'
        }]
      },
      ton: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ton.js',
        replacements: [{
          from: '\'__TON__\'',
          to: '<%= grunt.file.read("src/js/data/ton.topo.json") %>'
        }]
      },
      tto: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tto.js',
        replacements: [{
          from: '\'__TTO__\'',
          to: '<%= grunt.file.read("src/js/data/tto.topo.json") %>'
        }]
      },
      tun: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tun.js',
        replacements: [{
          from: '\'__TUN__\'',
          to: '<%= grunt.file.read("src/js/data/tun.topo.json") %>'
        }]
      },
      tur: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tur.js',
        replacements: [{
          from: '\'__TUR__\'',
          to: '<%= grunt.file.read("src/js/data/tur.topo.json") %>'
        }]
      },
      tuv: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tuv.js',
        replacements: [{
          from: '\'__TUV__\'',
          to: '<%= grunt.file.read("src/js/data/tuv.topo.json") %>'
        }]
      },
      twn: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.twn.js',
        replacements: [{
          from: '\'__TWN__\'',
          to: '<%= grunt.file.read("src/js/data/twn.topo.json") %>'
        }]
      },
      tza: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.tza.js',
        replacements: [{
          from: '\'__TZA__\'',
          to: '<%= grunt.file.read("src/js/data/tza.topo.json") %>'
        }]
      },
      uga: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.uga.js',
        replacements: [{
          from: '\'__UGA__\'',
          to: '<%= grunt.file.read("src/js/data/uga.topo.json") %>'
        }]
      },
      ukr: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ukr.js',
        replacements: [{
          from: '\'__UKR__\'',
          to: '<%= grunt.file.read("src/js/data/ukr.topo.json") %>'
        }]
      },
      umi: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.umi.js',
        replacements: [{
          from: '\'__UMI__\'',
          to: '<%= grunt.file.read("src/js/data/umi.topo.json") %>'
        }]
      },
      ury: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ury.js',
        replacements: [{
          from: '\'__URY__\'',
          to: '<%= grunt.file.read("src/js/data/ury.topo.json") %>'
        }]
      },
      usa: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.usa.js',
        replacements: [{
          from: '\'__USA__\'',
          to: '<%= grunt.file.read("src/js/data/usa.topo.json") %>'
        }]
      },
      usg: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.usg.js',
        replacements: [{
          from: '\'__USG__\'',
          to: '<%= grunt.file.read("src/js/data/usg.topo.json") %>'
        }]
      },
      uzb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.uzb.js',
        replacements: [{
          from: '\'__UZB__\'',
          to: '<%= grunt.file.read("src/js/data/uzb.topo.json") %>'
        }]
      },
      vat: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.vat.js',
        replacements: [{
          from: '\'__VAT__\'',
          to: '<%= grunt.file.read("src/js/data/vat.topo.json") %>'
        }]
      },
      vct: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.vct.js',
        replacements: [{
          from: '\'__VCT__\'',
          to: '<%= grunt.file.read("src/js/data/vct.topo.json") %>'
        }]
      },
      ven: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.ven.js',
        replacements: [{
          from: '\'__VEN__\'',
          to: '<%= grunt.file.read("src/js/data/ven.topo.json") %>'
        }]
      },
      vgb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.vgb.js',
        replacements: [{
          from: '\'__VGB__\'',
          to: '<%= grunt.file.read("src/js/data/vgb.topo.json") %>'
        }]
      },
      vir: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.vir.js',
        replacements: [{
          from: '\'__VIR__\'',
          to: '<%= grunt.file.read("src/js/data/vir.topo.json") %>'
        }]
      },
      vnm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.vnm.js',
        replacements: [{
          from: '\'__VNM__\'',
          to: '<%= grunt.file.read("src/js/data/vnm.topo.json") %>'
        }]
      },
      vut: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.vut.js',
        replacements: [{
          from: '\'__VUT__\'',
          to: '<%= grunt.file.read("src/js/data/vut.topo.json") %>'
        }]
      },
      wlf: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.wlf.js',
        replacements: [{
          from: '\'__WLF__\'',
          to: '<%= grunt.file.read("src/js/data/wlf.topo.json") %>'
        }]
      },
      wsb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.wsb.js',
        replacements: [{
          from: '\'__WSB__\'',
          to: '<%= grunt.file.read("src/js/data/wsb.topo.json") %>'
        }]
      },
      wsm: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.wsm.js',
        replacements: [{
          from: '\'__WSM__\'',
          to: '<%= grunt.file.read("src/js/data/wsm.topo.json") %>'
        }]
      },
      yem: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.yem.js',
        replacements: [{
          from: '\'__YEM__\'',
          to: '<%= grunt.file.read("src/js/data/yem.topo.json") %>'
        }]
      },
      zaf: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.zaf.js',
        replacements: [{
          from: '\'__ZAF__\'',
          to: '<%= grunt.file.read("src/js/data/zaf.topo.json") %>'
        }]
      },
      zmb: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.zmb.js',
        replacements: [{
          from: '\'__ZMB__\'',
          to: '<%= grunt.file.read("src/js/data/zmb.topo.json") %>'
        }]
      },
      zwe: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.zwe.js',
        replacements: [{
          from: '\'__ZWE__\'',
          to: '<%= grunt.file.read("src/js/data/zwe.topo.json") %>'
        }]
      },
      all: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.all.js',
        replacements: [{
          from: '\'__ABW__\'',
          to: '<%= grunt.file.read("src/js/data/abw.topo.json") %>'
        },
        {
          from: '\'__AFG__\'',
          to: '<%= grunt.file.read("src/js/data/afg.topo.json") %>'
        },
        {
          from: '\'__AGO__\'',
          to: '<%= grunt.file.read("src/js/data/ago.topo.json") %>'
        },
        {
          from: '\'__AIA__\'',
          to: '<%= grunt.file.read("src/js/data/aia.topo.json") %>'
        },
        {
          from: '\'__ALB__\'',
          to: '<%= grunt.file.read("src/js/data/alb.topo.json") %>'
        },
        {
          from: '\'__ALD__\'',
          to: '<%= grunt.file.read("src/js/data/ald.topo.json") %>'
        },
        {
          from: '\'__AND__\'',
          to: '<%= grunt.file.read("src/js/data/and.topo.json") %>'
        },
        {
          from: '\'__ARE__\'',
          to: '<%= grunt.file.read("src/js/data/are.topo.json") %>'
        },
        {
          from: '\'__ARG__\'',
          to: '<%= grunt.file.read("src/js/data/arg.topo.json") %>'
        },
        {
          from: '\'__ARM__\'',
          to: '<%= grunt.file.read("src/js/data/arm.topo.json") %>'
        },
        {
          from: '\'__ASM__\'',
          to: '<%= grunt.file.read("src/js/data/asm.topo.json") %>'
        },
        {
          from: '\'__ATA__\'',
          to: '<%= grunt.file.read("src/js/data/ata.topo.json") %>'
        },
        {
          from: '\'__ATC__\'',
          to: '<%= grunt.file.read("src/js/data/atc.topo.json") %>'
        },
        {
          from: '\'__ATF__\'',
          to: '<%= grunt.file.read("src/js/data/atf.topo.json") %>'
        },
        {
          from: '\'__ATG__\'',
          to: '<%= grunt.file.read("src/js/data/atg.topo.json") %>'
        },
        {
          from: '\'__AUS__\'',
          to: '<%= grunt.file.read("src/js/data/aus.topo.json") %>'
        },
        {
          from: '\'__AUT__\'',
          to: '<%= grunt.file.read("src/js/data/aut.topo.json") %>'
        },
        {
          from: '\'__AZE__\'',
          to: '<%= grunt.file.read("src/js/data/aze.topo.json") %>'
        },
        {
          from: '\'__BDI__\'',
          to: '<%= grunt.file.read("src/js/data/bdi.topo.json") %>'
        },
        {
          from: '\'__BEL__\'',
          to: '<%= grunt.file.read("src/js/data/bel.topo.json") %>'
        },
        {
          from: '\'__BEN__\'',
          to: '<%= grunt.file.read("src/js/data/ben.topo.json") %>'
        },
        {
          from: '\'__BFA__\'',
          to: '<%= grunt.file.read("src/js/data/bfa.topo.json") %>'
        },
        {
          from: '\'__BGD__\'',
          to: '<%= grunt.file.read("src/js/data/bgd.topo.json") %>'
        },
        {
          from: '\'__BGR__\'',
          to: '<%= grunt.file.read("src/js/data/bgr.topo.json") %>'
        },
        {
          from: '\'__BHR__\'',
          to: '<%= grunt.file.read("src/js/data/bhr.topo.json") %>'
        },
        {
          from: '\'__BHS__\'',
          to: '<%= grunt.file.read("src/js/data/bhs.topo.json") %>'
        },
        {
          from: '\'__BIH__\'',
          to: '<%= grunt.file.read("src/js/data/bih.topo.json") %>'
        },
        {
          from: '\'__BJN__\'',
          to: '<%= grunt.file.read("src/js/data/bjn.topo.json") %>'
        },
        {
          from: '\'__BLM__\'',
          to: '<%= grunt.file.read("src/js/data/blm.topo.json") %>'
        },
        {
          from: '\'__BLR__\'',
          to: '<%= grunt.file.read("src/js/data/blr.topo.json") %>'
        },
        {
          from: '\'__BLZ__\'',
          to: '<%= grunt.file.read("src/js/data/blz.topo.json") %>'
        },
        {
          from: '\'__BMU__\'',
          to: '<%= grunt.file.read("src/js/data/bmu.topo.json") %>'
        },
        {
          from: '\'__BOL__\'',
          to: '<%= grunt.file.read("src/js/data/bol.topo.json") %>'
        },
        {
          from: '\'__BRA__\'',
          to: '<%= grunt.file.read("src/js/data/bra.topo.json") %>'
        },
        {
          from: '\'__BRB__\'',
          to: '<%= grunt.file.read("src/js/data/brb.topo.json") %>'
        },
        {
          from: '\'__BRN__\'',
          to: '<%= grunt.file.read("src/js/data/brn.topo.json") %>'
        },
        {
          from: '\'__BTN__\'',
          to: '<%= grunt.file.read("src/js/data/btn.topo.json") %>'
        },
        {
          from: '\'__NOR__\'',
          to: '<%= grunt.file.read("src/js/data/nor.topo.json") %>'
        },
        {
          from: '\'__BWA__\'',
          to: '<%= grunt.file.read("src/js/data/bwa.topo.json") %>'
        },
        {
          from: '\'__CAF__\'',
          to: '<%= grunt.file.read("src/js/data/caf.topo.json") %>'
        },
        {
          from: '\'__CAN__\'',
          to: '<%= grunt.file.read("src/js/data/can.topo.json") %>'
        },
        {
          from: '\'__CHE__\'',
          to: '<%= grunt.file.read("src/js/data/che.topo.json") %>'
        },
        {
          from: '\'__CHL__\'',
          to: '<%= grunt.file.read("src/js/data/chl.topo.json") %>'
        },
        {
          from: '\'__CHN__\'',
          to: '<%= grunt.file.read("src/js/data/chn.topo.json") %>'
        },
        {
          from: '\'__CIV__\'',
          to: '<%= grunt.file.read("src/js/data/civ.topo.json") %>'
        },
        {
          from: '\'__CLP__\'',
          to: '<%= grunt.file.read("src/js/data/clp.topo.json") %>'
        },
        {
          from: '\'__CMR__\'',
          to: '<%= grunt.file.read("src/js/data/cmr.topo.json") %>'
        },
        {
          from: '\'__COD__\'',
          to: '<%= grunt.file.read("src/js/data/cod.topo.json") %>'
        },
        {
          from: '\'__COG__\'',
          to: '<%= grunt.file.read("src/js/data/cog.topo.json") %>'
        },
        {
          from: '\'__COK__\'',
          to: '<%= grunt.file.read("src/js/data/cok.topo.json") %>'
        },
        {
          from: '\'__COL__\'',
          to: '<%= grunt.file.read("src/js/data/col.topo.json") %>'
        },
        {
          from: '\'__COM__\'',
          to: '<%= grunt.file.read("src/js/data/com.topo.json") %>'
        },
        {
          from: '\'__CPV__\'',
          to: '<%= grunt.file.read("src/js/data/cpv.topo.json") %>'
        },
        {
          from: '\'__CRI__\'',
          to: '<%= grunt.file.read("src/js/data/cri.topo.json") %>'
        },
        {
          from: '\'__CSI__\'',
          to: '<%= grunt.file.read("src/js/data/csi.topo.json") %>'
        },
        {
          from: '\'__CUB__\'',
          to: '<%= grunt.file.read("src/js/data/cub.topo.json") %>'
        },
        {
          from: '\'__CUW__\'',
          to: '<%= grunt.file.read("src/js/data/cuw.topo.json") %>'
        },
        {
          from: '\'__CYM__\'',
          to: '<%= grunt.file.read("src/js/data/cym.topo.json") %>'
        },
        {
          from: '\'__CYN__\'',
          to: '<%= grunt.file.read("src/js/data/cyn.topo.json") %>'
        },
        {
          from: '\'__CYP__\'',
          to: '<%= grunt.file.read("src/js/data/cyp.topo.json") %>'
        },
        {
          from: '\'__CZE__\'',
          to: '<%= grunt.file.read("src/js/data/cze.topo.json") %>'
        },
        {
          from: '\'__DEU__\'',
          to: '<%= grunt.file.read("src/js/data/deu.topo.json") %>'
        },
        {
          from: '\'__DJI__\'',
          to: '<%= grunt.file.read("src/js/data/dji.topo.json") %>'
        },
        {
          from: '\'__DMA__\'',
          to: '<%= grunt.file.read("src/js/data/dma.topo.json") %>'
        },
        {
          from: '\'__DNK__\'',
          to: '<%= grunt.file.read("src/js/data/dnk.topo.json") %>'
        },
        {
          from: '\'__DOM__\'',
          to: '<%= grunt.file.read("src/js/data/dom.topo.json") %>'
        },
        {
          from: '\'__DZA__\'',
          to: '<%= grunt.file.read("src/js/data/dza.topo.json") %>'
        },
        {
          from: '\'__ECU__\'',
          to: '<%= grunt.file.read("src/js/data/ecu.topo.json") %>'
        },
        {
          from: '\'__EGY__\'',
          to: '<%= grunt.file.read("src/js/data/egy.topo.json") %>'
        },
        {
          from: '\'__ERI__\'',
          to: '<%= grunt.file.read("src/js/data/eri.topo.json") %>'
        },
        {
          from: '\'__ESB__\'',
          to: '<%= grunt.file.read("src/js/data/esb.topo.json") %>'
        },
        {
          from: '\'__ESP__\'',
          to: '<%= grunt.file.read("src/js/data/esp.topo.json") %>'
        },
        {
          from: '\'__EST__\'',
          to: '<%= grunt.file.read("src/js/data/est.topo.json") %>'
        },
        {
          from: '\'__ETH__\'',
          to: '<%= grunt.file.read("src/js/data/eth.topo.json") %>'
        },
        {
          from: '\'__FIN__\'',
          to: '<%= grunt.file.read("src/js/data/fin.topo.json") %>'
        },
        {
          from: '\'__FJI__\'',
          to: '<%= grunt.file.read("src/js/data/fji.topo.json") %>'
        },
        {
          from: '\'__FLK__\'',
          to: '<%= grunt.file.read("src/js/data/flk.topo.json") %>'
        },
        {
          from: '\'__FRA__\'',
          to: '<%= grunt.file.read("src/js/data/fra.topo.json") %>'
        },
        {
          from: '\'__FRO__\'',
          to: '<%= grunt.file.read("src/js/data/fro.topo.json") %>'
        },
        {
          from: '\'__FSM__\'',
          to: '<%= grunt.file.read("src/js/data/fsm.topo.json") %>'
        },
        {
          from: '\'__GAB__\'',
          to: '<%= grunt.file.read("src/js/data/gab.topo.json") %>'
        },
        {
          from: '\'__PSX__\'',
          to: '<%= grunt.file.read("src/js/data/psx.topo.json") %>'
        },
        {
          from: '\'__GBR__\'',
          to: '<%= grunt.file.read("src/js/data/gbr.topo.json") %>'
        },
        {
          from: '\'__GEO__\'',
          to: '<%= grunt.file.read("src/js/data/geo.topo.json") %>'
        },
        {
          from: '\'__GGY__\'',
          to: '<%= grunt.file.read("src/js/data/ggy.topo.json") %>'
        },
        {
          from: '\'__GHA__\'',
          to: '<%= grunt.file.read("src/js/data/gha.topo.json") %>'
        },
        {
          from: '\'__GIB__\'',
          to: '<%= grunt.file.read("src/js/data/gib.topo.json") %>'
        },
        {
          from: '\'__GIN__\'',
          to: '<%= grunt.file.read("src/js/data/gin.topo.json") %>'
        },
        {
          from: '\'__GMB__\'',
          to: '<%= grunt.file.read("src/js/data/gmb.topo.json") %>'
        },
        {
          from: '\'__GNB__\'',
          to: '<%= grunt.file.read("src/js/data/gnb.topo.json") %>'
        },
        {
          from: '\'__GNQ__\'',
          to: '<%= grunt.file.read("src/js/data/gnq.topo.json") %>'
        },
        {
          from: '\'__GRC__\'',
          to: '<%= grunt.file.read("src/js/data/grc.topo.json") %>'
        },
        {
          from: '\'__GRD__\'',
          to: '<%= grunt.file.read("src/js/data/grd.topo.json") %>'
        },
        {
          from: '\'__GRL__\'',
          to: '<%= grunt.file.read("src/js/data/grl.topo.json") %>'
        },
        {
          from: '\'__GTM__\'',
          to: '<%= grunt.file.read("src/js/data/gtm.topo.json") %>'
        },
        {
          from: '\'__GUM__\'',
          to: '<%= grunt.file.read("src/js/data/gum.topo.json") %>'
        },
        {
          from: '\'__GUY__\'',
          to: '<%= grunt.file.read("src/js/data/guy.topo.json") %>'
        },
        {
          from: '\'__HKG__\'',
          to: '<%= grunt.file.read("src/js/data/hkg.topo.json") %>'
        },
        {
          from: '\'__HMD__\'',
          to: '<%= grunt.file.read("src/js/data/hmd.topo.json") %>'
        },
        {
          from: '\'__HND__\'',
          to: '<%= grunt.file.read("src/js/data/hnd.topo.json") %>'
        },
        {
          from: '\'__HRV__\'',
          to: '<%= grunt.file.read("src/js/data/hrv.topo.json") %>'
        },
        {
          from: '\'__HTI__\'',
          to: '<%= grunt.file.read("src/js/data/hti.topo.json") %>'
        },
        {
          from: '\'__HUN__\'',
          to: '<%= grunt.file.read("src/js/data/hun.topo.json") %>'
        },
        {
          from: '\'__IDN__\'',
          to: '<%= grunt.file.read("src/js/data/idn.topo.json") %>'
        },
        {
          from: '\'__IMN__\'',
          to: '<%= grunt.file.read("src/js/data/imn.topo.json") %>'
        },
        {
          from: '\'__IND__\'',
          to: '<%= grunt.file.read("src/js/data/ind.topo.json") %>'
        },
        {
          from: '\'__IOA__\'',
          to: '<%= grunt.file.read("src/js/data/ioa.topo.json") %>'
        },
        {
          from: '\'__IOT__\'',
          to: '<%= grunt.file.read("src/js/data/iot.topo.json") %>'
        },
        {
          from: '\'__IRL__\'',
          to: '<%= grunt.file.read("src/js/data/irl.topo.json") %>'
        },
        {
          from: '\'__IRN__\'',
          to: '<%= grunt.file.read("src/js/data/irn.topo.json") %>'
        },
        {
          from: '\'__IRQ__\'',
          to: '<%= grunt.file.read("src/js/data/irq.topo.json") %>'
        },
        {
          from: '\'__ISL__\'',
          to: '<%= grunt.file.read("src/js/data/isl.topo.json") %>'
        },
        {
          from: '\'__ISR__\'',
          to: '<%= grunt.file.read("src/js/data/isr.topo.json") %>'
        },
        {
          from: '\'__ITA__\'',
          to: '<%= grunt.file.read("src/js/data/ita.topo.json") %>'
        },
        {
          from: '\'__JAM__\'',
          to: '<%= grunt.file.read("src/js/data/jam.topo.json") %>'
        },
        {
          from: '\'__JEY__\'',
          to: '<%= grunt.file.read("src/js/data/jey.topo.json") %>'
        },
        {
          from: '\'__JOR__\'',
          to: '<%= grunt.file.read("src/js/data/jor.topo.json") %>'
        },
        {
          from: '\'__JPN__\'',
          to: '<%= grunt.file.read("src/js/data/jpn.topo.json") %>'
        },
        {
          from: '\'__KAB__\'',
          to: '<%= grunt.file.read("src/js/data/kab.topo.json") %>'
        },
        {
          from: '\'__KAS__\'',
          to: '<%= grunt.file.read("src/js/data/kas.topo.json") %>'
        },
        {
          from: '\'__KAZ__\'',
          to: '<%= grunt.file.read("src/js/data/kaz.topo.json") %>'
        },
        {
          from: '\'__KEN__\'',
          to: '<%= grunt.file.read("src/js/data/ken.topo.json") %>'
        },
        {
          from: '\'__KGZ__\'',
          to: '<%= grunt.file.read("src/js/data/kgz.topo.json") %>'
        },
        {
          from: '\'__KHM__\'',
          to: '<%= grunt.file.read("src/js/data/khm.topo.json") %>'
        },
        {
          from: '\'__KIR__\'',
          to: '<%= grunt.file.read("src/js/data/kir.topo.json") %>'
        },
        {
          from: '\'__KNA__\'',
          to: '<%= grunt.file.read("src/js/data/kna.topo.json") %>'
        },
        {
          from: '\'__KOR__\'',
          to: '<%= grunt.file.read("src/js/data/kor.topo.json") %>'
        },
        {
          from: '\'__KOS__\'',
          to: '<%= grunt.file.read("src/js/data/kos.topo.json") %>'
        },
        {
          from: '\'__KWT__\'',
          to: '<%= grunt.file.read("src/js/data/kwt.topo.json") %>'
        },
        {
          from: '\'__LAO__\'',
          to: '<%= grunt.file.read("src/js/data/lao.topo.json") %>'
        },
        {
          from: '\'__LBN__\'',
          to: '<%= grunt.file.read("src/js/data/lbn.topo.json") %>'
        },
        {
          from: '\'__LBR__\'',
          to: '<%= grunt.file.read("src/js/data/lbr.topo.json") %>'
        },
        {
          from: '\'__LBY__\'',
          to: '<%= grunt.file.read("src/js/data/lby.topo.json") %>'
        },
        {
          from: '\'__LCA__\'',
          to: '<%= grunt.file.read("src/js/data/lca.topo.json") %>'
        },
        {
          from: '\'__LIE__\'',
          to: '<%= grunt.file.read("src/js/data/lie.topo.json") %>'
        },
        {
          from: '\'__LKA__\'',
          to: '<%= grunt.file.read("src/js/data/lka.topo.json") %>'
        },
        {
          from: '\'__LSO__\'',
          to: '<%= grunt.file.read("src/js/data/lso.topo.json") %>'
        },
        {
          from: '\'__LTU__\'',
          to: '<%= grunt.file.read("src/js/data/ltu.topo.json") %>'
        },
        {
          from: '\'__LUX__\'',
          to: '<%= grunt.file.read("src/js/data/lux.topo.json") %>'
        },
        {
          from: '\'__LVA__\'',
          to: '<%= grunt.file.read("src/js/data/lva.topo.json") %>'
        },
        {
          from: '\'__MAC__\'',
          to: '<%= grunt.file.read("src/js/data/mac.topo.json") %>'
        },
        {
          from: '\'__MAF__\'',
          to: '<%= grunt.file.read("src/js/data/maf.topo.json") %>'
        },
        {
          from: '\'__MAR__\'',
          to: '<%= grunt.file.read("src/js/data/mar.topo.json") %>'
        },
        {
          from: '\'__MCO__\'',
          to: '<%= grunt.file.read("src/js/data/mco.topo.json") %>'
        },
        {
          from: '\'__MDA__\'',
          to: '<%= grunt.file.read("src/js/data/mda.topo.json") %>'
        },
        {
          from: '\'__MDG__\'',
          to: '<%= grunt.file.read("src/js/data/mdg.topo.json") %>'
        },
        {
          from: '\'__MDV__\'',
          to: '<%= grunt.file.read("src/js/data/mdv.topo.json") %>'
        },
        {
          from: '\'__MEX__\'',
          to: '<%= grunt.file.read("src/js/data/mex.topo.json") %>'
        },
        {
          from: '\'__MHL__\'',
          to: '<%= grunt.file.read("src/js/data/mhl.topo.json") %>'
        },
        {
          from: '\'__MKD__\'',
          to: '<%= grunt.file.read("src/js/data/mkd.topo.json") %>'
        },
        {
          from: '\'__MLI__\'',
          to: '<%= grunt.file.read("src/js/data/mli.topo.json") %>'
        },
        {
          from: '\'__MLT__\'',
          to: '<%= grunt.file.read("src/js/data/mlt.topo.json") %>'
        },
        {
          from: '\'__MMR__\'',
          to: '<%= grunt.file.read("src/js/data/mmr.topo.json") %>'
        },
        {
          from: '\'__MNE__\'',
          to: '<%= grunt.file.read("src/js/data/mne.topo.json") %>'
        },
        {
          from: '\'__MNG__\'',
          to: '<%= grunt.file.read("src/js/data/mng.topo.json") %>'
        },
        {
          from: '\'__MNP__\'',
          to: '<%= grunt.file.read("src/js/data/mnp.topo.json") %>'
        },
        {
          from: '\'__MOZ__\'',
          to: '<%= grunt.file.read("src/js/data/moz.topo.json") %>'
        },
        {
          from: '\'__MRT__\'',
          to: '<%= grunt.file.read("src/js/data/mrt.topo.json") %>'
        },
        {
          from: '\'__MSR__\'',
          to: '<%= grunt.file.read("src/js/data/msr.topo.json") %>'
        },
        {
          from: '\'__MUS__\'',
          to: '<%= grunt.file.read("src/js/data/mus.topo.json") %>'
        },
        {
          from: '\'__MWI__\'',
          to: '<%= grunt.file.read("src/js/data/mwi.topo.json") %>'
        },
        {
          from: '\'__MYS__\'',
          to: '<%= grunt.file.read("src/js/data/mys.topo.json") %>'
        },
        {
          from: '\'__NAM__\'',
          to: '<%= grunt.file.read("src/js/data/nam.topo.json") %>'
        },
        {
          from: '\'__NCL__\'',
          to: '<%= grunt.file.read("src/js/data/ncl.topo.json") %>'
        },
        {
          from: '\'__NER__\'',
          to: '<%= grunt.file.read("src/js/data/ner.topo.json") %>'
        },
        {
          from: '\'__NFK__\'',
          to: '<%= grunt.file.read("src/js/data/nfk.topo.json") %>'
        },
        {
          from: '\'__NGA__\'',
          to: '<%= grunt.file.read("src/js/data/nga.topo.json") %>'
        },
        {
          from: '\'__NIC__\'',
          to: '<%= grunt.file.read("src/js/data/nic.topo.json") %>'
        },
        {
          from: '\'__NIU__\'',
          to: '<%= grunt.file.read("src/js/data/niu.topo.json") %>'
        },
        {
          from: '\'__NLD__\'',
          to: '<%= grunt.file.read("src/js/data/nld.topo.json") %>'
        },
        {
          from: '\'__NPL__\'',
          to: '<%= grunt.file.read("src/js/data/npl.topo.json") %>'
        },
        {
          from: '\'__NRU__\'',
          to: '<%= grunt.file.read("src/js/data/nru.topo.json") %>'
        },
        {
          from: '\'__NUL__\'',
          to: '<%= grunt.file.read("src/js/data/_nul.topo.json") %>'
        },
        {
          from: '\'__NZL__\'',
          to: '<%= grunt.file.read("src/js/data/nzl.topo.json") %>'
        },
        {
          from: '\'__OMN__\'',
          to: '<%= grunt.file.read("src/js/data/omn.topo.json") %>'
        },
        {
          from: '\'__PAK__\'',
          to: '<%= grunt.file.read("src/js/data/pak.topo.json") %>'
        },
        {
          from: '\'__PAN__\'',
          to: '<%= grunt.file.read("src/js/data/pan.topo.json") %>'
        },
        {
          from: '\'__PCN__\'',
          to: '<%= grunt.file.read("src/js/data/pcn.topo.json") %>'
        },
        {
          from: '\'__PER__\'',
          to: '<%= grunt.file.read("src/js/data/per.topo.json") %>'
        },
        {
          from: '\'__PGA__\'',
          to: '<%= grunt.file.read("src/js/data/pga.topo.json") %>'
        },
        {
          from: '\'__PHL__\'',
          to: '<%= grunt.file.read("src/js/data/phl.topo.json") %>'
        },
        {
          from: '\'__PLW__\'',
          to: '<%= grunt.file.read("src/js/data/plw.topo.json") %>'
        },
        {
          from: '\'__PNG__\'',
          to: '<%= grunt.file.read("src/js/data/png.topo.json") %>'
        },
        {
          from: '\'__POL__\'',
          to: '<%= grunt.file.read("src/js/data/pol.topo.json") %>'
        },
        {
          from: '\'__PRI__\'',
          to: '<%= grunt.file.read("src/js/data/pri.topo.json") %>'
        },
        {
          from: '\'__PRK__\'',
          to: '<%= grunt.file.read("src/js/data/prk.topo.json") %>'
        },
        {
          from: '\'__PRT__\'',
          to: '<%= grunt.file.read("src/js/data/prt.topo.json") %>'
        },
        {
          from: '\'__PRY__\'',
          to: '<%= grunt.file.read("src/js/data/pry.topo.json") %>'
        },
        {
          from: '\'__PYF__\'',
          to: '<%= grunt.file.read("src/js/data/pyf.topo.json") %>'
        },
        {
          from: '\'__QAT__\'',
          to: '<%= grunt.file.read("src/js/data/qat.topo.json") %>'
        },
        {
          from: '\'__ROU__\'',
          to: '<%= grunt.file.read("src/js/data/rou.topo.json") %>'
        },
        {
          from: '\'__RUS__\'',
          to: '<%= grunt.file.read("src/js/data/rus.topo.json") %>'
        },
        {
          from: '\'__RWA__\'',
          to: '<%= grunt.file.read("src/js/data/rwa.topo.json") %>'
        },
        {
          from: '\'__SAH__\'',
          to: '<%= grunt.file.read("src/js/data/sah.topo.json") %>'
        },
        {
          from: '\'__SAU__\'',
          to: '<%= grunt.file.read("src/js/data/sau.topo.json") %>'
        },
        {
          from: '\'__SCR__\'',
          to: '<%= grunt.file.read("src/js/data/scr.topo.json") %>'
        },
        {
          from: '\'__SDN__\'',
          to: '<%= grunt.file.read("src/js/data/sdn.topo.json") %>'
        },
        {
          from: '\'__SDS__\'',
          to: '<%= grunt.file.read("src/js/data/sds.topo.json") %>'
        },
        {
          from: '\'__SEN__\'',
          to: '<%= grunt.file.read("src/js/data/sen.topo.json") %>'
        },
        {
          from: '\'__SER__\'',
          to: '<%= grunt.file.read("src/js/data/ser.topo.json") %>'
        },
        {
          from: '\'__SGP__\'',
          to: '<%= grunt.file.read("src/js/data/sgp.topo.json") %>'
        },
        {
          from: '\'__SGS__\'',
          to: '<%= grunt.file.read("src/js/data/sgs.topo.json") %>'
        },
        {
          from: '\'__SHN__\'',
          to: '<%= grunt.file.read("src/js/data/shn.topo.json") %>'
        },
        {
          from: '\'__SLB__\'',
          to: '<%= grunt.file.read("src/js/data/slb.topo.json") %>'
        },
        {
          from: '\'__SLE__\'',
          to: '<%= grunt.file.read("src/js/data/sle.topo.json") %>'
        },
        {
          from: '\'__SLV__\'',
          to: '<%= grunt.file.read("src/js/data/slv.topo.json") %>'
        },
        {
          from: '\'__SMR__\'',
          to: '<%= grunt.file.read("src/js/data/smr.topo.json") %>'
        },
        {
          from: '\'__SOL__\'',
          to: '<%= grunt.file.read("src/js/data/sol.topo.json") %>'
        },
        {
          from: '\'__SOM__\'',
          to: '<%= grunt.file.read("src/js/data/som.topo.json") %>'
        },
        {
          from: '\'__SPM__\'',
          to: '<%= grunt.file.read("src/js/data/spm.topo.json") %>'
        },
        {
          from: '\'__SRB__\'',
          to: '<%= grunt.file.read("src/js/data/srb.topo.json") %>'
        },
        {
          from: '\'__STP__\'',
          to: '<%= grunt.file.read("src/js/data/stp.topo.json") %>'
        },
        {
          from: '\'__SUR__\'',
          to: '<%= grunt.file.read("src/js/data/sur.topo.json") %>'
        },
        {
          from: '\'__SVK__\'',
          to: '<%= grunt.file.read("src/js/data/svk.topo.json") %>'
        },
        {
          from: '\'__SVN__\'',
          to: '<%= grunt.file.read("src/js/data/svn.topo.json") %>'
        },
        {
          from: '\'__SWE__\'',
          to: '<%= grunt.file.read("src/js/data/swe.topo.json") %>'
        },
        {
          from: '\'__SWZ__\'',
          to: '<%= grunt.file.read("src/js/data/swz.topo.json") %>'
        },
        {
          from: '\'__SXM__\'',
          to: '<%= grunt.file.read("src/js/data/sxm.topo.json") %>'
        },
        {
          from: '\'__SYC__\'',
          to: '<%= grunt.file.read("src/js/data/syc.topo.json") %>'
        },
        {
          from: '\'__SYR__\'',
          to: '<%= grunt.file.read("src/js/data/syr.topo.json") %>'
        },
        {
          from: '\'__TCA__\'',
          to: '<%= grunt.file.read("src/js/data/tca.topo.json") %>'
        },
        {
          from: '\'__TCD__\'',
          to: '<%= grunt.file.read("src/js/data/tcd.topo.json") %>'
        },
        {
          from: '\'__TGO__\'',
          to: '<%= grunt.file.read("src/js/data/tgo.topo.json") %>'
        },
        {
          from: '\'__THA__\'',
          to: '<%= grunt.file.read("src/js/data/tha.topo.json") %>'
        },
        {
          from: '\'__TJK__\'',
          to: '<%= grunt.file.read("src/js/data/tjk.topo.json") %>'
        },
        {
          from: '\'__TKM__\'',
          to: '<%= grunt.file.read("src/js/data/tkm.topo.json") %>'
        },
        {
          from: '\'__TLS__\'',
          to: '<%= grunt.file.read("src/js/data/tls.topo.json") %>'
        },
        {
          from: '\'__TON__\'',
          to: '<%= grunt.file.read("src/js/data/ton.topo.json") %>'
        },
        {
          from: '\'__TTO__\'',
          to: '<%= grunt.file.read("src/js/data/tto.topo.json") %>'
        },
        {
          from: '\'__TUN__\'',
          to: '<%= grunt.file.read("src/js/data/tun.topo.json") %>'
        },
        {
          from: '\'__TUR__\'',
          to: '<%= grunt.file.read("src/js/data/tur.topo.json") %>'
        },
        {
          from: '\'__TUV__\'',
          to: '<%= grunt.file.read("src/js/data/tuv.topo.json") %>'
        },
        {
          from: '\'__TWN__\'',
          to: '<%= grunt.file.read("src/js/data/twn.topo.json") %>'
        },
        {
          from: '\'__TZA__\'',
          to: '<%= grunt.file.read("src/js/data/tza.topo.json") %>'
        },
        {
          from: '\'__UGA__\'',
          to: '<%= grunt.file.read("src/js/data/uga.topo.json") %>'
        },
        {
          from: '\'__UKR__\'',
          to: '<%= grunt.file.read("src/js/data/ukr.topo.json") %>'
        },
        {
          from: '\'__UMI__\'',
          to: '<%= grunt.file.read("src/js/data/umi.topo.json") %>'
        },
        {
          from: '\'__URY__\'',
          to: '<%= grunt.file.read("src/js/data/ury.topo.json") %>'
        },
        {
          from: '\'__USA__\'',
          to: '<%= grunt.file.read("src/js/data/usa.topo.json") %>'
        },
        {
          from: '\'__USG__\'',
          to: '<%= grunt.file.read("src/js/data/usg.topo.json") %>'
        },
        {
          from: '\'__UZB__\'',
          to: '<%= grunt.file.read("src/js/data/uzb.topo.json") %>'
        },
        {
          from: '\'__VAT__\'',
          to: '<%= grunt.file.read("src/js/data/vat.topo.json") %>'
        },
        {
          from: '\'__VCT__\'',
          to: '<%= grunt.file.read("src/js/data/vct.topo.json") %>'
        },
        {
          from: '\'__VEN__\'',
          to: '<%= grunt.file.read("src/js/data/ven.topo.json") %>'
        },
        {
          from: '\'__VGB__\'',
          to: '<%= grunt.file.read("src/js/data/vgb.topo.json") %>'
        },
        {
          from: '\'__VIR__\'',
          to: '<%= grunt.file.read("src/js/data/vir.topo.json") %>'
        },
        {
          from: '\'__VNM__\'',
          to: '<%= grunt.file.read("src/js/data/vnm.topo.json") %>'
        },
        {
          from: '\'__VUT__\'',
          to: '<%= grunt.file.read("src/js/data/vut.topo.json") %>'
        },
        {
          from: '\'__WLF__\'',
          to: '<%= grunt.file.read("src/js/data/wlf.topo.json") %>'
        },
        {
          from: '\'__WSB__\'',
          to: '<%= grunt.file.read("src/js/data/wsb.topo.json") %>'
        },
        {
          from: '\'__WSM__\'',
          to: '<%= grunt.file.read("src/js/data/wsm.topo.json") %>'
        },
        {
          from: '\'__YEM__\'',
          to: '<%= grunt.file.read("src/js/data/yem.topo.json") %>'
        },
        {
          from: '\'__ZAF__\'',
          to: '<%= grunt.file.read("src/js/data/zaf.topo.json") %>'
        },
        {
          from: '\'__ZMB__\'',
          to: '<%= grunt.file.read("src/js/data/zmb.topo.json") %>'
        },
        {
          from: '\'__ZWE__\'',
          to: '<%= grunt.file.read("src/js/data/zwe.topo.json") %>'
        },
        {
          from: '\'__WORLD__\'',
          to: '<%= grunt.file.read("src/js/data/world.topo.json") %>'
        }]
      }
    },
    watch: {
      datamap: {
        files: ['src/js/datamaps.js'],
        tasks: ['replace']
    }
  },
   uglify: {
      dist: {
        files: {
          'src/rel/datamaps.world.min.js': ['src/rel/datamaps.world.js'],
          'src/rel/datamaps.abw.min.js': ['src/rel/datamaps.abw.js'],
          'src/rel/datamaps.afg.min.js': ['src/rel/datamaps.afg.js'],
          'src/rel/datamaps.ago.min.js': ['src/rel/datamaps.ago.js'],
          'src/rel/datamaps.aia.min.js': ['src/rel/datamaps.aia.js'],
          'src/rel/datamaps.alb.min.js': ['src/rel/datamaps.alb.js'],
          'src/rel/datamaps.ald.min.js': ['src/rel/datamaps.ald.js'],
          'src/rel/datamaps.and.min.js': ['src/rel/datamaps.and.js'],
          'src/rel/datamaps.are.min.js': ['src/rel/datamaps.are.js'],
          'src/rel/datamaps.arg.min.js': ['src/rel/datamaps.arg.js'],
          'src/rel/datamaps.arm.min.js': ['src/rel/datamaps.arm.js'],
          'src/rel/datamaps.asm.min.js': ['src/rel/datamaps.asm.js'],
          'src/rel/datamaps.ata.min.js': ['src/rel/datamaps.ata.js'],
          'src/rel/datamaps.atc.min.js': ['src/rel/datamaps.atc.js'],
          'src/rel/datamaps.atf.min.js': ['src/rel/datamaps.atf.js'],
          'src/rel/datamaps.atg.min.js': ['src/rel/datamaps.atg.js'],
          'src/rel/datamaps.aus.min.js': ['src/rel/datamaps.aus.js'],
          'src/rel/datamaps.aut.min.js': ['src/rel/datamaps.aut.js'],
          'src/rel/datamaps.aze.min.js': ['src/rel/datamaps.aze.js'],
          'src/rel/datamaps.bdi.min.js': ['src/rel/datamaps.bdi.js'],
          'src/rel/datamaps.bel.min.js': ['src/rel/datamaps.bel.js'],
          'src/rel/datamaps.ben.min.js': ['src/rel/datamaps.ben.js'],
          'src/rel/datamaps.bfa.min.js': ['src/rel/datamaps.bfa.js'],
          'src/rel/datamaps.bgd.min.js': ['src/rel/datamaps.bgd.js'],
          'src/rel/datamaps.bgr.min.js': ['src/rel/datamaps.bgr.js'],
          'src/rel/datamaps.bhr.min.js': ['src/rel/datamaps.bhr.js'],
          'src/rel/datamaps.bhs.min.js': ['src/rel/datamaps.bhs.js'],
          'src/rel/datamaps.bih.min.js': ['src/rel/datamaps.bih.js'],
          'src/rel/datamaps.bjn.min.js': ['src/rel/datamaps.bjn.js'],
          'src/rel/datamaps.blm.min.js': ['src/rel/datamaps.blm.js'],
          'src/rel/datamaps.blr.min.js': ['src/rel/datamaps.blr.js'],
          'src/rel/datamaps.blz.min.js': ['src/rel/datamaps.blz.js'],
          'src/rel/datamaps.bmu.min.js': ['src/rel/datamaps.bmu.js'],
          'src/rel/datamaps.bol.min.js': ['src/rel/datamaps.bol.js'],
          'src/rel/datamaps.bra.min.js': ['src/rel/datamaps.bra.js'],
          'src/rel/datamaps.brb.min.js': ['src/rel/datamaps.brb.js'],
          'src/rel/datamaps.brn.min.js': ['src/rel/datamaps.brn.js'],
          'src/rel/datamaps.btn.min.js': ['src/rel/datamaps.btn.js'],
          'src/rel/datamaps.nor.min.js': ['src/rel/datamaps.nor.js'],
          'src/rel/datamaps.bwa.min.js': ['src/rel/datamaps.bwa.js'],
          'src/rel/datamaps.caf.min.js': ['src/rel/datamaps.caf.js'],
          'src/rel/datamaps.can.min.js': ['src/rel/datamaps.can.js'],
          'src/rel/datamaps.che.min.js': ['src/rel/datamaps.che.js'],
          'src/rel/datamaps.chl.min.js': ['src/rel/datamaps.chl.js'],
          'src/rel/datamaps.chn.min.js': ['src/rel/datamaps.chn.js'],
          'src/rel/datamaps.civ.min.js': ['src/rel/datamaps.civ.js'],
          'src/rel/datamaps.clp.min.js': ['src/rel/datamaps.clp.js'],
          'src/rel/datamaps.cmr.min.js': ['src/rel/datamaps.cmr.js'],
          'src/rel/datamaps.cod.min.js': ['src/rel/datamaps.cod.js'],
          'src/rel/datamaps.cog.min.js': ['src/rel/datamaps.cog.js'],
          'src/rel/datamaps.cok.min.js': ['src/rel/datamaps.cok.js'],
          'src/rel/datamaps.col.min.js': ['src/rel/datamaps.col.js'],
          'src/rel/datamaps.com.min.js': ['src/rel/datamaps.com.js'],
          'src/rel/datamaps.cpv.min.js': ['src/rel/datamaps.cpv.js'],
          'src/rel/datamaps.cri.min.js': ['src/rel/datamaps.cri.js'],
          'src/rel/datamaps.csi.min.js': ['src/rel/datamaps.csi.js'],
          'src/rel/datamaps.cub.min.js': ['src/rel/datamaps.cub.js'],
          'src/rel/datamaps.cuw.min.js': ['src/rel/datamaps.cuw.js'],
          'src/rel/datamaps.cym.min.js': ['src/rel/datamaps.cym.js'],
          'src/rel/datamaps.cyn.min.js': ['src/rel/datamaps.cyn.js'],
          'src/rel/datamaps.cyp.min.js': ['src/rel/datamaps.cyp.js'],
          'src/rel/datamaps.cze.min.js': ['src/rel/datamaps.cze.js'],
          'src/rel/datamaps.deu.min.js': ['src/rel/datamaps.deu.js'],
          'src/rel/datamaps.dji.min.js': ['src/rel/datamaps.dji.js'],
          'src/rel/datamaps.dma.min.js': ['src/rel/datamaps.dma.js'],
          'src/rel/datamaps.dnk.min.js': ['src/rel/datamaps.dnk.js'],
          'src/rel/datamaps.dom.min.js': ['src/rel/datamaps.dom.js'],
          'src/rel/datamaps.dza.min.js': ['src/rel/datamaps.dza.js'],
          'src/rel/datamaps.ecu.min.js': ['src/rel/datamaps.ecu.js'],
          'src/rel/datamaps.egy.min.js': ['src/rel/datamaps.egy.js'],
          'src/rel/datamaps.eri.min.js': ['src/rel/datamaps.eri.js'],
          'src/rel/datamaps.esb.min.js': ['src/rel/datamaps.esb.js'],
          'src/rel/datamaps.esp.min.js': ['src/rel/datamaps.esp.js'],
          'src/rel/datamaps.est.min.js': ['src/rel/datamaps.est.js'],
          'src/rel/datamaps.eth.min.js': ['src/rel/datamaps.eth.js'],
          'src/rel/datamaps.fin.min.js': ['src/rel/datamaps.fin.js'],
          'src/rel/datamaps.fji.min.js': ['src/rel/datamaps.fji.js'],
          'src/rel/datamaps.flk.min.js': ['src/rel/datamaps.flk.js'],
          'src/rel/datamaps.fra.min.js': ['src/rel/datamaps.fra.js'],
          'src/rel/datamaps.fro.min.js': ['src/rel/datamaps.fro.js'],
          'src/rel/datamaps.fsm.min.js': ['src/rel/datamaps.fsm.js'],
          'src/rel/datamaps.gab.min.js': ['src/rel/datamaps.gab.js'],
          'src/rel/datamaps.psx.min.js': ['src/rel/datamaps.psx.js'],
          'src/rel/datamaps.gbr.min.js': ['src/rel/datamaps.gbr.js'],
          'src/rel/datamaps.geo.min.js': ['src/rel/datamaps.geo.js'],
          'src/rel/datamaps.ggy.min.js': ['src/rel/datamaps.ggy.js'],
          'src/rel/datamaps.gha.min.js': ['src/rel/datamaps.gha.js'],
          'src/rel/datamaps.gib.min.js': ['src/rel/datamaps.gib.js'],
          'src/rel/datamaps.gin.min.js': ['src/rel/datamaps.gin.js'],
          'src/rel/datamaps.gmb.min.js': ['src/rel/datamaps.gmb.js'],
          'src/rel/datamaps.gnb.min.js': ['src/rel/datamaps.gnb.js'],
          'src/rel/datamaps.gnq.min.js': ['src/rel/datamaps.gnq.js'],
          'src/rel/datamaps.grc.min.js': ['src/rel/datamaps.grc.js'],
          'src/rel/datamaps.grd.min.js': ['src/rel/datamaps.grd.js'],
          'src/rel/datamaps.grl.min.js': ['src/rel/datamaps.grl.js'],
          'src/rel/datamaps.gtm.min.js': ['src/rel/datamaps.gtm.js'],
          'src/rel/datamaps.gum.min.js': ['src/rel/datamaps.gum.js'],
          'src/rel/datamaps.guy.min.js': ['src/rel/datamaps.guy.js'],
          'src/rel/datamaps.hkg.min.js': ['src/rel/datamaps.hkg.js'],
          'src/rel/datamaps.hmd.min.js': ['src/rel/datamaps.hmd.js'],
          'src/rel/datamaps.hnd.min.js': ['src/rel/datamaps.hnd.js'],
          'src/rel/datamaps.hrv.min.js': ['src/rel/datamaps.hrv.js'],
          'src/rel/datamaps.hti.min.js': ['src/rel/datamaps.hti.js'],
          'src/rel/datamaps.hun.min.js': ['src/rel/datamaps.hun.js'],
          'src/rel/datamaps.idn.min.js': ['src/rel/datamaps.idn.js'],
          'src/rel/datamaps.imn.min.js': ['src/rel/datamaps.imn.js'],
          'src/rel/datamaps.ind.min.js': ['src/rel/datamaps.ind.js'],
          'src/rel/datamaps.ioa.min.js': ['src/rel/datamaps.ioa.js'],
          'src/rel/datamaps.iot.min.js': ['src/rel/datamaps.iot.js'],
          'src/rel/datamaps.irl.min.js': ['src/rel/datamaps.irl.js'],
          'src/rel/datamaps.irn.min.js': ['src/rel/datamaps.irn.js'],
          'src/rel/datamaps.irq.min.js': ['src/rel/datamaps.irq.js'],
          'src/rel/datamaps.isl.min.js': ['src/rel/datamaps.isl.js'],
          'src/rel/datamaps.isr.min.js': ['src/rel/datamaps.isr.js'],
          'src/rel/datamaps.ita.min.js': ['src/rel/datamaps.ita.js'],
          'src/rel/datamaps.jam.min.js': ['src/rel/datamaps.jam.js'],
          'src/rel/datamaps.jey.min.js': ['src/rel/datamaps.jey.js'],
          'src/rel/datamaps.jor.min.js': ['src/rel/datamaps.jor.js'],
          'src/rel/datamaps.jpn.min.js': ['src/rel/datamaps.jpn.js'],
          'src/rel/datamaps.kab.min.js': ['src/rel/datamaps.kab.js'],
          'src/rel/datamaps.kas.min.js': ['src/rel/datamaps.kas.js'],
          'src/rel/datamaps.kaz.min.js': ['src/rel/datamaps.kaz.js'],
          'src/rel/datamaps.ken.min.js': ['src/rel/datamaps.ken.js'],
          'src/rel/datamaps.kgz.min.js': ['src/rel/datamaps.kgz.js'],
          'src/rel/datamaps.khm.min.js': ['src/rel/datamaps.khm.js'],
          'src/rel/datamaps.kir.min.js': ['src/rel/datamaps.kir.js'],
          'src/rel/datamaps.kna.min.js': ['src/rel/datamaps.kna.js'],
          'src/rel/datamaps.kor.min.js': ['src/rel/datamaps.kor.js'],
          'src/rel/datamaps.kos.min.js': ['src/rel/datamaps.kos.js'],
          'src/rel/datamaps.kwt.min.js': ['src/rel/datamaps.kwt.js'],
          'src/rel/datamaps.lao.min.js': ['src/rel/datamaps.lao.js'],
          'src/rel/datamaps.lbn.min.js': ['src/rel/datamaps.lbn.js'],
          'src/rel/datamaps.lbr.min.js': ['src/rel/datamaps.lbr.js'],
          'src/rel/datamaps.lby.min.js': ['src/rel/datamaps.lby.js'],
          'src/rel/datamaps.lca.min.js': ['src/rel/datamaps.lca.js'],
          'src/rel/datamaps.lie.min.js': ['src/rel/datamaps.lie.js'],
          'src/rel/datamaps.lka.min.js': ['src/rel/datamaps.lka.js'],
          'src/rel/datamaps.lso.min.js': ['src/rel/datamaps.lso.js'],
          'src/rel/datamaps.ltu.min.js': ['src/rel/datamaps.ltu.js'],
          'src/rel/datamaps.lux.min.js': ['src/rel/datamaps.lux.js'],
          'src/rel/datamaps.lva.min.js': ['src/rel/datamaps.lva.js'],
          'src/rel/datamaps.mac.min.js': ['src/rel/datamaps.mac.js'],
          'src/rel/datamaps.maf.min.js': ['src/rel/datamaps.maf.js'],
          'src/rel/datamaps.mar.min.js': ['src/rel/datamaps.mar.js'],
          'src/rel/datamaps.mco.min.js': ['src/rel/datamaps.mco.js'],
          'src/rel/datamaps.mda.min.js': ['src/rel/datamaps.mda.js'],
          'src/rel/datamaps.mdg.min.js': ['src/rel/datamaps.mdg.js'],
          'src/rel/datamaps.mdv.min.js': ['src/rel/datamaps.mdv.js'],
          'src/rel/datamaps.mex.min.js': ['src/rel/datamaps.mex.js'],
          'src/rel/datamaps.mhl.min.js': ['src/rel/datamaps.mhl.js'],
          'src/rel/datamaps.mkd.min.js': ['src/rel/datamaps.mkd.js'],
          'src/rel/datamaps.mli.min.js': ['src/rel/datamaps.mli.js'],
          'src/rel/datamaps.mlt.min.js': ['src/rel/datamaps.mlt.js'],
          'src/rel/datamaps.mmr.min.js': ['src/rel/datamaps.mmr.js'],
          'src/rel/datamaps.mne.min.js': ['src/rel/datamaps.mne.js'],
          'src/rel/datamaps.mng.min.js': ['src/rel/datamaps.mng.js'],
          'src/rel/datamaps.mnp.min.js': ['src/rel/datamaps.mnp.js'],
          'src/rel/datamaps.moz.min.js': ['src/rel/datamaps.moz.js'],
          'src/rel/datamaps.mrt.min.js': ['src/rel/datamaps.mrt.js'],
          'src/rel/datamaps.msr.min.js': ['src/rel/datamaps.msr.js'],
          'src/rel/datamaps.mus.min.js': ['src/rel/datamaps.mus.js'],
          'src/rel/datamaps.mwi.min.js': ['src/rel/datamaps.mwi.js'],
          'src/rel/datamaps.mys.min.js': ['src/rel/datamaps.mys.js'],
          'src/rel/datamaps.nam.min.js': ['src/rel/datamaps.nam.js'],
          'src/rel/datamaps.ncl.min.js': ['src/rel/datamaps.ncl.js'],
          'src/rel/datamaps.ner.min.js': ['src/rel/datamaps.ner.js'],
          'src/rel/datamaps.nfk.min.js': ['src/rel/datamaps.nfk.js'],
          'src/rel/datamaps.nga.min.js': ['src/rel/datamaps.nga.js'],
          'src/rel/datamaps.nic.min.js': ['src/rel/datamaps.nic.js'],
          'src/rel/datamaps.niu.min.js': ['src/rel/datamaps.niu.js'],
          'src/rel/datamaps.nld.min.js': ['src/rel/datamaps.nld.js'],
          'src/rel/datamaps.npl.min.js': ['src/rel/datamaps.npl.js'],
          'src/rel/datamaps.nru.min.js': ['src/rel/datamaps.nru.js'],
          'src/rel/datamaps.nul.min.js': ['src/rel/datamaps.nul.js'],
          'src/rel/datamaps.nzl.min.js': ['src/rel/datamaps.nzl.js'],
          'src/rel/datamaps.omn.min.js': ['src/rel/datamaps.omn.js'],
          'src/rel/datamaps.pak.min.js': ['src/rel/datamaps.pak.js'],
          'src/rel/datamaps.pan.min.js': ['src/rel/datamaps.pan.js'],
          'src/rel/datamaps.pcn.min.js': ['src/rel/datamaps.pcn.js'],
          'src/rel/datamaps.per.min.js': ['src/rel/datamaps.per.js'],
          'src/rel/datamaps.pga.min.js': ['src/rel/datamaps.pga.js'],
          'src/rel/datamaps.phl.min.js': ['src/rel/datamaps.phl.js'],
          'src/rel/datamaps.plw.min.js': ['src/rel/datamaps.plw.js'],
          'src/rel/datamaps.png.min.js': ['src/rel/datamaps.png.js'],
          'src/rel/datamaps.pol.min.js': ['src/rel/datamaps.pol.js'],
          'src/rel/datamaps.pri.min.js': ['src/rel/datamaps.pri.js'],
          'src/rel/datamaps.prk.min.js': ['src/rel/datamaps.prk.js'],
          'src/rel/datamaps.prt.min.js': ['src/rel/datamaps.prt.js'],
          'src/rel/datamaps.pry.min.js': ['src/rel/datamaps.pry.js'],
          'src/rel/datamaps.pyf.min.js': ['src/rel/datamaps.pyf.js'],
          'src/rel/datamaps.qat.min.js': ['src/rel/datamaps.qat.js'],
          'src/rel/datamaps.rou.min.js': ['src/rel/datamaps.rou.js'],
          'src/rel/datamaps.rus.min.js': ['src/rel/datamaps.rus.js'],
          'src/rel/datamaps.rwa.min.js': ['src/rel/datamaps.rwa.js'],
          'src/rel/datamaps.sah.min.js': ['src/rel/datamaps.sah.js'],
          'src/rel/datamaps.sau.min.js': ['src/rel/datamaps.sau.js'],
          'src/rel/datamaps.scr.min.js': ['src/rel/datamaps.scr.js'],
          'src/rel/datamaps.sdn.min.js': ['src/rel/datamaps.sdn.js'],
          'src/rel/datamaps.sds.min.js': ['src/rel/datamaps.sds.js'],
          'src/rel/datamaps.sen.min.js': ['src/rel/datamaps.sen.js'],
          'src/rel/datamaps.ser.min.js': ['src/rel/datamaps.ser.js'],
          'src/rel/datamaps.sgp.min.js': ['src/rel/datamaps.sgp.js'],
          'src/rel/datamaps.sgs.min.js': ['src/rel/datamaps.sgs.js'],
          'src/rel/datamaps.shn.min.js': ['src/rel/datamaps.shn.js'],
          'src/rel/datamaps.slb.min.js': ['src/rel/datamaps.slb.js'],
          'src/rel/datamaps.sle.min.js': ['src/rel/datamaps.sle.js'],
          'src/rel/datamaps.slv.min.js': ['src/rel/datamaps.slv.js'],
          'src/rel/datamaps.smr.min.js': ['src/rel/datamaps.smr.js'],
          'src/rel/datamaps.sol.min.js': ['src/rel/datamaps.sol.js'],
          'src/rel/datamaps.som.min.js': ['src/rel/datamaps.som.js'],
          'src/rel/datamaps.spm.min.js': ['src/rel/datamaps.spm.js'],
          'src/rel/datamaps.srb.min.js': ['src/rel/datamaps.srb.js'],
          'src/rel/datamaps.stp.min.js': ['src/rel/datamaps.stp.js'],
          'src/rel/datamaps.sur.min.js': ['src/rel/datamaps.sur.js'],
          'src/rel/datamaps.svk.min.js': ['src/rel/datamaps.svk.js'],
          'src/rel/datamaps.svn.min.js': ['src/rel/datamaps.svn.js'],
          'src/rel/datamaps.swe.min.js': ['src/rel/datamaps.swe.js'],
          'src/rel/datamaps.swz.min.js': ['src/rel/datamaps.swz.js'],
          'src/rel/datamaps.sxm.min.js': ['src/rel/datamaps.sxm.js'],
          'src/rel/datamaps.syc.min.js': ['src/rel/datamaps.syc.js'],
          'src/rel/datamaps.syr.min.js': ['src/rel/datamaps.syr.js'],
          'src/rel/datamaps.tca.min.js': ['src/rel/datamaps.tca.js'],
          'src/rel/datamaps.tcd.min.js': ['src/rel/datamaps.tcd.js'],
          'src/rel/datamaps.tgo.min.js': ['src/rel/datamaps.tgo.js'],
          'src/rel/datamaps.tha.min.js': ['src/rel/datamaps.tha.js'],
          'src/rel/datamaps.tjk.min.js': ['src/rel/datamaps.tjk.js'],
          'src/rel/datamaps.tkm.min.js': ['src/rel/datamaps.tkm.js'],
          'src/rel/datamaps.tls.min.js': ['src/rel/datamaps.tls.js'],
          'src/rel/datamaps.ton.min.js': ['src/rel/datamaps.ton.js'],
          'src/rel/datamaps.tto.min.js': ['src/rel/datamaps.tto.js'],
          'src/rel/datamaps.tun.min.js': ['src/rel/datamaps.tun.js'],
          'src/rel/datamaps.tur.min.js': ['src/rel/datamaps.tur.js'],
          'src/rel/datamaps.tuv.min.js': ['src/rel/datamaps.tuv.js'],
          'src/rel/datamaps.twn.min.js': ['src/rel/datamaps.twn.js'],
          'src/rel/datamaps.tza.min.js': ['src/rel/datamaps.tza.js'],
          'src/rel/datamaps.uga.min.js': ['src/rel/datamaps.uga.js'],
          'src/rel/datamaps.ukr.min.js': ['src/rel/datamaps.ukr.js'],
          'src/rel/datamaps.umi.min.js': ['src/rel/datamaps.umi.js'],
          'src/rel/datamaps.ury.min.js': ['src/rel/datamaps.ury.js'],
          'src/rel/datamaps.usa.min.js': ['src/rel/datamaps.usa.js'],
          'src/rel/datamaps.usg.min.js': ['src/rel/datamaps.usg.js'],
          'src/rel/datamaps.uzb.min.js': ['src/rel/datamaps.uzb.js'],
          'src/rel/datamaps.vat.min.js': ['src/rel/datamaps.vat.js'],
          'src/rel/datamaps.vct.min.js': ['src/rel/datamaps.vct.js'],
          'src/rel/datamaps.ven.min.js': ['src/rel/datamaps.ven.js'],
          'src/rel/datamaps.vgb.min.js': ['src/rel/datamaps.vgb.js'],
          'src/rel/datamaps.vir.min.js': ['src/rel/datamaps.vir.js'],
          'src/rel/datamaps.vnm.min.js': ['src/rel/datamaps.vnm.js'],
          'src/rel/datamaps.vut.min.js': ['src/rel/datamaps.vut.js'],
          'src/rel/datamaps.wlf.min.js': ['src/rel/datamaps.wlf.js'],
          'src/rel/datamaps.wsb.min.js': ['src/rel/datamaps.wsb.js'],
          'src/rel/datamaps.wsm.min.js': ['src/rel/datamaps.wsm.js'],
          'src/rel/datamaps.yem.min.js': ['src/rel/datamaps.yem.js'],
          'src/rel/datamaps.zaf.min.js': ['src/rel/datamaps.zaf.js'],
          'src/rel/datamaps.zmb.min.js': ['src/rel/datamaps.zmb.js'],
          'src/rel/datamaps.zwe.min.js': ['src/rel/datamaps.zwe.js'],
          'src/rel/datamaps.all.min.js': ['src/rel/datamaps.all.js'],
          'src/rel/datamaps.none.min.js': ['src/js/datamaps.js']
        }
      }
    },
    jasmine: {
      all: [
        'src/tests/SpecRunner_StatesGlobal.html',
        'src/tests/SpecRunner_StatesStripped.html',
        'src/tests/SpecRunner_CountriesStripped.html',
        'src/tests/SpecRunner_CountriesGlobal.html',
        'src/tests/SpecRunner_AllStripped.html',
        'src/tests/SpecRunner_AllGlobal.html',
        'src/tests/SpecRunner_jQueryPlugin.html'
      ]
    },
    copy: {
      all: {
        files: [
          { src: ['src/rel/*.js'], dest: './dist', flatten: true, expand: true }
        ]
      }
    },
    clean: {
      release: ['.dist/datamaps.*.js']
    },
    sync: {
      options: {
        include: ['name', 'version', 'main', 'dependencies']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-text-replace');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-sync-pkg');


  grunt.registerTask('dev', ['replace']);
  grunt.registerTask('build', ['replace', 'uglify:dist', 'copy', 'sync']);

};
