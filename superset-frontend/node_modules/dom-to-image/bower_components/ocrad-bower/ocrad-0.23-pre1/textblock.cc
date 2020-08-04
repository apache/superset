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
#include <climits>
#include <cstdio>
#include <string>
#include <vector>
#include <stdint.h>

#include "common.h"
#include "rational.h"
#include "rectangle.h"
#include "track.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "page_image.h"
#include "textline.h"
#include "textblock.h"


namespace {

void insert_line( std::vector< Textline * > & textlinep_vector, int i )
  { textlinep_vector.insert( textlinep_vector.begin() + i, new Textline ); }


void delete_line( std::vector< Textline * > & textlinep_vector, int i )
  {
  delete textlinep_vector[i];
  textlinep_vector.erase( textlinep_vector.begin() + i );
  }


// Build the vertical composite characters.
//
void join_characters( std::vector< Textline * > & tlpv )
  {
  for( unsigned current_line = 0; current_line < tlpv.size(); ++current_line )
    {
    Textline & line = *tlpv[current_line];
    for( int i = 0 ; i < line.characters() - 1; )
      {
      Character & c1 = line.character( i );
      bool joined = false;
      for( int j = i + 1 ; j < line.characters(); ++j )
        {
        Character & c2 = line.character( j );
        if( !c1.h_overlaps( c2 ) ) continue;
        Character *cup, *cdn;
        if( c1.vcenter() < c2.vcenter() ) cup = &c1, cdn = &c2;
        else cup = &c2, cdn = &c1;
        if( cdn->includes_hcenter( *cup ) || cup->includes_hcenter( *cdn ) ||
            ( cdn->top() > cup->bottom() && cdn->hcenter() < cup->hcenter() ) ||
            ( cdn->blobs() == 2 &&
              2 * cdn->blob( 0 ).size() < cdn->blob( 1 ).size() &&
              cdn->blob( 0 ).includes_vcenter( *cup ) ) )
          {
          int k;
          if( 64 * c1.size() < c2.main_blob().size() ) k = i;
          else if( 64 * c2.size() < c1.main_blob().size() ) k = j;
          else if( cdn == &c2 ) { c2.join( c1 ); k = i; }
          else { c1.join( c2 ); k = j; }
          line.delete_character( k );
          joined = true; break;
          }
        }
      if( !joined ) ++i;
      }
    }
  }

} // end namespace


Textblock::Textblock( const Rectangle & page, const Rectangle & block,
                      std::vector< Blob * > & blobp_vector )
  : Rectangle( block )
  {
  std::vector< Blob * > pending;
  std::vector< Blob * > pending_tall;
  std::vector< Blob * > pending_short;

  for( unsigned begin = 0, end = 0; end < blobp_vector.size(); begin = end )
    {
    int botmax = blobp_vector[begin]->bottom();		// make cuts
    while( ++end < blobp_vector.size() )
      {
      if( blobp_vector[end]->top() > botmax ) break;
      botmax = std::max( botmax, blobp_vector[end]->bottom() );
      }

    // Classify blobs by height.
    unsigned samples = 0;
    std::vector< int > height_distrib;
    for( unsigned i = begin; i < end; ++i )
      {
      if( blobp_vector[i]->is_abnormal() ) continue;
      unsigned h = blobp_vector[i]->height();
      if( h >= height_distrib.size() ) height_distrib.resize( h + 1 );
      ++height_distrib[h]; ++samples;
      }
    if( !height_distrib.size() )		// all blobs are abnormal
      for( unsigned i = begin; i < end; ++i )
        {
        unsigned h = blobp_vector[i]->height();
        if( h >= height_distrib.size() ) height_distrib.resize( h + 1 );
        ++height_distrib[h]; ++samples;
        }

    int mean_height = 0;
    int valid_samples = 0;
    for( unsigned i = 0, count = 0; i < height_distrib.size(); ++i )
      {
      int a = height_distrib[i];
      if( 10 * ( count + a ) >= samples && 10 * count < 9 * samples )
        { mean_height += a * i; valid_samples += a; }
      count += a;
      }
    if( valid_samples ) mean_height /= valid_samples;

    for( unsigned i = begin; i < end; ++i )
      {
      Blob * const p = blobp_vector[i];
      const bool a = p->is_abnormal();
      if( p->height() >= 2 * mean_height ||
          ( a && p->height() > mean_height ) ) pending_tall.push_back( p );
      else if( 2 * p->height() <= mean_height || p->height() <= 5 ||
               ( a && p->height() < mean_height ) )
        pending_short.push_back( p );
      else pending.push_back( p );
      }
    }

  if( !pending.size() )
    {
    for( unsigned i = 0; i < blobp_vector.size(); ++i )
      delete blobp_vector[i];
    blobp_vector.clear();
    return;
    }
  blobp_vector.clear();

  // Assign normal blobs to characters and create lines.
  int min_line = 0;			// first line of current cut
  tlpv.push_back( new Textline );
  int current_line = min_line = textlines() - 1;
  tlpv[current_line]->shift_characterp( new Character( pending[0] ) );
  for( unsigned i = 1; i < pending.size(); ++i )
    {
    Blob & b = *pending[i];
    current_line = std::max( min_line, current_line - 2 );
    while( true )
      {
      const Character *cl = 0, *cr = 0;
      for( int j = tlpv[current_line]->characters() - 1; j >= 0; --j )
        {
        const Character & cj = tlpv[current_line]->character( j );
        if( !b.includes_hcenter( cj ) && !cj.includes_hcenter( b ) )
          { if( b.h_precedes( cj ) ) cr = &cj; else { cl = &cj; break; } }
        }
      if( ( cl && ( cl->includes_vcenter( b ) || b.includes_vcenter( *cl ) ) ) ||
          ( cr && ( cr->includes_vcenter( b ) || b.includes_vcenter( *cr ) ) ) )
        { tlpv[current_line]->shift_characterp( new Character( &b ) ); break; }
      else if( ( cl && cl->top() > b.bottom() ) || ( cr && cr->top() > b.bottom() ) )
        {
        insert_line( tlpv, current_line );
        tlpv[current_line]->shift_characterp( new Character( &b ) ); break;
        }
      else if( ( cl && cl->v_overlap_percent( b ) > 5 ) ||
               ( cr && cr->v_overlap_percent( b ) > 5 ) )
        { tlpv[current_line]->shift_characterp( new Character( &b ) ); break; }
      else if( ++current_line >= textlines() )
        {
        tlpv.push_back( new Textline ); current_line = textlines() - 1;
        tlpv[current_line]->shift_characterp( new Character( &b ) ); break;
        }
      }
    }

  for( int i = textlines() - 1; i >= 0; --i )
    if( !tlpv[i]->characters() ) delete_line( tlpv, i );

  join_characters( tlpv );

  // Create tracks of lines.
  for( int i = 0; i < textlines(); ++i ) tlpv[i]->set_track();

  // Insert tall blobs.
  // Seek up, then seek down, needed for slanted or curved lines.
  current_line = 0;
  for( unsigned i = 0; i < pending_tall.size(); ++i )
    {
    Blob & b = *pending_tall[i];
    while( current_line > 0 &&
           b.bottom() < tlpv[current_line]->vcenter( b.hcenter() ) )
      --current_line;
    while( current_line < textlines() &&
           b.top() > tlpv[current_line]->vcenter( b.hcenter() ) )
      ++current_line;
    if( current_line >= textlines() )
      { --current_line; delete &b; continue; }
    Textline & l = *tlpv[current_line];
    const int bi = l.big_initials();
    const int mh = l.mean_height();
    if( b.height() <= 3 * mh &&
        ( b.height() <= 2 * mh || l.character( bi ).left() < b.left() ) )
      l.shift_characterp( new Character( &b ) );
    else if( !l.characters() ||
             l.character( std::min( bi+1, l.characters() - 1 ) ).left() > b.hcenter() )
      l.shift_characterp( new Character( &b ), true );	// big initial
    else delete &b;
    }

//  for( int i = 0; i < textlines(); ++i ) tlpv[i]->verify_big_initials();

  // Insert short blobs.
  // Seek up, then seek down, needed for slanted or curved lines.
  current_line = 0;
  for( unsigned i = 0; i < pending_short.size(); ++i )
    {
    Blob & b = *pending_short[i];
    while( current_line > 0 &&
           b.bottom() < tlpv[current_line]->top( b.hcenter() ) )
      --current_line;
    int temp = std::max( 0, current_line - 1 );
    while( current_line < textlines() &&
           b.top() > tlpv[current_line]->bottom( b.hcenter() ) )
      ++current_line;
    if( current_line >= textlines() )
      {
      const Textline & l = *tlpv[--current_line];
      const Character *p = l.character_at( b.hcenter() );
      if( b.top() > l.bottom( b.hcenter() ) + l.height() / 2 &&
          ( !p || b.top() > p->bottom() + l.height() / 2 ) )
        { delete &b; continue; }
      else temp = current_line;
      }
    if( current_line - temp > 1 ) temp = current_line - 1;
    if( current_line != temp &&
        2 * ( b.top() - tlpv[temp]->bottom( b.hcenter() ) ) <
        tlpv[current_line]->top( b.hcenter() ) - b.bottom() )
      current_line = temp;
    tlpv[current_line]->shift_characterp( new Character( &b ) );
    }

  // remove clipped lines at top or bottom of page
  if( textlines() > 2 )
    {
    const Textline * lp = tlpv[textlines()-1];
    for( int i = 0, c = 0; i < lp->characters(); ++i )
      if( lp->character( i ).bottom() >= page.bottom() &&
          2 * ++c >= lp->characters() )
        { delete_line( tlpv, textlines() - 1 ); break; }

    lp = tlpv[0];
    const int t = std::max( page.top(), 1 );
    for( int i = 0, c = 0; i < lp->characters(); ++i )
      if( lp->character( i ).top() <= t && 2 * ++c >= lp->characters() )
        { delete_line( tlpv, 0 ); break; }
    }

  // Second pass. Join lines of i-dots and tildes.
  for( int current_line = 0; current_line < textlines() - 1; )
    {
    bool joined = false;
    Textline & line1 = *tlpv[current_line];
    Textline & line2 = *tlpv[current_line+1];
    if( line1.characters() <= 2 * line2.characters() &&
        2 * line1.mean_height() < line2.mean_height() )
      for( int i1 = 0; !joined && i1 < line1.characters(); ++i1 )
        {
        Character & c1 = line1.character( i1 );
        if( 2 * c1.height() >= line2.mean_height() ) continue;
        for( int i2 = 0; !joined && i2 < line2.characters(); ++i2 )
          {
          Character & c2 = line2.character( i2 );
          if( c2.right() < c1.left() ) continue;
          if( c2.left() > c1.right() ) break;
          if( ( c2.includes_hcenter( c1 ) || c1.includes_hcenter( c2 ) )
              && c2.top() - c1.bottom() < line2.mean_height() )
            {
            joined = true; line2.join( line1 );
            delete_line( tlpv, current_line );
            }
          }
        }
    if( !joined ) ++current_line;
    }

  join_characters( tlpv );

  for( int i = 0; i < textlines(); ++i ) tlpv[i]->verify_big_initials();

  // Fourth pass. Remove noise lines.
  if( textlines() >= 3 )
    {
    for( int i = 0; i + 2 < textlines(); ++i )
      {
      Textline & line1 = *tlpv[i];
      Textline & line2 = *tlpv[i+1];
      Textline & line3 = *tlpv[i+2];
      if( line2.characters() > 2 || line1.characters() < 4 ||
          line3.characters() < 4 ) continue;
      if( !Ocrad::similar( line1.height(), line3.height(), 10 ) ) continue;
      if( 8 * line2.height() > line1.height() + line3.height() ) continue;
      delete_line( tlpv, i + 1 );
      }
    }

  // Remove leading and trailing noise characters.
  for( int i = 0; i < textlines(); ++i )
    {
    Textline & l = *tlpv[i];
    if( !l.big_initials() && l.characters() > 2 )
      {
      const Character & c0 = l.character( 0 );
      const Character & c1 = l.character( 1 );
      const Character & c2 = l.character( 2 );
      if( c0.blobs() == 1 &&
          4 * c0.size() < c1.size() && c1.left() - c0.right() > 2 * l.height() &&
          4 * c0.size() < c2.size() && c2.left() - c1.right() < l.height() )
        l.delete_character( 0 );
      }
    if( l.characters() > 2 )
      {
      const Character & c0 = l.character( l.characters() - 1 );
      const Character & c1 = l.character( l.characters() - 2 );
      const Character & c2 = l.character( l.characters() - 3 );
      if( c0.blobs() == 1 &&
          4 * c0.size() < c1.size() && c0.left() - c1.right() > 2 * l.height() &&
          4 * c0.size() < c2.size() && c1.left() - c2.right() < l.height() )
        l.delete_character( l.characters() - 1 );
      }
    }
  for( int i = 0; i < textlines(); ++i ) tlpv[i]->insert_spaces();
  }


Textblock::~Textblock()
  {
  for( int i = textlines() - 1; i >= 0; --i ) delete tlpv[i];
  }


void Textblock::recognize( const Charset & charset, const Filter & filter )
  {
  // Recognize characters.
  for( int i = 0; i < textlines(); ++i )
    {
    // First pass. Recognize the easy characters.
    tlpv[i]->recognize1( charset );
    // Second pass. Use context to clear up ambiguities.
    tlpv[i]->recognize2( charset );
    }

  if( filter.type() != Filter::none )
    for( int i = 0; i < textlines(); ++i )
      tlpv[i]->apply_filter( filter );

  // Remove unrecognized lines.
  for( int i = textlines() - 1; i >= 0; --i )
    {
    Textline & line1 = *tlpv[i];
    bool recognized = false;
    for( int j = 0 ; j < line1.characters(); ++j )
      { if( line1.character( j ).guesses() ) { recognized = true; break; } }
    if( !recognized ) delete_line( tlpv, i );
    }

  // Add blank lines.
  if( textlines() >= 3 )
    {
    int min_vdistance = ( tlpv.back()->mean_vcenter() - tlpv.front()->mean_vcenter() ) / ( textlines() - 1 );
    for( int i = 0; i + 1 < textlines(); ++i )
      {
      const Textline & line1 = *tlpv[i];
      const Textline & line2 = *tlpv[i+1];
      if( !Ocrad::similar( line1.characters(), line2.characters(), 50 ) ||
          !Ocrad::similar( line1.width(), line2.width(), 30 ) ) continue;
      const int vdistance = line2.mean_vcenter() - line1.mean_vcenter();
      if( vdistance >= min_vdistance ) continue;
      const int mh1 = line1.mean_height(), mh2 = line2.mean_height();
      if( mh1 < 10 || mh2 < 10 ) continue;
      if( Ocrad::similar( mh1, mh2, 20 ) && 2 * vdistance > mh1 + mh2 )
        min_vdistance = vdistance;
      }
    if( min_vdistance > 0 )
      for( int i = 0; i + 1 < textlines(); ++i )
        {
        const Textline & line1 = *tlpv[i];
        const Textline & line2 = *tlpv[i+1];
        int vdistance = line2.mean_vcenter() - line1.mean_vcenter() - min_vdistance;
        while( 2 * vdistance > min_vdistance )
          { insert_line( tlpv, ++i ); vdistance -= min_vdistance; }
        }
    }
  }


const Textline & Textblock::textline( const int i ) const
  {
  if( i < 0 || i >= textlines() )
    Ocrad::internal_error( "line, index out of bounds" );
  return *tlpv[i];
  }


int Textblock::characters() const
  {
  int total = 0;
  for( int i = 0; i < textlines(); ++i )
    total += tlpv[i]->characters();
  return total;
  }


void Textblock::print( const Control & control ) const
  {
  for( int i = 0; i < textlines(); ++i )
    tlpv[i]->print( control );
  std::fputs( "\n", control.outfile );
  }


void Textblock::dprint( const Control & control, bool graph, bool recursive ) const
  {
  std::fprintf( control.outfile, "%d lines\n\n", textlines() );

  for( int i = 0; i < textlines(); ++i )
    {
    std::fprintf( control.outfile, "%d characters in line %d\n",
                  tlpv[i]->characters(), i + 1 );
    tlpv[i]->dprint( control, graph, recursive );
    }
  std::fputs( "\n", control.outfile );
  }


void Textblock::xprint( const Control & control ) const
  {
  std::fprintf( control.exportfile, "lines %d\n", textlines() );

  for( int i = 0; i < textlines(); ++i )
    {
    std::fprintf( control.exportfile, "line %d chars %d height %d\n", i + 1,
                  tlpv[i]->characters(), tlpv[i]->mean_height() );
    tlpv[i]->xprint( control );
    }
  }


void Textblock::cmark( Page_image & page_image ) const
  {
  for( int i = 0; i < textlines(); ++i ) tlpv[i]->cmark( page_image );
  }


void Textblock::lmark( Page_image & page_image ) const
  {
  for( int i = 0; i < textlines(); ++i ) page_image.draw_track( *tlpv[i] );
  }
