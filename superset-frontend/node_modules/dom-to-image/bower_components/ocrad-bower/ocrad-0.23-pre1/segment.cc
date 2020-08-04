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

#include <climits>

#include "segment.h"


void Csegment::add_point( const int col )
  {
  if( !valid() ) left = right = col;
  else if( col < left ) left = col;
  else if( col > right ) right = col;
  }


void Csegment::add_csegment( const Csegment & seg )
  {
  if( seg.valid() )
    {
    if( !valid() ) *this = seg;
    else
      {
      if( seg.left < left ) left = seg.left;
      if( seg.right > right ) right = seg.right;
      }
    }
  }


int Csegment::distance( const Csegment & seg ) const
  {
  if( !valid() || !seg.valid() ) return INT_MAX;
  if( seg.right < left ) return left - seg.right;
  if( seg.left > right ) return seg.left - right;
  return 0;
  }


int Csegment::distance( const int col ) const
  {
  if( !valid() ) return INT_MAX;
  if( col < left ) return left - col;
  if( col > right ) return col - right;
  return 0;
  }
