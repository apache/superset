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

#include <algorithm>
#include <cstdio>
#include <string>
#include <vector>
#include <stdint.h>

#include "common.h"
#include "rectangle.h"
#include "segment.h"
#include "mask.h"
#include "track.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "page_image.h"
#include "textline.h"
#include "textblock.h"
#include "textpage.h"


namespace {

struct Zone
  {
  Mask mask;
  std::vector< Blob * > blobp_vector;
  Zone( const Rectangle & re ) : mask( re ) {}
  void join( Zone & z );
  };


void Zone::join( Zone & z )
  {
  mask.add_mask( z.mask );
  blobp_vector.insert( blobp_vector.end(),
                       z.blobp_vector.begin(), z.blobp_vector.end() );
  z.blobp_vector.clear();
  }


int blobs_in_page( const std::vector< Zone > & zone_vector )
  {
  int sum = 0;
  for( unsigned i = 0; i < zone_vector.size(); ++i )
    sum += zone_vector[i].blobp_vector.size();
  return sum;
  }


void bprint( const std::vector< Zone > & zone_vector, FILE * const outfile )
  {
//  std::fprintf( outfile, "page size %dw x %dh\n", width(), height() );
  std::fprintf( outfile, "total zones in page %d\n", (int)zone_vector.size() );
  std::fprintf( outfile, "total blobs in page %d\n\n", blobs_in_page( zone_vector ) );
  for( unsigned zindex = 0; zindex < zone_vector.size(); ++zindex )
    {
    const Rectangle & r = zone_vector[zindex].mask;
    const std::vector< Blob * > & blobp_vector = zone_vector[zindex].blobp_vector;

    std::fprintf( outfile, "zone %d of %d\n", zindex + 1, (int)zone_vector.size() );
    std::fprintf( outfile, "zone size %dw x %dh\n", r.width(), r.height() );
    std::fprintf( outfile, "total blobs in zone %u\n\n",
                  (unsigned)zone_vector[zindex].blobp_vector.size() );

    for( unsigned i = 0; i < blobp_vector.size(); ++i )
      blobp_vector[i]->print( outfile );
    }
  }


inline void join_blobs( std::vector< Blob * > & blobp_vector,
                         std::vector< Blob * > & v1,
                         std::vector< Blob * > & v2,
                         Blob * p1, Blob * p2, int i )
  {
  if( p1->top() > p2->top() )
    {
    Blob * const temp = p1; p1 = p2; p2 = temp;
    std::replace( v2.begin(), v2.begin() + ( i + 1 ), p2, p1 );
    }
  else std::replace( v1.begin() + i, v1.end(), p2, p1 );

  i = blobp_vector.size();
  while( --i >= 0 && blobp_vector[i] != p2 ) ;
  if( i < 0 ) Ocrad::internal_error( "join_blobs, lost blob" );
  blobp_vector.erase( blobp_vector.begin() + i );

  p1->add_bitmap( *p2 );
  delete p2;
  }


void ignore_abnormal_blobs( std::vector< Blob * > & blobp_vector )
  {
  for( int i = blobp_vector.size() - 1; i >= 0; --i )
    {
    Blob & b = *blobp_vector[i];
    if( b.height() > 35 * b.width() || b.width() > 25 * b.height() )
      {
      delete blobp_vector[i];
      blobp_vector.erase( blobp_vector.begin() + i );
      }
    }
  }


void ignore_small_blobs( std::vector< Blob * > & blobp_vector )
  {
  int to = 0, blobs = blobp_vector.size();
  for( int from = 0; from < blobs; ++from )
    {
    Blob * const p = blobp_vector[from];
    if( p->height() > 4 || p->width() > 4 ||
        ( ( p->height() > 2 || p->width() > 2 ) && p->area() > 5 ) )
      { blobp_vector[from] = blobp_vector[to]; blobp_vector[to] = p; ++to; }
    }
  if( to < blobs )
    {
    for( int i = to; i < blobs; ++i ) delete blobp_vector[i];
    blobp_vector.erase( blobp_vector.begin() + to, blobp_vector.end() );
    }
  }


void remove_top_bottom_noise( std::vector< Blob * > & blobp_vector )
  {
  int blobs = blobp_vector.size();
  for( int i = 0; i < blobs; ++i )
    {
    Blob & b = *blobp_vector[i];
    if( b.height() < 11 ) continue;

    int c = 0;
    for( int col = b.left(); col <= b.right(); ++col )
      if( b.get_bit( b.top(), col ) && ++c > 1 ) break;
    if( c <= 1 ) b.top( b.top() + 1 );

    c = 0;
    for( int col = b.left(); col <= b.right(); ++col )
      if( b.get_bit( b.bottom(), col ) && ++c > 1 ) break;
    if( c <= 1 ) b.bottom( b.bottom() - 1 );
    }
  }


void remove_left_right_noise( std::vector< Blob * > & blobp_vector )
  {
  int blobs = blobp_vector.size();
  for( int i = 0; i < blobs; ++i )
    {
    Blob & b = *blobp_vector[i];
    if( b.width() < 6 ) continue;

    int c = 0;
    for( int row = b.top(); row <= b.bottom(); ++row )
      if( b.get_bit( row, b.left() ) && ++c > 1 ) break;
    if( c <= 1 ) b.left( b.left() + 1 );

    c = 0;
    for( int row = b.top(); row <= b.bottom(); ++row )
      if( b.get_bit( row, b.right() ) && ++c > 1 ) break;
    if( c <= 1 ) b.right( b.right() - 1 );
    }
  }


void find_holes( std::vector< Zone > & zone_vector )
  {
  for( unsigned zi = 0; zi < zone_vector.size(); ++zi )
    {
    std::vector< Blob * > & blobp_vector = zone_vector[zi].blobp_vector;
    for( unsigned bvi = 0; bvi < blobp_vector.size(); ++bvi )
      blobp_vector[bvi]->find_holes();
    }
  }


void ignore_wide_blobs( const Rectangle & re,
                        std::vector< Blob * > & blobp_vector )
  {
  for( unsigned i = 0; i < blobp_vector.size(); )
    {
    Blob & b = *blobp_vector[i];
    if( 2 * b.width() < re.width() ) { ++i; continue; }
    blobp_vector.erase( blobp_vector.begin() + i );
    if( 4 * b.area() <= 3 * b.size() )
      {
      int blobs = 0;
      for( unsigned j = i; j < blobp_vector.size(); ++j )
        {
        if( blobp_vector[j]->top() > b.bottom() ) break;
        if( blobp_vector[j]->size() >= 16 ) ++blobs;
        }
      if( blobs <= b.size() / 400 )
        {
        if( 4 * b.area() <= b.size() )		// thin grid or frame
          { delete &b; continue; }
        b.find_holes();
        bool frame = false;
        if( b.holes() < std::min( b.height(), b.width() ) )
          for( int j = 0; j < b.holes(); ++j )
            {
            if( 4 * b.hole( j ).size() >= b.size() &&
                4 * b.hole( j ).area() >= b.size() )
              { frame = true; break; }
            }
        if( frame ) { delete &b; continue; }
        }
      }
    // picture, not frame
    if( 5 * b.width() > 4 * re.width() && 5 * b.height() > 4 * re.height() )
      {
      for( unsigned j = 0; j < blobp_vector.size(); ++j )
        delete blobp_vector[j];
      blobp_vector.clear(); delete &b; break;
      }
    for( unsigned j = blobp_vector.size(); j > i; )
      {
      const Blob & b2 = *blobp_vector[--j];
      if( b.includes( b2 ) )
        { delete &b2; blobp_vector.erase( blobp_vector.begin() + j ); }
      }
    delete &b;
    }
  }


int mean_blob_height( const std::vector< Blob * > & blobp_vector )
  {
  int mean_height = 0;
  unsigned samples = 0;
  std::vector< int > height_distrib;

  for( unsigned i = 0; i < blobp_vector.size(); ++i )
    {
    const unsigned h = blobp_vector[i]->height();
    const unsigned w = blobp_vector[i]->width();
    if( h < 10 || w >= 3 * h ) continue;
    if( h >= height_distrib.size() ) height_distrib.resize( h + 1 );
    ++height_distrib[h]; ++samples;
    }
  if( !height_distrib.size() )
    for( unsigned i = 0; i < blobp_vector.size(); ++i )
      {
      const unsigned h = blobp_vector[i]->height();
      if( h >= height_distrib.size() ) height_distrib.resize( h + 1 );
      ++height_distrib[h]; ++samples;
      }

  int valid_samples = 0;
  for( unsigned i = 0, count = 0; i < height_distrib.size(); ++i )
    {
    const int a = height_distrib[i];
    if( 10 * ( count + a ) >= samples && 10 * count < 9 * samples )
      { mean_height += a * i; valid_samples += a; }
    count += a;
    }
  if( valid_samples ) mean_height /= valid_samples;
  return mean_height;
  }


int analyse_layout( std::vector< Blob * > & blobp_vector,
                    std::vector< Zone > & zone_vector )
  {
  if( !blobp_vector.size() ) return 0;
  const int mean_height = mean_blob_height( blobp_vector );
  zone_vector.push_back( Zone( *blobp_vector[0] ) );
  zone_vector.back().blobp_vector.push_back( blobp_vector[0] );
  for( unsigned i = 1; i < blobp_vector.size(); ++i )
    {
    Blob & b = *blobp_vector[i];
    if( b.height() > 10 * mean_height ) { delete &b; continue; }
    int first = -1;
    for( unsigned j = 0; j < zone_vector.size(); ++j )
      {
      if( zone_vector[j].mask.distance( b ) < 2 * mean_height )
        {
        if( first < 0 ) first = j;
        else
          {
          zone_vector[first].join( zone_vector[j] );
          zone_vector.erase( zone_vector.begin() + j ); --j;
          }
        }
      }
    if( first >= 0 )
      {
      zone_vector[first].mask.add_rectangle( b );
      zone_vector[first].blobp_vector.push_back( &b );
      }
    else
      {
      zone_vector.push_back( Zone( b ) );
      zone_vector.back().blobp_vector.push_back( &b );
      }
    }
  blobp_vector.clear();

  // sort zone_vector
  int botmax = ( zone_vector.size() ? zone_vector[0].mask.bottom() : 0 );
  std::vector< int > cut_index_vector;
  for( unsigned i = 1; i < zone_vector.size(); ++i )
    {
    if( zone_vector[i].mask.top() > botmax ) cut_index_vector.push_back( i );
    botmax = std::max( botmax, zone_vector[i].mask.bottom() );
    }
  cut_index_vector.push_back( zone_vector.size() );
  for( unsigned begin = 0, cut = 0; cut < cut_index_vector.size(); ++cut )
    {
    const unsigned end = cut_index_vector[cut];
    for( unsigned i = begin; i + 1 < end; ++i )
      {
      unsigned first = i;
      for( unsigned j = i + 1; j < end; ++j )
        if( zone_vector[j].mask.precedes( zone_vector[first].mask ) )
          first = j;
      if( first != i ) std::swap( zone_vector[i], zone_vector[first] );
      }
    bool join = ( end - begin > 1 );
    for( unsigned i = begin; join && i < end; ++i )
      if( zone_vector[i].blobp_vector.size() > 80 ||
          zone_vector[i].mask.v_distance( zone_vector[begin].mask ) >
          zone_vector[i].mask.height() + zone_vector[begin].mask.height() )
        join = false;
    for( unsigned i = begin; join && i < end; ++i )
      if( zone_vector[i].mask.height() > 4 * mean_blob_height( zone_vector[i].blobp_vector ) )
        join = false;
    if( join )
      {
      for( unsigned i = begin + 1; i < end; ++i )
        zone_vector[begin].join( zone_vector[i] );
      zone_vector.erase( zone_vector.begin() + ( begin + 1 ),
                         zone_vector.begin() + end );
      for( unsigned i = cut; i < cut_index_vector.size(); ++i )
        cut_index_vector[i] -= ( end - begin - 1 );
      ++begin;
      }
    else begin = end;
    }
  return zone_vector.size();
  }


void scan_page( const Page_image & page_image, std::vector< Zone > & zone_vector,
                const int debug_level, const bool layout )
  {
  const Rectangle & re = page_image;
  const int zthreshold = page_image.threshold();
  std::vector< Blob * > blobp_vector;
  std::vector< Blob * > old_data( re.width(), (Blob *) 0 );
  std::vector< Blob * > new_data( re.width(), (Blob *) 0 );

  for( int row = re.top(); row <= re.bottom(); ++row )
    {
    old_data.swap( new_data );
    for( int col = re.left(); col <= re.right(); ++col )
      {
      const int dcol = col - re.left();
      if( !page_image.get_bit( row, col, zthreshold ) )
        new_data[dcol] = 0;			// white pixel
      else					// black pixel
        {
        Blob *p;
        Blob *lp  = ( (dcol > 0) ? new_data[dcol-1] : 0 );
        Blob *ltp = ( (dcol > 0) ? old_data[dcol-1] : 0 );
        Blob *tp  = old_data[dcol];
        Blob *rtp = ( (col < re.right()) ? old_data[dcol+1] : 0 );
        if( lp )       { p = lp;  p->add_point( row, col ); }
        else if( ltp ) { p = ltp; p->add_point( row, col ); }
        else if( tp )  { p = tp;  p->add_point( row, col ); }
        else if( rtp ) { p = rtp; p->add_point( row, col ); }
        else
          {
          p = new Blob( col, row, col, row );
          p->set_bit( row, col, true );
          blobp_vector.push_back( p );
          }
        new_data[dcol] = p;
        if( rtp && p != rtp )
          join_blobs( blobp_vector, old_data, new_data, p, rtp, dcol );
        }
      }
    }

  if( debug_level <= 99 && blobp_vector.size() > 3 )
    {
    ignore_wide_blobs( re, blobp_vector );
    ignore_small_blobs( blobp_vector );
    ignore_abnormal_blobs( blobp_vector );
    remove_top_bottom_noise( blobp_vector );
    remove_left_right_noise( blobp_vector );
    }

  if( layout && re.width() > 200 && re.height() > 200 &&
      blobp_vector.size() > 3 )
    {
    analyse_layout( blobp_vector, zone_vector );
    if( debug_level <= 99 && zone_vector.size() > 1 )
      for( unsigned i = 0; i < zone_vector.size(); ++i )
        ignore_wide_blobs( zone_vector[i].mask, zone_vector[i].blobp_vector );
    }
  else
    {
    zone_vector.push_back( Zone( re ) );
    zone_vector.back().blobp_vector.swap( blobp_vector );
    }
  find_holes( zone_vector );
  }

} // end namespace


Textpage::Textpage( const Page_image & page_image, const char * const filename,
                    const Control & control, const bool layout )
  : Rectangle( page_image ), name( filename )
  {
  const int debug_level = control.debug_level;
  if( debug_level < 0 || debug_level > 100 ) return;

  std::vector< Zone > zone_vector;			// layout zones
  scan_page( page_image, zone_vector, debug_level, layout );
  if( verbosity > 0 )
    std::fprintf( stderr, "number of text blocks = %d\n", (int)zone_vector.size() );

  if( debug_level >= 98 )
    {
    if( control.outfile ) bprint( zone_vector, control.outfile );
    return;
    }
  if( debug_level > 95 || ( debug_level > 89 && debug_level < 94 ) ) return;

  // build a Textblock for every zone with text
  for( unsigned i = 0; i < zone_vector.size(); ++i )
    {
    Textblock * const tbp = new Textblock( page_image, zone_vector[i].mask,
                                           zone_vector[i].blobp_vector );
    if( tbp->textlines() && debug_level < 90 )
      tbp->recognize( control.charset, control.filter );
    if( tbp->textlines() ) tbpv.push_back( tbp );
    else delete tbp;
    }
  if( debug_level == 0 ) return;
  if( !control.outfile ) return;
  if( debug_level >= 86 )
    {
    bool graph = ( debug_level >= 88 );
    bool recursive = ( debug_level & 1 );
    for( int i = 0; i < textblocks(); ++i )
      tbpv[i]->dprint( control, graph, recursive );
    return;
    }
  if( debug_level > 77 ) return;
  if( debug_level >= 70 )
    {
    Page_image tmp( page_image );
    if( ( debug_level - 70 ) & 1 )	// mark zones
      for( unsigned i = 0; i < zone_vector.size(); ++i )
        {
        if( debug_level == 71 ) tmp.draw_mask( zone_vector[i].mask );
        else tmp.draw_rectangle( zone_vector[i].mask );
        }
    if( ( debug_level - 70 ) & 2 )	// mark lines
      {
      for( int i = 0; i < textblocks(); ++i ) tbpv[i]->lmark( tmp );
      }
    if( ( debug_level - 70 ) & 4 )	// mark characters
      {
      for( int i = 0; i < textblocks(); ++i ) tbpv[i]->cmark( tmp );
      }
    tmp.save( control.outfile, control.filetype );
    return;
    }
  }


Textpage::~Textpage()
  {
  for( int i = textblocks() - 1; i >= 0; --i ) delete tbpv[i];
  }


const Textblock & Textpage::textblock( const int i ) const
  {
  if( i < 0 || i >= textblocks() )
    Ocrad::internal_error( "Textpage::textblock, index out of bounds" );
  return *(tbpv[i]);
  }


int Textpage::textlines() const
  {
  int total = 0;
  for( int i = 0; i < textblocks(); ++i )
    total += tbpv[i]->textlines();
  return total;
  }


int Textpage::characters() const
  {
  int total = 0;
  for( int i = 0; i < textblocks(); ++i )
    total += tbpv[i]->characters();
  return total;
  }


void Textpage::print( const Control & control ) const
  {
  if( control.outfile )
    for( int i = 0; i < textblocks(); ++i )
      tbpv[i]->print( control );
  }


void Textpage::xprint( const Control & control ) const
  {
  if( !control.exportfile ) return;

  std::fprintf( control.exportfile, "source file %s\n", name.c_str() );
  std::fprintf( control.exportfile, "total text blocks %d\n", textblocks() );

  for( int i = 0; i < textblocks(); ++i )
    {
    const Textblock & tb = *(tbpv[i]);
    std::fprintf( control.exportfile, "text block %d %d %d %d %d\n", i + 1,
                  tb.left(), tb.top(), tb.width(), tb.height() );
    tb.xprint( control );
    }
  }
