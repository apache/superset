#! /usr/bin/env python
# -*- coding: utf-8 -*-

#   math2html: convert LaTeX equations to HTML output.
#
#   Copyright (C) 2009-2011 Alex Fernández
#
#   Released under the terms of the `2-Clause BSD license'_, in short:
#   Copying and distribution of this file, with or without modification,
#   are permitted in any medium without royalty provided the copyright
#   notice and this notice are preserved.
#   This file is offered as-is, without any warranty.
#
# .. _2-Clause BSD license: http://www.spdx.org/licenses/BSD-2-Clause

#   Based on eLyXer: convert LyX source files to HTML output.
#   http://alexfernandez.github.io/elyxer/

# --end--
# Alex 20101110
# eLyXer standalone formula conversion to HTML.




import sys

class Trace(object):
  "A tracing class"

  debugmode = False
  quietmode = False
  showlinesmode = False

  prefix = None

  def debug(cls, message):
    "Show a debug message"
    if not Trace.debugmode or Trace.quietmode:
      return
    Trace.show(message, sys.stdout)

  def message(cls, message):
    "Show a trace message"
    if Trace.quietmode:
      return
    if Trace.prefix and Trace.showlinesmode:
      message = Trace.prefix + message
    Trace.show(message, sys.stdout)

  def error(cls, message):
    "Show an error message"
    message = '* ' + message
    if Trace.prefix and Trace.showlinesmode:
      message = Trace.prefix + message
    Trace.show(message, sys.stderr)

  def fatal(cls, message):
    "Show an error message and terminate"
    Trace.error('FATAL: ' + message)
    exit(-1)

  def show(cls, message, channel):
    "Show a message out of a channel"
    if sys.version_info < (3,0):
      message = message.encode('utf-8')
    channel.write(message + '\n')

  debug = classmethod(debug)
  message = classmethod(message)
  error = classmethod(error)
  fatal = classmethod(fatal)
  show = classmethod(show)




import os.path
import sys


class BibStylesConfig(object):
  "Configuration class from elyxer.config file"

  abbrvnat = {
      
      u'@article':u'$authors. $title. <i>$journal</i>,{ {$volume:}$pages,} $month $year.{ doi: $doi.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'cite':u'$surname($year)', 
      u'default':u'$authors. <i>$title</i>. $publisher, $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      }

  alpha = {
      
      u'@article':u'$authors. $title.{ <i>$journal</i>{, {$volume}{($number)}}{: $pages}{, $year}.}{ <a href="$url">$url</a>.}{ <a href="$filename">$filename</a>.}{ $note.}', 
      u'cite':u'$Sur$YY', 
      u'default':u'$authors. $title.{ <i>$journal</i>,} $year.{ <a href="$url">$url</a>.}{ <a href="$filename">$filename</a>.}{ $note.}', 
      }

  authordate2 = {
      
      u'@article':u'$authors. $year. $title. <i>$journal</i>, <b>$volume</b>($number), $pages.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@book':u'$authors. $year. <i>$title</i>. $publisher.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'cite':u'$surname, $year', 
      u'default':u'$authors. $year. <i>$title</i>. $publisher.{ URL <a href="$url">$url</a>.}{ $note.}', 
      }

  default = {
      
      u'@article':u'$authors: “$title”, <i>$journal</i>,{ pp. $pages,} $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@book':u'{$authors: }<i>$title</i>{ ($editor, ed.)}.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@booklet':u'$authors: <i>$title</i>.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@conference':u'$authors: “$title”, <i>$journal</i>,{ pp. $pages,} $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@inbook':u'$authors: <i>$title</i>.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@incollection':u'$authors: <i>$title</i>{ in <i>$booktitle</i>{ ($editor, ed.)}}.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@inproceedings':u'$authors: “$title”, <i>$booktitle</i>,{ pp. $pages,} $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@manual':u'$authors: <i>$title</i>.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@mastersthesis':u'$authors: <i>$title</i>.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@misc':u'$authors: <i>$title</i>.{{ $publisher,}{ $howpublished,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@phdthesis':u'$authors: <i>$title</i>.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@proceedings':u'$authors: “$title”, <i>$journal</i>,{ pp. $pages,} $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@techreport':u'$authors: <i>$title</i>, $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@unpublished':u'$authors: “$title”, <i>$journal</i>, $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'cite':u'$index', 
      u'default':u'$authors: <i>$title</i>.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      }

  defaulttags = {
      u'YY':u'??', u'authors':u'', u'surname':u'', 
      }

  ieeetr = {
      
      u'@article':u'$authors, “$title”, <i>$journal</i>, vol. $volume, no. $number, pp. $pages, $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@book':u'$authors, <i>$title</i>. $publisher, $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'cite':u'$index', 
      u'default':u'$authors, “$title”. $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      }

  plain = {
      
      u'@article':u'$authors. $title.{ <i>$journal</i>{, {$volume}{($number)}}{:$pages}{, $year}.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@book':u'$authors. <i>$title</i>. $publisher,{ $month} $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@incollection':u'$authors. $title.{ In <i>$booktitle</i> {($editor, ed.)}.} $publisher,{ $month} $year.{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'@inproceedings':u'$authors. $title. { <i>$booktitle</i>{, {$volume}{($number)}}{:$pages}{, $year}.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      u'cite':u'$index', 
      u'default':u'{$authors. }$title.{{ $publisher,} $year.}{ URL <a href="$url">$url</a>.}{ $note.}', 
      }

  vancouver = {
      
      u'@article':u'$authors. $title. <i>$journal</i>, $year{;{<b>$volume</b>}{($number)}{:$pages}}.{ URL: <a href="$url">$url</a>.}{ $note.}', 
      u'@book':u'$authors. $title. {$publisher, }$year.{ URL: <a href="$url">$url</a>.}{ $note.}', 
      u'cite':u'$index', 
      u'default':u'$authors. $title; {$publisher, }$year.{ $howpublished.}{ URL: <a href="$url">$url</a>.}{ $note.}', 
      }

class BibTeXConfig(object):
  "Configuration class from elyxer.config file"

  replaced = {
      u'--':u'—', u'..':u'.', 
      }

class ContainerConfig(object):
  "Configuration class from elyxer.config file"

  endings = {
      u'Align':u'\\end_layout', u'BarredText':u'\\bar', 
      u'BoldText':u'\\series', u'Cell':u'</cell', 
      u'ChangeDeleted':u'\\change_unchanged', 
      u'ChangeInserted':u'\\change_unchanged', u'ColorText':u'\\color', 
      u'EmphaticText':u'\\emph', u'Hfill':u'\\hfill', u'Inset':u'\\end_inset', 
      u'Layout':u'\\end_layout', u'LyXFooter':u'\\end_document', 
      u'LyXHeader':u'\\end_header', u'Row':u'</row', u'ShapedText':u'\\shape', 
      u'SizeText':u'\\size', u'StrikeOut':u'\\strikeout', 
      u'TextFamily':u'\\family', u'VersalitasText':u'\\noun', 
      }

  extracttext = {
      u'allowed':[u'StringContainer',u'Constant',u'FormulaConstant',], 
      u'cloned':[u'',], 
      u'extracted':[u'PlainLayout',u'TaggedText',u'Align',u'Caption',u'TextFamily',u'EmphaticText',u'VersalitasText',u'BarredText',u'SizeText',u'ColorText',u'LangLine',u'Formula',u'Bracket',u'RawText',u'BibTag',u'FormulaNumber',u'AlphaCommand',u'EmptyCommand',u'OneParamFunction',u'SymbolFunction',u'TextFunction',u'FontFunction',u'CombiningFunction',u'DecoratingFunction',u'FormulaSymbol',u'BracketCommand',u'TeXCode',], 
      }

  startendings = {
      u'\\begin_deeper':u'\\end_deeper', u'\\begin_inset':u'\\end_inset', 
      u'\\begin_layout':u'\\end_layout', 
      }

  starts = {
      u'':u'StringContainer', u'#LyX':u'BlackBox', u'</lyxtabular':u'BlackBox', 
      u'<cell':u'Cell', u'<column':u'Column', u'<row':u'Row', 
      u'\\align':u'Align', u'\\bar':u'BarredText', 
      u'\\bar default':u'BlackBox', u'\\bar no':u'BlackBox', 
      u'\\begin_body':u'BlackBox', u'\\begin_deeper':u'DeeperList', 
      u'\\begin_document':u'BlackBox', u'\\begin_header':u'LyXHeader', 
      u'\\begin_inset Argument':u'ShortTitle', 
      u'\\begin_inset Box':u'BoxInset', u'\\begin_inset Branch':u'Branch', 
      u'\\begin_inset Caption':u'Caption', 
      u'\\begin_inset CommandInset bibitem':u'BiblioEntry', 
      u'\\begin_inset CommandInset bibtex':u'BibTeX', 
      u'\\begin_inset CommandInset citation':u'BiblioCitation', 
      u'\\begin_inset CommandInset href':u'URL', 
      u'\\begin_inset CommandInset include':u'IncludeInset', 
      u'\\begin_inset CommandInset index_print':u'PrintIndex', 
      u'\\begin_inset CommandInset label':u'Label', 
      u'\\begin_inset CommandInset line':u'LineInset', 
      u'\\begin_inset CommandInset nomencl_print':u'PrintNomenclature', 
      u'\\begin_inset CommandInset nomenclature':u'NomenclatureEntry', 
      u'\\begin_inset CommandInset ref':u'Reference', 
      u'\\begin_inset CommandInset toc':u'TableOfContents', 
      u'\\begin_inset ERT':u'ERT', u'\\begin_inset Flex':u'FlexInset', 
      u'\\begin_inset Flex Chunkref':u'NewfangledChunkRef', 
      u'\\begin_inset Flex Marginnote':u'SideNote', 
      u'\\begin_inset Flex Sidenote':u'SideNote', 
      u'\\begin_inset Flex URL':u'FlexURL', u'\\begin_inset Float':u'Float', 
      u'\\begin_inset FloatList':u'ListOf', u'\\begin_inset Foot':u'Footnote', 
      u'\\begin_inset Formula':u'Formula', 
      u'\\begin_inset FormulaMacro':u'FormulaMacro', 
      u'\\begin_inset Graphics':u'Image', 
      u'\\begin_inset Index':u'IndexReference', 
      u'\\begin_inset Info':u'InfoInset', 
      u'\\begin_inset LatexCommand bibitem':u'BiblioEntry', 
      u'\\begin_inset LatexCommand bibtex':u'BibTeX', 
      u'\\begin_inset LatexCommand cite':u'BiblioCitation', 
      u'\\begin_inset LatexCommand citealt':u'BiblioCitation', 
      u'\\begin_inset LatexCommand citep':u'BiblioCitation', 
      u'\\begin_inset LatexCommand citet':u'BiblioCitation', 
      u'\\begin_inset LatexCommand htmlurl':u'URL', 
      u'\\begin_inset LatexCommand index':u'IndexReference', 
      u'\\begin_inset LatexCommand label':u'Label', 
      u'\\begin_inset LatexCommand nomenclature':u'NomenclatureEntry', 
      u'\\begin_inset LatexCommand prettyref':u'Reference', 
      u'\\begin_inset LatexCommand printindex':u'PrintIndex', 
      u'\\begin_inset LatexCommand printnomenclature':u'PrintNomenclature', 
      u'\\begin_inset LatexCommand ref':u'Reference', 
      u'\\begin_inset LatexCommand tableofcontents':u'TableOfContents', 
      u'\\begin_inset LatexCommand url':u'URL', 
      u'\\begin_inset LatexCommand vref':u'Reference', 
      u'\\begin_inset Marginal':u'SideNote', 
      u'\\begin_inset Newline':u'NewlineInset', 
      u'\\begin_inset Newpage':u'NewPageInset', u'\\begin_inset Note':u'Note', 
      u'\\begin_inset OptArg':u'ShortTitle', 
      u'\\begin_inset Phantom':u'PhantomText', 
      u'\\begin_inset Quotes':u'QuoteContainer', 
      u'\\begin_inset Tabular':u'Table', u'\\begin_inset Text':u'InsetText', 
      u'\\begin_inset VSpace':u'VerticalSpace', u'\\begin_inset Wrap':u'Wrap', 
      u'\\begin_inset listings':u'Listing', 
      u'\\begin_inset script':u'ScriptInset', u'\\begin_inset space':u'Space', 
      u'\\begin_layout':u'Layout', u'\\begin_layout Abstract':u'Abstract', 
      u'\\begin_layout Author':u'Author', 
      u'\\begin_layout Bibliography':u'Bibliography', 
      u'\\begin_layout Chunk':u'NewfangledChunk', 
      u'\\begin_layout Description':u'Description', 
      u'\\begin_layout Enumerate':u'ListItem', 
      u'\\begin_layout Itemize':u'ListItem', u'\\begin_layout List':u'List', 
      u'\\begin_layout LyX-Code':u'LyXCode', 
      u'\\begin_layout Plain':u'PlainLayout', 
      u'\\begin_layout Standard':u'StandardLayout', 
      u'\\begin_layout Title':u'Title', u'\\begin_preamble':u'LyXPreamble', 
      u'\\change_deleted':u'ChangeDeleted', 
      u'\\change_inserted':u'ChangeInserted', 
      u'\\change_unchanged':u'BlackBox', u'\\color':u'ColorText', 
      u'\\color inherit':u'BlackBox', u'\\color none':u'BlackBox', 
      u'\\emph default':u'BlackBox', u'\\emph off':u'BlackBox', 
      u'\\emph on':u'EmphaticText', u'\\emph toggle':u'EmphaticText', 
      u'\\end_body':u'LyXFooter', u'\\family':u'TextFamily', 
      u'\\family default':u'BlackBox', u'\\family roman':u'BlackBox', 
      u'\\hfill':u'Hfill', u'\\labelwidthstring':u'BlackBox', 
      u'\\lang':u'LangLine', u'\\length':u'InsetLength', 
      u'\\lyxformat':u'LyXFormat', u'\\lyxline':u'LyXLine', 
      u'\\newline':u'Newline', u'\\newpage':u'NewPage', 
      u'\\noindent':u'BlackBox', u'\\noun default':u'BlackBox', 
      u'\\noun off':u'BlackBox', u'\\noun on':u'VersalitasText', 
      u'\\paragraph_spacing':u'BlackBox', u'\\series bold':u'BoldText', 
      u'\\series default':u'BlackBox', u'\\series medium':u'BlackBox', 
      u'\\shape':u'ShapedText', u'\\shape default':u'BlackBox', 
      u'\\shape up':u'BlackBox', u'\\size':u'SizeText', 
      u'\\size normal':u'BlackBox', u'\\start_of_appendix':u'StartAppendix', 
      u'\\strikeout default':u'BlackBox', u'\\strikeout on':u'StrikeOut', 
      }

  string = {
      u'startcommand':u'\\', 
      }

  table = {
      u'headers':[u'<lyxtabular',u'<features',], 
      }

class EscapeConfig(object):
  "Configuration class from elyxer.config file"

  chars = {
      u'\n':u'', u' -- ':u' — ', u' --- ':u' — ', u'\'':u'’', u'`':u'‘', 
      }

  commands = {
      u'\\InsetSpace \\space{}':u' ', u'\\InsetSpace \\thinspace{}':u' ', 
      u'\\InsetSpace ~':u' ', u'\\SpecialChar \\-':u'', 
      u'\\SpecialChar \\@.':u'.', u'\\SpecialChar \\ldots{}':u'…', 
      u'\\SpecialChar \\menuseparator':u' ▷ ', 
      u'\\SpecialChar \\nobreakdash-':u'-', u'\\SpecialChar \\slash{}':u'/', 
      u'\\SpecialChar \\textcompwordmark{}':u'', u'\\backslash':u'\\', 
      }

  entities = {
      u'&':u'&amp;', u'<':u'&lt;', u'>':u'&gt;', 
      }

  html = {
      u'/>':u'>', 
      }

  iso885915 = {
      u' ':u'&nbsp;', u' ':u'&emsp;', u' ':u'&#8197;', 
      }

  nonunicode = {
      u' ':u' ', 
      }

class FormulaConfig(object):
  "Configuration class from elyxer.config file"

  alphacommands = {
      u'\\AA':u'Å', u'\\AE':u'Æ', 
      u'\\AmS':u'<span class="versalitas">AmS</span>', u'\\Angstroem':u'Å', 
      u'\\DH':u'Ð', u'\\Koppa':u'Ϟ', u'\\L':u'Ł', u'\\Micro':u'µ', u'\\O':u'Ø', 
      u'\\OE':u'Œ', u'\\Sampi':u'Ϡ', u'\\Stigma':u'Ϛ', u'\\TH':u'Þ', 
      u'\\aa':u'å', u'\\ae':u'æ', u'\\alpha':u'α', u'\\beta':u'β', 
      u'\\delta':u'δ', u'\\dh':u'ð', u'\\digamma':u'ϝ', u'\\epsilon':u'ϵ', 
      u'\\eta':u'η', u'\\eth':u'ð', u'\\gamma':u'γ', u'\\i':u'ı', 
      u'\\imath':u'ı', u'\\iota':u'ι', u'\\j':u'ȷ', u'\\jmath':u'ȷ', 
      u'\\kappa':u'κ', u'\\koppa':u'ϟ', u'\\l':u'ł', u'\\lambda':u'λ', 
      u'\\mu':u'μ', u'\\nu':u'ν', u'\\o':u'ø', u'\\oe':u'œ', u'\\omega':u'ω', 
      u'\\phi':u'φ', u'\\pi':u'π', u'\\psi':u'ψ', u'\\rho':u'ρ', 
      u'\\sampi':u'ϡ', u'\\sigma':u'σ', u'\\ss':u'ß', u'\\stigma':u'ϛ', 
      u'\\tau':u'τ', u'\\tcohm':u'Ω', u'\\textcrh':u'ħ', u'\\th':u'þ', 
      u'\\theta':u'θ', u'\\upsilon':u'υ', u'\\varDelta':u'∆', 
      u'\\varGamma':u'Γ', u'\\varLambda':u'Λ', u'\\varOmega':u'Ω', 
      u'\\varPhi':u'Φ', u'\\varPi':u'Π', u'\\varPsi':u'Ψ', u'\\varSigma':u'Σ', 
      u'\\varTheta':u'Θ', u'\\varUpsilon':u'Υ', u'\\varXi':u'Ξ', 
      u'\\varbeta':u'ϐ', u'\\varepsilon':u'ε', u'\\varkappa':u'ϰ', 
      u'\\varphi':u'φ', u'\\varpi':u'ϖ', u'\\varrho':u'ϱ', u'\\varsigma':u'ς', 
      u'\\vartheta':u'ϑ', u'\\xi':u'ξ', u'\\zeta':u'ζ', 
      }

  array = {
      u'begin':u'\\begin', u'cellseparator':u'&', u'end':u'\\end', 
      u'rowseparator':u'\\\\', 
      }

  bigbrackets = {
      u'(':[u'⎛',u'⎜',u'⎝',], u')':[u'⎞',u'⎟',u'⎠',], u'[':[u'⎡',u'⎢',u'⎣',], 
      u']':[u'⎤',u'⎥',u'⎦',], u'{':[u'⎧',u'⎪',u'⎨',u'⎩',], u'|':[u'|',], 
      u'}':[u'⎫',u'⎪',u'⎬',u'⎭',], u'∥':[u'∥',], 
      }

  bigsymbols = {
      u'∑':[u'⎲',u'⎳',], u'∫':[u'⌠',u'⌡',], 
      }

  bracketcommands = {
      u'\\left':u'span class="symbol"', 
      u'\\left.':u'<span class="leftdot"></span>', 
      u'\\middle':u'span class="symbol"', u'\\right':u'span class="symbol"', 
      u'\\right.':u'<span class="rightdot"></span>', 
      }

  combiningfunctions = {
      u'\\"':u'̈', u'\\\'':u'́', u'\\^':u'̂', u'\\`':u'̀', u'\\acute':u'́', 
      u'\\bar':u'̄', u'\\breve':u'̆', u'\\c':u'̧', u'\\check':u'̌', 
      u'\\dddot':u'⃛', u'\\ddot':u'̈', u'\\dot':u'̇', u'\\grave':u'̀', 
      u'\\hat':u'̂', u'\\mathring':u'̊', u'\\overleftarrow':u'⃖', 
      u'\\overrightarrow':u'⃗', u'\\r':u'̊', u'\\s':u'̩', 
      u'\\textcircled':u'⃝', u'\\textsubring':u'̥', u'\\tilde':u'̃', 
      u'\\v':u'̌', u'\\vec':u'⃗', u'\\~':u'̃', 
      }

  commands = {
      u'\\ ':u' ', u'\\!':u'', u'\\#':u'#', u'\\$':u'$', u'\\%':u'%', 
      u'\\&':u'&', u'\\,':u' ', u'\\:':u' ', u'\\;':u' ', u'\\AC':u'∿', 
      u'\\APLcomment':u'⍝', u'\\APLdownarrowbox':u'⍗', u'\\APLinput':u'⍞', 
      u'\\APLinv':u'⌹', u'\\APLleftarrowbox':u'⍇', u'\\APLlog':u'⍟', 
      u'\\APLrightarrowbox':u'⍈', u'\\APLuparrowbox':u'⍐', u'\\Box':u'□', 
      u'\\Bumpeq':u'≎', u'\\CIRCLE':u'●', u'\\Cap':u'⋒', 
      u'\\CapitalDifferentialD':u'ⅅ', u'\\CheckedBox':u'☑', u'\\Circle':u'○', 
      u'\\Coloneqq':u'⩴', u'\\ComplexI':u'ⅈ', u'\\ComplexJ':u'ⅉ', 
      u'\\Corresponds':u'≙', u'\\Cup':u'⋓', u'\\Delta':u'Δ', u'\\Diamond':u'◇', 
      u'\\Diamondblack':u'◆', u'\\Diamonddot':u'⟐', u'\\DifferentialD':u'ⅆ', 
      u'\\Downarrow':u'⇓', u'\\EUR':u'€', u'\\Euler':u'ℇ', 
      u'\\ExponetialE':u'ⅇ', u'\\Finv':u'Ⅎ', u'\\Game':u'⅁', u'\\Gamma':u'Γ', 
      u'\\Im':u'ℑ', u'\\Join':u'⨝', u'\\LEFTCIRCLE':u'◖', u'\\LEFTcircle':u'◐', 
      u'\\LHD':u'◀', u'\\Lambda':u'Λ', u'\\Lbag':u'⟅', u'\\Leftarrow':u'⇐', 
      u'\\Lleftarrow':u'⇚', u'\\Longleftarrow':u'⟸', 
      u'\\Longleftrightarrow':u'⟺', u'\\Longrightarrow':u'⟹', u'\\Lparen':u'⦅', 
      u'\\Lsh':u'↰', u'\\Mapsfrom':u'⇐|', u'\\Mapsto':u'|⇒', u'\\Omega':u'Ω', 
      u'\\P':u'¶', u'\\Phi':u'Φ', u'\\Pi':u'Π', u'\\Pr':u'Pr', u'\\Psi':u'Ψ', 
      u'\\Qoppa':u'Ϙ', u'\\RHD':u'▶', u'\\RIGHTCIRCLE':u'◗', 
      u'\\RIGHTcircle':u'◑', u'\\Rbag':u'⟆', u'\\Re':u'ℜ', u'\\Rparen':u'⦆', 
      u'\\Rrightarrow':u'⇛', u'\\Rsh':u'↱', u'\\S':u'§', u'\\Sigma':u'Σ', 
      u'\\Square':u'☐', u'\\Subset':u'⋐', u'\\Sun':u'☉', u'\\Supset':u'⋑', 
      u'\\Theta':u'Θ', u'\\Uparrow':u'⇑', u'\\Updownarrow':u'⇕', 
      u'\\Upsilon':u'Υ', u'\\Vdash':u'⊩', u'\\Vert':u'∥', u'\\Vvdash':u'⊪', 
      u'\\XBox':u'☒', u'\\Xi':u'Ξ', u'\\Yup':u'⅄', u'\\\\':u'<br/>', 
      u'\\_':u'_', u'\\aleph':u'ℵ', u'\\amalg':u'∐', u'\\anchor':u'⚓', 
      u'\\angle':u'∠', u'\\aquarius':u'♒', u'\\arccos':u'arccos', 
      u'\\arcsin':u'arcsin', u'\\arctan':u'arctan', u'\\arg':u'arg', 
      u'\\aries':u'♈', u'\\arrowbullet':u'➢', u'\\ast':u'∗', u'\\asymp':u'≍', 
      u'\\backepsilon':u'∍', u'\\backprime':u'‵', u'\\backsimeq':u'⋍', 
      u'\\backslash':u'\\', u'\\ballotx':u'✗', u'\\barwedge':u'⊼', 
      u'\\because':u'∵', u'\\beth':u'ℶ', u'\\between':u'≬', u'\\bigcap':u'∩', 
      u'\\bigcirc':u'○', u'\\bigcup':u'∪', u'\\bigodot':u'⊙', 
      u'\\bigoplus':u'⊕', u'\\bigotimes':u'⊗', u'\\bigsqcup':u'⊔', 
      u'\\bigstar':u'★', u'\\bigtriangledown':u'▽', u'\\bigtriangleup':u'△', 
      u'\\biguplus':u'⊎', u'\\bigvee':u'∨', u'\\bigwedge':u'∧', 
      u'\\biohazard':u'☣', u'\\blacklozenge':u'⧫', u'\\blacksmiley':u'☻', 
      u'\\blacksquare':u'■', u'\\blacktriangle':u'▲', 
      u'\\blacktriangledown':u'▼', u'\\blacktriangleleft':u'◂', 
      u'\\blacktriangleright':u'▶', u'\\blacktriangleup':u'▴', u'\\bot':u'⊥', 
      u'\\bowtie':u'⋈', u'\\box':u'▫', u'\\boxast':u'⧆', u'\\boxbar':u'◫', 
      u'\\boxbox':u'⧈', u'\\boxbslash':u'⧅', u'\\boxcircle':u'⧇', 
      u'\\boxdot':u'⊡', u'\\boxminus':u'⊟', u'\\boxplus':u'⊞', 
      u'\\boxslash':u'⧄', u'\\boxtimes':u'⊠', u'\\bullet':u'•', 
      u'\\bumpeq':u'≏', u'\\cancer':u'♋', u'\\cap':u'∩', u'\\capricornus':u'♑', 
      u'\\cat':u'⁀', u'\\cdot':u'⋅', u'\\cdots':u'⋯', u'\\cent':u'¢', 
      u'\\centerdot':u'∙', u'\\checkmark':u'✓', u'\\chi':u'χ', u'\\circ':u'∘', 
      u'\\circeq':u'≗', u'\\circlearrowleft':u'↺', u'\\circlearrowright':u'↻', 
      u'\\circledR':u'®', u'\\circledast':u'⊛', u'\\circledbslash':u'⦸', 
      u'\\circledcirc':u'⊚', u'\\circleddash':u'⊝', u'\\circledgtr':u'⧁', 
      u'\\circledless':u'⧀', u'\\clubsuit':u'♣', u'\\colon':u': ', u'\\coloneqq':u'≔', 
      u'\\complement':u'∁', u'\\cong':u'≅', u'\\coprod':u'∐', 
      u'\\copyright':u'©', u'\\cos':u'cos', u'\\cosh':u'cosh', u'\\cot':u'cot', 
      u'\\coth':u'coth', u'\\csc':u'csc', u'\\cup':u'∪', u'\\curlyvee':u'⋎', 
      u'\\curlywedge':u'⋏', u'\\curvearrowleft':u'↶', 
      u'\\curvearrowright':u'↷', u'\\dag':u'†', u'\\dagger':u'†', 
      u'\\daleth':u'ℸ', u'\\dashleftarrow':u'⇠', u'\\dashv':u'⊣', 
      u'\\ddag':u'‡', u'\\ddagger':u'‡', u'\\ddots':u'⋱', u'\\deg':u'deg', 
      u'\\det':u'det', u'\\diagdown':u'╲', u'\\diagup':u'╱', 
      u'\\diameter':u'⌀', u'\\diamond':u'◇', u'\\diamondsuit':u'♦', 
      u'\\dim':u'dim', u'\\div':u'÷', u'\\divideontimes':u'⋇', 
      u'\\dotdiv':u'∸', u'\\doteq':u'≐', u'\\doteqdot':u'≑', u'\\dotplus':u'∔', 
      u'\\dots':u'…', u'\\doublebarwedge':u'⌆', u'\\downarrow':u'↓', 
      u'\\downdownarrows':u'⇊', u'\\downharpoonleft':u'⇃', 
      u'\\downharpoonright':u'⇂', u'\\dsub':u'⩤', u'\\earth':u'♁', 
      u'\\eighthnote':u'♪', u'\\ell':u'ℓ', u'\\emptyset':u'∅', 
      u'\\eqcirc':u'≖', u'\\eqcolon':u'≕', u'\\eqsim':u'≂', u'\\euro':u'€', 
      u'\\exists':u'∃', u'\\exp':u'exp', u'\\fallingdotseq':u'≒', 
      u'\\fcmp':u'⨾', u'\\female':u'♀', u'\\flat':u'♭', u'\\forall':u'∀', 
      u'\\fourth':u'⁗', u'\\frown':u'⌢', u'\\frownie':u'☹', u'\\gcd':u'gcd', 
      u'\\gemini':u'♊', u'\\geq)':u'≥', u'\\geqq':u'≧', u'\\geqslant':u'≥', 
      u'\\gets':u'←', u'\\gg':u'≫', u'\\ggg':u'⋙', u'\\gimel':u'ℷ', 
      u'\\gneqq':u'≩', u'\\gnsim':u'⋧', u'\\gtrdot':u'⋗', u'\\gtreqless':u'⋚', 
      u'\\gtreqqless':u'⪌', u'\\gtrless':u'≷', u'\\gtrsim':u'≳', 
      u'\\guillemotleft':u'«', u'\\guillemotright':u'»', u'\\hbar':u'ℏ', 
      u'\\heartsuit':u'♥', u'\\hfill':u'<span class="hfill"> </span>', 
      u'\\hom':u'hom', u'\\hookleftarrow':u'↩', u'\\hookrightarrow':u'↪', 
      u'\\hslash':u'ℏ', u'\\idotsint':u'<span class="bigsymbol">∫⋯∫</span>', 
      u'\\iiint':u'<span class="bigsymbol">∭</span>', 
      u'\\iint':u'<span class="bigsymbol">∬</span>', u'\\imath':u'ı', 
      u'\\inf':u'inf', u'\\infty':u'∞', u'\\intercal':u'⊺', 
      u'\\interleave':u'⫴', u'\\invamp':u'⅋', u'\\invneg':u'⌐', 
      u'\\jmath':u'ȷ', u'\\jupiter':u'♃', u'\\ker':u'ker', u'\\land':u'∧', 
      u'\\landupint':u'<span class="bigsymbol">∱</span>', u'\\lang':u'⟪', 
      u'\\langle':u'⟨', u'\\lblot':u'⦉', u'\\lbrace':u'{', u'\\lbrace)':u'{', 
      u'\\lbrack':u'[', u'\\lceil':u'⌈', u'\\ldots':u'…', u'\\leadsto':u'⇝', 
      u'\\leftarrow)':u'←', u'\\leftarrowtail':u'↢', u'\\leftarrowtobar':u'⇤', 
      u'\\leftharpoondown':u'↽', u'\\leftharpoonup':u'↼', 
      u'\\leftleftarrows':u'⇇', u'\\leftleftharpoons':u'⥢', u'\\leftmoon':u'☾', 
      u'\\leftrightarrow':u'↔', u'\\leftrightarrows':u'⇆', 
      u'\\leftrightharpoons':u'⇋', u'\\leftthreetimes':u'⋋', u'\\leo':u'♌', 
      u'\\leq)':u'≤', u'\\leqq':u'≦', u'\\leqslant':u'≤', u'\\lessdot':u'⋖', 
      u'\\lesseqgtr':u'⋛', u'\\lesseqqgtr':u'⪋', u'\\lessgtr':u'≶', 
      u'\\lesssim':u'≲', u'\\lfloor':u'⌊', u'\\lg':u'lg', u'\\lgroup':u'⟮', 
      u'\\lhd':u'⊲', u'\\libra':u'♎', u'\\lightning':u'↯', u'\\limg':u'⦇', 
      u'\\liminf':u'liminf', u'\\limsup':u'limsup', u'\\ll':u'≪', 
      u'\\llbracket':u'⟦', u'\\llcorner':u'⌞', u'\\lll':u'⋘', u'\\ln':u'ln', 
      u'\\lneqq':u'≨', u'\\lnot':u'¬', u'\\lnsim':u'⋦', u'\\log':u'log', 
      u'\\longleftarrow':u'⟵', u'\\longleftrightarrow':u'⟷', 
      u'\\longmapsto':u'⟼', u'\\longrightarrow':u'⟶', u'\\looparrowleft':u'↫', 
      u'\\looparrowright':u'↬', u'\\lor':u'∨', u'\\lozenge':u'◊', 
      u'\\lrcorner':u'⌟', u'\\ltimes':u'⋉', u'\\lyxlock':u'', u'\\male':u'♂', 
      u'\\maltese':u'✠', u'\\mapsfrom':u'↤', u'\\mapsto':u'↦', 
      u'\\mathcircumflex':u'^', u'\\max':u'max', u'\\measuredangle':u'∡', 
      u'\\medbullet':u'⚫', u'\\medcirc':u'⚪', u'\\mercury':u'☿', u'\\mho':u'℧', 
      u'\\mid':u'∣', u'\\min':u'min', u'\\models':u'⊨', u'\\mp':u'∓', 
      u'\\multimap':u'⊸', u'\\nLeftarrow':u'⇍', u'\\nLeftrightarrow':u'⇎', 
      u'\\nRightarrow':u'⇏', u'\\nVDash':u'⊯', u'\\nabla':u'∇', 
      u'\\napprox':u'≉', u'\\natural':u'♮', u'\\ncong':u'≇', u'\\nearrow':u'↗', 
      u'\\neg':u'¬', u'\\neg)':u'¬', u'\\neptune':u'♆', u'\\nequiv':u'≢', 
      u'\\newline':u'<br/>', u'\\nexists':u'∄', u'\\ngeqslant':u'≱', 
      u'\\ngtr':u'≯', u'\\ngtrless':u'≹', u'\\ni':u'∋', u'\\ni)':u'∋', 
      u'\\nleftarrow':u'↚', u'\\nleftrightarrow':u'↮', u'\\nleqslant':u'≰', 
      u'\\nless':u'≮', u'\\nlessgtr':u'≸', u'\\nmid':u'∤', u'\\nolimits':u'', 
      u'\\nonumber':u'', u'\\not':u'¬', u'\\not<':u'≮', u'\\not=':u'≠', 
      u'\\not>':u'≯', u'\\notbackslash':u'⍀', u'\\notin':u'∉', u'\\notni':u'∌', 
      u'\\notslash':u'⌿', u'\\nparallel':u'∦', u'\\nprec':u'⊀', 
      u'\\nrightarrow':u'↛', u'\\nsim':u'≁', u'\\nsimeq':u'≄', 
      u'\\nsqsubset':u'⊏̸', u'\\nsubseteq':u'⊈', u'\\nsucc':u'⊁', 
      u'\\nsucccurlyeq':u'⋡', u'\\nsupset':u'⊅', u'\\nsupseteq':u'⊉', 
      u'\\ntriangleleft':u'⋪', u'\\ntrianglelefteq':u'⋬', 
      u'\\ntriangleright':u'⋫', u'\\ntrianglerighteq':u'⋭', u'\\nvDash':u'⊭', 
      u'\\nvdash':u'⊬', u'\\nwarrow':u'↖', u'\\odot':u'⊙', 
      u'\\officialeuro':u'€', u'\\oiiint':u'<span class="bigsymbol">∰</span>', 
      u'\\oiint':u'<span class="bigsymbol">∯</span>', 
      u'\\oint':u'<span class="bigsymbol">∮</span>', 
      u'\\ointclockwise':u'<span class="bigsymbol">∲</span>', 
      u'\\ointctrclockwise':u'<span class="bigsymbol">∳</span>', 
      u'\\ominus':u'⊖', u'\\oplus':u'⊕', u'\\oslash':u'⊘', u'\\otimes':u'⊗', 
      u'\\owns':u'∋', u'\\parallel':u'∥', u'\\partial':u'∂', u'\\pencil':u'✎', 
      u'\\perp':u'⊥', u'\\pisces':u'♓', u'\\pitchfork':u'⋔', u'\\pluto':u'♇', 
      u'\\pm':u'±', u'\\pointer':u'➪', u'\\pointright':u'☞', u'\\pounds':u'£', 
      u'\\prec':u'≺', u'\\preccurlyeq':u'≼', u'\\preceq':u'≼', 
      u'\\precsim':u'≾', u'\\prime':u'′', u'\\prompto':u'∝', u'\\qoppa':u'ϙ', 
      u'\\qquad':u'  ', u'\\quad':u' ', u'\\quarternote':u'♩', 
      u'\\radiation':u'☢', u'\\rang':u'⟫', u'\\rangle':u'⟩', u'\\rblot':u'⦊', 
      u'\\rbrace':u'}', u'\\rbrace)':u'}', u'\\rbrack':u']', u'\\rceil':u'⌉', 
      u'\\recycle':u'♻', u'\\rfloor':u'⌋', u'\\rgroup':u'⟯', u'\\rhd':u'⊳', 
      u'\\rightangle':u'∟', u'\\rightarrow)':u'→', u'\\rightarrowtail':u'↣', 
      u'\\rightarrowtobar':u'⇥', u'\\rightharpoondown':u'⇁', 
      u'\\rightharpoonup':u'⇀', u'\\rightharpooondown':u'⇁', 
      u'\\rightharpooonup':u'⇀', u'\\rightleftarrows':u'⇄', 
      u'\\rightleftharpoons':u'⇌', u'\\rightmoon':u'☽', 
      u'\\rightrightarrows':u'⇉', u'\\rightrightharpoons':u'⥤', 
      u'\\rightthreetimes':u'⋌', u'\\rimg':u'⦈', u'\\risingdotseq':u'≓', 
      u'\\rrbracket':u'⟧', u'\\rsub':u'⩥', u'\\rtimes':u'⋊', 
      u'\\sagittarius':u'♐', u'\\saturn':u'♄', u'\\scorpio':u'♏', 
      u'\\searrow':u'↘', u'\\sec':u'sec', u'\\second':u'″', u'\\setminus':u'∖', 
      u'\\sharp':u'♯', u'\\simeq':u'≃', u'\\sin':u'sin', u'\\sinh':u'sinh', 
      u'\\sixteenthnote':u'♬', u'\\skull':u'☠', u'\\slash':u'∕', 
      u'\\smallsetminus':u'∖', u'\\smalltriangledown':u'▿', 
      u'\\smalltriangleleft':u'◃', u'\\smalltriangleright':u'▹', 
      u'\\smalltriangleup':u'▵', u'\\smile':u'⌣', u'\\smiley':u'☺', 
      u'\\spadesuit':u'♠', u'\\spddot':u'¨', u'\\sphat':u'', 
      u'\\sphericalangle':u'∢', u'\\spot':u'⦁', u'\\sptilde':u'~', 
      u'\\sqcap':u'⊓', u'\\sqcup':u'⊔', u'\\sqsubset':u'⊏', 
      u'\\sqsubseteq':u'⊑', u'\\sqsupset':u'⊐', u'\\sqsupseteq':u'⊒', 
      u'\\square':u'□', u'\\sslash':u'⫽', u'\\star':u'⋆', u'\\steaming':u'☕', 
      u'\\subseteqq':u'⫅', u'\\subsetneqq':u'⫋', u'\\succ':u'≻', 
      u'\\succcurlyeq':u'≽', u'\\succeq':u'≽', u'\\succnsim':u'⋩', 
      u'\\succsim':u'≿', u'\\sun':u'☼', u'\\sup':u'sup', u'\\supseteqq':u'⫆', 
      u'\\supsetneqq':u'⫌', u'\\surd':u'√', u'\\swarrow':u'↙', 
      u'\\swords':u'⚔', u'\\talloblong':u'⫾', u'\\tan':u'tan', 
      u'\\tanh':u'tanh', u'\\taurus':u'♉', u'\\textasciicircum':u'^', 
      u'\\textasciitilde':u'~', u'\\textbackslash':u'\\', 
      u'\\textcopyright':u'©\'', u'\\textdegree':u'°', u'\\textellipsis':u'…', 
      u'\\textemdash':u'—', u'\\textendash':u'—', u'\\texteuro':u'€', 
      u'\\textgreater':u'>', u'\\textless':u'<', u'\\textordfeminine':u'ª', 
      u'\\textordmasculine':u'º', u'\\textquotedblleft':u'“', 
      u'\\textquotedblright':u'”', u'\\textquoteright':u'’', 
      u'\\textregistered':u'®', u'\\textrightarrow':u'→', 
      u'\\textsection':u'§', u'\\texttrademark':u'™', 
      u'\\texttwosuperior':u'²', u'\\textvisiblespace':u' ', 
      u'\\therefore':u'∴', u'\\third':u'‴', u'\\top':u'⊤', u'\\triangle':u'△', 
      u'\\triangleleft':u'⊲', u'\\trianglelefteq':u'⊴', u'\\triangleq':u'≜', 
      u'\\triangleright':u'▷', u'\\trianglerighteq':u'⊵', 
      u'\\twoheadleftarrow':u'↞', u'\\twoheadrightarrow':u'↠', 
      u'\\twonotes':u'♫', u'\\udot':u'⊍', u'\\ulcorner':u'⌜', u'\\unlhd':u'⊴', 
      u'\\unrhd':u'⊵', u'\\unrhl':u'⊵', u'\\uparrow':u'↑', 
      u'\\updownarrow':u'↕', u'\\upharpoonleft':u'↿', u'\\upharpoonright':u'↾', 
      u'\\uplus':u'⊎', u'\\upuparrows':u'⇈', u'\\uranus':u'♅', 
      u'\\urcorner':u'⌝', u'\\vDash':u'⊨', u'\\varclubsuit':u'♧', 
      u'\\vardiamondsuit':u'♦', u'\\varheartsuit':u'♥', u'\\varnothing':u'∅', 
      u'\\varspadesuit':u'♤', u'\\vdash':u'⊢', u'\\vdots':u'⋮', u'\\vee':u'∨', 
      u'\\vee)':u'∨', u'\\veebar':u'⊻', u'\\vert':u'∣', u'\\virgo':u'♍', 
      u'\\warning':u'⚠', u'\\wasylozenge':u'⌑', u'\\wedge':u'∧', 
      u'\\wedge)':u'∧', u'\\wp':u'℘', u'\\wr':u'≀', u'\\yen':u'¥', 
      u'\\yinyang':u'☯', u'\\{':u'{', u'\\|':u'∥', u'\\}':u'}', 
      }

  decoratedcommand = {
      
      }

  decoratingfunctions = {
      u'\\overleftarrow':u'⟵', u'\\overrightarrow':u'⟶', u'\\widehat':u'^', 
      }

  endings = {
      u'bracket':u'}', u'complex':u'\\]', u'endafter':u'}', 
      u'endbefore':u'\\end{', u'squarebracket':u']', 
      }

  environments = {
      u'align':[u'r',u'l',], u'eqnarray':[u'r',u'c',u'l',], 
      u'gathered':[u'l',u'l',], 
      }

  fontfunctions = {
      u'\\boldsymbol':u'b', u'\\mathbb':u'span class="blackboard"', 
      u'\\mathbb{A}':u'𝔸', u'\\mathbb{B}':u'𝔹', u'\\mathbb{C}':u'ℂ', 
      u'\\mathbb{D}':u'𝔻', u'\\mathbb{E}':u'𝔼', u'\\mathbb{F}':u'𝔽', 
      u'\\mathbb{G}':u'𝔾', u'\\mathbb{H}':u'ℍ', u'\\mathbb{J}':u'𝕁', 
      u'\\mathbb{K}':u'𝕂', u'\\mathbb{L}':u'𝕃', u'\\mathbb{N}':u'ℕ', 
      u'\\mathbb{O}':u'𝕆', u'\\mathbb{P}':u'ℙ', u'\\mathbb{Q}':u'ℚ', 
      u'\\mathbb{R}':u'ℝ', u'\\mathbb{S}':u'𝕊', u'\\mathbb{T}':u'𝕋', 
      u'\\mathbb{W}':u'𝕎', u'\\mathbb{Z}':u'ℤ', u'\\mathbf':u'b', 
      u'\\mathcal':u'span class="scriptfont"', u'\\mathcal{B}':u'ℬ', 
      u'\\mathcal{E}':u'ℰ', u'\\mathcal{F}':u'ℱ', u'\\mathcal{H}':u'ℋ', 
      u'\\mathcal{I}':u'ℐ', u'\\mathcal{L}':u'ℒ', u'\\mathcal{M}':u'ℳ', 
      u'\\mathcal{R}':u'ℛ', u'\\mathfrak':u'span class="fraktur"', 
      u'\\mathfrak{C}':u'ℭ', u'\\mathfrak{F}':u'𝔉', u'\\mathfrak{H}':u'ℌ', 
      u'\\mathfrak{I}':u'ℑ', u'\\mathfrak{R}':u'ℜ', u'\\mathfrak{Z}':u'ℨ', 
      u'\\mathit':u'i', u'\\mathring{A}':u'Å', u'\\mathring{U}':u'Ů', 
      u'\\mathring{a}':u'å', u'\\mathring{u}':u'ů', u'\\mathring{w}':u'ẘ', 
      u'\\mathring{y}':u'ẙ', u'\\mathrm':u'span class="mathrm"', 
      u'\\mathscr':u'span class="scriptfont"', u'\\mathscr{B}':u'ℬ', 
      u'\\mathscr{E}':u'ℰ', u'\\mathscr{F}':u'ℱ', u'\\mathscr{H}':u'ℋ', 
      u'\\mathscr{I}':u'ℐ', u'\\mathscr{L}':u'ℒ', u'\\mathscr{M}':u'ℳ', 
      u'\\mathscr{R}':u'ℛ', u'\\mathsf':u'span class="mathsf"', 
      u'\\mathtt':u'tt', 
      }

  hybridfunctions = {
      u'\\addcontentsline':[u'{$p!}{$q!}{$r!}',u'f0{}',u'ignored',], 
      u'\\addtocontents':[u'{$p!}{$q!}',u'f0{}',u'ignored',], 
      u'\\backmatter':[u'',u'f0{}',u'ignored',], 
      u'\\binom':[u'{$1}{$2}',u'f2{(}f0{f1{$1}f1{$2}}f2{)}',u'span class="binom"',u'span class="binomstack"',u'span class="bigsymbol"',], 
      u'\\boxed':[u'{$1}',u'f0{$1}',u'span class="boxed"',], 
      u'\\cfrac':[u'[$p!]{$1}{$2}',u'f0{f3{(}f1{$1}f3{)/(}f2{$2}f3{)}}',u'span class="fullfraction"',u'span class="numerator align-$p"',u'span class="denominator"',u'span class="ignored"',], 
      u'\\color':[u'{$p!}{$1}',u'f0{$1}',u'span style="color: $p;"',], 
      u'\\colorbox':[u'{$p!}{$1}',u'f0{$1}',u'span class="colorbox" style="background: $p;"',], 
      u'\\dbinom':[u'{$1}{$2}',u'(f0{f1{f2{$1}}f1{f2{ }}f1{f2{$2}}})',u'span class="binomial"',u'span class="binomrow"',u'span class="binomcell"',], 
      u'\\dfrac':[u'{$1}{$2}',u'f0{f3{(}f1{$1}f3{)/(}f2{$2}f3{)}}',u'span class="fullfraction"',u'span class="numerator"',u'span class="denominator"',u'span class="ignored"',], 
      u'\\displaystyle':[u'{$1}',u'f0{$1}',u'span class="displaystyle"',], 
      u'\\fancyfoot':[u'[$p!]{$q!}',u'f0{}',u'ignored',], 
      u'\\fancyhead':[u'[$p!]{$q!}',u'f0{}',u'ignored',], 
      u'\\fbox':[u'{$1}',u'f0{$1}',u'span class="fbox"',], 
      u'\\fboxrule':[u'{$p!}',u'f0{}',u'ignored',], 
      u'\\fboxsep':[u'{$p!}',u'f0{}',u'ignored',], 
      u'\\fcolorbox':[u'{$p!}{$q!}{$1}',u'f0{$1}',u'span class="boxed" style="border-color: $p; background: $q;"',], 
      u'\\frac':[u'{$1}{$2}',u'f0{f3{(}f1{$1}f3{)/(}f2{$2}f3{)}}',u'span class="fraction"',u'span class="numerator"',u'span class="denominator"',u'span class="ignored"',], 
      u'\\framebox':[u'[$p!][$q!]{$1}',u'f0{$1}',u'span class="framebox align-$q" style="width: $p;"',], 
      u'\\frontmatter':[u'',u'f0{}',u'ignored',], 
      u'\\href':[u'[$o]{$u!}{$t!}',u'f0{$t}',u'a href="$u"',], 
      u'\\hspace':[u'{$p!}',u'f0{ }',u'span class="hspace" style="width: $p;"',], 
      u'\\leftroot':[u'{$p!}',u'f0{ }',u'span class="leftroot" style="width: $p;px"',], 
      u'\\mainmatter':[u'',u'f0{}',u'ignored',], 
      u'\\markboth':[u'{$p!}{$q!}',u'f0{}',u'ignored',], 
      u'\\markright':[u'{$p!}',u'f0{}',u'ignored',], 
      u'\\nicefrac':[u'{$1}{$2}',u'f0{f1{$1}⁄f2{$2}}',u'span class="fraction"',u'sup class="numerator"',u'sub class="denominator"',u'span class="ignored"',], 
      u'\\parbox':[u'[$p!]{$w!}{$1}',u'f0{1}',u'div class="Boxed" style="width: $w;"',], 
      u'\\raisebox':[u'{$p!}{$1}',u'f0{$1.font}',u'span class="raisebox" style="vertical-align: $p;"',], 
      u'\\renewenvironment':[u'{$1!}{$2!}{$3!}',u'',], 
      u'\\rule':[u'[$v!]{$w!}{$h!}',u'f0/',u'hr class="line" style="width: $w; height: $h;"',], 
      u'\\scriptscriptstyle':[u'{$1}',u'f0{$1}',u'span class="scriptscriptstyle"',], 
      u'\\scriptstyle':[u'{$1}',u'f0{$1}',u'span class="scriptstyle"',], 
      u'\\sqrt':[u'[$0]{$1}',u'f0{f1{$0}f2{√}f4{(}f3{$1}f4{)}}',u'span class="sqrt"',u'sup class="root"',u'span class="radical"',u'span class="root"',u'span class="ignored"',], 
      u'\\stackrel':[u'{$1}{$2}',u'f0{f1{$1}f2{$2}}',u'span class="stackrel"',u'span class="upstackrel"',u'span class="downstackrel"',], 
      u'\\tbinom':[u'{$1}{$2}',u'(f0{f1{f2{$1}}f1{f2{ }}f1{f2{$2}}})',u'span class="binomial"',u'span class="binomrow"',u'span class="binomcell"',], 
      u'\\textcolor':[u'{$p!}{$1}',u'f0{$1}',u'span style="color: $p;"',], 
      u'\\textstyle':[u'{$1}',u'f0{$1}',u'span class="textstyle"',], 
      u'\\thispagestyle':[u'{$p!}',u'f0{}',u'ignored',], 
      u'\\unit':[u'[$0]{$1}',u'$0f0{$1.font}',u'span class="unit"',], 
      u'\\unitfrac':[u'[$0]{$1}{$2}',u'$0f0{f1{$1.font}⁄f2{$2.font}}',u'span class="fraction"',u'sup class="unit"',u'sub class="unit"',], 
      u'\\uproot':[u'{$p!}',u'f0{ }',u'span class="uproot" style="width: $p;px"',], 
      u'\\url':[u'{$u!}',u'f0{$u}',u'a href="$u"',], 
      u'\\vspace':[u'{$p!}',u'f0{ }',u'span class="vspace" style="height: $p;"',], 
      }

  hybridsizes = {
      u'\\binom':u'$1+$2', u'\\cfrac':u'$1+$2', u'\\dbinom':u'$1+$2+1', 
      u'\\dfrac':u'$1+$2', u'\\frac':u'$1+$2', u'\\tbinom':u'$1+$2+1', 
      }

  labelfunctions = {
      u'\\label':u'a name="#"', 
      }

  limitcommands = {
      u'\\biginterleave':u'⫼', u'\\bigsqcap':u'⨅', u'\\fint':u'⨏', 
      u'\\iiiint':u'⨌', u'\\int':u'∫', u'\\intop':u'∫', u'\\lim':u'lim', 
      u'\\prod':u'∏', u'\\smallint':u'∫', u'\\sqint':u'⨖', u'\\sum':u'∑', 
      u'\\varointclockwise':u'∲', u'\\varprod':u'⨉', u'\\zcmp':u'⨟', 
      u'\\zhide':u'⧹', u'\\zpipe':u'⨠', u'\\zproject':u'⨡', 
      }

  misccommands = {
      u'\\limits':u'LimitPreviousCommand', u'\\newcommand':u'MacroDefinition', 
      u'\\renewcommand':u'MacroDefinition', 
      u'\\setcounter':u'SetCounterFunction', u'\\tag':u'FormulaTag', 
      u'\\tag*':u'FormulaTag', u'\\today':u'TodayCommand', 
      }

  modified = {
      u'\n':u'', u' ':u'', u'$':u'', u'&':u'	', u'\'':u'’', u'+':u' + ', 
      u',':u', ', u'-':u' − ', u'/':u' ⁄ ', u':':u' : ', u'<':u' &lt; ', 
      u'=':u' = ', u'>':u' &gt; ', u'@':u'', u'~':u'', 
      }

  onefunctions = {
      u'\\Big':u'span class="bigsymbol"', u'\\Bigg':u'span class="hugesymbol"', 
      u'\\bar':u'span class="bar"', u'\\begin{array}':u'span class="arraydef"', 
      u'\\big':u'span class="symbol"', u'\\bigg':u'span class="largesymbol"', 
      u'\\bigl':u'span class="bigsymbol"', u'\\bigr':u'span class="bigsymbol"', 
      u'\\centering':u'span class="align-center"', 
      u'\\ensuremath':u'span class="ensuremath"', 
      u'\\hphantom':u'span class="phantom"', 
      u'\\noindent':u'span class="noindent"', 
      u'\\overbrace':u'span class="overbrace"', 
      u'\\overline':u'span class="overline"', 
      u'\\phantom':u'span class="phantom"', 
      u'\\underbrace':u'span class="underbrace"', u'\\underline':u'u', 
      u'\\vphantom':u'span class="phantom"', 
      }

  spacedcommands = {
      u'\\Bot':u'⫫', u'\\Doteq':u'≑', u'\\DownArrowBar':u'⤓', 
      u'\\DownLeftTeeVector':u'⥞', u'\\DownLeftVectorBar':u'⥖', 
      u'\\DownRightTeeVector':u'⥟', u'\\DownRightVectorBar':u'⥗', 
      u'\\Equal':u'⩵', u'\\LeftArrowBar':u'⇤', u'\\LeftDownTeeVector':u'⥡', 
      u'\\LeftDownVectorBar':u'⥙', u'\\LeftTeeVector':u'⥚', 
      u'\\LeftTriangleBar':u'⧏', u'\\LeftUpTeeVector':u'⥠', 
      u'\\LeftUpVectorBar':u'⥘', u'\\LeftVectorBar':u'⥒', 
      u'\\Leftrightarrow':u'⇔', u'\\Longmapsfrom':u'⟽', u'\\Longmapsto':u'⟾', 
      u'\\MapsDown':u'↧', u'\\MapsUp':u'↥', u'\\Nearrow':u'⇗', 
      u'\\NestedGreaterGreater':u'⪢', u'\\NestedLessLess':u'⪡', 
      u'\\NotGreaterLess':u'≹', u'\\NotGreaterTilde':u'≵', 
      u'\\NotLessTilde':u'≴', u'\\Nwarrow':u'⇖', u'\\Proportion':u'∷', 
      u'\\RightArrowBar':u'⇥', u'\\RightDownTeeVector':u'⥝', 
      u'\\RightDownVectorBar':u'⥕', u'\\RightTeeVector':u'⥛', 
      u'\\RightTriangleBar':u'⧐', u'\\RightUpTeeVector':u'⥜', 
      u'\\RightUpVectorBar':u'⥔', u'\\RightVectorBar':u'⥓', 
      u'\\Rightarrow':u'⇒', u'\\Same':u'⩶', u'\\Searrow':u'⇘', 
      u'\\Swarrow':u'⇙', u'\\Top':u'⫪', u'\\UpArrowBar':u'⤒', u'\\VDash':u'⊫', 
      u'\\approx':u'≈', u'\\approxeq':u'≊', u'\\backsim':u'∽', u'\\barin':u'⋶', 
      u'\\barleftharpoon':u'⥫', u'\\barrightharpoon':u'⥭', u'\\bij':u'⤖', 
      u'\\coloneq':u'≔', u'\\corresponds':u'≙', u'\\curlyeqprec':u'⋞', 
      u'\\curlyeqsucc':u'⋟', u'\\dashrightarrow':u'⇢', u'\\dlsh':u'↲', 
      u'\\downdownharpoons':u'⥥', u'\\downuparrows':u'⇵', 
      u'\\downupharpoons':u'⥯', u'\\drsh':u'↳', u'\\eqslantgtr':u'⪖', 
      u'\\eqslantless':u'⪕', u'\\equiv':u'≡', u'\\ffun':u'⇻', u'\\finj':u'⤕', 
      u'\\ge':u'≥', u'\\geq':u'≥', u'\\ggcurly':u'⪼', u'\\gnapprox':u'⪊', 
      u'\\gneq':u'⪈', u'\\gtrapprox':u'⪆', u'\\hash':u'⋕', u'\\iddots':u'⋰', 
      u'\\implies':u' ⇒ ', u'\\in':u'∈', u'\\le':u'≤', u'\\leftarrow':u'←', 
      u'\\leftarrowtriangle':u'⇽', u'\\leftbarharpoon':u'⥪', 
      u'\\leftrightarrowtriangle':u'⇿', u'\\leftrightharpoon':u'⥊', 
      u'\\leftrightharpoondown':u'⥐', u'\\leftrightharpoonup':u'⥎', 
      u'\\leftrightsquigarrow':u'↭', u'\\leftslice':u'⪦', 
      u'\\leftsquigarrow':u'⇜', u'\\leftupdownharpoon':u'⥑', u'\\leq':u'≤', 
      u'\\lessapprox':u'⪅', u'\\llcurly':u'⪻', u'\\lnapprox':u'⪉', 
      u'\\lneq':u'⪇', u'\\longmapsfrom':u'⟻', u'\\multimapboth':u'⧟', 
      u'\\multimapdotbothA':u'⊶', u'\\multimapdotbothB':u'⊷', 
      u'\\multimapinv':u'⟜', u'\\nVdash':u'⊮', u'\\ne':u'≠', u'\\neq':u'≠', 
      u'\\ngeq':u'≱', u'\\nleq':u'≰', u'\\nni':u'∌', u'\\not\\in':u'∉', 
      u'\\notasymp':u'≭', u'\\npreceq':u'⋠', u'\\nsqsubseteq':u'⋢', 
      u'\\nsqsupseteq':u'⋣', u'\\nsubset':u'⊄', u'\\nsucceq':u'⋡', 
      u'\\pfun':u'⇸', u'\\pinj':u'⤔', u'\\precapprox':u'⪷', u'\\preceqq':u'⪳', 
      u'\\precnapprox':u'⪹', u'\\precnsim':u'⋨', u'\\propto':u'∝', 
      u'\\psur':u'⤀', u'\\rightarrow':u'→', u'\\rightarrowtriangle':u'⇾', 
      u'\\rightbarharpoon':u'⥬', u'\\rightleftharpoon':u'⥋', 
      u'\\rightslice':u'⪧', u'\\rightsquigarrow':u'⇝', 
      u'\\rightupdownharpoon':u'⥏', u'\\sim':u'~', u'\\strictfi':u'⥼', 
      u'\\strictif':u'⥽', u'\\subset':u'⊂', u'\\subseteq':u'⊆', 
      u'\\subsetneq':u'⊊', u'\\succapprox':u'⪸', u'\\succeqq':u'⪴', 
      u'\\succnapprox':u'⪺', u'\\supset':u'⊃', u'\\supseteq':u'⊇', 
      u'\\supsetneq':u'⊋', u'\\times':u'×', u'\\to':u'→', 
      u'\\updownarrows':u'⇅', u'\\updownharpoons':u'⥮', u'\\upupharpoons':u'⥣', 
      u'\\vartriangleleft':u'⊲', u'\\vartriangleright':u'⊳', 
      }

  starts = {
      u'beginafter':u'}', u'beginbefore':u'\\begin{', u'bracket':u'{', 
      u'command':u'\\', u'comment':u'%', u'complex':u'\\[', u'simple':u'$', 
      u'squarebracket':u'[', u'unnumbered':u'*', 
      }

  symbolfunctions = {
      u'^':u'sup', u'_':u'sub', 
      }

  textfunctions = {
      u'\\mbox':u'span class="mbox"', u'\\text':u'span class="text"', 
      u'\\textbf':u'b', u'\\textipa':u'span class="textipa"', u'\\textit':u'i', 
      u'\\textnormal':u'span class="textnormal"', 
      u'\\textrm':u'span class="textrm"', 
      u'\\textsc':u'span class="versalitas"', 
      u'\\textsf':u'span class="textsf"', u'\\textsl':u'i', u'\\texttt':u'tt', 
      u'\\textup':u'span class="normal"', 
      }

  unmodified = {
      
      u'characters':[u'.',u'*',u'€',u'(',u')',u'[',u']',u'·',u'!',u';',u'|',u'§',u'"',], 
      }

  urls = {
      u'googlecharts':u'http://chart.googleapis.com/chart?cht=tx&chl=', 
      }

class GeneralConfig(object):
  "Configuration class from elyxer.config file"

  version = {
      u'date':u'2015-02-26', u'lyxformat':u'413', u'number':u'1.2.5', 
      }

class HeaderConfig(object):
  "Configuration class from elyxer.config file"

  parameters = {
      u'beginpreamble':u'\\begin_preamble', u'branch':u'\\branch', 
      u'documentclass':u'\\textclass', u'endbranch':u'\\end_branch', 
      u'endpreamble':u'\\end_preamble', u'language':u'\\language', 
      u'lstset':u'\\lstset', u'outputchanges':u'\\output_changes', 
      u'paragraphseparation':u'\\paragraph_separation', 
      u'pdftitle':u'\\pdf_title', u'secnumdepth':u'\\secnumdepth', 
      u'tocdepth':u'\\tocdepth', 
      }

  styles = {
      
      u'article':[u'article',u'aastex',u'aapaper',u'acmsiggraph',u'sigplanconf',u'achemso',u'amsart',u'apa',u'arab-article',u'armenian-article',u'article-beamer',u'chess',u'dtk',u'elsarticle',u'heb-article',u'IEEEtran',u'iopart',u'kluwer',u'scrarticle-beamer',u'scrartcl',u'extarticle',u'paper',u'mwart',u'revtex4',u'spie',u'svglobal3',u'ltugboat',u'agu-dtd',u'jgrga',u'agums',u'entcs',u'egs',u'ijmpc',u'ijmpd',u'singlecol-new',u'doublecol-new',u'isprs',u'tarticle',u'jsarticle',u'jarticle',u'jss',u'literate-article',u'siamltex',u'cl2emult',u'llncs',u'svglobal',u'svjog',u'svprobth',], 
      u'book':[u'book',u'amsbook',u'scrbook',u'extbook',u'tufte-book',u'report',u'extreport',u'scrreprt',u'memoir',u'tbook',u'jsbook',u'jbook',u'mwbk',u'svmono',u'svmult',u'treport',u'jreport',u'mwrep',], 
      }

class ImageConfig(object):
  "Configuration class from elyxer.config file"

  converters = {
      
      u'imagemagick':u'convert[ -density $scale][ -define $format:use-cropbox=true] "$input" "$output"', 
      u'inkscape':u'inkscape "$input" --export-png="$output"', 
      u'lyx':u'lyx -C "$input" "$output"', 
      }

  cropboxformats = {
      u'.eps':u'ps', u'.pdf':u'pdf', u'.ps':u'ps', 
      }

  formats = {
      u'default':u'.png', u'vector':[u'.svg',u'.eps',], 
      }

class LayoutConfig(object):
  "Configuration class from elyxer.config file"

  groupable = {
      
      u'allowed':[u'StringContainer',u'Constant',u'TaggedText',u'Align',u'TextFamily',u'EmphaticText',u'VersalitasText',u'BarredText',u'SizeText',u'ColorText',u'LangLine',u'Formula',], 
      }

class NewfangleConfig(object):
  "Configuration class from elyxer.config file"

  constants = {
      u'chunkref':u'chunkref{', u'endcommand':u'}', u'endmark':u'&gt;', 
      u'startcommand':u'\\', u'startmark':u'=&lt;', 
      }

class NumberingConfig(object):
  "Configuration class from elyxer.config file"

  layouts = {
      
      u'ordered':[u'Chapter',u'Section',u'Subsection',u'Subsubsection',u'Paragraph',], 
      u'roman':[u'Part',u'Book',], 
      }

  sequence = {
      u'symbols':[u'*',u'**',u'†',u'‡',u'§',u'§§',u'¶',u'¶¶',u'#',u'##',], 
      }

class StyleConfig(object):
  "Configuration class from elyxer.config file"

  hspaces = {
      u'\\enskip{}':u' ', u'\\hfill{}':u'<span class="hfill"> </span>', 
      u'\\hspace*{\\fill}':u' ', u'\\hspace*{}':u'', u'\\hspace{}':u' ', 
      u'\\negthinspace{}':u'', u'\\qquad{}':u'  ', u'\\quad{}':u' ', 
      u'\\space{}':u' ', u'\\thinspace{}':u' ', u'~':u' ', 
      }

  quotes = {
      u'ald':u'»', u'als':u'›', u'ard':u'«', u'ars':u'‹', u'eld':u'&ldquo;', 
      u'els':u'&lsquo;', u'erd':u'&rdquo;', u'ers':u'&rsquo;', u'fld':u'«', 
      u'fls':u'‹', u'frd':u'»', u'frs':u'›', u'gld':u'„', u'gls':u'‚', 
      u'grd':u'“', u'grs':u'‘', u'pld':u'„', u'pls':u'‚', u'prd':u'”', 
      u'prs':u'’', u'sld':u'”', u'srd':u'”', 
      }

  referenceformats = {
      u'eqref':u'(@↕)', u'formatted':u'¶↕', u'nameref':u'$↕', u'pageref':u'#↕', 
      u'ref':u'@↕', u'vpageref':u'on-page#↕', u'vref':u'@on-page#↕', 
      }

  size = {
      u'ignoredtexts':[u'col',u'text',u'line',u'page',u'theight',u'pheight',], 
      }

  vspaces = {
      u'bigskip':u'<div class="bigskip"> </div>', 
      u'defskip':u'<div class="defskip"> </div>', 
      u'medskip':u'<div class="medskip"> </div>', 
      u'smallskip':u'<div class="smallskip"> </div>', 
      u'vfill':u'<div class="vfill"> </div>', 
      }

class TOCConfig(object):
  "Configuration class from elyxer.config file"

  extractplain = {
      
      u'allowed':[u'StringContainer',u'Constant',u'TaggedText',u'Align',u'TextFamily',u'EmphaticText',u'VersalitasText',u'BarredText',u'SizeText',u'ColorText',u'LangLine',u'Formula',], 
      u'cloned':[u'',], u'extracted':[u'',], 
      }

  extracttitle = {
      u'allowed':[u'StringContainer',u'Constant',u'Space',], 
      u'cloned':[u'TextFamily',u'EmphaticText',u'VersalitasText',u'BarredText',u'SizeText',u'ColorText',u'LangLine',u'Formula',], 
      u'extracted':[u'PlainLayout',u'TaggedText',u'Align',u'Caption',u'StandardLayout',u'FlexInset',], 
      }

class TagConfig(object):
  "Configuration class from elyxer.config file"

  barred = {
      u'under':u'u', 
      }

  family = {
      u'sans':u'span class="sans"', u'typewriter':u'tt', 
      }

  flex = {
      u'CharStyle:Code':u'span class="code"', 
      u'CharStyle:MenuItem':u'span class="menuitem"', 
      u'Code':u'span class="code"', u'MenuItem':u'span class="menuitem"', 
      u'Noun':u'span class="noun"', u'Strong':u'span class="strong"', 
      }

  group = {
      u'layouts':[u'Quotation',u'Quote',], 
      }

  layouts = {
      u'Center':u'div', u'Chapter':u'h?', u'Date':u'h2', u'Paragraph':u'div', 
      u'Part':u'h1', u'Quotation':u'blockquote', u'Quote':u'blockquote', 
      u'Section':u'h?', u'Subsection':u'h?', u'Subsubsection':u'h?', 
      }

  listitems = {
      u'Enumerate':u'ol', u'Itemize':u'ul', 
      }

  notes = {
      u'Comment':u'', u'Greyedout':u'span class="greyedout"', u'Note':u'', 
      }

  script = {
      u'subscript':u'sub', u'superscript':u'sup', 
      }

  shaped = {
      u'italic':u'i', u'slanted':u'i', u'smallcaps':u'span class="versalitas"', 
      }

class TranslationConfig(object):
  "Configuration class from elyxer.config file"

  constants = {
      u'Appendix':u'Appendix', u'Book':u'Book', u'Chapter':u'Chapter', 
      u'Paragraph':u'Paragraph', u'Part':u'Part', u'Section':u'Section', 
      u'Subsection':u'Subsection', u'Subsubsection':u'Subsubsection', 
      u'abstract':u'Abstract', u'bibliography':u'Bibliography', 
      u'figure':u'figure', u'float-algorithm':u'Algorithm ', 
      u'float-figure':u'Figure ', u'float-listing':u'Listing ', 
      u'float-table':u'Table ', u'float-tableau':u'Tableau ', 
      u'footnotes':u'Footnotes', u'generated-by':u'Document generated by ', 
      u'generated-on':u' on ', u'index':u'Index', 
      u'jsmath-enable':u'Please enable JavaScript on your browser.', 
      u'jsmath-requires':u' requires JavaScript to correctly process the mathematics on this page. ', 
      u'jsmath-warning':u'Warning: ', u'list-algorithm':u'List of Algorithms', 
      u'list-figure':u'List of Figures', u'list-table':u'List of Tables', 
      u'list-tableau':u'List of Tableaux', u'main-page':u'Main page', 
      u'next':u'Next', u'nomenclature':u'Nomenclature', 
      u'on-page':u' on page ', u'prev':u'Prev', u'references':u'References', 
      u'toc':u'Table of Contents', u'toc-for':u'Contents for ', u'up':u'Up', 
      }

  languages = {
      u'american':u'en', u'british':u'en', u'deutsch':u'de', u'dutch':u'nl', 
      u'english':u'en', u'french':u'fr', u'ngerman':u'de', u'russian':u'ru', 
      u'spanish':u'es', 
      }






class CommandLineParser(object):
  "A parser for runtime options"

  def __init__(self, options):
    self.options = options

  def parseoptions(self, args):
    "Parse command line options"
    if len(args) == 0:
      return None
    while len(args) > 0 and args[0].startswith('--'):
      key, value = self.readoption(args)
      if not key:
        return 'Option ' + value + ' not recognized'
      if not value:
        return 'Option ' + key + ' needs a value'
      setattr(self.options, key, value)
    return None

  def readoption(self, args):
    "Read the key and value for an option"
    arg = args[0][2:]
    del args[0]
    if '=' in arg:
      key = self.readequalskey(arg, args)
    else:
      key = arg.replace('-', '')
    if not hasattr(self.options, key):
      return None, key
    current = getattr(self.options, key)
    if isinstance(current, bool):
      return key, True
    # read value
    if len(args) == 0:
      return key, None
    if args[0].startswith('"'):
      initial = args[0]
      del args[0]
      return key, self.readquoted(args, initial)
    value = args[0].decode('utf-8')
    del args[0]
    if isinstance(current, list):
      current.append(value)
      return key, current
    return key, value

  def readquoted(self, args, initial):
    "Read a value between quotes"
    Trace.error('Oops')
    value = initial[1:]
    while len(args) > 0 and not args[0].endswith('"') and not args[0].startswith('--'):
      Trace.error('Appending ' + args[0])
      value += ' ' + args[0]
      del args[0]
    if len(args) == 0 or args[0].startswith('--'):
      return None
    value += ' ' + args[0:-1]
    return value

  def readequalskey(self, arg, args):
    "Read a key using equals"
    split = arg.split('=', 1)
    key = split[0]
    value = split[1]
    args.insert(0, value)
    return key



class Options(object):
  "A set of runtime options"

  instance = None

  location = None
  nocopy = False
  copyright = False
  debug = False
  quiet = False
  version = False
  hardversion = False
  versiondate = False
  html = False
  help = False
  showlines = True
  unicode = False
  iso885915 = False
  css = []
  favicon = ''
  title = None
  directory = None
  destdirectory = None
  toc = False
  toctarget = ''
  tocfor = None
  forceformat = None
  lyxformat = False
  target = None
  splitpart = None
  memory = True
  lowmem = False
  nobib = False
  converter = 'imagemagick'
  raw = False
  jsmath = None
  mathjax = None
  nofooter = False
  simplemath = False
  template = None
  noconvert = False
  notoclabels = False
  letterfoot = True
  numberfoot = False
  symbolfoot = False
  hoverfoot = True
  marginfoot = False
  endfoot = False
  supfoot = True
  alignfoot = False
  footnotes = None
  imageformat = None
  copyimages = False
  googlecharts = False
  embedcss = []

  branches = dict()

  def parseoptions(self, args):
    "Parse command line options"
    Options.location = args[0]
    del args[0]
    parser = CommandLineParser(Options)
    result = parser.parseoptions(args)
    if result:
      Trace.error(result)
      self.usage()
    self.processoptions()

  def processoptions(self):
    "Process all options parsed."
    if Options.help:
      self.usage()
    if Options.version:
      self.showversion()
    if Options.hardversion:
      self.showhardversion()
    if Options.versiondate:
      self.showversiondate()
    if Options.lyxformat:
      self.showlyxformat()
    if Options.splitpart:
      try:
        Options.splitpart = int(Options.splitpart)
        if Options.splitpart <= 0:
          Trace.error('--splitpart requires a number bigger than zero')
          self.usage()
      except:
        Trace.error('--splitpart needs a numeric argument, not ' + Options.splitpart)
        self.usage()
    if Options.lowmem or Options.toc or Options.tocfor:
      Options.memory = False
    self.parsefootnotes()
    if Options.forceformat and not Options.imageformat:
      Options.imageformat = Options.forceformat
    if Options.imageformat == 'copy':
      Options.copyimages = True
    if Options.css == []:
      Options.css = ['http://elyxer.nongnu.org/lyx.css']
    if Options.favicon == '':
      pass # no default favicon
    if Options.html:
      Options.simplemath = True
    if Options.toc and not Options.tocfor:
      Trace.error('Option --toc is deprecated; use --tocfor "page" instead')
      Options.tocfor = Options.toctarget
    if Options.nocopy:
      Trace.error('Option --nocopy is deprecated; it is no longer needed')
    if Options.jsmath:
      Trace.error('Option --jsmath is deprecated; use --mathjax instead')
    # set in Trace if necessary
    for param in dir(Trace):
      if param.endswith('mode'):
        setattr(Trace, param, getattr(self, param[:-4]))

  def usage(self):
    "Show correct usage"
    Trace.error('Usage: ' + os.path.basename(Options.location) + ' [options] [filein] [fileout]')
    Trace.error('Convert LyX input file "filein" to HTML file "fileout".')
    Trace.error('If filein (or fileout) is not given use standard input (or output).')
    Trace.error('Main program of the eLyXer package (http://elyxer.nongnu.org/).')
    self.showoptions()

  def parsefootnotes(self):
    "Parse footnotes options."
    if not Options.footnotes:
      return
    Options.marginfoot = False
    Options.letterfoot = False
    Options.hoverfoot = False
    options = Options.footnotes.split(',')
    for option in options:
      footoption = option + 'foot'
      if hasattr(Options, footoption):
        setattr(Options, footoption, True)
      else:
        Trace.error('Unknown footnotes option: ' + option)
    if not Options.endfoot and not Options.marginfoot and not Options.hoverfoot:
      Options.hoverfoot = True
    if not Options.numberfoot and not Options.symbolfoot:
      Options.letterfoot = True

  def showoptions(self):
    "Show all possible options"
    Trace.error('  Common options:')
    Trace.error('    --help:                 show this online help')
    Trace.error('    --quiet:                disables all runtime messages')
    Trace.error('')
    Trace.error('  Advanced options:')
    Trace.error('    --debug:                enable debugging messages (for developers)')
    Trace.error('    --version:              show version number and release date')
    Trace.error('    --lyxformat:            return the highest LyX version supported')
    Trace.error('  Options for HTML output:')
    Trace.error('    --title "title":        set the generated page title')
    Trace.error('    --css "file.css":       use a custom CSS file')
    Trace.error('    --embedcss "file.css":  embed styles from a CSS file into the output')
    Trace.error('    --favicon "icon.ico":   insert the specified favicon in the header.')
    Trace.error('    --html:                 output HTML 4.0 instead of the default XHTML')
    Trace.error('    --unicode:              full Unicode output')
    Trace.error('    --iso885915:            output a document with ISO-8859-15 encoding')
    Trace.error('    --nofooter:             remove the footer "generated by eLyXer"')
    Trace.error('    --simplemath:           do not generate fancy math constructions')
    Trace.error('  Options for image output:')
    Trace.error('    --directory "img_dir":  look for images in the specified directory')
    Trace.error('    --destdirectory "dest": put converted images into this directory')
    Trace.error('    --imageformat ".ext":   image output format, or "copy" to copy images')
    Trace.error('    --noconvert:            do not convert images, use in original locations')
    Trace.error('    --converter "inkscape": use an alternative program to convert images')
    Trace.error('  Options for footnote display:')
    Trace.error('    --numberfoot:           mark footnotes with numbers instead of letters')
    Trace.error('    --symbolfoot:           mark footnotes with symbols (*, **...)')
    Trace.error('    --hoverfoot:            show footnotes as hovering text (default)')
    Trace.error('    --marginfoot:           show footnotes on the page margin')
    Trace.error('    --endfoot:              show footnotes at the end of the page')
    Trace.error('    --supfoot:              use superscript for footnote markers (default)')
    Trace.error('    --alignfoot:            use aligned text for footnote markers')
    Trace.error('    --footnotes "options":  specify several comma-separated footnotes options')
    Trace.error('      Available options are: "number", "symbol", "hover", "margin", "end",')
    Trace.error('        "sup", "align"')
    Trace.error('  Advanced output options:')
    Trace.error('    --splitpart "depth":    split the resulting webpage at the given depth')
    Trace.error('    --tocfor "page":        generate a TOC that points to the given page')
    Trace.error('    --target "frame":       make all links point to the given frame')
    Trace.error('    --notoclabels:          omit the part labels in the TOC, such as Chapter')
    Trace.error('    --lowmem:               do the conversion on the fly (conserve memory)')
    Trace.error('    --raw:                  generate HTML without header or footer.')
    Trace.error('    --mathjax remote:       use MathJax remotely to display equations')
    Trace.error('    --mathjax "URL":        use MathJax from the given URL to display equations')
    Trace.error('    --googlecharts:         use Google Charts to generate formula images')
    Trace.error('    --template "file":      use a template, put everything in <!--$content-->')
    Trace.error('    --copyright:            add a copyright notice at the bottom')
    Trace.error('  Deprecated options:')
    Trace.error('    --toc:                  (deprecated) create a table of contents')
    Trace.error('    --toctarget "page":     (deprecated) generate a TOC for the given page')
    Trace.error('    --nocopy:               (deprecated) maintained for backwards compatibility')
    Trace.error('    --jsmath "URL":         use jsMath from the given URL to display equations')
    sys.exit()

  def showversion(self):
    "Return the current eLyXer version string"
    string = 'eLyXer version ' + GeneralConfig.version['number']
    string += ' (' + GeneralConfig.version['date'] + ')'
    Trace.error(string)
    sys.exit()

  def showhardversion(self):
    "Return just the version string"
    Trace.message(GeneralConfig.version['number'])
    sys.exit()

  def showversiondate(self):
    "Return just the version dte"
    Trace.message(GeneralConfig.version['date'])
    sys.exit()

  def showlyxformat(self):
    "Return just the lyxformat parameter"
    Trace.message(GeneralConfig.version['lyxformat'])
    sys.exit()

class BranchOptions(object):
  "A set of options for a branch"

  def __init__(self, name):
    self.name = name
    self.options = {'color':'#ffffff'}

  def set(self, key, value):
    "Set a branch option"
    if not key.startswith(ContainerConfig.string['startcommand']):
      Trace.error('Invalid branch option ' + key)
      return
    key = key.replace(ContainerConfig.string['startcommand'], '')
    self.options[key] = value

  def isselected(self):
    "Return if the branch is selected"
    if not 'selected' in self.options:
      return False
    return self.options['selected'] == '1'

  def __unicode__(self):
    "String representation"
    return 'options for ' + self.name + ': ' + unicode(self.options)




import urllib








class Cloner(object):
  "An object used to clone other objects."

  def clone(cls, original):
    "Return an exact copy of an object."
    "The original object must have an empty constructor."
    return cls.create(original.__class__)

  def create(cls, type):
    "Create an object of a given class."
    clone = type.__new__(type)
    clone.__init__()
    return clone

  clone = classmethod(clone)
  create = classmethod(create)

class ContainerExtractor(object):
  "A class to extract certain containers."

  def __init__(self, config):
    "The config parameter is a map containing three lists: allowed, copied and extracted."
    "Each of the three is a list of class names for containers."
    "Allowed containers are included as is into the result."
    "Cloned containers are cloned and placed into the result."
    "Extracted containers are looked into."
    "All other containers are silently ignored."
    self.allowed = config['allowed']
    self.cloned = config['cloned']
    self.extracted = config['extracted']

  def extract(self, container):
    "Extract a group of selected containers from elyxer.a container."
    list = []
    locate = lambda c: c.__class__.__name__ in self.allowed + self.cloned
    recursive = lambda c: c.__class__.__name__ in self.extracted
    process = lambda c: self.process(c, list)
    container.recursivesearch(locate, recursive, process)
    return list

  def process(self, container, list):
    "Add allowed containers, clone cloned containers and add the clone."
    name = container.__class__.__name__
    if name in self.allowed:
      list.append(container)
    elif name in self.cloned:
      list.append(self.safeclone(container))
    else:
      Trace.error('Unknown container class ' + name)

  def safeclone(self, container):
    "Return a new container with contents only in a safe list, recursively."
    clone = Cloner.clone(container)
    clone.output = container.output
    clone.contents = self.extract(container)
    return clone






class Parser(object):
  "A generic parser"

  def __init__(self):
    self.begin = 0
    self.parameters = dict()

  def parseheader(self, reader):
    "Parse the header"
    header = reader.currentline().split()
    reader.nextline()
    self.begin = reader.linenumber
    return header

  def parseparameter(self, reader):
    "Parse a parameter"
    if reader.currentline().strip().startswith('<'):
      key, value = self.parsexml(reader)
      self.parameters[key] = value
      return
    split = reader.currentline().strip().split(' ', 1)
    reader.nextline()
    if len(split) == 0:
      return
    key = split[0]
    if len(split) == 1:
      self.parameters[key] = True
      return
    if not '"' in split[1]:
      self.parameters[key] = split[1].strip()
      return
    doublesplit = split[1].split('"')
    self.parameters[key] = doublesplit[1]

  def parsexml(self, reader):
    "Parse a parameter in xml form: <param attr1=value...>"
    strip = reader.currentline().strip()
    reader.nextline()
    if not strip.endswith('>'):
      Trace.error('XML parameter ' + strip + ' should be <...>')
    split = strip[1:-1].split()
    if len(split) == 0:
      Trace.error('Empty XML parameter <>')
      return None, None
    key = split[0]
    del split[0]
    if len(split) == 0:
      return key, dict()
    attrs = dict()
    for attr in split:
      if not '=' in attr:
        Trace.error('Erroneous attribute for ' + key + ': ' + attr)
        attr += '="0"'
      parts = attr.split('=')
      attrkey = parts[0]
      value = parts[1].split('"')[1]
      attrs[attrkey] = value
    return key, attrs

  def parseending(self, reader, process):
    "Parse until the current ending is found"
    if not self.ending:
      Trace.error('No ending for ' + unicode(self))
      return
    while not reader.currentline().startswith(self.ending):
      process()

  def parsecontainer(self, reader, contents):
    container = self.factory.createcontainer(reader)
    if container:
      container.parent = self.parent
      contents.append(container)

  def __unicode__(self):
    "Return a description"
    return self.__class__.__name__ + ' (' + unicode(self.begin) + ')'

class LoneCommand(Parser):
  "A parser for just one command line"

  def parse(self,reader):
    "Read nothing"
    return []

class TextParser(Parser):
  "A parser for a command and a bit of text"

  stack = []

  def __init__(self, container):
    Parser.__init__(self)
    self.ending = None
    if container.__class__.__name__ in ContainerConfig.endings:
      self.ending = ContainerConfig.endings[container.__class__.__name__]
    self.endings = []

  def parse(self, reader):
    "Parse lines as long as they are text"
    TextParser.stack.append(self.ending)
    self.endings = TextParser.stack + [ContainerConfig.endings['Layout'],
        ContainerConfig.endings['Inset'], self.ending]
    contents = []
    while not self.isending(reader):
      self.parsecontainer(reader, contents)
    return contents

  def isending(self, reader):
    "Check if text is ending"
    current = reader.currentline().split()
    if len(current) == 0:
      return False
    if current[0] in self.endings:
      if current[0] in TextParser.stack:
        TextParser.stack.remove(current[0])
      else:
        TextParser.stack = []
      return True
    return False

class ExcludingParser(Parser):
  "A parser that excludes the final line"

  def parse(self, reader):
    "Parse everything up to (and excluding) the final line"
    contents = []
    self.parseending(reader, lambda: self.parsecontainer(reader, contents))
    return contents

class BoundedParser(ExcludingParser):
  "A parser bound by a final line"

  def parse(self, reader):
    "Parse everything, including the final line"
    contents = ExcludingParser.parse(self, reader)
    # skip last line
    reader.nextline()
    return contents

class BoundedDummy(Parser):
  "A bound parser that ignores everything"

  def parse(self, reader):
    "Parse the contents of the container"
    self.parseending(reader, lambda: reader.nextline())
    # skip last line
    reader.nextline()
    return []

class StringParser(Parser):
  "Parses just a string"

  def parseheader(self, reader):
    "Do nothing, just take note"
    self.begin = reader.linenumber + 1
    return []

  def parse(self, reader):
    "Parse a single line"
    contents = reader.currentline()
    reader.nextline()
    return contents

class InsetParser(BoundedParser):
  "Parses a LyX inset"

  def parse(self, reader):
    "Parse inset parameters into a dictionary"
    startcommand = ContainerConfig.string['startcommand']
    while reader.currentline() != '' and not reader.currentline().startswith(startcommand):
      self.parseparameter(reader)
    return BoundedParser.parse(self, reader)






class ContainerOutput(object):
  "The generic HTML output for a container."

  def gethtml(self, container):
    "Show an error."
    Trace.error('gethtml() not implemented for ' + unicode(self))

  def isempty(self):
    "Decide if the output is empty: by default, not empty."
    return False

class EmptyOutput(ContainerOutput):

  def gethtml(self, container):
    "Return empty HTML code."
    return []

  def isempty(self):
    "This output is particularly empty."
    return True

class FixedOutput(ContainerOutput):
  "Fixed output"

  def gethtml(self, container):
    "Return constant HTML code"
    return container.html

class ContentsOutput(ContainerOutput):
  "Outputs the contents converted to HTML"

  def gethtml(self, container):
    "Return the HTML code"
    html = []
    if container.contents == None:
      return html
    for element in container.contents:
      if not hasattr(element, 'gethtml'):
        Trace.error('No html in ' + element.__class__.__name__ + ': ' + unicode(element))
        return html
      html += element.gethtml()
    return html

class TaggedOutput(ContentsOutput):
  "Outputs an HTML tag surrounding the contents."

  tag = None
  breaklines = False
  empty = False

  def settag(self, tag, breaklines=False, empty=False):
    "Set the value for the tag and other attributes."
    self.tag = tag
    if breaklines:
      self.breaklines = breaklines
    if empty:
      self.empty = empty
    return self

  def setbreaklines(self, breaklines):
    "Set the value for breaklines."
    self.breaklines = breaklines
    return self

  def gethtml(self, container):
    "Return the HTML code."
    if self.empty:
      return [self.selfclosing(container)]
    html = [self.open(container)]
    html += ContentsOutput.gethtml(self, container)
    html.append(self.close(container))
    return html

  def open(self, container):
    "Get opening line."
    if not self.checktag():
      return ''
    open = '<' + self.tag + '>'
    if self.breaklines:
      return open + '\n'
    return open

  def close(self, container):
    "Get closing line."
    if not self.checktag():
      return ''
    close = '</' + self.tag.split()[0] + '>'
    if self.breaklines:
      return '\n' + close + '\n'
    return close

  def selfclosing(self, container):
    "Get self-closing line."
    if not self.checktag():
      return ''
    selfclosing = '<' + self.tag + '/>'
    if self.breaklines:
      return selfclosing + '\n'
    return selfclosing

  def checktag(self):
    "Check that the tag is valid."
    if not self.tag:
      Trace.error('No tag in ' + unicode(container))
      return False
    if self.tag == '':
      return False
    return True

class FilteredOutput(ContentsOutput):
  "Returns the output in the contents, but filtered:"
  "some strings are replaced by others."

  def __init__(self):
    "Initialize the filters."
    self.filters = []

  def addfilter(self, original, replacement):
    "Add a new filter: replace the original by the replacement."
    self.filters.append((original, replacement))

  def gethtml(self, container):
    "Return the HTML code"
    result = []
    html = ContentsOutput.gethtml(self, container)
    for line in html:
      result.append(self.filter(line))
    return result

  def filter(self, line):
    "Filter a single line with all available filters."
    for original, replacement in self.filters:
      if original in line:
        line = line.replace(original, replacement)
    return line

class StringOutput(ContainerOutput):
  "Returns a bare string as output"

  def gethtml(self, container):
    "Return a bare string"
    return [container.string]







import sys
import codecs


class LineReader(object):
  "Reads a file line by line"

  def __init__(self, filename):
    if isinstance(filename, file):
      self.file = filename
    else:
      self.file = codecs.open(filename, 'rU', 'utf-8')
    self.linenumber = 1
    self.lastline = None
    self.current = None
    self.mustread = True
    self.depleted = False
    try:
      self.readline()
    except UnicodeDecodeError:
      # try compressed file
      import gzip
      self.file = gzip.open(filename, 'rb')
      self.readline()

  def setstart(self, firstline):
    "Set the first line to read."
    for i in range(firstline):
      self.file.readline()
    self.linenumber = firstline

  def setend(self, lastline):
    "Set the last line to read."
    self.lastline = lastline

  def currentline(self):
    "Get the current line"
    if self.mustread:
      self.readline()
    return self.current

  def nextline(self):
    "Go to next line"
    if self.depleted:
      Trace.fatal('Read beyond file end')
    self.mustread = True

  def readline(self):
    "Read a line from elyxer.file"
    self.current = self.file.readline()
    if not isinstance(self.file, codecs.StreamReaderWriter):
      self.current = self.current.decode('utf-8')
    if len(self.current) == 0:
      self.depleted = True
    self.current = self.current.rstrip('\n\r')
    self.linenumber += 1
    self.mustread = False
    Trace.prefix = 'Line ' + unicode(self.linenumber) + ': '
    if self.linenumber % 1000 == 0:
      Trace.message('Parsing')

  def finished(self):
    "Find out if the file is finished"
    if self.lastline and self.linenumber == self.lastline:
      return True
    if self.mustread:
      self.readline()
    return self.depleted

  def close(self):
    self.file.close()

class LineWriter(object):
  "Writes a file as a series of lists"

  file = False

  def __init__(self, filename):
    if isinstance(filename, file):
      self.file = filename
      self.filename = None
    else:
      self.filename = filename

  def write(self, strings):
    "Write a list of strings"
    for string in strings:
      if not isinstance(string, basestring):
        Trace.error('Not a string: ' + unicode(string) + ' in ' + unicode(strings))
        return
      self.writestring(string)

  def writestring(self, string):
    "Write a string"
    if not self.file:
      self.file = codecs.open(self.filename, 'w', "utf-8")
    if self.file == sys.stdout and sys.version_info < (3,0):
      string = string.encode('utf-8')
    self.file.write(string)

  def writeline(self, line):
    "Write a line to file"
    self.writestring(line + '\n')

  def close(self):
    self.file.close()






class Globable(object):
  """A bit of text which can be globbed (lumped together in bits).
  Methods current(), skipcurrent(), checkfor() and isout() have to be
  implemented by subclasses."""

  leavepending = False

  def __init__(self):
    self.endinglist = EndingList()

  def checkbytemark(self):
    "Check for a Unicode byte mark and skip it."
    if self.finished():
      return
    if ord(self.current()) == 0xfeff:
      self.skipcurrent()

  def isout(self):
    "Find out if we are out of the position yet."
    Trace.error('Unimplemented isout()')
    return True

  def current(self):
    "Return the current character."
    Trace.error('Unimplemented current()')
    return ''

  def checkfor(self, string):
    "Check for the given string in the current position."
    Trace.error('Unimplemented checkfor()')
    return False

  def finished(self):
    "Find out if the current text has finished."
    if self.isout():
      if not self.leavepending:
        self.endinglist.checkpending()
      return True
    return self.endinglist.checkin(self)

  def skipcurrent(self):
    "Return the current character and skip it."
    Trace.error('Unimplemented skipcurrent()')
    return ''

  def glob(self, currentcheck):
    "Glob a bit of text that satisfies a check on the current char."
    glob = ''
    while not self.finished() and currentcheck():
      glob += self.skipcurrent()
    return glob

  def globalpha(self):
    "Glob a bit of alpha text"
    return self.glob(lambda: self.current().isalpha())

  def globnumber(self):
    "Glob a row of digits."
    return self.glob(lambda: self.current().isdigit())

  def isidentifier(self):
    "Return if the current character is alphanumeric or _."
    if self.current().isalnum() or self.current() == '_':
      return True
    return False

  def globidentifier(self):
    "Glob alphanumeric and _ symbols."
    return self.glob(self.isidentifier)

  def isvalue(self):
    "Return if the current character is a value character:"
    "not a bracket or a space."
    if self.current().isspace():
      return False
    if self.current() in '{}()':
      return False
    return True

  def globvalue(self):
    "Glob a value: any symbols but brackets."
    return self.glob(self.isvalue)

  def skipspace(self):
    "Skip all whitespace at current position."
    return self.glob(lambda: self.current().isspace())

  def globincluding(self, magicchar):
    "Glob a bit of text up to (including) the magic char."
    glob = self.glob(lambda: self.current() != magicchar) + magicchar
    self.skip(magicchar)
    return glob

  def globexcluding(self, excluded):
    "Glob a bit of text up until (excluding) any excluded character."
    return self.glob(lambda: self.current() not in excluded)

  def pushending(self, ending, optional = False):
    "Push a new ending to the bottom"
    self.endinglist.add(ending, optional)

  def popending(self, expected = None):
    "Pop the ending found at the current position"
    if self.isout() and self.leavepending:
      return expected
    ending = self.endinglist.pop(self)
    if expected and expected != ending:
      Trace.error('Expected ending ' + expected + ', got ' + ending)
    self.skip(ending)
    return ending

  def nextending(self):
    "Return the next ending in the queue."
    nextending = self.endinglist.findending(self)
    if not nextending:
      return None
    return nextending.ending

class EndingList(object):
  "A list of position endings"

  def __init__(self):
    self.endings = []

  def add(self, ending, optional = False):
    "Add a new ending to the list"
    self.endings.append(PositionEnding(ending, optional))

  def pickpending(self, pos):
    "Pick any pending endings from a parse position."
    self.endings += pos.endinglist.endings

  def checkin(self, pos):
    "Search for an ending"
    if self.findending(pos):
      return True
    return False

  def pop(self, pos):
    "Remove the ending at the current position"
    if pos.isout():
      Trace.error('No ending out of bounds')
      return ''
    ending = self.findending(pos)
    if not ending:
      Trace.error('No ending at ' + pos.current())
      return ''
    for each in reversed(self.endings):
      self.endings.remove(each)
      if each == ending:
        return each.ending
      elif not each.optional:
        Trace.error('Removed non-optional ending ' + each)
    Trace.error('No endings left')
    return ''

  def findending(self, pos):
    "Find the ending at the current position"
    if len(self.endings) == 0:
      return None
    for index, ending in enumerate(reversed(self.endings)):
      if ending.checkin(pos):
        return ending
      if not ending.optional:
        return None
    return None

  def checkpending(self):
    "Check if there are any pending endings"
    if len(self.endings) != 0:
      Trace.error('Pending ' + unicode(self) + ' left open')

  def __unicode__(self):
    "Printable representation"
    string = 'endings ['
    for ending in self.endings:
      string += unicode(ending) + ','
    if len(self.endings) > 0:
      string = string[:-1]
    return string + ']'

class PositionEnding(object):
  "An ending for a parsing position"

  def __init__(self, ending, optional):
    self.ending = ending
    self.optional = optional

  def checkin(self, pos):
    "Check for the ending"
    return pos.checkfor(self.ending)

  def __unicode__(self):
    "Printable representation"
    string = 'Ending ' + self.ending
    if self.optional:
      string += ' (optional)'
    return string



class Position(Globable):
  """A position in a text to parse.
  Including those in Globable, functions to implement by subclasses are:
  skip(), identifier(), extract(), isout() and current()."""

  def __init__(self):
    Globable.__init__(self)

  def skip(self, string):
    "Skip a string"
    Trace.error('Unimplemented skip()')

  def identifier(self):
    "Return an identifier for the current position."
    Trace.error('Unimplemented identifier()')
    return 'Error'

  def extract(self, length):
    "Extract the next string of the given length, or None if not enough text,"
    "without advancing the parse position."
    Trace.error('Unimplemented extract()')
    return None

  def checkfor(self, string):
    "Check for a string at the given position."
    return string == self.extract(len(string))

  def checkforlower(self, string):
    "Check for a string in lower case."
    extracted = self.extract(len(string))
    if not extracted:
      return False
    return string.lower() == self.extract(len(string)).lower()

  def skipcurrent(self):
    "Return the current character and skip it."
    current = self.current()
    self.skip(current)
    return current

  def next(self):
    "Advance the position and return the next character."
    self.skipcurrent()
    return self.current()

  def checkskip(self, string):
    "Check for a string at the given position; if there, skip it"
    if not self.checkfor(string):
      return False
    self.skip(string)
    return True

  def error(self, message):
    "Show an error message and the position identifier."
    Trace.error(message + ': ' + self.identifier())

class TextPosition(Position):
  "A parse position based on a raw text."

  def __init__(self, text):
    "Create the position from elyxer.some text."
    Position.__init__(self)
    self.pos = 0
    self.text = text
    self.checkbytemark()

  def skip(self, string):
    "Skip a string of characters."
    self.pos += len(string)

  def identifier(self):
    "Return a sample of the remaining text."
    length = 30
    if self.pos + length > len(self.text):
      length = len(self.text) - self.pos
    return '*' + self.text[self.pos:self.pos + length] + '*'

  def isout(self):
    "Find out if we are out of the text yet."
    return self.pos >= len(self.text)

  def current(self):
    "Return the current character, assuming we are not out."
    return self.text[self.pos]

  def extract(self, length):
    "Extract the next string of the given length, or None if not enough text."
    if self.pos + length > len(self.text):
      return None
    return self.text[self.pos : self.pos + length]

class FilePosition(Position):
  "A parse position based on an underlying file."

  def __init__(self, filename):
    "Create the position from a file."
    Position.__init__(self)
    self.reader = LineReader(filename)
    self.pos = 0
    self.checkbytemark()

  def skip(self, string):
    "Skip a string of characters."
    length = len(string)
    while self.pos + length > len(self.reader.currentline()):
      length -= len(self.reader.currentline()) - self.pos + 1
      self.nextline()
    self.pos += length

  def currentline(self):
    "Get the current line of the underlying file."
    return self.reader.currentline()

  def nextline(self):
    "Go to the next line."
    self.reader.nextline()
    self.pos = 0

  def linenumber(self):
    "Return the line number of the file."
    return self.reader.linenumber + 1

  def identifier(self):
    "Return the current line and line number in the file."
    before = self.reader.currentline()[:self.pos - 1]
    after = self.reader.currentline()[self.pos:]
    return 'line ' + unicode(self.getlinenumber()) + ': ' + before + '*' + after

  def isout(self):
    "Find out if we are out of the text yet."
    if self.pos > len(self.reader.currentline()):
      if self.pos > len(self.reader.currentline()) + 1:
        Trace.error('Out of the line ' + self.reader.currentline() + ': ' + unicode(self.pos))
      self.nextline()
    return self.reader.finished()

  def current(self):
    "Return the current character, assuming we are not out."
    if self.pos == len(self.reader.currentline()):
      return '\n'
    if self.pos > len(self.reader.currentline()):
      Trace.error('Out of the line ' + self.reader.currentline() + ': ' + unicode(self.pos))
      return '*'
    return self.reader.currentline()[self.pos]

  def extract(self, length):
    "Extract the next string of the given length, or None if not enough text."
    if self.pos + length > len(self.reader.currentline()):
      return None
    return self.reader.currentline()[self.pos : self.pos + length]



class Container(object):
  "A container for text and objects in a lyx file"

  partkey = None
  parent = None
  begin = None

  def __init__(self):
    self.contents = list()

  def process(self):
    "Process contents"
    pass

  def gethtml(self):
    "Get the resulting HTML"
    html = self.output.gethtml(self)
    if isinstance(html, basestring):
      Trace.error('Raw string ' + html)
      html = [html]
    return self.escapeall(html)

  def escapeall(self, lines):
    "Escape all lines in an array according to the output options."
    result = []
    for line in lines:
      if Options.html:
        line = self.escape(line, EscapeConfig.html)
      if Options.iso885915:
        line = self.escape(line, EscapeConfig.iso885915)
        line = self.escapeentities(line)
      elif not Options.unicode:
        line = self.escape(line, EscapeConfig.nonunicode)
      result.append(line)
    return result

  def escape(self, line, replacements = EscapeConfig.entities):
    "Escape a line with replacements from elyxer.a map"
    pieces = replacements.keys()
    # do them in order
    pieces.sort()
    for piece in pieces:
      if piece in line:
        line = line.replace(piece, replacements[piece])
    return line

  def escapeentities(self, line):
    "Escape all Unicode characters to HTML entities."
    result = ''
    pos = TextPosition(line)
    while not pos.finished():
      if ord(pos.current()) > 128:
        codepoint = hex(ord(pos.current()))
        if codepoint == '0xd835':
          codepoint = hex(ord(pos.next()) + 0xf800)
        result += '&#' + codepoint[1:] + ';'
      else:
        result += pos.current()
      pos.skipcurrent()
    return result

  def searchall(self, type):
    "Search for all embedded containers of a given type"
    list = []
    self.searchprocess(type, lambda container: list.append(container))
    return list

  def searchremove(self, type):
    "Search for all containers of a type and remove them"
    list = self.searchall(type)
    for container in list:
      container.parent.contents.remove(container)
    return list

  def searchprocess(self, type, process):
    "Search for elements of a given type and process them"
    self.locateprocess(lambda container: isinstance(container, type), process)

  def locateprocess(self, locate, process):
    "Search for all embedded containers and process them"
    for container in self.contents:
      container.locateprocess(locate, process)
      if locate(container):
        process(container)

  def recursivesearch(self, locate, recursive, process):
    "Perform a recursive search in the container."
    for container in self.contents:
      if recursive(container):
        container.recursivesearch(locate, recursive, process)
      if locate(container):
        process(container)

  def extracttext(self):
    "Extract all text from elyxer.allowed containers."
    result = ''
    constants = ContainerExtractor(ContainerConfig.extracttext).extract(self)
    for constant in constants:
      result += constant.string
    return result

  def group(self, index, group, isingroup):
    "Group some adjoining elements into a group"
    if index >= len(self.contents):
      return
    if hasattr(self.contents[index], 'grouped'):
      return
    while index < len(self.contents) and isingroup(self.contents[index]):
      self.contents[index].grouped = True
      group.contents.append(self.contents[index])
      self.contents.pop(index)
    self.contents.insert(index, group)

  def remove(self, index):
    "Remove a container but leave its contents"
    container = self.contents[index]
    self.contents.pop(index)
    while len(container.contents) > 0:
      self.contents.insert(index, container.contents.pop())

  def tree(self, level = 0):
    "Show in a tree"
    Trace.debug("  " * level + unicode(self))
    for container in self.contents:
      container.tree(level + 1)

  def getparameter(self, name):
    "Get the value of a parameter, if present."
    if not name in self.parameters:
      return None
    return self.parameters[name]

  def getparameterlist(self, name):
    "Get the value of a comma-separated parameter as a list."
    paramtext = self.getparameter(name)
    if not paramtext:
      return []
    return paramtext.split(',')

  def hasemptyoutput(self):
    "Check if the parent's output is empty."
    current = self.parent
    while current:
      if current.output.isempty():
        return True
      current = current.parent
    return False

  def __unicode__(self):
    "Get a description"
    if not self.begin:
      return self.__class__.__name__
    return self.__class__.__name__ + '@' + unicode(self.begin)

class BlackBox(Container):
  "A container that does not output anything"

  def __init__(self):
    self.parser = LoneCommand()
    self.output = EmptyOutput()
    self.contents = []

class LyXFormat(BlackBox):
  "Read the lyxformat command"

  def process(self):
    "Show warning if version < 276"
    version = int(self.header[1])
    if version < 276:
      Trace.error('Warning: unsupported old format version ' + str(version))
    if version > int(GeneralConfig.version['lyxformat']):
      Trace.error('Warning: unsupported new format version ' + str(version))

class StringContainer(Container):
  "A container for a single string"

  parsed = None

  def __init__(self):
    self.parser = StringParser()
    self.output = StringOutput()
    self.string = ''

  def process(self):
    "Replace special chars from elyxer.the contents."
    if self.parsed:
      self.string = self.replacespecial(self.parsed)
      self.parsed = None

  def replacespecial(self, line):
    "Replace all special chars from elyxer.a line"
    replaced = self.escape(line, EscapeConfig.entities)
    replaced = self.changeline(replaced)
    if ContainerConfig.string['startcommand'] in replaced and len(replaced) > 1:
      # unprocessed commands
      if self.begin:
        message = 'Unknown command at ' + unicode(self.begin) + ': '
      else:
        message = 'Unknown command: '
      Trace.error(message + replaced.strip())
    return replaced

  def changeline(self, line):
    line = self.escape(line, EscapeConfig.chars)
    if not ContainerConfig.string['startcommand'] in line:
      return line
    line = self.escape(line, EscapeConfig.commands)
    return line

  def extracttext(self):
    "Return all text."
    return self.string
  
  def __unicode__(self):
    "Return a printable representation."
    result = 'StringContainer'
    if self.begin:
      result += '@' + unicode(self.begin)
    ellipsis = '...'
    if len(self.string.strip()) <= 15:
      ellipsis = ''
    return result + ' (' + self.string.strip()[:15] + ellipsis + ')'

class Constant(StringContainer):
  "A constant string"

  def __init__(self, text):
    self.contents = []
    self.string = text
    self.output = StringOutput()

  def __unicode__(self):
    return 'Constant: ' + self.string

class TaggedText(Container):
  "Text inside a tag"

  output = None

  def __init__(self):
    self.parser = TextParser(self)
    self.output = TaggedOutput()

  def complete(self, contents, tag, breaklines=False):
    "Complete the tagged text and return it"
    self.contents = contents
    self.output.tag = tag
    self.output.breaklines = breaklines
    return self

  def constant(self, text, tag, breaklines=False):
    "Complete the tagged text with a constant"
    constant = Constant(text)
    return self.complete([constant], tag, breaklines)

  def __unicode__(self):
    "Return a printable representation."
    if not hasattr(self.output, 'tag'):
      return 'Emtpy tagged text'
    if not self.output.tag:
      return 'Tagged <unknown tag>'
    return 'Tagged <' + self.output.tag + '>'






class DocumentParameters(object):
  "Global parameters for the document."

  pdftitle = None
  indentstandard = False
  tocdepth = 10
  startinglevel = 0
  maxdepth = 10
  language = None
  bibliography = None
  outputchanges = False
  displaymode = False






class FormulaParser(Parser):
  "Parses a formula"

  def parseheader(self, reader):
    "See if the formula is inlined"
    self.begin = reader.linenumber + 1
    type = self.parsetype(reader)
    if not type:
      reader.nextline()
      type = self.parsetype(reader)
      if not type:
        Trace.error('Unknown formula type in ' + reader.currentline().strip())
        return ['unknown']
    return [type]

  def parsetype(self, reader):
    "Get the formula type from the first line."
    if reader.currentline().find(FormulaConfig.starts['simple']) >= 0:
      return 'inline'
    if reader.currentline().find(FormulaConfig.starts['complex']) >= 0:
      return 'block'
    if reader.currentline().find(FormulaConfig.starts['unnumbered']) >= 0:
      return 'block'
    if reader.currentline().find(FormulaConfig.starts['beginbefore']) >= 0:
      return 'numbered'
    return None
  
  def parse(self, reader):
    "Parse the formula until the end"
    formula = self.parseformula(reader)
    while not reader.currentline().startswith(self.ending):
      stripped = reader.currentline().strip()
      if len(stripped) > 0:
        Trace.error('Unparsed formula line ' + stripped)
      reader.nextline()
    reader.nextline()
    return formula

  def parseformula(self, reader):
    "Parse the formula contents"
    simple = FormulaConfig.starts['simple']
    if simple in reader.currentline():
      rest = reader.currentline().split(simple, 1)[1]
      if simple in rest:
        # formula is $...$
        return self.parsesingleliner(reader, simple, simple)
      # formula is multiline $...$
      return self.parsemultiliner(reader, simple, simple)
    if FormulaConfig.starts['complex'] in reader.currentline():
      # formula of the form \[...\]
      return self.parsemultiliner(reader, FormulaConfig.starts['complex'],
          FormulaConfig.endings['complex'])
    beginbefore = FormulaConfig.starts['beginbefore']
    beginafter = FormulaConfig.starts['beginafter']
    if beginbefore in reader.currentline():
      if reader.currentline().strip().endswith(beginafter):
        current = reader.currentline().strip()
        endsplit = current.split(beginbefore)[1].split(beginafter)
        startpiece = beginbefore + endsplit[0] + beginafter
        endbefore = FormulaConfig.endings['endbefore']
        endafter = FormulaConfig.endings['endafter']
        endpiece = endbefore + endsplit[0] + endafter
        return startpiece + self.parsemultiliner(reader, startpiece, endpiece) + endpiece
      Trace.error('Missing ' + beginafter + ' in ' + reader.currentline())
      return ''
    begincommand = FormulaConfig.starts['command']
    beginbracket = FormulaConfig.starts['bracket']
    if begincommand in reader.currentline() and beginbracket in reader.currentline():
      endbracket = FormulaConfig.endings['bracket']
      return self.parsemultiliner(reader, beginbracket, endbracket)
    Trace.error('Formula beginning ' + reader.currentline() + ' is unknown')
    return ''

  def parsesingleliner(self, reader, start, ending):
    "Parse a formula in one line"
    line = reader.currentline().strip()
    if not start in line:
      Trace.error('Line ' + line + ' does not contain formula start ' + start)
      return ''
    if not line.endswith(ending):
      Trace.error('Formula ' + line + ' does not end with ' + ending)
      return ''
    index = line.index(start)
    rest = line[index + len(start):-len(ending)]
    reader.nextline()
    return rest

  def parsemultiliner(self, reader, start, ending):
    "Parse a formula in multiple lines"
    formula = ''
    line = reader.currentline()
    if not start in line:
      Trace.error('Line ' + line.strip() + ' does not contain formula start ' + start)
      return ''
    index = line.index(start)
    line = line[index + len(start):].strip()
    while not line.endswith(ending):
      formula += line + '\n'
      reader.nextline()
      line = reader.currentline()
    formula += line[:-len(ending)]
    reader.nextline()
    return formula

class MacroParser(FormulaParser):
  "A parser for a formula macro."

  def parseheader(self, reader):
    "See if the formula is inlined"
    self.begin = reader.linenumber + 1
    return ['inline']
  
  def parse(self, reader):
    "Parse the formula until the end"
    formula = self.parsemultiliner(reader, self.parent.start, self.ending)
    reader.nextline()
    return formula
  








class FormulaBit(Container):
  "A bit of a formula"

  type = None
  size = 1
  original = ''

  def __init__(self):
    "The formula bit type can be 'alpha', 'number', 'font'."
    self.contents = []
    self.output = ContentsOutput()

  def setfactory(self, factory):
    "Set the internal formula factory."
    self.factory = factory
    return self

  def add(self, bit):
    "Add any kind of formula bit already processed"
    self.contents.append(bit)
    self.original += bit.original
    bit.parent = self

  def skiporiginal(self, string, pos):
    "Skip a string and add it to the original formula"
    self.original += string
    if not pos.checkskip(string):
      Trace.error('String ' + string + ' not at ' + pos.identifier())

  def computesize(self):
    "Compute the size of the bit as the max of the sizes of all contents."
    if len(self.contents) == 0:
      return 1
    self.size = max([element.size for element in self.contents])
    return self.size

  def clone(self):
    "Return a copy of itself."
    return self.factory.parseformula(self.original)

  def __unicode__(self):
    "Get a string representation"
    return self.__class__.__name__ + ' read in ' + self.original

class TaggedBit(FormulaBit):
  "A tagged string in a formula"

  def constant(self, constant, tag):
    "Set the constant and the tag"
    self.output = TaggedOutput().settag(tag)
    self.add(FormulaConstant(constant))
    return self

  def complete(self, contents, tag, breaklines = False):
    "Set the constant and the tag"
    self.contents = contents
    self.output = TaggedOutput().settag(tag, breaklines)
    return self

  def selfcomplete(self, tag):
    "Set the self-closing tag, no contents (as in <hr/>)."
    self.output = TaggedOutput().settag(tag, empty = True)
    return self

class FormulaConstant(Constant):
  "A constant string in a formula"

  def __init__(self, string):
    "Set the constant string"
    Constant.__init__(self, string)
    self.original = string
    self.size = 1
    self.type = None

  def computesize(self):
    "Compute the size of the constant: always 1."
    return self.size

  def clone(self):
    "Return a copy of itself."
    return FormulaConstant(self.original)

  def __unicode__(self):
    "Return a printable representation."
    return 'Formula constant: ' + self.string

class RawText(FormulaBit):
  "A bit of text inside a formula"

  def detect(self, pos):
    "Detect a bit of raw text"
    return pos.current().isalpha()

  def parsebit(self, pos):
    "Parse alphabetic text"
    alpha = pos.globalpha()
    self.add(FormulaConstant(alpha))
    self.type = 'alpha'

class FormulaSymbol(FormulaBit):
  "A symbol inside a formula"

  modified = FormulaConfig.modified
  unmodified = FormulaConfig.unmodified['characters']

  def detect(self, pos):
    "Detect a symbol"
    if pos.current() in FormulaSymbol.unmodified:
      return True
    if pos.current() in FormulaSymbol.modified:
      return True
    return False

  def parsebit(self, pos):
    "Parse the symbol"
    if pos.current() in FormulaSymbol.unmodified:
      self.addsymbol(pos.current(), pos)
      return
    if pos.current() in FormulaSymbol.modified:
      self.addsymbol(FormulaSymbol.modified[pos.current()], pos)
      return
    Trace.error('Symbol ' + pos.current() + ' not found')

  def addsymbol(self, symbol, pos):
    "Add a symbol"
    self.skiporiginal(pos.current(), pos)
    self.contents.append(FormulaConstant(symbol))

class FormulaNumber(FormulaBit):
  "A string of digits in a formula"

  def detect(self, pos):
    "Detect a digit"
    return pos.current().isdigit()

  def parsebit(self, pos):
    "Parse a bunch of digits"
    digits = pos.glob(lambda: pos.current().isdigit())
    self.add(FormulaConstant(digits))
    self.type = 'number'

class Comment(FormulaBit):
  "A LaTeX comment: % to the end of the line."

  start = FormulaConfig.starts['comment']

  def detect(self, pos):
    "Detect the %."
    return pos.current() == self.start

  def parsebit(self, pos):
    "Parse to the end of the line."
    self.original += pos.globincluding('\n')

class WhiteSpace(FormulaBit):
  "Some white space inside a formula."

  def detect(self, pos):
    "Detect the white space."
    return pos.current().isspace()

  def parsebit(self, pos):
    "Parse all whitespace."
    self.original += pos.skipspace()

  def __unicode__(self):
    "Return a printable representation."
    return 'Whitespace: *' + self.original + '*'

class Bracket(FormulaBit):
  "A {} bracket inside a formula"

  start = FormulaConfig.starts['bracket']
  ending = FormulaConfig.endings['bracket']

  def __init__(self):
    "Create a (possibly literal) new bracket"
    FormulaBit.__init__(self)
    self.inner = None

  def detect(self, pos):
    "Detect the start of a bracket"
    return pos.checkfor(self.start)

  def parsebit(self, pos):
    "Parse the bracket"
    self.parsecomplete(pos, self.innerformula)
    return self

  def parsetext(self, pos):
    "Parse a text bracket"
    self.parsecomplete(pos, self.innertext)
    return self

  def parseliteral(self, pos):
    "Parse a literal bracket"
    self.parsecomplete(pos, self.innerliteral)
    return self

  def parsecomplete(self, pos, innerparser):
    "Parse the start and end marks"
    if not pos.checkfor(self.start):
      Trace.error('Bracket should start with ' + self.start + ' at ' + pos.identifier())
      return None
    self.skiporiginal(self.start, pos)
    pos.pushending(self.ending)
    innerparser(pos)
    self.original += pos.popending(self.ending)
    self.computesize()

  def innerformula(self, pos):
    "Parse a whole formula inside the bracket"
    while not pos.finished():
      self.add(self.factory.parseany(pos))

  def innertext(self, pos):
    "Parse some text inside the bracket, following textual rules."
    specialchars = FormulaConfig.symbolfunctions.keys()
    specialchars.append(FormulaConfig.starts['command'])
    specialchars.append(FormulaConfig.starts['bracket'])
    specialchars.append(Comment.start)
    while not pos.finished():
      if pos.current() in specialchars:
        self.add(self.factory.parseany(pos))
        if pos.checkskip(' '):
          self.original += ' '
      else:
        self.add(FormulaConstant(pos.skipcurrent()))

  def innerliteral(self, pos):
    "Parse a literal inside the bracket, which does not generate HTML."
    self.literal = ''
    while not pos.finished() and not pos.current() == self.ending:
      if pos.current() == self.start:
        self.parseliteral(pos)
      else:
        self.literal += pos.skipcurrent()
    self.original += self.literal

class SquareBracket(Bracket):
  "A [] bracket inside a formula"

  start = FormulaConfig.starts['squarebracket']
  ending = FormulaConfig.endings['squarebracket']

  def clone(self):
    "Return a new square bracket with the same contents."
    bracket = SquareBracket()
    bracket.contents = self.contents
    return bracket



class MathsProcessor(object):
  "A processor for a maths construction inside the FormulaProcessor."

  def process(self, contents, index):
    "Process an element inside a formula."
    Trace.error('Unimplemented process() in ' + unicode(self))

  def __unicode__(self):
    "Return a printable description."
    return 'Maths processor ' + self.__class__.__name__

class FormulaProcessor(object):
  "A processor specifically for formulas."

  processors = []

  def process(self, bit):
    "Process the contents of every formula bit, recursively."
    self.processcontents(bit)
    self.processinsides(bit)
    self.traversewhole(bit)

  def processcontents(self, bit):
    "Process the contents of a formula bit."
    if not isinstance(bit, FormulaBit):
      return
    bit.process()
    for element in bit.contents:
      self.processcontents(element)

  def processinsides(self, bit):
    "Process the insides (limits, brackets) in a formula bit."
    if not isinstance(bit, FormulaBit):
      return
    for index, element in enumerate(bit.contents):
      for processor in self.processors:
        processor.process(bit.contents, index)
      # continue with recursive processing
      self.processinsides(element)

  def traversewhole(self, formula):
    "Traverse over the contents to alter variables and space units."
    last = None
    for bit, contents in self.traverse(formula):
      if bit.type == 'alpha':
        self.italicize(bit, contents)
      elif bit.type == 'font' and last and last.type == 'number':
        bit.contents.insert(0, FormulaConstant(u' '))
      last = bit

  def traverse(self, bit):
    "Traverse a formula and yield a flattened structure of (bit, list) pairs."
    for element in bit.contents:
      if hasattr(element, 'type') and element.type:
        yield (element, bit.contents)
      elif isinstance(element, FormulaBit):
        for pair in self.traverse(element):
          yield pair

  def italicize(self, bit, contents):
    "Italicize the given bit of text."
    index = contents.index(bit)
    contents[index] = TaggedBit().complete([bit], 'i')




class Formula(Container):
  "A LaTeX formula"

  def __init__(self):
    self.parser = FormulaParser()
    self.output = TaggedOutput().settag('span class="formula"')

  def process(self):
    "Convert the formula to tags"
    if self.header[0] == 'inline':
      DocumentParameters.displaymode = False
    else:
      DocumentParameters.displaymode = True
      self.output.settag('div class="formula"', True)
    if Options.jsmath:
      self.jsmath()
    elif Options.mathjax:
      self.mathjax()
    elif Options.googlecharts:
      self.googlecharts()
    else:
      self.classic()

  def jsmath(self):
    "Make the contents for jsMath."
    if self.header[0] != 'inline':
      self.output = TaggedOutput().settag('div class="math"')
    else:
      self.output = TaggedOutput().settag('span class="math"')
    self.contents = [Constant(self.parsed)]

  def mathjax(self):
    "Make the contents for MathJax."
    self.output.tag = 'span class="MathJax_Preview"'
    tag = 'script type="math/tex'
    if self.header[0] != 'inline':
      tag += ';mode=display'
    self.contents = [TaggedText().constant(self.parsed, tag + '"', True)]

  def googlecharts(self):
    "Make the contents using Google Charts http://code.google.com/apis/chart/."
    url = FormulaConfig.urls['googlecharts'] + urllib.quote_plus(self.parsed)
    img = '<img class="chart" src="' + url + '" alt="' + self.parsed + '"/>'
    self.contents = [Constant(img)]

  def classic(self):
    "Make the contents using classic output generation with XHTML and CSS."
    whole = FormulaFactory().parseformula(self.parsed)
    FormulaProcessor().process(whole)
    whole.parent = self
    self.contents = [whole]

  def parse(self, pos):
    "Parse using a parse position instead of self.parser."
    if pos.checkskip('$$'):
      self.parsedollarblock(pos)
    elif pos.checkskip('$'):
      self.parsedollarinline(pos)
    elif pos.checkskip('\\('):
      self.parseinlineto(pos, '\\)')
    elif pos.checkskip('\\['):
      self.parseblockto(pos, '\\]')
    else:
      pos.error('Unparseable formula')
    self.process()
    return self

  def parsedollarinline(self, pos):
    "Parse a $...$ formula."
    self.header = ['inline']
    self.parsedollar(pos)

  def parsedollarblock(self, pos):
    "Parse a $$...$$ formula."
    self.header = ['block']
    self.parsedollar(pos)
    if not pos.checkskip('$'):
      pos.error('Formula should be $$...$$, but last $ is missing.')

  def parsedollar(self, pos):
    "Parse to the next $."
    pos.pushending('$')
    self.parsed = pos.globexcluding('$')
    pos.popending('$')

  def parseinlineto(self, pos, limit):
    "Parse a \\(...\\) formula."
    self.header = ['inline']
    self.parseupto(pos, limit)

  def parseblockto(self, pos, limit):
    "Parse a \\[...\\] formula."
    self.header = ['block']
    self.parseupto(pos, limit)

  def parseupto(self, pos, limit):
    "Parse a formula that ends with the given command."
    pos.pushending(limit)
    self.parsed = pos.glob(lambda: True)
    pos.popending(limit)

  def __unicode__(self):
    "Return a printable representation."
    if self.partkey and self.partkey.number:
      return 'Formula (' + self.partkey.number + ')'
    return 'Unnumbered formula'

class WholeFormula(FormulaBit):
  "Parse a whole formula"

  def detect(self, pos):
    "Not outside the formula is enough."
    return not pos.finished()

  def parsebit(self, pos):
    "Parse with any formula bit"
    while not pos.finished():
      self.add(self.factory.parseany(pos))

class FormulaFactory(object):
  "Construct bits of formula"

  # bit types will be appended later
  types = [FormulaSymbol, RawText, FormulaNumber, Bracket, Comment, WhiteSpace]
  skippedtypes = [Comment, WhiteSpace]
  defining = False

  def __init__(self):
    "Initialize the map of instances."
    self.instances = dict()

  def detecttype(self, type, pos):
    "Detect a bit of a given type."
    if pos.finished():
      return False
    return self.instance(type).detect(pos)

  def instance(self, type):
    "Get an instance of the given type."
    if not type in self.instances or not self.instances[type]:
      self.instances[type] = self.create(type)
    return self.instances[type]

  def create(self, type):
    "Create a new formula bit of the given type."
    return Cloner.create(type).setfactory(self)

  def clearskipped(self, pos):
    "Clear any skipped types."
    while not pos.finished():
      if not self.skipany(pos):
        return
    return

  def skipany(self, pos):
    "Skip any skipped types."
    for type in self.skippedtypes:
      if self.instance(type).detect(pos):
        return self.parsetype(type, pos)
    return None

  def parseany(self, pos):
    "Parse any formula bit at the current location."
    for type in self.types + self.skippedtypes:
      if self.detecttype(type, pos):
        return self.parsetype(type, pos)
    Trace.error('Unrecognized formula at ' + pos.identifier())
    return FormulaConstant(pos.skipcurrent())

  def parsetype(self, type, pos):
    "Parse the given type and return it."
    bit = self.instance(type)
    self.instances[type] = None
    returnedbit = bit.parsebit(pos)
    if returnedbit:
      return returnedbit.setfactory(self)
    return bit

  def parseformula(self, formula):
    "Parse a string of text that contains a whole formula."
    pos = TextPosition(formula)
    whole = self.create(WholeFormula)
    if whole.detect(pos):
      whole.parsebit(pos)
      return whole
    # no formula found
    if not pos.finished():
      Trace.error('Unknown formula at: ' + pos.identifier())
      whole.add(TaggedBit().constant(formula, 'span class="unknown"'))
    return whole




import unicodedata












import gettext


class Translator(object):
  "Reads the configuration file and tries to find a translation."
  "Otherwise falls back to the messages in the config file."

  instance = None

  def translate(cls, key):
    "Get the translated message for a key."
    return cls.instance.getmessage(key)

  translate = classmethod(translate)

  def __init__(self):
    self.translation = None
    self.first = True

  def findtranslation(self):
    "Find the translation for the document language."
    self.langcodes = None
    if not DocumentParameters.language:
      Trace.error('No language in document')
      return
    if not DocumentParameters.language in TranslationConfig.languages:
      Trace.error('Unknown language ' + DocumentParameters.language)
      return
    if TranslationConfig.languages[DocumentParameters.language] == 'en':
      return
    langcodes = [TranslationConfig.languages[DocumentParameters.language]]
    try:
      self.translation = gettext.translation('elyxer', None, langcodes)
    except IOError:
      Trace.error('No translation for ' + unicode(langcodes))

  def getmessage(self, key):
    "Get the translated message for the given key."
    if self.first:
      self.findtranslation()
      self.first = False
    message = self.getuntranslated(key)
    if not self.translation:
      return message
    try:
      message = self.translation.ugettext(message)
    except IOError:
      pass
    return message

  def getuntranslated(self, key):
    "Get the untranslated message."
    if not key in TranslationConfig.constants:
      Trace.error('Cannot translate ' + key)
      return key
    return TranslationConfig.constants[key]

Translator.instance = Translator()



class NumberCounter(object):
  "A counter for numbers (by default)."
  "The type can be changed to return letters, roman numbers..."

  name = None
  value = None
  mode = None
  master = None

  letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  symbols = NumberingConfig.sequence['symbols']
  romannumerals = [
      ('M', 1000), ('CM', 900), ('D', 500), ('CD', 400), ('C', 100),
      ('XC', 90), ('L', 50), ('XL', 40), ('X', 10), ('IX', 9), ('V', 5),
      ('IV', 4), ('I', 1)
      ]

  def __init__(self, name):
    "Give a name to the counter."
    self.name = name

  def setmode(self, mode):
    "Set the counter mode. Can be changed at runtime."
    self.mode = mode
    return self

  def init(self, value):
    "Set an initial value."
    self.value = value

  def gettext(self):
    "Get the next value as a text string."
    return unicode(self.value)

  def getletter(self):
    "Get the next value as a letter."
    return self.getsequence(self.letters)

  def getsymbol(self):
    "Get the next value as a symbol."
    return self.getsequence(self.symbols)

  def getsequence(self, sequence):
    "Get the next value from elyxer.a sequence."
    return sequence[(self.value - 1) % len(sequence)]

  def getroman(self):
    "Get the next value as a roman number."
    result = ''
    number = self.value
    for numeral, value in self.romannumerals:
      if number >= value:
        result += numeral * (number / value)
        number = number % value
    return result

  def getvalue(self):
    "Get the current value as configured in the current mode."
    if not self.mode or self.mode in ['text', '1']:
      return self.gettext()
    if self.mode == 'A':
      return self.getletter()
    if self.mode == 'a':
      return self.getletter().lower()
    if self.mode == 'I':
      return self.getroman()
    if self.mode == '*':
      return self.getsymbol()
    Trace.error('Unknown counter mode ' + self.mode)
    return self.gettext()

  def getnext(self):
    "Increase the current value and get the next value as configured."
    if not self.value:
      self.value = 0
    self.value += 1
    return self.getvalue()

  def reset(self):
    "Reset the counter."
    self.value = 0

  def __unicode__(self):
    "Return a printable representation."
    result = 'Counter ' + self.name
    if self.mode:
      result += ' in mode ' + self.mode
    return result

class DependentCounter(NumberCounter):
  "A counter which depends on another one (the master)."

  def setmaster(self, master):
    "Set the master counter."
    self.master = master
    self.last = self.master.getvalue()
    return self

  def getnext(self):
    "Increase or, if the master counter has changed, restart."
    if self.last != self.master.getvalue():
      self.reset()
    value = NumberCounter.getnext(self)
    self.last = self.master.getvalue()
    return value

  def getvalue(self):
    "Get the value of the combined counter: master.dependent."
    return self.master.getvalue() + '.' + NumberCounter.getvalue(self)

class NumberGenerator(object):
  "A number generator for unique sequences and hierarchical structures. Used in:"
  "  * ordered part numbers: Chapter 3, Section 5.3."
  "  * unique part numbers: Footnote 15, Bibliography cite [15]."
  "  * chaptered part numbers: Figure 3.15, Equation (8.3)."
  "  * unique roman part numbers: Part I, Book IV."

  chaptered = None
  generator = None

  romanlayouts = [x.lower() for x in NumberingConfig.layouts['roman']]
  orderedlayouts = [x.lower() for x in NumberingConfig.layouts['ordered']]

  counters = dict()
  appendix = None

  def deasterisk(self, type):
    "Remove the possible asterisk in a layout type."
    return type.replace('*', '')

  def isunique(self, type):
    "Find out if the layout type corresponds to a unique part."
    return self.isroman(type)

  def isroman(self, type):
    "Find out if the layout type should have roman numeration."
    return self.deasterisk(type).lower() in self.romanlayouts

  def isinordered(self, type):
    "Find out if the layout type corresponds to an (un)ordered part."
    return self.deasterisk(type).lower() in self.orderedlayouts

  def isnumbered(self, type):
    "Find out if the type for a layout corresponds to a numbered layout."
    if '*' in type:
      return False
    if self.isroman(type):
      return True
    if not self.isinordered(type):
      return False
    if self.getlevel(type) > DocumentParameters.maxdepth:
      return False
    return True

  def isunordered(self, type):
    "Find out if the type contains an asterisk, basically."
    return '*' in type

  def getlevel(self, type):
    "Get the level that corresponds to a layout type."
    if self.isunique(type):
      return 0
    if not self.isinordered(type):
      Trace.error('Unknown layout type ' + type)
      return 0
    type = self.deasterisk(type).lower()
    level = self.orderedlayouts.index(type) + 1
    return level - DocumentParameters.startinglevel

  def getparttype(self, type):
    "Obtain the type for the part: without the asterisk, "
    "and switched to Appendix if necessary."
    if NumberGenerator.appendix and self.getlevel(type) == 1:
      return 'Appendix'
    return self.deasterisk(type)

  def generate(self, type):
    "Generate a number for a layout type."
    "Unique part types such as Part or Book generate roman numbers: Part I."
    "Ordered part types return dot-separated tuples: Chapter 5, Subsection 2.3.5."
    "Everything else generates unique numbers: Bibliography [1]."
    "Each invocation results in a new number."
    return self.getcounter(type).getnext()

  def getcounter(self, type):
    "Get the counter for the given type."
    type = type.lower()
    if not type in self.counters:
      self.counters[type] = self.create(type)
    return self.counters[type]

  def create(self, type):
    "Create a counter for the given type."
    if self.isnumbered(type) and self.getlevel(type) > 1:
      index = self.orderedlayouts.index(type)
      above = self.orderedlayouts[index - 1]
      master = self.getcounter(above)
      return self.createdependent(type, master)
    counter = NumberCounter(type)
    if self.isroman(type):
      counter.setmode('I')
    return counter

  def getdependentcounter(self, type, master):
    "Get (or create) a counter of the given type that depends on another."
    if not type in self.counters or not self.counters[type].master:
      self.counters[type] = self.createdependent(type, master)
    return self.counters[type]

  def createdependent(self, type, master):
    "Create a dependent counter given the master."
    return DependentCounter(type).setmaster(master)

  def startappendix(self):
    "Start appendices here."
    firsttype = self.orderedlayouts[DocumentParameters.startinglevel]
    counter = self.getcounter(firsttype)
    counter.setmode('A').reset()
    NumberGenerator.appendix = True

class ChapteredGenerator(NumberGenerator):
  "Generate chaptered numbers, as in Chapter.Number."
  "Used in equations, figures: Equation (5.3), figure 8.15."

  def generate(self, type):
    "Generate a number which goes with first-level numbers (chapters). "
    "For the article classes a unique number is generated."
    if DocumentParameters.startinglevel > 0:
      return NumberGenerator.generator.generate(type)
    chapter = self.getcounter('Chapter')
    return self.getdependentcounter(type, chapter).getnext()


NumberGenerator.chaptered = ChapteredGenerator()
NumberGenerator.generator = NumberGenerator()






class ContainerSize(object):
  "The size of a container."

  width = None
  height = None
  maxwidth = None
  maxheight = None
  scale = None

  def set(self, width = None, height = None):
    "Set the proper size with width and height."
    self.setvalue('width', width)
    self.setvalue('height', height)
    return self

  def setmax(self, maxwidth = None, maxheight = None):
    "Set max width and/or height."
    self.setvalue('maxwidth', maxwidth)
    self.setvalue('maxheight', maxheight)
    return self

  def readparameters(self, container):
    "Read some size parameters off a container."
    self.setparameter(container, 'width')
    self.setparameter(container, 'height')
    self.setparameter(container, 'scale')
    self.checkvalidheight(container)
    return self

  def setparameter(self, container, name):
    "Read a size parameter off a container, and set it if present."
    value = container.getparameter(name)
    self.setvalue(name, value)

  def setvalue(self, name, value):
    "Set the value of a parameter name, only if it's valid."
    value = self.processparameter(value)
    if value:
      setattr(self, name, value)

  def checkvalidheight(self, container):
    "Check if the height parameter is valid; otherwise erase it."
    heightspecial = container.getparameter('height_special')
    if self.height and self.extractnumber(self.height) == '1' and heightspecial == 'totalheight':
      self.height = None

  def processparameter(self, value):
    "Do the full processing on a parameter."
    if not value:
      return None
    if self.extractnumber(value) == '0':
      return None
    for ignored in StyleConfig.size['ignoredtexts']:
      if ignored in value:
        value = value.replace(ignored, '')
    return value

  def extractnumber(self, text):
    "Extract the first number in the given text."
    result = ''
    decimal = False
    for char in text:
      if char.isdigit():
        result += char
      elif char == '.' and not decimal:
        result += char
        decimal = True
      else:
        return result
    return result

  def checkimage(self, width, height):
    "Check image dimensions, set them if possible."
    if width:
      self.maxwidth = unicode(width) + 'px'
      if self.scale and not self.width:
        self.width = self.scalevalue(width)
    if height:
      self.maxheight = unicode(height) + 'px'
      if self.scale and not self.height:
        self.height = self.scalevalue(height)
    if self.width and not self.height:
      self.height = 'auto'
    if self.height and not self.width:
      self.width = 'auto'

  def scalevalue(self, value):
    "Scale the value according to the image scale and return it as unicode."
    scaled = value * int(self.scale) / 100
    return unicode(int(scaled)) + 'px'

  def removepercentwidth(self):
    "Remove percent width if present, to set it at the figure level."
    if not self.width:
      return None
    if not '%' in self.width:
      return None
    width = self.width
    self.width = None
    if self.height == 'auto':
      self.height = None
    return width

  def addstyle(self, container):
    "Add the proper style attribute to the output tag."
    if not isinstance(container.output, TaggedOutput):
      Trace.error('No tag to add style, in ' + unicode(container))
    if not self.width and not self.height and not self.maxwidth and not self.maxheight:
      # nothing to see here; move along
      return
    tag = ' style="'
    tag += self.styleparameter('width')
    tag += self.styleparameter('maxwidth')
    tag += self.styleparameter('height')
    tag += self.styleparameter('maxheight')
    if tag[-1] == ' ':
      tag = tag[:-1]
    tag += '"'
    container.output.tag += tag

  def styleparameter(self, name):
    "Get the style for a single parameter."
    value = getattr(self, name)
    if value:
      return name.replace('max', 'max-') + ': ' + value + '; '
    return ''



class QuoteContainer(Container):
  "A container for a pretty quote"

  def __init__(self):
    self.parser = BoundedParser()
    self.output = FixedOutput()

  def process(self):
    "Process contents"
    self.type = self.header[2]
    if not self.type in StyleConfig.quotes:
      Trace.error('Quote type ' + self.type + ' not found')
      self.html = ['"']
      return
    self.html = [StyleConfig.quotes[self.type]]

class LyXLine(Container):
  "A Lyx line"

  def __init__(self):
    self.parser = LoneCommand()
    self.output = FixedOutput()

  def process(self):
    self.html = ['<hr class="line" />']

class EmphaticText(TaggedText):
  "Text with emphatic mode"

  def process(self):
    self.output.tag = 'i'

class ShapedText(TaggedText):
  "Text shaped (italic, slanted)"

  def process(self):
    self.type = self.header[1]
    if not self.type in TagConfig.shaped:
      Trace.error('Unrecognized shape ' + self.header[1])
      self.output.tag = 'span'
      return
    self.output.tag = TagConfig.shaped[self.type]

class VersalitasText(TaggedText):
  "Text in versalitas"

  def process(self):
    self.output.tag = 'span class="versalitas"'

class ColorText(TaggedText):
  "Colored text"

  def process(self):
    self.color = self.header[1]
    self.output.tag = 'span class="' + self.color + '"'

class SizeText(TaggedText):
  "Sized text"

  def process(self):
    self.size = self.header[1]
    self.output.tag = 'span class="' + self.size + '"'

class BoldText(TaggedText):
  "Bold text"

  def process(self):
    self.output.tag = 'b'

class TextFamily(TaggedText):
  "A bit of text from elyxer.a different family"

  def process(self):
    "Parse the type of family"
    self.type = self.header[1]
    if not self.type in TagConfig.family:
      Trace.error('Unrecognized family ' + type)
      self.output.tag = 'span'
      return
    self.output.tag = TagConfig.family[self.type]

class Hfill(TaggedText):
  "Horizontall fill"

  def process(self):
    self.output.tag = 'span class="hfill"'

class BarredText(TaggedText):
  "Text with a bar somewhere"

  def process(self):
    "Parse the type of bar"
    self.type = self.header[1]
    if not self.type in TagConfig.barred:
      Trace.error('Unknown bar type ' + self.type)
      self.output.tag = 'span'
      return
    self.output.tag = TagConfig.barred[self.type]

class LangLine(TaggedText):
  "A line with language information"

  def process(self):
    "Only generate a span with lang info when the language is recognized."
    lang = self.header[1]
    if not lang in TranslationConfig.languages:
      self.output = ContentsOutput()
      return
    isolang = TranslationConfig.languages[lang]
    self.output = TaggedOutput().settag('span lang="' + isolang + '"', False)

class InsetLength(BlackBox):
  "A length measure inside an inset."

  def process(self):
    self.length = self.header[1]

class Space(Container):
  "A space of several types"

  def __init__(self):
    self.parser = InsetParser()
    self.output = FixedOutput()
  
  def process(self):
    self.type = self.header[2]
    if self.type not in StyleConfig.hspaces:
      Trace.error('Unknown space type ' + self.type)
      self.html = [' ']
      return
    self.html = [StyleConfig.hspaces[self.type]]
    length = self.getlength()
    if not length:
      return
    self.output = TaggedOutput().settag('span class="hspace"', False)
    ContainerSize().set(length).addstyle(self)

  def getlength(self):
    "Get the space length from elyxer.the contents or parameters."
    if len(self.contents) == 0 or not isinstance(self.contents[0], InsetLength):
      return None
    return self.contents[0].length

class VerticalSpace(Container):
  "An inset that contains a vertical space."

  def __init__(self):
    self.parser = InsetParser()
    self.output = FixedOutput()

  def process(self):
    "Set the correct tag"
    self.type = self.header[2]
    if self.type not in StyleConfig.vspaces:
      self.output = TaggedOutput().settag('div class="vspace" style="height: ' + self.type + ';"', True)
      return
    self.html = [StyleConfig.vspaces[self.type]]

class Align(Container):
  "Bit of aligned text"

  def __init__(self):
    self.parser = ExcludingParser()
    self.output = TaggedOutput().setbreaklines(True)

  def process(self):
    self.output.tag = 'div class="' + self.header[1] + '"'

class Newline(Container):
  "A newline"

  def __init__(self):
    self.parser = LoneCommand()
    self.output = FixedOutput()

  def process(self):
    "Process contents"
    self.html = ['<br/>\n']

class NewPage(Newline):
  "A new page"

  def process(self):
    "Process contents"
    self.html = ['<p><br/>\n</p>\n']

class Separator(Container):
  "A separator string which is not extracted by extracttext()."

  def __init__(self, constant):
    self.output = FixedOutput()
    self.contents = []
    self.html = [constant]

class StrikeOut(TaggedText):
  "Striken out text."

  def process(self):
    "Set the output tag to strike."
    self.output.tag = 'strike'

class StartAppendix(BlackBox):
  "Mark to start an appendix here."
  "From this point on, all chapters become appendices."

  def process(self):
    "Activate the special numbering scheme for appendices, using letters."
    NumberGenerator.generator.startappendix()






class Link(Container):
  "A link to another part of the document"

  anchor = None
  url = None
  type = None
  page = None
  target = None
  destination = None
  title = None

  def __init__(self):
    "Initialize the link, add target if configured."
    self.contents = []
    self.parser = InsetParser()
    self.output = LinkOutput()
    if Options.target:
      self.target = Options.target

  def complete(self, text, anchor = None, url = None, type = None, title = None):
    "Complete the link."
    self.contents = [Constant(text)]
    if anchor:
      self.anchor = anchor
    if url:
      self.url = url
    if type:
      self.type = type
    if title:
      self.title = title
    return self

  def computedestination(self):
    "Use the destination link to fill in the destination URL."
    if not self.destination:
      return
    self.url = ''
    if self.destination.anchor:
      self.url = '#' + self.destination.anchor
    if self.destination.page:
      self.url = self.destination.page + self.url

  def setmutualdestination(self, destination):
    "Set another link as destination, and set its destination to this one."
    self.destination = destination
    destination.destination = self

  def __unicode__(self):
    "Return a printable representation."
    result = 'Link'
    if self.anchor:
      result += ' #' + self.anchor
    if self.url:
      result += ' to ' + self.url
    return result

class URL(Link):
  "A clickable URL"

  def process(self):
    "Read URL from elyxer.parameters"
    target = self.escape(self.getparameter('target'))
    self.url = target
    type = self.getparameter('type')
    if type:
      self.url = self.escape(type) + target
    name = self.getparameter('name')
    if not name:
      name = target
    self.contents = [Constant(name)]

class FlexURL(URL):
  "A flexible URL"

  def process(self):
    "Read URL from elyxer.contents"
    self.url = self.extracttext()

class LinkOutput(ContainerOutput):
  "A link pointing to some destination"
  "Or an anchor (destination)"

  def gethtml(self, link):
    "Get the HTML code for the link"
    type = link.__class__.__name__
    if link.type:
      type = link.type
    tag = 'a class="' + type + '"'
    if link.anchor:
      tag += ' name="' + link.anchor + '"'
    if link.destination:
      link.computedestination()
    if link.url:
      tag += ' href="' + link.url + '"'
    if link.target:
      tag += ' target="' + link.target + '"'
    if link.title:
      tag += ' title="' + link.title + '"'
    return TaggedOutput().settag(tag).gethtml(link)





class Postprocessor(object):
  "Postprocess a container keeping some context"

  stages = []

  def __init__(self):
    self.stages = StageDict(Postprocessor.stages, self)
    self.current = None
    self.last = None

  def postprocess(self, next):
    "Postprocess a container and its contents."
    self.postrecursive(self.current)
    result = self.postcurrent(next)
    self.last = self.current
    self.current = next
    return result

  def postrecursive(self, container):
    "Postprocess the container contents recursively"
    if not hasattr(container, 'contents'):
      return
    if len(container.contents) == 0:
      return
    if hasattr(container, 'postprocess'):
      if not container.postprocess:
        return
    postprocessor = Postprocessor()
    contents = []
    for element in container.contents:
      post = postprocessor.postprocess(element)
      if post:
        contents.append(post)
    # two rounds to empty the pipeline
    for i in range(2):
      post = postprocessor.postprocess(None)
      if post:
        contents.append(post)
    container.contents = contents

  def postcurrent(self, next):
    "Postprocess the current element taking into account next and last."
    stage = self.stages.getstage(self.current)
    if not stage:
      return self.current
    return stage.postprocess(self.last, self.current, next)

class StageDict(object):
  "A dictionary of stages corresponding to classes"

  def __init__(self, classes, postprocessor):
    "Instantiate an element from elyxer.each class and store as a dictionary"
    instances = self.instantiate(classes, postprocessor)
    self.stagedict = dict([(x.processedclass, x) for x in instances])

  def instantiate(self, classes, postprocessor):
    "Instantiate an element from elyxer.each class"
    stages = [x.__new__(x) for x in classes]
    for element in stages:
      element.__init__()
      element.postprocessor = postprocessor
    return stages

  def getstage(self, element):
    "Get the stage for a given element, if the type is in the dict"
    if not element.__class__ in self.stagedict:
      return None
    return self.stagedict[element.__class__]



class Label(Link):
  "A label to be referenced"

  names = dict()
  lastlayout = None

  def __init__(self):
    Link.__init__(self)
    self.lastnumbered = None

  def process(self):
    "Process a label container."
    key = self.getparameter('name')
    self.create(' ', key)
    self.lastnumbered = Label.lastlayout

  def create(self, text, key, type = 'Label'):
    "Create the label for a given key."
    self.key = key
    self.complete(text, anchor = key, type = type)
    Label.names[key] = self
    if key in Reference.references:
      for reference in Reference.references[key]:
        reference.destination = self
    return self

  def findpartkey(self):
    "Get the part key for the latest numbered container seen."
    numbered = self.numbered(self)
    if numbered and numbered.partkey:
      return numbered.partkey
    return ''

  def numbered(self, container):
    "Get the numbered container for the label."
    if container.partkey:
      return container
    if not container.parent:
      if self.lastnumbered:
        return self.lastnumbered
      return None
    return self.numbered(container.parent)

  def __unicode__(self):
    "Return a printable representation."
    if not hasattr(self, 'key'):
      return 'Unnamed label'
    return 'Label ' + self.key

class Reference(Link):
  "A reference to a label."

  references = dict()
  key = 'none'

  def process(self):
    "Read the reference and set the arrow."
    self.key = self.getparameter('reference')
    if self.key in Label.names:
      self.direction = u'↑'
      label = Label.names[self.key]
    else:
      self.direction = u'↓'
      label = Label().complete(' ', self.key, 'preref')
    self.destination = label
    self.formatcontents()
    if not self.key in Reference.references:
      Reference.references[self.key] = []
    Reference.references[self.key].append(self)

  def formatcontents(self):
    "Format the reference contents."
    formatkey = self.getparameter('LatexCommand')
    if not formatkey:
      formatkey = 'ref'
    self.formatted = u'↕'
    if formatkey in StyleConfig.referenceformats:
      self.formatted = StyleConfig.referenceformats[formatkey]
    else:
      Trace.error('Unknown reference format ' + formatkey)
    self.replace(u'↕', self.direction)
    self.replace('#', '1')
    self.replace('on-page', Translator.translate('on-page'))
    partkey = self.destination.findpartkey()
    # only if partkey and partkey.number are not null, send partkey.number
    self.replace('@', partkey and partkey.number)
    self.replace(u'¶', partkey and partkey.tocentry)
    if not '$' in self.formatted or not partkey or not partkey.titlecontents:
      # there is a $ left, but it should go away on preprocessing
      self.contents = [Constant(self.formatted)]
      return
    pieces = self.formatted.split('$')
    self.contents = [Constant(pieces[0])]
    for piece in pieces[1:]:
      self.contents += partkey.titlecontents
      self.contents.append(Constant(piece))

  def replace(self, key, value):
    "Replace a key in the format template with a value."
    if not key in self.formatted:
      return
    if not value:
      value = ''
    self.formatted = self.formatted.replace(key, value)

  def __unicode__(self):
    "Return a printable representation."
    return 'Reference ' + self.key



class FormulaCommand(FormulaBit):
  "A LaTeX command inside a formula"

  types = []
  start = FormulaConfig.starts['command']
  commandmap = None

  def detect(self, pos):
    "Find the current command."
    return pos.checkfor(FormulaCommand.start)

  def parsebit(self, pos):
    "Parse the command."
    command = self.extractcommand(pos)
    bit = self.parsewithcommand(command, pos)
    if bit:
      return bit
    if command.startswith('\\up') or command.startswith('\\Up'):
      upgreek = self.parseupgreek(command, pos)
      if upgreek:
        return upgreek
    if not self.factory.defining:
      Trace.error('Unknown command ' + command)
    self.output = TaggedOutput().settag('span class="unknown"')
    self.add(FormulaConstant(command))
    return None

  def parsewithcommand(self, command, pos):
    "Parse the command type once we have the command."
    for type in FormulaCommand.types:
      if command in type.commandmap:
        return self.parsecommandtype(command, type, pos)
    return None

  def parsecommandtype(self, command, type, pos):
    "Parse a given command type."
    bit = self.factory.create(type)
    bit.setcommand(command)
    returned = bit.parsebit(pos)
    if returned:
      return returned
    return bit

  def extractcommand(self, pos):
    "Extract the command from elyxer.the current position."
    if not pos.checkskip(FormulaCommand.start):
      pos.error('Missing command start ' + FormulaCommand.start)
      return
    if pos.finished():
      return self.emptycommand(pos)
    if pos.current().isalpha():
      # alpha command
      command = FormulaCommand.start + pos.globalpha()
      # skip mark of short command
      pos.checkskip('*')
      return command
    # symbol command
    return FormulaCommand.start + pos.skipcurrent()

  def emptycommand(self, pos):
    """Check for an empty command: look for command disguised as ending.
    Special case against '{ \{ \} }' situation."""
    command = ''
    if not pos.isout():
      ending = pos.nextending()
      if ending and pos.checkskip(ending):
        command = ending
    return FormulaCommand.start + command

  def parseupgreek(self, command, pos):
    "Parse the Greek \\up command.."
    if len(command) < 4:
      return None
    if command.startswith('\\up'):
      upcommand = '\\' + command[3:]
    elif pos.checkskip('\\Up'):
      upcommand = '\\' + command[3:4].upper() + command[4:]
    else:
      Trace.error('Impossible upgreek command: ' + command)
      return
    upgreek = self.parsewithcommand(upcommand, pos)
    if upgreek:
      upgreek.type = 'font'
    return upgreek

class CommandBit(FormulaCommand):
  "A formula bit that includes a command"

  def setcommand(self, command):
    "Set the command in the bit"
    self.command = command
    if self.commandmap:
      self.original += command
      self.translated = self.commandmap[self.command]
 
  def parseparameter(self, pos):
    "Parse a parameter at the current position"
    self.factory.clearskipped(pos)
    if pos.finished():
      return None
    parameter = self.factory.parseany(pos)
    self.add(parameter)
    return parameter

  def parsesquare(self, pos):
    "Parse a square bracket"
    self.factory.clearskipped(pos)
    if not self.factory.detecttype(SquareBracket, pos):
      return None
    bracket = self.factory.parsetype(SquareBracket, pos)
    self.add(bracket)
    return bracket

  def parseliteral(self, pos):
    "Parse a literal bracket."
    self.factory.clearskipped(pos)
    if not self.factory.detecttype(Bracket, pos):
      if not pos.isvalue():
        Trace.error('No literal parameter found at: ' + pos.identifier())
        return None
      return pos.globvalue()
    bracket = Bracket().setfactory(self.factory)
    self.add(bracket.parseliteral(pos))
    return bracket.literal

  def parsesquareliteral(self, pos):
    "Parse a square bracket literally."
    self.factory.clearskipped(pos)
    if not self.factory.detecttype(SquareBracket, pos):
      return None
    bracket = SquareBracket().setfactory(self.factory)
    self.add(bracket.parseliteral(pos))
    return bracket.literal

  def parsetext(self, pos):
    "Parse a text parameter."
    self.factory.clearskipped(pos)
    if not self.factory.detecttype(Bracket, pos):
      Trace.error('No text parameter for ' + self.command)
      return None
    bracket = Bracket().setfactory(self.factory).parsetext(pos)
    self.add(bracket)
    return bracket

class EmptyCommand(CommandBit):
  "An empty command (without parameters)"

  commandmap = FormulaConfig.commands

  def parsebit(self, pos):
    "Parse a command without parameters"
    self.contents = [FormulaConstant(self.translated)]

class SpacedCommand(CommandBit):
  "An empty command which should have math spacing in formulas."

  commandmap = FormulaConfig.spacedcommands

  def parsebit(self, pos):
    "Place as contents the command translated and spaced."
    self.contents = [FormulaConstant(u' ' + self.translated + u' ')]

class AlphaCommand(EmptyCommand):
  "A command without paramters whose result is alphabetical"

  commandmap = FormulaConfig.alphacommands

  def parsebit(self, pos):
    "Parse the command and set type to alpha"
    EmptyCommand.parsebit(self, pos)
    self.type = 'alpha'

class OneParamFunction(CommandBit):
  "A function of one parameter"

  commandmap = FormulaConfig.onefunctions
  simplified = False

  def parsebit(self, pos):
    "Parse a function with one parameter"
    self.output = TaggedOutput().settag(self.translated)
    self.parseparameter(pos)
    self.simplifyifpossible()

  def simplifyifpossible(self):
    "Try to simplify to a single character."
    if self.original in self.commandmap:
      self.output = FixedOutput()
      self.html = [self.commandmap[self.original]]
      self.simplified = True

class SymbolFunction(CommandBit):
  "Find a function which is represented by a symbol (like _ or ^)"

  commandmap = FormulaConfig.symbolfunctions

  def detect(self, pos):
    "Find the symbol"
    return pos.current() in SymbolFunction.commandmap

  def parsebit(self, pos):
    "Parse the symbol"
    self.setcommand(pos.current())
    pos.skip(self.command)
    self.output = TaggedOutput().settag(self.translated)
    self.parseparameter(pos)

class TextFunction(CommandBit):
  "A function where parameters are read as text."

  commandmap = FormulaConfig.textfunctions

  def parsebit(self, pos):
    "Parse a text parameter"
    self.output = TaggedOutput().settag(self.translated)
    self.parsetext(pos)

  def process(self):
    "Set the type to font"
    self.type = 'font'

class LabelFunction(CommandBit):
  "A function that acts as a label"

  commandmap = FormulaConfig.labelfunctions

  def parsebit(self, pos):
    "Parse a literal parameter"
    self.key = self.parseliteral(pos)

  def process(self):
    "Add an anchor with the label contents."
    self.type = 'font'
    self.label = Label().create(' ', self.key, type = 'eqnumber')
    self.contents = [self.label]
    # store as a Label so we know it's been seen
    Label.names[self.key] = self.label

class FontFunction(OneParamFunction):
  "A function of one parameter that changes the font"

  commandmap = FormulaConfig.fontfunctions

  def process(self):
    "Simplify if possible using a single character."
    self.type = 'font'
    self.simplifyifpossible()

FormulaFactory.types += [FormulaCommand, SymbolFunction]
FormulaCommand.types = [
    AlphaCommand, EmptyCommand, OneParamFunction, FontFunction, LabelFunction,
    TextFunction, SpacedCommand,
    ]












class BigSymbol(object):
  "A big symbol generator."

  symbols = FormulaConfig.bigsymbols

  def __init__(self, symbol):
    "Create the big symbol."
    self.symbol = symbol

  def getpieces(self):
    "Get an array with all pieces."
    if not self.symbol in self.symbols:
      return [self.symbol]
    if self.smalllimit():
      return [self.symbol]
    return self.symbols[self.symbol]

  def smalllimit(self):
    "Decide if the limit should be a small, one-line symbol."
    if not DocumentParameters.displaymode:
      return True
    if len(self.symbols[self.symbol]) == 1:
      return True
    return Options.simplemath

class BigBracket(BigSymbol):
  "A big bracket generator."

  def __init__(self, size, bracket, alignment='l'):
    "Set the size and symbol for the bracket."
    self.size = size
    self.original = bracket
    self.alignment = alignment
    self.pieces = None
    if bracket in FormulaConfig.bigbrackets:
      self.pieces = FormulaConfig.bigbrackets[bracket]

  def getpiece(self, index):
    "Return the nth piece for the bracket."
    function = getattr(self, 'getpiece' + unicode(len(self.pieces)))
    return function(index)

  def getpiece1(self, index):
    "Return the only piece for a single-piece bracket."
    return self.pieces[0]

  def getpiece3(self, index):
    "Get the nth piece for a 3-piece bracket: parenthesis or square bracket."
    if index == 0:
      return self.pieces[0]
    if index == self.size - 1:
      return self.pieces[-1]
    return self.pieces[1]

  def getpiece4(self, index):
    "Get the nth piece for a 4-piece bracket: curly bracket."
    if index == 0:
      return self.pieces[0]
    if index == self.size - 1:
      return self.pieces[3]
    if index == (self.size - 1)/2:
      return self.pieces[2]
    return self.pieces[1]

  def getcell(self, index):
    "Get the bracket piece as an array cell."
    piece = self.getpiece(index)
    span = 'span class="bracket align-' + self.alignment + '"'
    return TaggedBit().constant(piece, span)

  def getcontents(self):
    "Get the bracket as an array or as a single bracket."
    if self.size == 1 or not self.pieces:
      return self.getsinglebracket()
    rows = []
    for index in range(self.size):
      cell = self.getcell(index)
      rows.append(TaggedBit().complete([cell], 'span class="arrayrow"'))
    return [TaggedBit().complete(rows, 'span class="array"')]

  def getsinglebracket(self):
    "Return the bracket as a single sign."
    if self.original == '.':
      return [TaggedBit().constant('', 'span class="emptydot"')]
    return [TaggedBit().constant(self.original, 'span class="symbol"')]






class FormulaEquation(CommandBit):
  "A simple numbered equation."

  piece = 'equation'

  def parsebit(self, pos):
    "Parse the array"
    self.output = ContentsOutput()
    self.add(self.factory.parsetype(WholeFormula, pos))

class FormulaCell(FormulaCommand):
  "An array cell inside a row"

  def setalignment(self, alignment):
    self.alignment = alignment
    self.output = TaggedOutput().settag('span class="arraycell align-' + alignment +'"', True)
    return self

  def parsebit(self, pos):
    self.factory.clearskipped(pos)
    if pos.finished():
      return
    self.add(self.factory.parsetype(WholeFormula, pos))

class FormulaRow(FormulaCommand):
  "An array row inside an array"

  cellseparator = FormulaConfig.array['cellseparator']

  def setalignments(self, alignments):
    self.alignments = alignments
    self.output = TaggedOutput().settag('span class="arrayrow"', True)
    return self

  def parsebit(self, pos):
    "Parse a whole row"
    index = 0
    pos.pushending(self.cellseparator, optional=True)
    while not pos.finished():
      cell = self.createcell(index)
      cell.parsebit(pos)
      self.add(cell)
      index += 1
      pos.checkskip(self.cellseparator)
    if len(self.contents) == 0:
      self.output = EmptyOutput()

  def createcell(self, index):
    "Create the cell that corresponds to the given index."
    alignment = self.alignments[index % len(self.alignments)]
    return self.factory.create(FormulaCell).setalignment(alignment)

class MultiRowFormula(CommandBit):
  "A formula with multiple rows."

  def parserows(self, pos):
    "Parse all rows, finish when no more row ends"
    self.rows = []
    first = True
    for row in self.iteraterows(pos):
      if first:
        first = False
      else:
        # intersparse empty rows
        self.addempty()
      row.parsebit(pos)
      self.addrow(row)
    self.size = len(self.rows)

  def iteraterows(self, pos):
    "Iterate over all rows, end when no more row ends"
    rowseparator = FormulaConfig.array['rowseparator']
    while True:
      pos.pushending(rowseparator, True)
      row = self.factory.create(FormulaRow)
      yield row.setalignments(self.alignments)
      if pos.checkfor(rowseparator):
        self.original += pos.popending(rowseparator)
      else:
        return

  def addempty(self):
    "Add an empty row."
    row = self.factory.create(FormulaRow).setalignments(self.alignments)
    for index, originalcell in enumerate(self.rows[-1].contents):
      cell = row.createcell(index)
      cell.add(FormulaConstant(u' '))
      row.add(cell)
    self.addrow(row)

  def addrow(self, row):
    "Add a row to the contents and to the list of rows."
    self.rows.append(row)
    self.add(row)

class FormulaArray(MultiRowFormula):
  "An array within a formula"

  piece = 'array'

  def parsebit(self, pos):
    "Parse the array"
    self.output = TaggedOutput().settag('span class="array"', False)
    self.parsealignments(pos)
    self.parserows(pos)

  def parsealignments(self, pos):
    "Parse the different alignments"
    # vertical
    self.valign = 'c'
    literal = self.parsesquareliteral(pos)
    if literal:
      self.valign = literal
    # horizontal
    literal = self.parseliteral(pos)
    self.alignments = []
    for l in literal:
      self.alignments.append(l)

class FormulaMatrix(MultiRowFormula):
  "A matrix (array with center alignment)."

  piece = 'matrix'

  def parsebit(self, pos):
    "Parse the matrix, set alignments to 'c'."
    self.output = TaggedOutput().settag('span class="array"', False)
    self.valign = 'c'
    self.alignments = ['c']
    self.parserows(pos)

class FormulaCases(MultiRowFormula):
  "A cases statement"

  piece = 'cases'

  def parsebit(self, pos):
    "Parse the cases"
    self.output = ContentsOutput()
    self.alignments = ['l', 'l']
    self.parserows(pos)
    for row in self.contents:
      for cell in row.contents:
        cell.output.settag('span class="case align-l"', True)
        cell.contents.append(FormulaConstant(u' '))
    array = TaggedBit().complete(self.contents, 'span class="bracketcases"', True)
    brace = BigBracket(len(self.contents), '{', 'l')
    self.contents = brace.getcontents() + [array]

class EquationEnvironment(MultiRowFormula):
  "A \\begin{}...\\end equation environment with rows and cells."

  def parsebit(self, pos):
    "Parse the whole environment."
    self.output = TaggedOutput().settag('span class="environment"', False)
    environment = self.piece.replace('*', '')
    if environment in FormulaConfig.environments:
      self.alignments = FormulaConfig.environments[environment]
    else:
      Trace.error('Unknown equation environment ' + self.piece)
      self.alignments = ['l']
    self.parserows(pos)

class BeginCommand(CommandBit):
  "A \\begin{}...\end command and what it entails (array, cases, aligned)"

  commandmap = {FormulaConfig.array['begin']:''}

  types = [FormulaEquation, FormulaArray, FormulaCases, FormulaMatrix]

  def parsebit(self, pos):
    "Parse the begin command"
    command = self.parseliteral(pos)
    bit = self.findbit(command)
    ending = FormulaConfig.array['end'] + '{' + command + '}'
    pos.pushending(ending)
    bit.parsebit(pos)
    self.add(bit)
    self.original += pos.popending(ending)
    self.size = bit.size

  def findbit(self, piece):
    "Find the command bit corresponding to the \\begin{piece}"
    for type in BeginCommand.types:
      if piece.replace('*', '') == type.piece:
        return self.factory.create(type)
    bit = self.factory.create(EquationEnvironment)
    bit.piece = piece
    return bit

FormulaCommand.types += [BeginCommand]


import datetime


class CombiningFunction(OneParamFunction):

  commandmap = FormulaConfig.combiningfunctions

  def parsebit(self, pos):
    "Parse a combining function."
    self.type = 'alpha'
    combining = self.translated
    parameter = self.parsesingleparameter(pos)
    if not parameter:
      Trace.error('Empty parameter for combining function ' + self.command)
    elif len(parameter.extracttext()) != 1:
      Trace.error('Applying combining function ' + self.command + ' to invalid string "' + parameter.extracttext() + '"')
    self.contents.append(Constant(combining))

  def parsesingleparameter(self, pos):
    "Parse a parameter, or a single letter."
    self.factory.clearskipped(pos)
    if pos.finished():
      Trace.error('Error while parsing single parameter at ' + pos.identifier())
      return None
    if self.factory.detecttype(Bracket, pos) \
        or self.factory.detecttype(FormulaCommand, pos):
      return self.parseparameter(pos)
    letter = FormulaConstant(pos.skipcurrent())
    self.add(letter)
    return letter

class DecoratingFunction(OneParamFunction):
  "A function that decorates some bit of text"

  commandmap = FormulaConfig.decoratingfunctions

  def parsebit(self, pos):
    "Parse a decorating function"
    self.type = 'alpha'
    symbol = self.translated
    self.symbol = TaggedBit().constant(symbol, 'span class="symbolover"')
    self.parameter = self.parseparameter(pos)
    self.output = TaggedOutput().settag('span class="withsymbol"')
    self.contents.insert(0, self.symbol)
    self.parameter.output = TaggedOutput().settag('span class="undersymbol"')
    self.simplifyifpossible()

class LimitCommand(EmptyCommand):
  "A command which accepts limits above and below, in display mode."

  commandmap = FormulaConfig.limitcommands

  def parsebit(self, pos):
    "Parse a limit command."
    pieces = BigSymbol(self.translated).getpieces()
    self.output = TaggedOutput().settag('span class="limits"')
    for piece in pieces:
      self.contents.append(TaggedBit().constant(piece, 'span class="limit"'))

class LimitPreviousCommand(LimitCommand):
  "A command to limit the previous command."

  commandmap = None

  def parsebit(self, pos):
    "Do nothing."
    self.output = TaggedOutput().settag('span class="limits"')
    self.factory.clearskipped(pos)

  def __unicode__(self):
    "Return a printable representation."
    return 'Limit previous command'

class LimitsProcessor(MathsProcessor):
  "A processor for limits inside an element."

  def process(self, contents, index):
    "Process the limits for an element."
    if Options.simplemath:
      return
    if self.checklimits(contents, index):
      self.modifylimits(contents, index)
    if self.checkscript(contents, index) and self.checkscript(contents, index + 1):
      self.modifyscripts(contents, index)

  def checklimits(self, contents, index):
    "Check if the current position has a limits command."
    if not DocumentParameters.displaymode:
      return False
    if self.checkcommand(contents, index + 1, LimitPreviousCommand):
      self.limitsahead(contents, index)
      return False
    if not isinstance(contents[index], LimitCommand):
      return False
    return self.checkscript(contents, index + 1)

  def limitsahead(self, contents, index):
    "Limit the current element based on the next."
    contents[index + 1].add(contents[index].clone())
    contents[index].output = EmptyOutput()

  def modifylimits(self, contents, index):
    "Modify a limits commands so that the limits appear above and below."
    limited = contents[index]
    subscript = self.getlimit(contents, index + 1)
    limited.contents.append(subscript)
    if self.checkscript(contents, index + 1):
      superscript = self.getlimit(contents, index  + 1)
    else:
      superscript = TaggedBit().constant(u' ', 'sup class="limit"')
    limited.contents.insert(0, superscript)

  def getlimit(self, contents, index):
    "Get the limit for a limits command."
    limit = self.getscript(contents, index)
    limit.output.tag = limit.output.tag.replace('script', 'limit')
    return limit

  def modifyscripts(self, contents, index):
    "Modify the super- and subscript to appear vertically aligned."
    subscript = self.getscript(contents, index)
    # subscript removed so instead of index + 1 we get index again
    superscript = self.getscript(contents, index)
    scripts = TaggedBit().complete([superscript, subscript], 'span class="scripts"')
    contents.insert(index, scripts)

  def checkscript(self, contents, index):
    "Check if the current element is a sub- or superscript."
    return self.checkcommand(contents, index, SymbolFunction)

  def checkcommand(self, contents, index, type):
    "Check for the given type as the current element."
    if len(contents) <= index:
      return False
    return isinstance(contents[index], type)

  def getscript(self, contents, index):
    "Get the sub- or superscript."
    bit = contents[index]
    bit.output.tag += ' class="script"'
    del contents[index]
    return bit

class BracketCommand(OneParamFunction):
  "A command which defines a bracket."

  commandmap = FormulaConfig.bracketcommands

  def parsebit(self, pos):
    "Parse the bracket."
    OneParamFunction.parsebit(self, pos)

  def create(self, direction, character):
    "Create the bracket for the given character."
    self.original = character
    self.command = '\\' + direction
    self.contents = [FormulaConstant(character)]
    return self

class BracketProcessor(MathsProcessor):
  "A processor for bracket commands."

  def process(self, contents, index):
    "Convert the bracket using Unicode pieces, if possible."
    if Options.simplemath:
      return
    if self.checkleft(contents, index):
      return self.processleft(contents, index)

  def processleft(self, contents, index):
    "Process a left bracket."
    rightindex = self.findright(contents, index + 1)
    if not rightindex:
      return
    size = self.findmax(contents, index, rightindex)
    self.resize(contents[index], size)
    self.resize(contents[rightindex], size)

  def checkleft(self, contents, index):
    "Check if the command at the given index is left."
    return self.checkdirection(contents[index], '\\left')
  
  def checkright(self, contents, index):
    "Check if the command at the given index is right."
    return self.checkdirection(contents[index], '\\right')

  def checkdirection(self, bit, command):
    "Check if the given bit is the desired bracket command."
    if not isinstance(bit, BracketCommand):
      return False
    return bit.command == command

  def findright(self, contents, index):
    "Find the right bracket starting at the given index, or 0."
    depth = 1
    while index < len(contents):
      if self.checkleft(contents, index):
        depth += 1
      if self.checkright(contents, index):
        depth -= 1
      if depth == 0:
        return index
      index += 1
    return None

  def findmax(self, contents, leftindex, rightindex):
    "Find the max size of the contents between the two given indices."
    sliced = contents[leftindex:rightindex]
    return max([element.size for element in sliced])

  def resize(self, command, size):
    "Resize a bracket command to the given size."
    character = command.extracttext()
    alignment = command.command.replace('\\', '')
    bracket = BigBracket(size, character, alignment)
    command.output = ContentsOutput()
    command.contents = bracket.getcontents()

class TodayCommand(EmptyCommand):
  "Shows today's date."

  commandmap = None

  def parsebit(self, pos):
    "Parse a command without parameters"
    self.output = FixedOutput()
    self.html = [datetime.date.today().strftime('%b %d, %Y')]


FormulaCommand.types += [
    DecoratingFunction, CombiningFunction, LimitCommand, BracketCommand,
    ]

FormulaProcessor.processors += [
    LimitsProcessor(), BracketProcessor(),
    ]



class ParameterDefinition(object):
  "The definition of a parameter in a hybrid function."
  "[] parameters are optional, {} parameters are mandatory."
  "Each parameter has a one-character name, like {$1} or {$p}."
  "A parameter that ends in ! like {$p!} is a literal."
  "Example: [$1]{$p!} reads an optional parameter $1 and a literal mandatory parameter p."

  parambrackets = [('[', ']'), ('{', '}')]

  def __init__(self):
    self.name = None
    self.literal = False
    self.optional = False
    self.value = None
    self.literalvalue = None

  def parse(self, pos):
    "Parse a parameter definition: [$0], {$x}, {$1!}..."
    for (opening, closing) in ParameterDefinition.parambrackets:
      if pos.checkskip(opening):
        if opening == '[':
          self.optional = True
        if not pos.checkskip('$'):
          Trace.error('Wrong parameter name, did you mean $' + pos.current() + '?')
          return None
        self.name = pos.skipcurrent()
        if pos.checkskip('!'):
          self.literal = True
        if not pos.checkskip(closing):
          Trace.error('Wrong parameter closing ' + pos.skipcurrent())
          return None
        return self
    Trace.error('Wrong character in parameter template: ' + pos.skipcurrent())
    return None

  def read(self, pos, function):
    "Read the parameter itself using the definition."
    if self.literal:
      if self.optional:
        self.literalvalue = function.parsesquareliteral(pos)
      else:
        self.literalvalue = function.parseliteral(pos)
      if self.literalvalue:
        self.value = FormulaConstant(self.literalvalue)
    elif self.optional:
      self.value = function.parsesquare(pos)
    else:
      self.value = function.parseparameter(pos)

  def __unicode__(self):
    "Return a printable representation."
    result = 'param ' + self.name
    if self.value:
      result += ': ' + unicode(self.value)
    else:
      result += ' (empty)'
    return result

class ParameterFunction(CommandBit):
  "A function with a variable number of parameters defined in a template."
  "The parameters are defined as a parameter definition."

  def readparams(self, readtemplate, pos):
    "Read the params according to the template."
    self.params = dict()
    for paramdef in self.paramdefs(readtemplate):
      paramdef.read(pos, self)
      self.params['$' + paramdef.name] = paramdef

  def paramdefs(self, readtemplate):
    "Read each param definition in the template"
    pos = TextPosition(readtemplate)
    while not pos.finished():
      paramdef = ParameterDefinition().parse(pos)
      if paramdef:
        yield paramdef

  def getparam(self, name):
    "Get a parameter as parsed."
    if not name in self.params:
      return None
    return self.params[name]

  def getvalue(self, name):
    "Get the value of a parameter."
    return self.getparam(name).value

  def getliteralvalue(self, name):
    "Get the literal value of a parameter."
    param = self.getparam(name)
    if not param or not param.literalvalue:
      return None
    return param.literalvalue

class HybridFunction(ParameterFunction):
  """
  A parameter function where the output is also defined using a template.
  The template can use a number of functions; each function has an associated
  tag.
  Example: [f0{$1},span class="fbox"] defines a function f0 which corresponds
  to a span of class fbox, yielding <span class="fbox">$1</span>.
  Literal parameters can be used in tags definitions:
    [f0{$1},span style="color: $p;"]
  yields <span style="color: $p;">$1</span>, where $p is a literal parameter.
  Sizes can be specified in hybridsizes, e.g. adding parameter sizes. By
  default the resulting size is the max of all arguments. Sizes are used
  to generate the right parameters.
  A function followed by a single / is output as a self-closing XHTML tag:
    [f0/,hr]
  will generate <hr/>.
  """

  commandmap = FormulaConfig.hybridfunctions

  def parsebit(self, pos):
    "Parse a function with [] and {} parameters"
    readtemplate = self.translated[0]
    writetemplate = self.translated[1]
    self.readparams(readtemplate, pos)
    self.contents = self.writeparams(writetemplate)
    self.computehybridsize()

  def writeparams(self, writetemplate):
    "Write all params according to the template"
    return self.writepos(TextPosition(writetemplate))

  def writepos(self, pos):
    "Write all params as read in the parse position."
    result = []
    while not pos.finished():
      if pos.checkskip('$'):
        param = self.writeparam(pos)
        if param:
          result.append(param)
      elif pos.checkskip('f'):
        function = self.writefunction(pos)
        if function:
          function.type = None
          result.append(function)
      elif pos.checkskip('('):
        result.append(self.writebracket('left', '('))
      elif pos.checkskip(')'):
        result.append(self.writebracket('right', ')'))
      else:
        result.append(FormulaConstant(pos.skipcurrent()))
    return result

  def writeparam(self, pos):
    "Write a single param of the form $0, $x..."
    name = '$' + pos.skipcurrent()
    if not name in self.params:
      Trace.error('Unknown parameter ' + name)
      return None
    if not self.params[name]:
      return None
    if pos.checkskip('.'):
      self.params[name].value.type = pos.globalpha()
    return self.params[name].value

  def writefunction(self, pos):
    "Write a single function f0,...,fn."
    tag = self.readtag(pos)
    if not tag:
      return None
    if pos.checkskip('/'):
      # self-closing XHTML tag, such as <hr/>
      return TaggedBit().selfcomplete(tag)
    if not pos.checkskip('{'):
      Trace.error('Function should be defined in {}')
      return None
    pos.pushending('}')
    contents = self.writepos(pos)
    pos.popending()
    if len(contents) == 0:
      return None
    return TaggedBit().complete(contents, tag)

  def readtag(self, pos):
    "Get the tag corresponding to the given index. Does parameter substitution."
    if not pos.current().isdigit():
      Trace.error('Function should be f0,...,f9: f' + pos.current())
      return None
    index = int(pos.skipcurrent())
    if 2 + index > len(self.translated):
      Trace.error('Function f' + unicode(index) + ' is not defined')
      return None
    tag = self.translated[2 + index]
    if not '$' in tag:
      return tag
    for variable in self.params:
      if variable in tag:
        param = self.params[variable]
        if not param.literal:
          Trace.error('Parameters in tag ' + tag + ' should be literal: {' + variable + '!}')
          continue
        if param.literalvalue:
          value = param.literalvalue
        else:
          value = ''
        tag = tag.replace(variable, value)
    return tag

  def writebracket(self, direction, character):
    "Return a new bracket looking at the given direction."
    return self.factory.create(BracketCommand).create(direction, character)
  
  def computehybridsize(self):
    "Compute the size of the hybrid function."
    if not self.command in HybridSize.configsizes:
      self.computesize()
      return
    self.size = HybridSize().getsize(self)
    # set the size in all elements at first level
    for element in self.contents:
      element.size = self.size

class HybridSize(object):
  "The size associated with a hybrid function."

  configsizes = FormulaConfig.hybridsizes

  def getsize(self, function):
    "Read the size for a function and parse it."
    sizestring = self.configsizes[function.command]
    for name in function.params:
      if name in sizestring:
        size = function.params[name].value.computesize()
        sizestring = sizestring.replace(name, unicode(size))
    if '$' in sizestring:
      Trace.error('Unconverted variable in hybrid size: ' + sizestring)
      return 1
    return eval(sizestring)


FormulaCommand.types += [HybridFunction]









class HeaderParser(Parser):
  "Parses the LyX header"

  def parse(self, reader):
    "Parse header parameters into a dictionary, return the preamble."
    contents = []
    self.parseending(reader, lambda: self.parseline(reader, contents))
    # skip last line
    reader.nextline()
    return contents

  def parseline(self, reader, contents):
    "Parse a single line as a parameter or as a start"
    line = reader.currentline()
    if line.startswith(HeaderConfig.parameters['branch']):
      self.parsebranch(reader)
      return
    elif line.startswith(HeaderConfig.parameters['lstset']):
      LstParser().parselstset(reader)
      return
    elif line.startswith(HeaderConfig.parameters['beginpreamble']):
      contents.append(self.factory.createcontainer(reader))
      return
    # no match
    self.parseparameter(reader)

  def parsebranch(self, reader):
    "Parse all branch definitions."
    branch = reader.currentline().split()[1]
    reader.nextline()
    subparser = HeaderParser().complete(HeaderConfig.parameters['endbranch'])
    subparser.parse(reader)
    options = BranchOptions(branch)
    for key in subparser.parameters:
      options.set(key, subparser.parameters[key])
    Options.branches[branch] = options

  def complete(self, ending):
    "Complete the parser with the given ending."
    self.ending = ending
    return self

class PreambleParser(Parser):
  "A parser for the LyX preamble."

  preamble = []

  def parse(self, reader):
    "Parse the full preamble with all statements."
    self.ending = HeaderConfig.parameters['endpreamble']
    self.parseending(reader, lambda: self.parsepreambleline(reader))
    return []

  def parsepreambleline(self, reader):
    "Parse a single preamble line."
    PreambleParser.preamble.append(reader.currentline())
    reader.nextline()

class LstParser(object):
  "Parse global and local lstparams."

  globalparams = dict()

  def parselstset(self, reader):
    "Parse a declaration of lstparams in lstset."
    paramtext = self.extractlstset(reader)
    if not '{' in paramtext:
      Trace.error('Missing opening bracket in lstset: ' + paramtext)
      return
    lefttext = paramtext.split('{')[1]
    croppedtext = lefttext[:-1]
    LstParser.globalparams = self.parselstparams(croppedtext)

  def extractlstset(self, reader):
    "Extract the global lstset parameters."
    paramtext = ''
    while not reader.finished():
      paramtext += reader.currentline()
      reader.nextline()
      if paramtext.endswith('}'):
        return paramtext
    Trace.error('Could not find end of \\lstset settings; aborting')

  def parsecontainer(self, container):
    "Parse some lstparams from elyxer.a container."
    container.lstparams = LstParser.globalparams.copy()
    paramlist = container.getparameterlist('lstparams')
    container.lstparams.update(self.parselstparams(paramlist))

  def parselstparams(self, paramlist):
    "Process a number of lstparams from elyxer.a list."
    paramdict = dict()
    for param in paramlist:
      if not '=' in param:
        if len(param.strip()) > 0:
          Trace.error('Invalid listing parameter ' + param)
      else:
        key, value = param.split('=', 1)
        paramdict[key] = value
    return paramdict




class MacroDefinition(CommandBit):
  "A function that defines a new command (a macro)."

  macros = dict()

  def parsebit(self, pos):
    "Parse the function that defines the macro."
    self.output = EmptyOutput()
    self.parameternumber = 0
    self.defaults = []
    self.factory.defining = True
    self.parseparameters(pos)
    self.factory.defining = False
    Trace.debug('New command ' + self.newcommand + ' (' + \
        unicode(self.parameternumber) + ' parameters)')
    self.macros[self.newcommand] = self

  def parseparameters(self, pos):
    "Parse all optional parameters (number of parameters, default values)"
    "and the mandatory definition."
    self.newcommand = self.parsenewcommand(pos)
    # parse number of parameters
    literal = self.parsesquareliteral(pos)
    if literal:
      self.parameternumber = int(literal)
    # parse all default values
    bracket = self.parsesquare(pos)
    while bracket:
      self.defaults.append(bracket)
      bracket = self.parsesquare(pos)
    # parse mandatory definition
    self.definition = self.parseparameter(pos)

  def parsenewcommand(self, pos):
    "Parse the name of the new command."
    self.factory.clearskipped(pos)
    if self.factory.detecttype(Bracket, pos):
      return self.parseliteral(pos)
    if self.factory.detecttype(FormulaCommand, pos):
      return self.factory.create(FormulaCommand).extractcommand(pos)
    Trace.error('Unknown formula bit in defining function at ' + pos.identifier())
    return 'unknown'

  def instantiate(self):
    "Return an instance of the macro."
    return self.definition.clone()

class MacroParameter(FormulaBit):
  "A parameter from elyxer.a macro."

  def detect(self, pos):
    "Find a macro parameter: #n."
    return pos.checkfor('#')

  def parsebit(self, pos):
    "Parse the parameter: #n."
    if not pos.checkskip('#'):
      Trace.error('Missing parameter start #.')
      return
    self.number = int(pos.skipcurrent())
    self.original = '#' + unicode(self.number)
    self.contents = [TaggedBit().constant('#' + unicode(self.number), 'span class="unknown"')]

class MacroFunction(CommandBit):
  "A function that was defined using a macro."

  commandmap = MacroDefinition.macros

  def parsebit(self, pos):
    "Parse a number of input parameters."
    self.output = FilteredOutput()
    self.values = []
    macro = self.translated
    self.parseparameters(pos, macro)
    self.completemacro(macro)

  def parseparameters(self, pos, macro):
    "Parse as many parameters as are needed."
    self.parseoptional(pos, list(macro.defaults))
    self.parsemandatory(pos, macro.parameternumber - len(macro.defaults))
    if len(self.values) < macro.parameternumber:
      Trace.error('Missing parameters in macro ' + unicode(self))

  def parseoptional(self, pos, defaults):
    "Parse optional parameters."
    optional = []
    while self.factory.detecttype(SquareBracket, pos):
      optional.append(self.parsesquare(pos))
      if len(optional) > len(defaults):
        break
    for value in optional:
      default = defaults.pop()
      if len(value.contents) > 0:
        self.values.append(value)
      else:
        self.values.append(default)
    self.values += defaults

  def parsemandatory(self, pos, number):
    "Parse a number of mandatory parameters."
    for index in range(number):
      parameter = self.parsemacroparameter(pos, number - index)
      if not parameter:
        return
      self.values.append(parameter)

  def parsemacroparameter(self, pos, remaining):
    "Parse a macro parameter. Could be a bracket or a single letter."
    "If there are just two values remaining and there is a running number,"
    "parse as two separater numbers."
    self.factory.clearskipped(pos)
    if pos.finished():
      return None
    if self.factory.detecttype(FormulaNumber, pos):
      return self.parsenumbers(pos, remaining)
    return self.parseparameter(pos)

  def parsenumbers(self, pos, remaining):
    "Parse the remaining parameters as a running number."
    "For example, 12 would be {1}{2}."
    number = self.factory.parsetype(FormulaNumber, pos)
    if not len(number.original) == remaining:
      return number
    for digit in number.original:
      value = self.factory.create(FormulaNumber)
      value.add(FormulaConstant(digit))
      value.type = number
      self.values.append(value)
    return None

  def completemacro(self, macro):
    "Complete the macro with the parameters read."
    self.contents = [macro.instantiate()]
    replaced = [False] * len(self.values)
    for parameter in self.searchall(MacroParameter):
      index = parameter.number - 1
      if index >= len(self.values):
        Trace.error('Macro parameter index out of bounds: ' + unicode(index))
        return
      replaced[index] = True
      parameter.contents = [self.values[index].clone()]
    for index in range(len(self.values)):
      if not replaced[index]:
        self.addfilter(index, self.values[index])

  def addfilter(self, index, value):
    "Add a filter for the given parameter number and parameter value."
    original = '#' + unicode(index + 1)
    value = ''.join(self.values[0].gethtml())
    self.output.addfilter(original, value)

class FormulaMacro(Formula):
  "A math macro defined in an inset."

  def __init__(self):
    self.parser = MacroParser()
    self.output = EmptyOutput()

  def __unicode__(self):
    "Return a printable representation."
    return 'Math macro'

FormulaFactory.types += [ MacroParameter ]

FormulaCommand.types += [
    MacroFunction,
    ]



def math2html(formula):
  "Convert some TeX math to HTML."
  factory = FormulaFactory()
  whole = factory.parseformula(formula)
  FormulaProcessor().process(whole)
  whole.process()
  return ''.join(whole.gethtml())

def main():
  "Main function, called if invoked from elyxer.the command line"
  args = sys.argv
  Options().parseoptions(args)
  if len(args) != 1:
    Trace.error('Usage: math2html.py escaped_string')
    exit()
  result = math2html(args[0])
  Trace.message(result)

if __name__ == '__main__':
  main()

