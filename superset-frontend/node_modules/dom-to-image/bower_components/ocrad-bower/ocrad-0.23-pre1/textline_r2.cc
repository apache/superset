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
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <stdint.h>

#include "common.h"
#include "rectangle.h"
#include "track.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "textline.h"

// All the code in this file is provisional and will be rewritten someday


namespace {

int find_space_or_hyphen( const std::vector< Character * > & cpv, unsigned i )
  {
  while( i < cpv.size() && !cpv[i]->maybe(' ') && !cpv[i]->maybe('-') ) ++i;
  return i;
  }

} // end namespace


     // transform some small letters to capitals
void Textline::check_lower_ambiguous()
  {
  int begin = big_initials();
  bool isolated = false;	// isolated letters compare with all line
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.maybe(' ') )
      {
      if( i + 2 < characters() && character( i + 2 ).maybe(' ') )
        { begin = big_initials(); isolated = true; }
      else { begin = i + 1; isolated = false; }
      continue;
      }
    if( c1.guesses() == 1 )
      {
      const int code = c1.guess( 0 ).code;
      if( !UCS::islower_small_ambiguous( code ) ) continue;
      if( 5 * c1.height() < 4 * mean_height() ) continue;
      bool capital = ( 4 * c1.height() > 5 * mean_height() );
      bool small = false;
      for( int j = begin; j < characters(); ++j ) if( j != i )
        {
        const Character & c2 = character( j );
        if( !c2.guesses() ) continue;
        if( c2.maybe(' ') ) { if( isolated ) continue; else break; }
        const int code2 = c2.guess( 0 ).code;
        if( code2 >= 128 || !std::isalpha( code2 ) ) continue;
        if( !capital )
          {
          if( 4 * c1.height() > 5 * c2.height() ) capital = true;
          else if( std::isupper( code2 ) && code2 != 'B' && code2 != 'Q' &&
                   ( c1.height() >= c2.height() ||
                     Ocrad::similar( c1.height(), c2.height(), 10 ) ) )
            capital = true;
          else if( code2 == 't' && c1.height() >= c2.height() ) capital = true;

          }
        if( !small && std::islower( code2 ) && code2 != 'l' && code2 != 'j' )
          {
          if( 5 * c1.height() < 4 * c2.height() ) small = true;
          else if( UCS::islower_small( code2 ) &&
                   code2 != 'r' && !c2.maybe('Q')  &&
                   ( j < i || !UCS::islower_small_ambiguous( code2 ) ) &&
                   Ocrad::similar( c1.height(), c2.height(), 10 ) )
            small = true;
          }
        }
      if( capital && !small ) c1.insert_guess( 0, std::toupper( code ), 1 );
      }
    }
  }


void Textline::recognize2( const Charset & charset )
  {
  if( big_initials() >= characters() ) return;

  // try to recognize separately the 3 overlapped blobs of an
  // unrecognized character
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( !c.guesses() && c.blobs() == 3 )
      {
      const Blob & b1 = c.blob( 0 );
      const Blob & b2 = c.blob( 1 );
      const Blob & b3 = c.blob( 2 );		// lower blob
      if( Ocrad::similar( b2.height(), b3.height(), 20 ) && !b2.h_overlaps( b3 ) &&
          b2.v_includes( b3.vcenter() ) && b3.v_includes( b2.vcenter() ) &&
          b1.bottom() < b2.top() && b1.bottom() < b3.top() )
        {
        if( b1.height() > b2.height() && b1.height() > b3.height() )
          {
          Character c1( new Blob( b1 ) );
          c1.recognize1( charset, charbox( c1 ) );
          if( c1.guesses() ) c = c1;
          }
        else
          {
          Character c2( new Blob( b2 ) );
          Character c3( new Blob( b3 ) );
          if( b2.h_includes( b1.hcenter() ) ) c2.shift_blobp( new Blob( b1 ) );
          else if( b3.h_includes( b1.hcenter() ) ) c3.shift_blobp( new Blob( b1 ) );
          c2.recognize1( charset, charbox( c2 ) );
          c3.recognize1( charset, charbox( c3 ) );
          if( c2.guesses() && c3.guesses() )
            { c = c2; shift_characterp( new Character( c3 ) ); ++i; }
          }
        }
      }
    }

  // try to recognize separately the 2 overlapped blobs of an
  // unrecognized character
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( !c.guesses() && c.blobs() == 2 &&
        c.blob( 0 ).v_overlaps( c.blob( 1 ) ) )
      {
      Character c1( new Blob( c.blob( 0 ) ) );
      c1.recognize1( charset, charbox( c1 ) );
      Character c2( new Blob( c.blob( 1 ) ) );
      c2.recognize1( charset, charbox( c2 ) );
      if( ( c1.guesses() && c2.guesses() ) ||
          Ocrad::similar( c1.height(), c2.height(), 20 ) )
        {
        if( c1.height() > c2.height() ) c = c1;
        else { c = c2; c2 = c1; }
        // discards spurious dots
        if( !c2.maybe('.') || c2.top() > c.vcenter() )
          { shift_characterp( new Character( c2 ) ); ++i; }
        }
      }
    }

  // remove speckles under the charbox' bottom of an unrecognized character
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( !c.guesses() && c.blobs() == 2 &&
        c.blob( 0 ).size() > 10 * c.blob( 1 ).size() &&
        c.blob( 1 ).top() > charbox( c ).bottom() )
      {
      Character c1( new Blob( c.blob( 0 ) ) );
      c1.recognize1( charset, charbox( c1 ) );
      if( c1.guesses() ) c = c1;
      }
    }

  // remove speckles above the charbox' top of an unrecognized character
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( !c.guesses() && c.blobs() == 2 &&
        c.blob( 1 ).size() > 5 * c.blob( 0 ).size() &&
        c.blob( 0 ).bottom() + 2 * c.blob( 0 ).height() < charbox( c ).top() )
      {
      Character c1( new Blob( c.blob( 1 ) ) );
      c1.recognize1( charset, charbox( c1 ) );
      if( c1.guesses() ) c = c1;
      }
    }

  // try to separate lightly merged characters
  // FIXME try relative minima (small pixel count surrounded by larger counts)
  // FIXME try all possible separation points
  // FIXME try other separation paths (an irregular line, not a column)
  // FIXME sometimes leaves unconnected blobs
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( !c.guesses() && c.width() > 20 && 5 * c.width() >= 3 * c.height() &&
        5 * c.height() >= 3 * mean_height() )
      {
      int ib = c.blobs() - 1;
      for( int k = ib - 1; k >= 0; --k )
        if( c.blob( k ).width() > c.blob( ib ).width() ) ib = k;
      if( ib < 0 || 10 * c.blob( ib ).width() < 9 * c.width() ||
          c.blob( ib ).bottom() < c.bottom() )
        continue;
      const Blob & b = c.blob( ib );			// widest blob
      int colmin = 0, cmin = b.height() + 1;
      for( int col = b.hpos( 30 ); col <= b.hpos( 70 ); ++col )
        {
        int c = 0;
        for( int row = b.top(); row <= b.bottom(); ++row )
          if( b.id( row, col ) ) ++c;
        if( c < cmin || ( c == cmin && col <= b.hcenter() ) )
          { cmin = c; colmin = col; }
        }
      if( 4 * cmin > b.height() ||
          ( 5 * cmin > b.height() &&
            ( colmin <= b.hpos( 40 ) || colmin >= b.hpos( 60 ) ) ) ) continue;
      if( colmin <= b.left() || colmin >= b.right() ) continue;
      Rectangle r1( b.left(), b.top(), colmin - 1, b.bottom() );
      Rectangle r2( colmin + 1, b.top(), b.right(), b.bottom() );
      Blob b1( b, r1 );
      b1.adjust_height(); if( 2 * b1.height() < b.height() ) continue;
      Blob b2( b, r2 );
      b2.adjust_height(); if( 2 * b2.height() < b.height() ) continue;
      b1.find_holes(); b2.find_holes();
      Character c1( new Blob( b1 ) );
      Character c2( new Blob( b2 ) );
      for( int j = 0; j < c.blobs(); ++j ) if( j != ib )
        {
        const Blob & bj = c.blob( j );
        if( c1.includes_hcenter( bj ) ) c1.shift_blobp( new Blob( bj ) );
        else if( c2.includes_hcenter( bj ) ) c2.shift_blobp( new Blob( bj ) );
        }
      c1.recognize1( charset, charbox( c1 ) );
      c2.recognize1( charset, charbox( c2 ) );
      if( ( c1.guesses() && c2.guesses() ) ||
          ( ( c1.guesses() || c2.guesses() ) && c.width() > c.height() ) )
        {
        c = c1; shift_characterp( new Character( c2 ) );
        if( !c1.guesses() ) --i; else if( c2.guesses() ) ++i;
        }
      }
    }

  // try to recognize 1 blob unrecognized characters with holes by
  // removing small holes (noise)
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( !c.guesses() && c.blobs() == 1 && c.blob( 0 ).holes() )
      {
      Character c1( c );
      Blob & b = c1.blob( 0 );
      for( int j = b.holes() - 1; j >= 0; --j )
        if( 64 * b.hole( j ).size() <= b.size() ||
            16 * b.hole( j ).height() <= b.height() ) b.fill_hole( j );
      if( b.holes() < c.blob( 0 ).holes() )
        {
        c1.recognize1( charset, charbox( c1 ) );
        if( c1.guesses() ) { c = c1; continue; }
        }
/*      if( b.holes() == 1 && 25 * b.hole( 0 ).size() < b.size() &&
          Ocrad::similar( b.height(), b.width(), 40 ) )
        {
        b.fill_hole( 0 );
        c1.recognize1( charset, charbox( c1 ) );
        if( c1.guesses() ) { c = c1; continue; }
        }*/
      }
    }

  // separate merged characters recognized by recognize1
  for( int i = big_initials(); i < characters(); )
    {
    if( !cpv[i]->guesses() || cpv[i]->guess( 0 ).code >= 0 ) { ++i; continue; }
    const Character c( *cpv[i] );
    const int blob_index = -(c.guess( 0 ).code + 1);
    delete_character( i );
    if( c.guesses() >= 3 && c.blobs() >= 1 && blob_index < c.blobs() )
      {
      int left = c.guess( 0 ).value;
      for( int g = 1; g < c.guesses(); ++g )
        {
        Blob b( c.blob( blob_index ) );
        Rectangle re( left, b.top(), c.guess( g ).value, b.bottom() );
        b.add_rectangle( re );
        Blob b1( b, re );
        b1.adjust_height(); b1.adjust_width(); b1.find_holes();
        Character c1( new Blob( b1 ) );
        for( int k = 0; k < c.blobs(); ++k )
          if( k != blob_index && !c.blob( k ).includes( re ) &&
              re.includes_hcenter( c.blob( k ) ) )
            c1.shift_blobp( new Blob( c.blob( k ) ) );
        c1.add_guess( c.guess( g ).code, 0 );
        shift_characterp( new Character( c1 ) );
        left = re.right() + 1;
        }
      }
    }

  // choose between 'B' and 'a'
  for( int i = big_initials(), begin = i; i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.maybe(' ') ) { begin = i + 1 ; continue; }
    if( c1.guesses() )
      {
      int code = c1.guess( 0 ).code;
      if( c1.guesses() != 2 || code != 'B' || c1.guess( 1 ).code != 'a' )
        continue;
      if( 4 * c1.height() > 5 * mean_height() ) continue;
      for( int j = begin; j < characters(); ++j ) if( j != i )
        {
        Character & c2 = character( j );
        if( c2.maybe(' ') ) break;
        if( c2.guesses() >= 1 )
          {
          int code2 = c2.guess( 0 ).code;
          if( code2 >= 128 ) continue;
          if( ( std::isupper( code2 ) && code2 != 'B' && code2 != 'Q' && 5 * c1.height() < 4 * c2.height() ) ||
              ( UCS::islower_small( code2 ) && code2 != 'r' && !UCS::islower_small_ambiguous( code2 ) &&
                ( c1.height() <= c2.height() ||
                  Ocrad::similar( c1.height(), c2.height(), 10 ) ) ) )
            { c1.swap_guesses( 0, 1 ); break; }
          }
        }
      }
    }

  // choose between '8' and 'a' or 'e'
  for( int i = big_initials(), begin = i; i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.maybe(' ') ) { begin = i + 1 ; continue; }
    if( c1.guesses() == 2 && c1.guess( 1 ).code == '8' )
      {
      int code = c1.guess( 0 ).code;
      if( ( code != 'a' && code != 'e' ) || 5 * c1.height() < 4 * mean_height() )
        continue;
      for( int j = begin; j < characters(); ++j ) if( j != i )
        {
        Character & c2 = character( j );
        if( c2.maybe(' ') ) break;
        if( c2.guesses() >= 1 )
          {
          int code2 = c2.guess( 0 ).code;
          if( code2 >= 128 ) continue;
          if( ( ( std::isalpha( code2 ) || code2 == ':' ) && 4 * c1.height() > 5 * c2.height() ) ||
              ( ( std::isdigit( code2 ) || std::isupper( code2 ) || code2 == 'l' ) &&
                ( c1.height() >= c2.height() ||
                  Ocrad::similar( c1.height(), c2.height(), 10 ) ) ) )
            { c1.swap_guesses( 0, 1 ); break; }
          }
        }
      }
    }

  check_lower_ambiguous();

  // transform 'i' into 'j'
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.guesses() == 1 && c1.guess( 0 ).code == 'i' )
      {
      int j = i + 1;
      if( j >= characters() || !character( j ).guesses() )
        { j = i - 1; if( j < big_initials() || !character( j ).guesses() ) continue; }
      Character & c2 = character( j );
      if( UCS::isvowel( c2.guess( 0 ).code ) &&
          c1.bottom() >= c2.bottom() + ( c2.height() / 4 ) )
        c1.insert_guess( 0, 'j', 1 );
      }
    }

  // transform small o or u with accent or diaeresis to capital
  {
  int begin = big_initials();
  bool isolated = false;	// isolated letters compare with all line
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.guesses() >= 1 )
      {
      if( c1.maybe(' ') )
        {
        if( i + 2 < characters() && character( i + 2 ).maybe(' ') )
          { begin = big_initials(); isolated = true; }
        else { begin = i + 1; isolated = false; }
        continue;
        }
      int code = c1.guess( 0 ).code;
      if( code < 128 || c1.blobs() < 2 ) continue;
      int codeb = UCS::base_letter( code );
      if( codeb != 'o' && codeb != 'u' ) continue;
      const Blob & b1 = c1.blob( c1.blobs() - 1 );	// lower blob
      for( int j = begin; j < characters(); ++j ) if( j != i )
        {
        Character & c2 = character( j );
        if( c2.guesses() >= 1 )
          {
          if( c2.maybe(' ') ) { if( isolated ) continue; else break; }
          int code2 = c2.guess( 0 ).code;
          int code2b = UCS::base_letter( code2 );
          if( !code2b && code2 >= 128 ) continue;
          if( ( std::isalpha( code2 ) && 4 * b1.height() > 5 * c2.height() ) ||
              ( std::isupper( code2 ) && Ocrad::similar( b1.height(), c2.height(), 10 ) ) ||
              ( std::isalpha( code2b ) && 4 * c1.height() > 5 * c2.height() ) ||
              ( std::isupper( code2b ) && Ocrad::similar( c1.height(), c2.height(), 10 ) ) )
            { c1.insert_guess( 0, UCS::toupper( code ), 1 ); break; }
          }
        }
      }
    }
  }

  // transform 'O' or 'l' into '0' or '1'
  for( int i = big_initials(), begin = i; i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.maybe(' ') ) { begin = i + 1 ; continue; }
    if( c1.guesses() >= 1 )
      {
      int code = c1.guess( 0 ).code;
      if( code != 'o' && code != 'O' && code != 'l' ) continue;
      for( int j = begin; j < characters(); ++j ) if( j != i )
        {
        Character & c2 = character( j );
        if( c2.maybe(' ') ) break;
        if( c2.guesses() >= 1 )
          {
          int code2 = c2.guess( 0 ).code;
          if( UCS::isdigit( code2 ) )
            {
            if( Ocrad::similar( c1.height(), c2.height(), 10 ) )
              c1.insert_guess( 0, (code == 'l') ? '1' : '0', c1.guess( 0 ).value + 1 );
            break;
            }
          if( UCS::isalpha( code2 ) &&
              code2 != 'o' && code2 != 'O' && code2 != 'l' ) break;
          }
        }
      }
    }

  // transform a small 'p' to a capital 'P'
  for( int i = characters() - 1; i >= big_initials(); --i )
    {
    Character & c1 = character( i );
    if( c1.guesses() == 1 && c1.guess( 0 ).code == 'p' )
      {
      const int noise = std::max( 2, c1.height() / 20 );
      bool cap = false, valid_c2 = false;
      if( i < characters() - 1 && character(i+1).guesses() )
        {
        Character & c2 = character( i + 1 );
        int code = c2.guess( 0 ).code;
        if( UCS::isalnum( code ) || code == '.' || code == '|' )
          {
          valid_c2 = true;
          switch( code )
            {
            case 'g': case 'j': case 'p': case 'q': case 'y':
                      cap = ( c1.bottom() + noise <= c2.bottom() ); break;
            case 'Q': cap = ( std::abs( c1.top() - c2.top() ) <= noise ); break;
            default : cap = ( std::abs( c1.bottom() - c2.bottom() ) <= noise );
            }
          }
        }
      if( !valid_c2 && i > big_initials() && !character(i-1).maybe(' ') )
        cap = ( std::abs( c1.bottom() - charbox(c1).bottom() ) <= noise );
      if( cap ) c1.only_guess( 'P', 0 );
      }
    }

  // transform a capital 'Y' to a small 'y'
  for( int i = characters() - 1; i > big_initials(); --i )
    {
    Character & c1 = character( i - 1 );
    if( c1.guesses() == 1 && c1.guess( 0 ).code == 'Y' )
      {
      Character & c2 = character( i );
      if( !c2.guesses() ) continue;
      int code = c2.guess( 0 ).code;
      if( UCS::isalnum( code ) || code == '.' || code == '|' )
        {
        switch( code )
          {
          case 'g': case 'j': case 'p': case 'q': case 'y':
                    if( c1.bottom() < c2.bottom() - 2 ) continue; break;
          case 'Q': if( c1.top() < c2.top() + 2 ) continue; break;
          default : if( c1.bottom() < c2.bottom() + 2 ) continue;
          }
        c1.only_guess( 'y', 0 );
        }
      }
    }

  // transform a SSCEDI to a CSCEDI
  if( charset.enabled( Charset::iso_8859_9 ) )
    for( int i = big_initials(); i < characters(); ++i )
      {
      Character & c = character( i );
      if( c.guesses() == 1 && c.guess( 0 ).code == UCS::SSCEDI )
        {
        if( i > big_initials() && character( i - 1 ).guesses() )
          {
          Character & c1 = character( i - 1 );
          int code = c1.guess( 0 ).code;
          if( ( UCS::islower( code ) && c.top() < c1.top() - 2 ) ||
              ( UCS::base_letter( code ) && code != UCS::SINODOT &&
                Ocrad::similar( c.top(), c1.top(), 10 ) ) )
            { c.insert_guess( 0, UCS::CSCEDI, 1 ); continue; }
          }
        if( i < characters() - 1 && character( i + 1 ).guesses() )
          {
          Character & c1 = character( i + 1 );
          int code = c1.guess( 0 ).code;
          if( ( UCS::islower( code ) && c.top() < c1.top() - 2 ) ||
              ( UCS::base_letter( code ) && code != UCS::SINODOT &&
                Ocrad::similar( c.top(), c1.top(), 10 ) ) )
            { c.insert_guess( 0, UCS::CSCEDI, 1 ); continue; }
          }
        }
      }

  // transform words like 'lO.OOO' into numbers like '10.000'
  for( int begin = big_initials(), end = begin; begin < characters(); begin = end + 1 )
    {
    end = find_space_or_hyphen( cpv, begin );
    if( end - begin < 2 ) continue;
    Character & c1 = character( begin );
    if( !c1.guesses() ) continue;
    int height = c1.height();
    int code = c1.guess( 0 ).code;
    if( UCS::isdigit( code ) || code == 'l' || code == 'O' || code == 'o' )
      {
      int digits = 1;
      int i = begin + 1;
      for( ; i < end; ++i )
        {
        Character & c = character( i );
        if( !c.guesses() ) break;
        bool valid = false;
        int code = c.guess( 0 ).code;
        if( ( UCS::isdigit( code ) || code == 'l' || code == 'O' || code == 'o' ) &&
            Ocrad::similar( c.height(), height, 10 ) )
          { valid = true; ++digits; }
        if( code == '.' || code == ',' || code == ':' || code == '+' || code == '-' )
          valid = true;
        if( !valid ) break;
        }
      if( i >= end && digits >= 2 )
        for( i = begin; i < end; ++i )
        {
        Character & c = character( i );
        int code = c.guess( 0 ).code;
        if( code == 'l' ) code = '1';
        else if( code == 'O' || code == 'o' ) code = '0';
        else code = 0;
        if( code ) c.insert_guess( 0, code, c.guess( 0 ).value + 1 );
        }
      }
    }

  // detects Roman numerals 'II', 'III' and 'IIII'
  for( int begin = big_initials(), end = begin; begin < characters(); begin = end + 1 )
    {
    end = find_space_or_hyphen( cpv, begin );
    if( end - begin < 2 || end - begin > 4 ) continue;
    const int height = character( begin ).height();
    int i;
    for( i = begin; i < end; ++i )
      {
      Character & c = character( i );
      if( !c.maybe('|') || !Ocrad::similar( c.height(), height, 10 ) ) break;
      }
    if( i >= end )
      for( i = begin; i < end; ++i )
        {
        Character & c = character( i );
        if( !character(i).maybe('I') )
          c.insert_guess( 0, 'I', c.guess( 0 ).value + 1 );
        }
    }

  // choose between 'a' and 'Q'
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( c.guesses() == 2 &&
        c.guess( 0 ).code == 'a' && c.guess( 1 ).code == 'Q' )
      {
      if( 4 * c.height() > 5 * mean_height() )
        { c.swap_guesses( 0, 1 ); check_lower_ambiguous(); continue; }
      if( i < characters() - 1 && character( i + 1 ).guesses() )
        {
        const int code = character( i + 1 ).guess( 0 ).code;
        if( ( UCS::ishigh( code ) ) &&
            10 * c.height() > 9 * character( i + 1 ).height() )
          { c.swap_guesses( 0, 1 ); check_lower_ambiguous(); continue; }
        }
      if( i > big_initials() && character( i - 1 ).guesses() )
        {
        const int code = character( i - 1 ).guess( 0 ).code;
        if( ( UCS::ishigh( code ) ) &&
            10 * c.height() > 9 * character( i - 1 ).height() )
          { c.swap_guesses( 0, 1 ); check_lower_ambiguous(); }
        }
      }
    }

  // transform a vertical bar into 'l' or 'I' (or a 'l' into an 'I')
  for( int i = big_initials(); i < characters(); ++i )
    {
    Character & c = character( i );
    if( c.guesses() != 1 ) continue;
    int code = c.guess( 0 ).code;
    if( code == '|' || code == 'l' )
      {
      int lcode = 0, rcode = 0;
      if( i > 0 && character( i - 1 ).guesses() )
        lcode = character( i - 1 ).guess( 0 ).code;
      if( i < characters() - 1 && character( i + 1 ).guesses() )
        rcode = character( i + 1 ).guess( 0 ).code;
      if( ( UCS::isupper( rcode ) || UCS::isdigit( rcode ) ) &&
          ( !lcode || UCS::isupper( lcode ) || !UCS::isalnum( lcode ) ) )
        { c.insert_guess( 0, 'I', 1 ); continue; }
      if( code == 'l' ) continue;
      if( UCS::isalpha( lcode ) || UCS::isalpha( rcode ) )
        { c.insert_guess( 0, 'l', 1 ); continue; }
      if( rcode == '|' && ( !lcode || !UCS::isalnum( lcode ) ) )
        {
        if( i < characters() - 2 && character( i + 2 ).guesses() &&
            UCS::isalpha( character( i + 2 ).guess( 0 ).code ) )
          { c.insert_guess( 0, 'l', 1 ); continue; }
        if( i >= 2 && character( i - 2 ).guesses() &&
            UCS::isalpha( character( i - 2 ).guess( 0 ).code ) )
          { c.insert_guess( 0, 'l', 1 ); continue; }
        }
      }
    }

  // transform a vertical bar into 'I' at end of word
  for( int begin = big_initials(), end = begin; begin < characters(); begin = end + 1 )
    {
    end = find_space_or_hyphen( cpv, begin );
    if( end - begin < 3 ) continue;
    Character & ce = character( end - 1 );
    if( !ce.maybe('|') || ce.maybe('I') ) continue;
    const int height = ce.height();
    int i;
    for( i = begin; i < end - 1; ++i )
      {
      const Character & c = character( i );
      if( !c.guesses() ) break;
      const int code = c.guess( 0 ).code;
      if( ( !UCS::isupper( code ) && !UCS::isdigit( code ) ) ||
          !Ocrad::similar( c.height(), height, 10 ) ) break;
      }
    if( i >= end - 1 )
      ce.insert_guess( 0, 'I', ce.guess( 0 ).value + 1 );
    }

  // transform 'l' or '|' into UCS::SINODOT
  if( charset.enabled( Charset::iso_8859_9 ) )
  for( int i = big_initials(), begin = i; i < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.maybe(' ') ) { begin = i + 1 ; continue; }
    if( c1.guesses() )
      {
      int code = c1.guess( 0 ).code;
      if( code != 'l' && code != '|' ) continue;
      if( 4 * c1.height() > 5 * mean_height() ) continue;
      if( 5 * c1.height() < 4 * mean_height() )
        { c1.only_guess( UCS::SINODOT, 0 ); continue; }
      bool capital = false, small = false;
      for( int j = begin; j < characters(); ++j ) if( j != i )
        {
        Character & c2 = character( j );
        if( c2.maybe(' ') ) break;
        if( !c2.guesses() ) continue;
        int code2 = c2.guess( 0 ).code;
        if( code2 >= 128 || !std::isalpha( code2 ) ) continue;
        if( !capital )
          {
          if( 4 * c1.height() > 5 * c2.height() ) capital = true;
          else if( std::isupper( code2 ) && code2 != 'B' && code2 != 'Q' &&
                   ( c1.height() >= c2.height() ||
                     Ocrad::similar( c1.height(), c2.height(), 10 ) ) )
            capital = true;
          }
        if( !small && std::islower( code2 ) &&  code2 != 'l' )
          {
          if( 5 * c1.height() < 4 * c2.height() ) small = true;
          else if( UCS::islower_small( code2 ) &&
                   ( j < i || !UCS::islower_small_ambiguous( code2 ) ) &&
                   Ocrad::similar( c1.height(), c2.height(), 10 ) )
            small = true;
          }
        }
      if( !capital && small ) c1.insert_guess( 0, UCS::SINODOT, 1 );
      }
    }

  // join two adjacent single quotes into a double quote
  for( int i = big_initials(); i < characters() - 1; ++i )
    {
    Character & c1 = character( i );
    Character & c2 = character( i + 1 );
    if( c1.guesses() == 1 && c2.guesses() == 1 )
      {
      int code1 = c1.guess( 0 ).code;
      int code2 = c2.guess( 0 ).code;
      if( ( code1 == '\'' || code1 == '`' ) && code1 == code2 &&
          2 * ( c2.left() - c1.right() ) < 3 * c1.width() )
        { c1.join( c2 ); c1.only_guess( '"', 0 ); delete_character( i + 1 ); }
      }
    }

  // join a comma followed by a period into a semicolon
  for( int i = big_initials(); i < characters() - 1; ++i )
    {
    Character & c1 = character( i );
    Character & c2 = character( i + 1 );
    if( c1.guesses() == 1 && c2.guesses() == 1 )
      {
      int code1 = c1.guess( 0 ).code;
      int code2 = c2.guess( 0 ).code;
      if( code1 == ',' && code2 == '.' && c1.top() > c2.bottom() &&
          c2.left() - c1.right() < c2.width() )
        { c1.join( c2 ); c1.only_guess( ';', 0 ); delete_character( i + 1 ); }
      }
    }

  // choose between '.' and '-'
  if( characters() >= 2 )
    {
    Character & c = character( characters() - 1 );
    if( c.guesses() >= 2 &&
        c.guess( 0 ).code == '.' && c.guess( 1 ).code == '-' )
      {
      const Character & lc = character( characters() - 2 );
      if( lc.guesses() && UCS::isalpha( lc.guess( 0 ).code ) )
        c.swap_guesses( 0, 1 );
      }
    }

  // join a 'n' followed by a 'I' into a 'm'
  for( int i = big_initials(); i < characters() - 1; ++i )
    {
    Character & c1 = character( i );
    Character & c2 = character( i + 1 );
    if( c1.guesses() == 1 && c2.guesses() == 1 )
      {
      int code1 = c1.guess( 0 ).code;
      int code2 = c2.guess( 0 ).code;
      if( code1 == 'n' && ( code2 == 'I' || code2 == 'l' ) &&
          Ocrad::similar( c1.height(), c2.height(), 10 ) &&
          c2.left() - c1.right() < c2.width() )
        { c1.join( c2 ); c1.only_guess( 'm', 0 ); delete_character( i + 1 ); }
      }
    }

  // join the secuence '°', '/', 'o', ' ' into a '%'
  for( int i = big_initials(); i + 2 < characters(); ++i )
    {
    Character & c1 = character( i );
    if( c1.guesses() == 1 && c1.guess( 0 ).code == UCS::DEG )
      {
      if( character( i + 1 ).maybe('/') &&
          character( i + 2 ).maybe('o') &&
          ( i + 3 >= characters() || character( i + 3 ).maybe(' ') ) )
        {
        c1.join( character( i + 1 ) ); c1.join( character( i + 2 ) );
        delete_character( i + 2 ); delete_character( i + 1 );
        c1.only_guess( '%', 0 );
        }
      }
    }

  }
