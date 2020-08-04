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
#include <vector>
#include <stdint.h>
#include <cstdlib>

#include "common.h"
#include "rectangle.h"
#include "segment.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "profile.h"
#include "feats.h"


// First attempt at recognition without relying on context.
//
void Character::recognize1( const Charset & charset, const Rectangle & charbox )
  {
  if( blobs() == 1 ) recognize11( charset, charbox );
  else if( blobs() == 2 ) recognize12( charset, charbox );
  else if( blobs() == 3 ) recognize13( charset, charbox );
  }


// Recognizes 1 blob characters.
// 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghklmnopqrstuvwxyz
// #$&'()*+,-./<>@[\]^_`{|}~¬
//
void Character::recognize11( const Charset & charset, const Rectangle & charbox )
  {
  const Blob & b = blob( 0 );
  if( b.holes() == 0 ) recognize110( charset, charbox );
  else if( b.holes() == 1 ) recognize111( charset, charbox );
  else if( b.holes() == 2 ) recognize112( charbox );
  }


// Recognizes 1 blob characters without holes.
// 12357CEFGHIJKLMNSTUVWXYZcfhklmnrstuvwxyz
// '()*+,-./<>@[\]^_`{|}~¬
//
void Character::recognize110( const Charset & charset, const Rectangle & charbox )
  {
  const Blob & b = blob( 0 );
  Features f( b );
  int code = f.test_easy( charbox );
  if( code )
    {
    if( code == '.' && b.width() > b.height() && b.v_includes( charbox.vcenter() ) )
      { add_guess( code, 1 ); add_guess( '-', 0 ); return; }
    add_guess( code, 0 ); return;
    }
  if( b.height() < 5 || ( b.height() < 8 && b.width() < 6 ) ||
      b.height() > 10 * b.width() || 5 * b.height() < b.width() ) return;

  code = f.test_CEFIJLlT( charset ); if( code ) { add_guess( code, 0 ); return; }
  code = f.test_frst( charbox );     if( code ) { add_guess( code, 0 ); return; }
  code = f.test_G();                 if( code ) { add_guess( code, 0 ); return; }
  code = f.test_c();                 if( code ) { add_guess( code, 0 ); return; }
  if( charset.enabled( Charset::iso_8859_9 ) )
    { code = f.test_s_cedilla();     if( code ) { add_guess( code, 0 ); return; } }
  code = f.test_235Esz( charset );   if( code ) { add_guess( code, 0 ); return; }
  code = f.test_HKMNUuvwYy( charbox );
  if( code == 'u' && f.lp.istpit() )	// Looks for merged 'tr'
    {
    int col = b.seek_left( b.vcenter(), b.right() );
    if( col < b.hpos( 90 ) && !b.escape_top( b.vcenter(), col ) )
      {
      col = b.seek_left( b.vcenter(), col - 1, false );
      while( --col > b.hpos( 40 ) &&
             ( b.seek_top( b.vcenter(), col ) > b.top() ||
               f.hp[col-b.left()] > b.height() / 10 ) ) ;
      if( col > b.hpos( 40 ) && col < b.right() &&
          set_merged_guess( 't', col, 'r', 0 ) ) return;
      }
    }
  if( code == 'N' && b.width() > b.height() && b.top() >= charbox.top() &&
      4 * f.tp[f.tp.pos(50)] < b.height() )
    {					// Looks for merged 'rv'
    const int col = f.hp.iminimum();
    if( col >= f.hp.pos( 40 ) && col < f.hp.pos( 50 ) &&
        set_merged_guess( 'r', b.left() + col, 'v', 0 ) ) return;
    }
  if( code ) { add_guess( code, 0 ); return; }
  const int noise = ( std::min( b.height(), b.width() ) / 30 ) + 1;
  if( f.bp.minima() <= 2 &&
      ( f.bp.minima( b.height() / 8 + noise ) == 2 ||
        ( b.height() >= 16 && f.bp.minima( b.height() / 8 ) == 2 ) ) )
    {
    code = f.test_hknwx( charbox );
    if( code == 'n' )	// Looks for '"' or merged 'rt' or 'fl'
      {
      if( b.bottom() <= charbox.vcenter() ) { add_guess( '"', 0 ); return; }
      if( b.width() > b.height() && 10 * f.lp[f.lp.pos(10)] < b.width() &&
          !f.rp.increasing( f.rp.pos( 75 ) ) )
        {
        const int rgap = f.rp[f.rp.pos(50)];
        if( 10 * rgap > b.width() && !b.escape_top( b.vcenter(), b.right() ) )
          return;	// leave 'rr', 'TT', 'rz', 'FT' etc, for next pass
        }
      if( 2 * f.lp[f.lp.pos(10)] > b.width() && !f.rp.increasing( f.rp.pos( 75 ) ) )
        {
        const int col = b.seek_left( b.vcenter(), b.right() );
        if( col <= b.hpos( 95 ) && !b.escape_top( b.vcenter(), col ) &&
            set_merged_guess( 'r', b.hcenter(), 't', 0 ) ) return;
        }
      if( f.rp.minima() == 1 && !f.rp.increasing( f.rp.pos( 75 ) ) )
        {
        int dmax = 0; bool bar = false;
        for( int row = b.vpos( 60 ); row > b.vpos( 25 ); --row )
          {
          int d = b.hcenter() - b.seek_left( row, b.hcenter() );
          if( d > dmax ) dmax = d;
          else if( 2 * d < dmax && dmax > 2 ) bar = true;
          if( bar && Ocrad::similar( d, dmax, 25 ) )
            {
            int col, limit = b.seek_right( b.vcenter(), b.hcenter() );
            for( col = b.hcenter(); col <= limit; ++col )
              if( b.seek_bottom( b.vcenter(), col ) < b.bottom() ) break;
            if( col > b.left() && col < b.right() &&
                set_merged_guess( 'f', col - 1, 'l', 0 ) ) return;
            }
          }
        }
      }
    else if( code == 'h' )	// Looks for merged 'rf' or 'fi'
      {
      if( 2 * f.lp[f.lp.pos(10)] > b.width() )
        {
        if( f.rp[f.rp.pos(70)] >= 2 &&
            b.seek_top( b.vpos( 70 ), b.right() ) > b.top() )
          {
          int col = 0, hmin = f.hp.range() + 1;
          for( int i = b.hpos( 40 ); i <= b.hpos( 60 ); ++i )
            if( f.hp[i-b.left()] < hmin )
              { hmin = f.hp[i-b.left()]; col = i; }
          if( col > b.left() && col < b.right() )
            set_merged_guess( 'r', col - 1, 'f', 0 );
          }
        return;
        }
      if( f.rp.isctip( 30 ) )
        { set_merged_guess( 'f', b.hcenter(), 'i', 0 ); return; }
      }
    else if( code == 'k' )	// Looks for merged 'rt'
      {
      if( 2 * f.lp[f.lp.pos(10)] > b.width() &&
          !f.rp.increasing( f.rp.pos( 75 ) ) &&
          set_merged_guess( 'r', b.hcenter(), 't', 0 ) ) return;
      }
    if( code ) { add_guess( code, 0 ); return; }
    }
  if( f.bp.minima() == 3 )
    {
    if( f.bp.minima( b.height() / 2 ) == 1 && f.tp.minima() == 3 &&
        f.lp.minima() == 2 && f.rp.minima() == 2 )
      { add_guess( '*', 0 ); return; }
    if( b.id( b.vcenter(), b.hcenter() ) == 0 &&
        b.id( b.vcenter() - 1, b.hcenter() ) == 0 &&
        b.id( b.vcenter() + 1, b.hcenter() ) == 0 &&
        b.seek_left( b.vcenter(), b.hcenter() ) <= b.hpos( 25 ) )
      {					// Found merged 'rn'
      int row = b.vpos( 95 );
      int col = b.seek_right( row, b.left() );
      col = b.seek_right( row, col + 1, false );
      col = b.seek_right( row, col + 1 );
      if( col > b.left() && col < b.right() &&
          set_merged_guess( 'r', col, 'n', 0 ) ) return;
      }
    if( f.tp.minima( b.height() / 3 ) == 1 ) add_guess( 'm', 0 );
    return;
    }
  if( f.bp.minima() == 4 && f.tp.minima( b.height() / 3 ) == 1 )
    {					// Found merged 'rm'
    int row = b.vpos( 95 );
    int col = b.seek_right( row, b.left() );
    col = b.seek_right( row, col + 1, false );
    col = b.seek_right( row, col + 1 );
    if( col > b.left() && col < b.right() &&
        set_merged_guess( 'r', col, 'm', 0 ) ) return;
    }

  if( f.tp.minima( b.height() / 4 ) == 3 )
    {
    int hdiff;
    if( !b.bottom_hook( &hdiff ) &&
        ( f.segments_in_row( b.vcenter() ) < 4 ||
          !b.escape_top( b.vcenter(), b.hcenter() ) ) )
      add_guess( 'w', 0 );
    return;
    }

  code = f.test_line( charbox );
  if( code ) { add_guess( code, 0 ); return; }

  code = f.test_misc( charbox );
  if( code ) { add_guess( code, 0 ); return; }
  }


// Recognizes 1 blob characters with 1 hole.
// 0469ADOPQRabdegopq#
//
void Character::recognize111( const Charset & charset, const Rectangle & charbox )
  {
  const Blob & b = blob( 0 );
  const Bitmap & h = b.hole( 0 );
  if( !h.is_hcentred_in( b ) ) return;
  Features f( b );
  int top_delta = h.top() - b.top(), bottom_delta = b.bottom() - h.bottom();

  if( std::abs( top_delta - bottom_delta ) <= std::max( 2, h.height() / 4 ) ||
      Ocrad::similar( top_delta, bottom_delta, 40, 2 ) )
    {					// hole is vertically centred
    int code = f.test_4ADQao( charset, charbox );
    if( code )
      {
      if( code == 'Q' && Ocrad::similar( top_delta, bottom_delta, 40, 2 ) )
        add_guess( 'a', 1 );
      add_guess( code, 0 );
      }
    return;
    }

  if( top_delta < bottom_delta )	// hole is high
    {
    int code = f.test_49ARegpq( charbox );
    if( code ) add_guess( code, 0 );
    return;
    }

  if( top_delta > bottom_delta )	// hole is low
    {
    int code = f.test_6abd( charset );
    if( code )
      {
      add_guess( code, 0 );
      if( code == UCS::SOACUTE )
        {
        int row = h.top() - ( b.bottom() - h.bottom() ) - 1;
        if( row <= b.top() || row + 1 >= h.top() ) return;
        Blob & b1 = const_cast< Blob & >( b );
        Blob b2( b );
        b1.bottom( row ); b2.top( row + 1 );
        blobpv.push_back( new Blob( b2 ) );
        }
      }
    }
  }


// Recognizes 1 blob characters with 2 holes.
// 8BQg$&
//
void Character::recognize112( const Rectangle & charbox )
  {
  const Blob & b = blob( 0 );
  const Bitmap & h1 = b.hole( 0 );		// upper hole
  const Bitmap & h2 = b.hole( 1 );		// lower hole
  Profile lp( b, Profile::left );
  Profile tp( b, Profile::top );
  Profile rp( b, Profile::right );
  Profile bp( b, Profile::bottom );

  // Check for 'm' or 'w' with merged serifs
  if( 10 * std::abs( h2.vcenter() - h1.vcenter() ) <= b.height() &&
      h1.is_vcentred_in( b ) && h2.is_vcentred_in( b ) )
    {
    if( ( b.bottom() - h1.bottom() <= h1.top() - b.top() ) &&
        ( b.bottom() - h2.bottom() <= h2.top() - b.top() ) && bp.isflats() )
      { add_guess( 'm', 0 ); return; }

    if( 5 * std::abs( h1.bottom() - b.vcenter() ) <= b.height() &&
        5 * std::abs( h2.bottom() - b.vcenter() ) <= b.height() &&
        tp.isflats() && bp.minima() == 2 )
      { add_guess( 'w', 0 ); return; }
    return;
    }
  if( !h1.is_hcentred_in( b ) ) return;
  if( !h2.is_hcentred_in( b ) ) return;
  if( h1.left() > b.hcenter() && h2.left() > b.hcenter() ) return;
  if( h1.right() < b.hpos( 40 ) && h2.right() < b.hpos( 40 ) ) return;
  if( h1.top() > b.vcenter() || h2.bottom() < b.vcenter() ) return;
  const int a1 = h1.area();
  const int a2 = h2.area();

  {
  const int w = b.right() - std::min( b.hcenter(),
                            std::min( h1.hcenter(), h2.hcenter() ) );
  for( int i = h1.bottom() - b.top() + 1; i < h2.top() - b.top(); ++i )
    if( rp[i] > w ) { add_guess( 'g', 2 ); return; }
  }

  if( Ocrad::similar( a1, a2, 50 ) )		// I don't like this
    {
    if( h1.bottom() > b.vcenter() && h2.top() < b.vcenter() &&
        h1.h_overlaps( h2 ) && !h1.h_includes( h2 ) )
      { add_guess( '0', 0 ); return; }
    if( h1.bottom() <= h2.top() )
      {
      int hdiff;
      if( b.bottom_hook( &hdiff ) && hdiff > b.height() / 2 )
        if( b.top_hook( &hdiff ) && hdiff > b.height() / 2 )
          { add_guess( 's', 0 ); return; }

      if( lp.isflats() && ( lp.istip() || ( lp.isflat() && b.test_BD() ) ) )
        { add_guess( 'B', 0 ); return; }

      int col1 = h1.seek_left( h1.bottom(), h1.right() + 1 ) - 1;
      int col2 = h2.seek_right( h2.top(), h2.left() - 1 ) + 1;
      if( col1 <= col2 )
        {
        if( lp.isconvex() || lp.ispit() ) add_guess( 'e', 1 );
        else if( !rp.isctip() && tp.minima() == 1 ) add_guess( 'a', 1 );
        if( bp.istpit() ) { add_guess( '$', 0 ); return; }
        }

      if( b.hcenter() > h1.hcenter() && b.hcenter() > h2.hcenter() &&
          ( b.hcenter() >= h1.right() || b.hcenter() >= h2.right() ) )
        { add_guess( '&', 0 ); return; }

      for( int row = h1.bottom() + 1; row < h2.top(); ++row )
        if( !b.get_bit( row, hcenter() ) )
          { add_guess( 'g', 0 ); return; }

      if( charbox.bottom() > h2.vcenter() &&
          ( bp.isconvex() || ( bp.ispit() && tp.ispit() ) ) )
        {
        if( b.top() >= charbox.top() && b.height() <= charbox.height() )
          {
          if( ( lp.ispit() || lp.isconvex() ) &&
              ( !rp.ispit() || h2.right() > h1.right() ) )
            add_guess( 'e', 1 );
          else if( b.right() - rp[rp.pos(50)] > h1.right() && !rp.isctip() )
            add_guess( 'a', 1 );
          }
        if( h1.bottom() > b.vcenter() && h1.top() > b.vpos( 30 ) )
          add_guess( UCS::SEACUTE, 0 );
        else add_guess( '8', 0 );
        return;
        }

      if( lp.minima() == 2 && rp.minima() == 1 )
        {
        if( charbox.vcenter() < h1.bottom() && charbox.bottom() < h2.bottom() )
          add_guess( 'g', 0 );
        else add_guess( 'a', 0 );
        return;
        }

      if( charbox.vcenter() > h1.top() &&
          ( charbox.vcenter() < h1.bottom() || charbox.bottom() < h2.vcenter() ) )
        add_guess( 'g', 2 );
      add_guess( 'B', 1 ); add_guess( 'a', 0 );
      return;
      }
    }

  if( a1 > a2 && h1.h_overlaps( h2 ) )
    {
    if( !h1.v_overlaps( h2 ) )
      {
      if( h2.left() > b.hcenter() && h2.bottom() < b.bottom() - h1.height() )
        add_guess( '9', 0 );
      else add_guess( 'g', 0 );
      return;
      }
    if( h1.h_includes( h2 ) ) { add_guess( 'Q', 0 ); return; }
    return;
    }

  if( a1 < a2 && tp.minima() == 1 )
    {
    if( h1.h_overlaps( h2 ) )
      {
      if( rp.minima() == 1 )
        {
        if( 2 * h1.height() > h2.height() && 2 * h1.width() > h2.width() &&
            3 * h2.width() >= b.width() && !lp.isctip() )
          { if( lp.ispit() && lp.isconvex() ) add_guess( '6', 0 );
          else add_guess( 'B', 0 ); }
        else if( h2.right() < b.hcenter() ) add_guess( '&', 0 );
        else add_guess( 'a', 0 );
        return;
        }
      if( !h1.v_overlaps( h2 ) &&
          h1.right() < b.hcenter() && h1.top() > b.top() + h1.height() )
        { add_guess( '6', 0 ); return; }
      }
    if( h1.bottom() < h2.top() ) { add_guess( '&', 0 ); return; }
    }
  }
