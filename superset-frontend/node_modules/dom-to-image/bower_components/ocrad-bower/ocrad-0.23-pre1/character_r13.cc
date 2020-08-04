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

#include "common.h"
#include "rectangle.h"
#include "segment.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "profile.h"
#include "feats.h"


// Recognizes 3 blob characters.
// %ÄËÏÖÜäëïöüÿ÷
//
void Character::recognize13( const Charset & charset, const Rectangle & charbox )
  {
  const Blob & b1 = blob( 0 );
  const Blob & b2 = blob( 1 );
  const Blob & b3 = blob( 2 );		// lower blob
  Character c( new Blob( b3 ) );
  int code = 0;

  c.recognize1( charset, charbox );
  if( c.guesses() )
    {
    if( c.maybe('.') ||
        ( c.height() < 2 * c.width() && c.maybe(',') && 2 * b3.area() >= b3.size() ) )
      {
      if( b1.bottom() <= b2.top() && b2.bottom() <= b3.top() )
        { if( b2.width() >= 2 * b2.height() ) code = UCS::DIV; }
      else if( b1.top() < b3.top() && b2.top() < b3.top() )
        code = '%';
      }
    else if( std::max( b1.width(), b2.width() ) < b3.width() &&
             Ocrad::similar( b1.height(), b2.height(), 20, 2 ) &&
             2 * std::max( b1.height(), b2.height() ) < b3.height() )
      code = UCS::compose( c.guess( 0 ).code, ':' );
    else if( c.maybe('o') )
      {
      if( ( b1.hcenter() < b2.hcenter() && b1.holes() == 1 && !b2.holes() ) ||
          ( b2.hcenter() < b1.hcenter() && b2.holes() == 1 && !b1.holes() ) )
        code = '%';
      }
    }
  if( charset.only( Charset::ascii ) )
    {
    if( code == UCS::DIV ) code = '%';
    else code = UCS::base_letter( code );
    }
  if( code ) add_guess( code, 0 );
  }
