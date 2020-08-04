/*  Ocradlib - Optical Character Recognition library
    Copyright (C) 2009, 2010, 2011, 2012, 2013 Antonio Diaz Diaz.

    This library is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    As a special exception, you may use this file as part of a free
    software library without restriction.  Specifically, if other files
    instantiate templates or use macros or inline functions from this
    file, or you compile this file and link it with other files to
    produce an executable, this file does not by itself cause the
    resulting executable to be covered by the GNU General Public
    License.  This exception does not however invalidate any other
    reasons why the executable file might be covered by the GNU General
    Public License.
*/

#include <climits>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <stdint.h>

#include "ocradlib.h"
#include "common.h"
#include "rectangle.h"
#include "ucs.h"
#include "track.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "page_image.h"
#include "textline.h"
#include "textblock.h"
#include "textpage.h"


struct OCRAD_Descriptor
  {
  Page_image * page_image;
  Textpage * textpage;
  OCRAD_Errno ocr_errno;
  Control control;
  std::string text;

  OCRAD_Descriptor()
    :
    page_image( 0 ),
    textpage( 0 ),
    ocr_errno( OCRAD_ok )
    { control.outfile = 0; }
  };


bool verify_descriptor( OCRAD_Descriptor * const ocrdes,
                        const bool result = false )
  {
  if( !ocrdes ) return false;
  if( !ocrdes->page_image || ( result && !ocrdes->textpage ) )
    { ocrdes->ocr_errno = OCRAD_sequence_error; return false; }
  return true;
  }


const char * OCRAD_version() { return OCRAD_version_string; }


OCRAD_Descriptor * OCRAD_open()
  {
  verbosity = -1;			// keep library silent
  OCRAD_Descriptor * const ocrdes = new( std::nothrow ) OCRAD_Descriptor;
  if( !ocrdes ) return 0;
  return ocrdes;
  }


int OCRAD_close( OCRAD_Descriptor * const ocrdes )
  {
  if( !ocrdes ) return -1;
  if( ocrdes->textpage ) delete ocrdes->textpage;
  if( ocrdes->page_image ) delete ocrdes->page_image;
  delete ocrdes;
  return 0;
  }


OCRAD_Errno OCRAD_get_errno( OCRAD_Descriptor * const ocrdes )
  {
  if( !ocrdes ) return OCRAD_bad_argument;
  return ocrdes->ocr_errno;
  }


int OCRAD_set_image( OCRAD_Descriptor * const ocrdes,
                     const OCRAD_Pixmap * const image, const bool invert )
  {
  if( !ocrdes ) return -1;
  if( !image || image->height < 3 || image->width < 3 ||
      INT_MAX / image->width < image->height ||
      ( image->mode != OCRAD_bitmap && image->mode != OCRAD_greymap &&
        image->mode != OCRAD_colormap ) )
    { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }

  try
    {
    Page_image * const page_image = new Page_image( *image, invert );
    if( ocrdes->textpage )
      { delete ocrdes->textpage; ocrdes->textpage = 0; }
    if( ocrdes->page_image ) delete ocrdes->page_image;
    ocrdes->page_image = page_image;
    }
  catch( std::bad_alloc )
    { ocrdes->ocr_errno = OCRAD_mem_error; return -1; }
  return 0;
  }


int OCRAD_set_image_from_file( OCRAD_Descriptor * const ocrdes,
                               const char * const filename, const bool invert )
  {
  if( !ocrdes ) return -1;
  FILE * infile = 0;
  if( filename && filename[0] )
    {
    if( std::strcmp( filename, "-" ) == 0 ) infile = stdin;
    else infile = std::fopen( filename, "rb" );
    }
  if( !infile ) { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }
  int retval = 0;
  try
    {
    Page_image * const page_image = new Page_image( infile, invert );
    if( ocrdes->textpage )
      { delete ocrdes->textpage; ocrdes->textpage = 0; }
    if( ocrdes->page_image ) delete ocrdes->page_image;
    ocrdes->page_image = page_image;
    }
  catch( std::bad_alloc )
    { ocrdes->ocr_errno = OCRAD_mem_error; retval = -1; }
  catch( ... )
    { ocrdes->ocr_errno = OCRAD_bad_argument; retval = -1; }
  std::fclose( infile );
  return retval;
  }


int OCRAD_set_utf8_format( OCRAD_Descriptor * const ocrdes, const bool utf8 )
  {
  if( !verify_descriptor( ocrdes ) ) return -1;
  ocrdes->control.utf8 = utf8;
  return 0;
  }


int OCRAD_set_threshold( OCRAD_Descriptor * const ocrdes, const int threshold )
  {
  if( !verify_descriptor( ocrdes ) ) return -1;
  if( threshold < -1 || threshold > 255 )
    { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }
  ocrdes->page_image->threshold( threshold );
  return 0;
  }


int OCRAD_scale( OCRAD_Descriptor * const ocrdes, const int value )
  {
  if( !verify_descriptor( ocrdes ) ) return -1;
  int retval = 0;
  try { if( !ocrdes->page_image->scale( value ) ) retval = -1; }
  catch( ... ) { retval = -1; }
  if( retval < 0 ) ocrdes->ocr_errno = OCRAD_bad_argument;
  return retval;
  }

int OCRAD_set_exportfile( OCRAD_Descriptor * const ocrdes, const char * const filename)
  {
  if( !verify_descriptor( ocrdes ) ) return -1;
  
  FILE * exportfile = 0;
  if( filename && filename[0] )
    {
    if( std::strcmp( filename, "-" ) == 0 ) exportfile = stdout;
    else exportfile = std::fopen( filename, "w" );
    }
  if( !exportfile ) { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }

  ocrdes->control.exportfile = exportfile;
  return 0;
  }


int OCRAD_recognize( OCRAD_Descriptor * const ocrdes, const bool layout )
  {
  if( !verify_descriptor( ocrdes ) ) return -1;
  Textpage * const textpage =
    new( std::nothrow ) Textpage( *ocrdes->page_image, "",
                                  ocrdes->control, layout );
  if( !textpage )
    { ocrdes->ocr_errno = OCRAD_mem_error; return -1; }
  if( ocrdes->textpage ) delete ocrdes->textpage;
  ocrdes->textpage = textpage;

  if( ocrdes->control.exportfile ) textpage->xprint( ocrdes->control );

  return 0;
  }


int OCRAD_result_blocks( OCRAD_Descriptor * const ocrdes )
  {
  if( !verify_descriptor( ocrdes, true ) ) return -1;
  return ocrdes->textpage->textblocks();
  }


int OCRAD_result_lines( OCRAD_Descriptor * const ocrdes, const int blocknum )
  {
  if( !verify_descriptor( ocrdes, true ) ) return -1;
  if( blocknum < 0 || blocknum >= ocrdes->textpage->textblocks() )
    { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }
  return ocrdes->textpage->textblock( blocknum ).textlines();
  }


int OCRAD_result_chars_total( OCRAD_Descriptor * const ocrdes )
  {
  if( !verify_descriptor( ocrdes, true ) ) return -1;
  int c = 0;
  for( int b = 0; b < ocrdes->textpage->textblocks(); ++b )
    for( int i = 0; i < ocrdes->textpage->textblock( b ).textlines(); ++i )
      c += ocrdes->textpage->textblock( b ).textline( i ).characters();
  return c;
  }


int OCRAD_result_chars_block( OCRAD_Descriptor * const ocrdes,
                              const int blocknum )
  {
  if( !verify_descriptor( ocrdes, true ) ) return -1;
  if( blocknum < 0 || blocknum >= ocrdes->textpage->textblocks() )
    { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }
  int c = 0;
  for( int i = 0; i < ocrdes->textpage->textblock( blocknum ).textlines(); ++i )
    c += ocrdes->textpage->textblock( blocknum ).textline( i ).characters();
  return c;
  }


int OCRAD_result_chars_line( OCRAD_Descriptor * const ocrdes,
                             const int blocknum, const int linenum )
  {
  if( !verify_descriptor( ocrdes, true ) ) return -1;
  if( blocknum < 0 || blocknum >= ocrdes->textpage->textblocks() ||
      linenum < 0 ||
      linenum >= ocrdes->textpage->textblock( blocknum ).textlines() )
    { ocrdes->ocr_errno = OCRAD_bad_argument; return -1; }
  return
    ocrdes->textpage->textblock( blocknum ).textline( linenum ).characters();
  }


const char * OCRAD_result_line( OCRAD_Descriptor * const ocrdes,
                                const int blocknum, const int linenum )
  {
  if( !verify_descriptor( ocrdes, true ) ) return 0;
  if( blocknum < 0 || blocknum >= ocrdes->textpage->textblocks() ||
      linenum < 0 ||
      linenum >= ocrdes->textpage->textblock( blocknum ).textlines() )
    { ocrdes->ocr_errno = OCRAD_bad_argument; return 0; }
  const Textline & textline =
    ocrdes->textpage->textblock( blocknum ).textline( linenum );
  ocrdes->text.clear();
  if( !ocrdes->control.utf8 )
    for( int i = 0; i < textline.characters(); ++i )
      ocrdes->text += textline.character( i ).byte_result();
  else
    for( int i = 0; i < textline.characters(); ++i )
      ocrdes->text += textline.character( i ).utf8_result();
  ocrdes->text += '\n';
  return ocrdes->text.c_str();
  }


int OCRAD_result_first_character( OCRAD_Descriptor * const ocrdes )
  {
  if( !verify_descriptor( ocrdes, true ) ) return -1;
  int ch = 0;
  if( ocrdes->textpage->textblocks() > 0 &&
      ocrdes->textpage->textblock( 0 ).textlines() > 0 )
    {
    const Character & character =
      ocrdes->textpage->textblock( 0 ).textline( 0 ).character( 0 );
    if( character.guesses() )
      {
      if( !ocrdes->control.utf8 )
        ch = UCS::map_to_byte( character.guess( 0 ).code );
      else
        ch = character.guess( 0 ).code;
      }
    }
  return ch;
  }
