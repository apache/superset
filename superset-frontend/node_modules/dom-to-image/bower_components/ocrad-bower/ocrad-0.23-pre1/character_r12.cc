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

#include <cstdio>
#include <cstdlib>
#include <vector>
#include <stdint.h>

#include "common.h"
#include "rectangle.h"
#include "segment.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "profile.h"
#include "feats.h"


// Recognizes 2 blob characters.
// ijÑñ!%:;=?|¡ª±º¿ÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛáéíóúàèìòùâêîôûÅå
//
void Character::recognize12( const Charset & charset, const Rectangle & charbox )
  {
  const Blob & b1 = blob( 0 );		// upper blob
  const Blob & b2 = blob( 1 );		// lower blob
  int a1 = b1.area();
  int a2 = b2.area();
  Features f1( b1 );
  Features f2( b2 );

  if( Ocrad::similar( a1, a2, 10 ) )
    {
    if( !b1.holes() && !b2.holes() &&
        2 * a1 > b1.size() && 2 * a2 > b2.size() )
      {
      if( width() > height() || Ocrad::similar( width(), height(), 40 ) )
        { add_guess( '=', 0 ); return; }
      if( Ocrad::similar( b1.width(), b1.height(), 20, 2 ) &&
          Ocrad::similar( b2.width(), b2.height(), 20, 2 ) )
        add_guess( ':', 0 );
      return;
      }
    return;
    }

  if( Ocrad::similar( a1, a2, 60 ) )
    {
    if( f1.test_solid( charbox ) == '.' )
      {
      if( f2.test_solid( charbox ) == '.' )
        { add_guess( ':', 0 ); return; }
      if( b2.height() > b1.height() && b2.top() > charbox.vcenter() )
        { add_guess( ';', 0 ); return; }
      }
    if( charset.enabled( Charset::iso_8859_15 ) ||
        charset.enabled( Charset::iso_8859_9 ) )
      {
      int code = f2.test_solid( charbox );
      if( code == '-' || code == '_' )
        { add_guess( UCS::PLUSMIN, 0 ); return; }
      }
    if( b1.includes_hcenter( b2 ) && b2.includes_hcenter( b1 ) )
      {
      if( b1.holes() && b2.holes() ) { add_guess( 'g', 0 ); return; }
      }
    if( b1.hcenter() < b2.hcenter() )		// Looks for merged 'fi'
      {
      if( b2.height() > b2.width() && b1.hcenter() < b2.left() &&
          b1.includes_hcenter( b2 ) && 4 * b1.height() > 5 * b2.height() &&
          Ocrad::similar( b1.bottom()-b1.top(), b2.bottom()-b1.top(), 10 ) )
        {
        Character c2( new Blob( b2 ) ); c2.recognize1( charset, charbox );
        if( ( c2.maybe('l') || c2.maybe('|') ) &&
            set_merged_guess( 'f', b2.left() - 1, 'i', 0 ) ) return;
        }
      }
    }

  if( a1 > a2 && b1.hcenter() < b2.hcenter() &&
      2 * b1.height() > 3 * b2.height() &&
      b1.holes() == 1 && b2.holes() == 1 &&
      Ocrad::similar( b2.width(), b2.height(), 50 ) )
    { add_guess( '%', 0 ); return; }

  if( a1 < a2 )
    {
      {
      int code = f1.test_solid( charbox );		//FIXME all this
      if( code == '-' && 2 * b1.height() > b1.width() ) code = '.';
      else if( code == '\'' || code == '|' ) code = '.';
      if( !code && !b1.holes() &&
          2 * b1.height() < b2.height() && b1.width() <= b2.width() )
        {
        if( 10 * a1 >= 7 * b1.height() * b1.width() ) code = '.';
        else code = '\'';
        }
      if( !b2.holes() && ( code == '.' || code == '\'' ) )
        {
        // Looks for merged 'ri' or 'rí'
        if( f2.bp.minima( b2.height() / 4 ) == 2 &&
            b2.top() > b1.bottom() && b2.hcenter() < b1.left() )
          {
          Character c2( new Blob( b2 ) ); c2.recognize1( charset, charbox );
          if( c2.maybe('n') )
            {
            if( code == '.' && ( b1.left() < b2.hcenter() || b1.right() > b2.right() ) )
              { add_guess( 'n', 0 ); return; }		// FIXME remove dot
            int col, limit = b2.seek_right( b2.vcenter(), b2.hcenter() );
            for( col = b2.hcenter(); col <= limit; ++col )
              if( b2.seek_bottom( b2.vcenter(), col ) < b2.bottom() ) break;
            if( b2.left() < col && col < b2.right() )
              {
              if( charset.enabled( Charset::iso_8859_9 ) && f2.rp.istip() )
                set_merged_guess( 'T', col - 1, UCS::CIDOT, 1 );
              else
                {
                const int code2 = ( ( code == '.' ) ? 'i' : (int)UCS::SIACUTE );
                set_merged_guess( 'r', col - 1, code2, 1 );
                }
              return;
              }
            }
          }

        if( code == '.' && f2.bp.minima( b2.height() / 4 ) == 1 &&
            b1.bottom() <= b2.top() && f2.rp.minima( b2.width() / 2 ) <= 2 )
          {
          int hdiff;
          if( b2.bottom_hook( &hdiff ) && std::abs( hdiff ) >= b2.height() / 2 )
            {
            if( hdiff > 0 && f2.rp.increasing( f2.rp.pos( 80 ) ) )
              { add_guess( 'j', 0 ); return; }
            if( hdiff < 0 )
              {
              if( charset.enabled( Charset::iso_8859_15 ) ||
                  charset.enabled( Charset::iso_8859_9 ) )
                if( -4 * hdiff <= 3 * b2.height() &&
                    f2.wp.max() > 2 * f1.wp.max() && f2.lp.minima() == 1 &&
                    2 * f2.bp[0] < b2.height() )
                  { add_guess( UCS::IQUEST, 0 ); return; }
              add_guess( 'i', 0 ); return;
              }
            }
          if( f2.tp.minima() == 1 )
            {
            const bool maybe_j = ( b2.height() > charbox.height() &&
                                   b2.vpos( 80 ) > charbox.bottom() );
            if( Ocrad::similar( f1.wp.max(), f2.wp.max(), 20 ) )
              {
              if( charset.enabled( Charset::iso_8859_15 ) ||
                  charset.enabled( Charset::iso_8859_9 ) )
                if( !f2.lp.isctip() && f2.wp.max() >= f1.wp.max() &&
                    ( 3 * f2.wp[f2.wp.pos(10)] < 2 * f1.wp.max() ||
                      ( b1.left() <= b2.left() && b2.vpos( 80 ) > charbox.bottom() ) ) )
                  { add_guess( UCS::IEXCLAM, 0 ); return; }
              if( maybe_j ) add_guess( 'j', 0 ); else add_guess( 'i', 0 );
              return;
              }
            if( 3 * f2.wp.max() > 4 * f1.wp.max() &&
                b2.seek_bottom( b2.vcenter(), b2.hpos( 10 ) ) < b2.bottom() &&
                f2.rp.increasing( f2.rp.pos( 75 ) ) &&
                ( b1.left() >= b2.hcenter() ||
                  b2.seek_top( b2.vcenter(), b2.hpos( 10 ) ) <= b2.top() ) )
              { add_guess( 'j', 0 ); return; }
            if( charset.enabled( Charset::iso_8859_9 ) && f2.rp.istip() )
              { add_guess( UCS::CIDOT, 0 ); return; }
            if( maybe_j ) add_guess( 'j', 0 ); else add_guess( 'i', 0 );
            return;
            }
          }
        }
      }

    if( ( !b1.holes() && ( b1.bottom() < b2.vcenter() || 2 * a1 < a2 ) ) ||
        ( b1.holes() == 1 && b1.bottom() < b2.top() &&
          b2.top() - b1.bottom() < b1.height() ) )
      {
      Character c( new Blob( b2 ) ); c.recognize1( charset, charbox );
      if( c.guesses() )
        {
        int code = c.guess( 0 ).code;
        if( b1.holes() == 1 )
          {
          if( code == 'a' ) code = UCS::SARING;
          else if( code == 'A' ) code = UCS::CARING;
          else code = 0;
          }
        else if( code == 'u' &&
                 5 * b1.width() <= b2.width() && 5 * b1.height() <= b2.width() )
          return;
        else if( b1.bottom() < b2.vcenter() )
          {
          int atype = '\'';
          if( UCS::isvowel( code ) && 2 * b1.width() > 3 * b1.height() &&
              !f1.tp.iscpit() && f1.hp.iscpit() ) atype = ':';
          else if( f1.bp.minima() == 2 || f1.bp.istip() ) atype = '^';
          else if( std::min( b1.height(), b1.width() ) >= 5 &&
                   ( f1.rp.decreasing() || f1.tp.increasing() ) &&
                   ( f1.bp.decreasing() || f1.lp.increasing() ) ) atype = '`';
          code = UCS::compose( code, atype );
          }
        if( code != c.guess( 0 ).code && charset.only( Charset::ascii ) )
          {
          if( UCS::base_letter( code ) == 'i' ) code = 'i';
          else code = c.guess( 0 ).code;
          }
        if( code ) add_guess( code, 0 );
        }
      }
    return;
    }

  if( b1.bottom() <= b2.top() )
    {
    const int code = f2.test_solid( charbox );
    if( !b1.holes() && ( code == '.' ||
          ( code && Ocrad::similar( b2.height(), b2.width(), 50 ) ) ) )
      {
      if( Ocrad::similar( b1.width(), b2.width(), 50 ) && !f1.lp.isctip() )
        { add_guess( '!', 0 ); return; }
      if( f1.bp.minima() == 1 ) add_guess( '?', 0 );
      return;
      }
    if( code == '-' || code == '_' )
      if( charset.enabled( Charset::iso_8859_15 ) ||
          charset.enabled( Charset::iso_8859_9 ) )
        {
        if( b1.holes() == 1 )
          {
          const Bitmap & h = b1.hole( 0 );
          if( b2.width() >= h.width() && b2.top() - b1.bottom() < h.height() )
            {
            if( Ocrad::similar( h.left() - b1.left(), b1.right() - h.right(), 40 ) )
              { add_guess( UCS::MASCORD, 0 ); return; }
            add_guess( UCS::FEMIORD, 0 ); return;
            }
          }
        }
    }
  }
