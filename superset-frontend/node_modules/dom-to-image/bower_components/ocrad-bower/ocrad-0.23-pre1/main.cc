/*  GNU Ocrad - Optical Character Recognition program
    Copyright (C) 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011,
    2012, 2013 Antonio Diaz Diaz.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
/*
    Exit status: 0 for a normal exit, 1 for environmental problems
    (file not found, invalid flags, I/O errors, etc), 2 to indicate a
    corrupt or invalid input file, 3 for an internal consistency error
    (eg, bug) which caused ocrad to panic.
*/

#include <cctype>
#include <climits>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <stdint.h>
#if defined(__MSVCRT__) || defined(__OS2__) || defined(_MSC_VER)
#include <fcntl.h>
#include <unistd.h>
#include <io.h>
#endif

#include "arg_parser.h"
#include "common.h"
#include "rational.h"
#include "rectangle.h"
#include "page_image.h"
#include "textpage.h"


namespace {

const char * const Program_name = "GNU Ocrad";
const char * const program_name = "ocrad";
const char * const program_year = "2013";
const char * invocation_name = 0;

struct Input_control
  {
  Transformation transformation;
  int scale;
  Rational threshold, ltwh[4];
  bool copy, cut, invert, layout;

  Input_control()
    : scale( 0 ), threshold( -1 ),
      copy( false ), cut( false ), invert( false ), layout( false ) {}

  bool parse_cut_rectangle( const char * const s );
  bool parse_threshold( const char * const s );
  };


void show_error( const char * const msg, const int errcode = 0,
                 const bool help = false )
  {
  if( verbosity >= 0 )
    {
    if( msg && msg[0] )
      {
      std::fprintf( stderr, "%s: %s", program_name, msg );
      if( errcode > 0 ) std::fprintf( stderr, ": %s", std::strerror( errcode ) );
      std::fprintf( stderr, "\n" );
      }
    if( help )
      std::fprintf( stderr, "Try '%s --help' for more information.\n",
                    invocation_name );
    }
  }


bool Input_control::parse_cut_rectangle( const char * const s )
  {
  int c = ltwh[0].parse( s );				// left
  if( c && s[c] == ',' && ltwh[0] >= -1 )
    {
    int i = c + 1;
    c = ltwh[1].parse( &s[i] );				// top
    if( c && s[i+c] == ',' && ltwh[1] >= -1 )
      {
      i += c + 1; c = ltwh[2].parse( &s[i] );		// width
      if( c && s[i+c] == ',' && ltwh[2] > 0 )
        {
        i += c + 1; c = ltwh[3].parse( &s[i] );		// height
        if( c && ltwh[3] > 0 ) { cut = true; return true; }
        }
      }
    }
  show_error( "invalid cut rectangle.", 0, true );
  return false;
  }


bool Input_control::parse_threshold( const char * const s )
  {
  Rational tmp;
  if( tmp.parse( s ) && tmp >= 0 && tmp <= 1 )
    { threshold = tmp; return true; }
  show_error( "threshold out of limits (0.0 - 1.0).", 0, true );
  return false;
  }


void show_help()
  {
  std::printf( "GNU Ocrad is an OCR (Optical Character Recognition) program based on a\n"
               "feature extraction method. It reads images in pbm (bitmap), pgm\n"
               "(greyscale) or ppm (color) formats and produces text in byte (8-bit) or\n"
               "UTF-8 formats. The pbm, pgm and ppm formats are collectively known as pnm.\n"
               "\nOcrad includes a layout analyser able to separate the columns or blocks\n"
               "of text normally found on printed pages.\n"
               "\nUsage: %s [options] [files]\n", invocation_name );
  std::printf( "\nOptions:\n"
               "  -h, --help               display this help and exit\n"
               "  -V, --version            output version information and exit\n"
               "  -a, --append             append text to output file\n"
               "  -c, --charset=<name>     try '--charset=help' for a list of names\n"
               "  -e, --filter=<name>      try '--filter=help' for a list of names\n"
               "  -f, --force              force overwrite of output file\n"
               "  -F, --format=<fmt>       output format (byte, utf8)\n"
               "  -i, --invert             invert image levels (white on black)\n"
               "  -l, --layout             perform layout analysis\n"
               "  -o, --output=<file>      place the output into <file>\n"
               "  -q, --quiet              suppress all messages\n"
               "  -s, --scale=[-]<n>       scale input image by [1/]<n>\n"
               "  -t, --transform=<name>   try '--transform=help' for a list of names\n"
               "  -T, --threshold=<n%%>     threshold for binarization (0-100%%)\n"
               "  -u, --cut=<l,t,w,h>      cut input image by given rectangle\n"
               "  -v, --verbose            be verbose\n"
               "  -x, --export=<file>      export results in ORF format to <file>\n" );
  if( verbosity > 0 )
    {
    std::printf( "  -1..6                    pnm output file type (debug)\n"
                 "  -C, --copy               'copy' input to output (debug)\n"
                 "  -D, --debug=<level>      (0-100) output intermediate data (debug)\n" );
    }
  std::printf( "If no files are specified, ocrad reads the image from standard input.\n"
               "If the -o option is not specified, ocrad sends text to standard output.\n"
               "\nExit status: 0 for a normal exit, 1 for environmental problems (file\n"
               "not found, invalid flags, I/O errors, etc), 2 to indicate a corrupt or\n"
               "invalid input file, 3 for an internal consistency error (eg, bug) which\n"
               "caused ocrad to panic.\n"
               "\nReport bugs to bug-ocrad@gnu.org\n"
               "Ocrad home page: http://www.gnu.org/software/ocrad/ocrad.html\n"
               "General help using GNU software: http://www.gnu.org/gethelp\n" );
  }


void show_version()
  {
  std::printf( "%s %s\n", Program_name, PROGVERSION );
  std::printf( "Copyright (C) %s Antonio Diaz Diaz.\n", program_year );
  std::printf( "License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>\n"
               "This is free software: you are free to change and redistribute it.\n"
               "There is NO WARRANTY, to the extent permitted by law.\n" );
  }


const char * my_basename( const char * filename )
  {
  const char * c = filename;
  while( *c ) { if( *c == '/' ) { filename = c + 1; } ++c; }
  return filename;
  }


int process_file( FILE * const infile, const char * const infile_name,
                  const Input_control & input_control,
                  const Control & control )
  {
  if( verbosity > 0 )
    std::fprintf( stderr, "processing file '%s'\n", infile_name );
  try
    {
    Page_image page_image( infile, input_control.invert );

    if( input_control.cut )
      {
      if( page_image.cut( input_control.ltwh ) )
        {
        if( verbosity > 0 )
          std::fprintf( stderr, "file cut to %dw x %dh\n",
                        page_image.width(), page_image.height() );
        }
      else
        {
        if( verbosity > 0 )
          std::fprintf( stderr, "file '%s' totally cut away\n", infile_name );
        return 1;
        }
      }

    page_image.transform( input_control.transformation );
    page_image.scale( input_control.scale );
    page_image.threshold( input_control.threshold );
    if( verbosity > 0 )
      {
      const Rational th( page_image.threshold(), page_image.maxval() );
      std::fprintf( stderr, "maxval = %d, threshold = %d (%s)\n",
                    page_image.maxval(), page_image.threshold(),
                    th.to_decimal( 1, -3 ).c_str() );
      }

    if( input_control.copy )
      {
      if( control.outfile ) page_image.save( control.outfile, control.filetype );
      return 0;
      }

    Textpage textpage( page_image, my_basename( infile_name ), control,
                       input_control.layout );
    if( control.debug_level == 0 )
      {
      if( control.outfile ) textpage.print( control );
      if( control.exportfile ) textpage.xprint( control );
      }
    }
  catch( Page_image::Error e ) { show_error( e.msg ); return 2; }
  if( verbosity > 0 ) std::fprintf( stderr, "\n" );
  return 0;
  }

} // end namespace


// 'infile' contains the scanned image (in pnm format) to be converted
// to text.
// 'outfile' is the destination for the text version of the scanned
// image. (or for a pnm file if debugging).
// 'exportfile' is the Ocr Results File.
//
int main( const int argc, const char * const argv[] )
  {
  Input_control input_control;
  Control control;
  const char * outfile_name = 0, * exportfile_name = 0;
  bool append = false, force = false;
  invocation_name = argv[0];

  const Arg_parser::Option options[] =
    {
    { '1', 0,           Arg_parser::no  },
    { '2', 0,           Arg_parser::no  },
    { '3', 0,           Arg_parser::no  },
    { '4', 0,           Arg_parser::no  },
    { '5', 0,           Arg_parser::no  },
    { '6', 0,           Arg_parser::no  },
    { 'a', "append",    Arg_parser::no  },
    { 'c', "charset",   Arg_parser::yes },
    { 'C', "copy",      Arg_parser::no  },
    { 'D', "debug",     Arg_parser::yes },
    { 'e', "filter",    Arg_parser::yes },
    { 'f', "force",     Arg_parser::no  },
    { 'F', "format",    Arg_parser::yes },
    { 'h', "help",      Arg_parser::no  },
    { 'i', "invert",    Arg_parser::no  },
    { 'l', "layout",    Arg_parser::no  },
    { 'o', "output",    Arg_parser::yes },
    { 'q', "quiet",     Arg_parser::no  },
    { 's', "scale",     Arg_parser::yes },
    { 't', "transform", Arg_parser::yes },
    { 'T', "threshold", Arg_parser::yes },
    { 'u', "cut",       Arg_parser::yes },
    { 'v', "verbose",   Arg_parser::no  },
    { 'V', "version",   Arg_parser::no  },
    { 'x', "export",    Arg_parser::yes },
    {  0 , 0,           Arg_parser::no  } };

  const Arg_parser parser( argc, argv, options );
  if( parser.error().size() )				// bad option
    { show_error( parser.error().c_str(), 0, true ); return 1; }

  int argind = 0;
  for( ; argind < parser.arguments(); ++argind )
    {
    const int code = parser.code( argind );
    if( !code ) break;					// no more options
    const char * const arg = parser.argument( argind ).c_str();
    switch( code )
      {
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6': control.filetype = code; break;
      case 'a': append = true; break;
      case 'c': if( !control.charset.enable( arg ) )
                  { control.charset.show_error( program_name, arg ); return 1; }
                break;
      case 'C': input_control.copy = true; break;
      case 'D': control.debug_level = std::strtol( arg, 0, 0 ); break;
      case 'e': if( !control.filter.set( arg ) )
                  { control.filter.show_error( program_name, arg ); return 1; }
                break;
      case 'f': force = true; break;
      case 'F': if( !control.set_format( arg ) )
                  { show_error( "bad output format.", 0, true ); return 1; }
                break;
      case 'h': show_help(); return 0;
      case 'i': input_control.invert = true; break;
      case 'l': input_control.layout = true; break;
      case 'o': outfile_name = arg; break;
      case 'q': verbosity = -1; break;
      case 's': input_control.scale = std::strtol( arg, 0, 0 ); break;
      case 't': if( !input_control.transformation.set( arg ) )
                  { input_control.transformation.show_error( program_name, arg );
                  return 1; }
                break;
      case 'T': if( !input_control.parse_threshold( arg ) ) return 1; break;
      case 'u': if( !input_control.parse_cut_rectangle( arg ) ) return 1; break;
      case 'v': if( verbosity < 4 ) ++verbosity; break;
      case 'V': show_version(); return 0;
      case 'x': exportfile_name = arg; break;
      default : Ocrad::internal_error( "uncaught option" );
      }
    } // end process options

#if defined(__MSVCRT__) || defined(__OS2__) || defined(_MSC_VER)
  setmode( STDIN_FILENO, O_BINARY );
  setmode( STDOUT_FILENO, O_BINARY );
#endif

  if( outfile_name && std::strcmp( outfile_name, "-" ) != 0 )
    {
    if( append ) control.outfile = std::fopen( outfile_name, "a" );
    else if( force ) control.outfile = std::fopen( outfile_name, "w" );
    else if( ( control.outfile = std::fopen( outfile_name, "wx" ) ) == 0 )
      {
      if( verbosity >= 0 )
        std::fprintf( stderr, "Output file %s already exists.\n", outfile_name );
      return 1;
      }
    if( !control.outfile )
      {
      if( verbosity >= 0 )
        std::fprintf( stderr, "Cannot open %s\n", outfile_name );
      return 1;
      }
    }

  if( exportfile_name && control.debug_level == 0 && !input_control.copy )
    {
    if( std::strcmp( exportfile_name, "-" ) == 0 )
      { control.exportfile = stdout; if( !outfile_name ) control.outfile = 0; }
    else
      {
      control.exportfile = std::fopen( exportfile_name, "w" );
      if( !control.exportfile )
        {
        if( verbosity >= 0 )
          std::fprintf( stderr, "Cannot open %s\n", exportfile_name );
        return 1;
        }
      }
    std::fprintf( control.exportfile,
                  "# Ocr Results File. Created by %s version %s\n",
                  Program_name, PROGVERSION );
    }

  // process any remaining command line arguments (input files)
  FILE * infile = (argind < parser.arguments()) ? 0 : stdin;
  const char *infile_name = "-";
  int retval = 0;
  while( true )
    {
    while( infile != stdin )
      {
      if( infile ) std::fclose( infile );
      if( argind >= parser.arguments() ) { infile = 0; break; }
      infile_name = parser.argument( argind++ ).c_str();
      if( std::strcmp( infile_name, "-" ) == 0 ) infile = stdin;
      else infile = std::fopen( infile_name, "rb" );
      if( infile ) break;
      if( verbosity >= 0 )
        std::fprintf( stderr, "Cannot open %s\n", infile_name );
      if( retval == 0 ) retval = 1;
      }
    if( !infile ) break;

    int tmp = process_file( infile, infile_name, input_control, control );
    if( infile == stdin )
      {
      if( tmp <= 1 )
        {
        int ch;
        do ch = std::fgetc( infile ); while( std::isspace( ch ) );
        std::ungetc( ch, infile );
        }
      if( tmp > 1 || std::feof( infile ) || std::ferror( infile ) ) infile = 0;
      }
    if( tmp > retval ) retval = tmp;
    if( control.outfile ) std::fflush( control.outfile );
    if( control.exportfile ) std::fflush( control.exportfile );
    }
  if( control.outfile ) std::fclose( control.outfile );
  if( control.exportfile ) std::fclose( control.exportfile );
  return retval;
  }
