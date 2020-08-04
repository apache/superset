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

class Textblock;

class Textpage : public Rectangle
  {
  const std::string name;
  std::vector< Textblock * > tbpv;

  Textpage( const Textpage & );			// declared as private
  void operator=( const Textpage & );		// declared as private

public:
  Textpage( const Page_image & page_image, const char * const filename,
            const Control & control, const bool layout );
  ~Textpage();

  const Textblock & textblock( const int i ) const;
  int textblocks() const { return tbpv.size(); }
  int textlines() const;
  int characters() const;

  void print( const Control & control ) const;
  void xprint( const Control & control ) const;
  };
