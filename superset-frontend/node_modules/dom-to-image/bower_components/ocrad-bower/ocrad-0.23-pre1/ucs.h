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

namespace UCS {

enum { IEXCLAM = 0x00A1,	// inverted exclamation mark
       COPY    = 0x00A9,	// copyright sign
       FEMIORD = 0x00AA,	// feminine ordinal indicator
       LDANGLE = 0x00AB,	// left-pointing double angle quotation mark
       NOT     = 0x00AC,	// not sign
       REG     = 0x00AE,	// registered sign
       DEG     = 0x00B0,	// degree sign
       PLUSMIN = 0x00B1,	// plus-minus sign
       POW2    = 0x00B2,	// superscript two
       POW3    = 0x00B3,	// superscript three
       MICRO   = 0x00B5,	// micro sign
       PILCROW = 0x00B6,	// pilcrow sign
       MIDDOT  = 0x00B7,	// middle dot
       POW1    = 0x00B9,	// superscript one
       MASCORD = 0x00BA,	// masculine ordinal indicator
       RDANGLE = 0x00BB,	// right-pointing double angle quotation mark
       IQUEST  = 0x00BF,	// inverted question mark
       CAGRAVE = 0x00C0,	// latin capital letter a with grave
       CAACUTE = 0x00C1,	// latin capital letter a with acute
       CACIRCU = 0x00C2,	// latin capital letter a with circumflex
       CATILDE = 0x00C3,	// latin capital letter a with tilde
       CADIAER = 0x00C4,	// latin capital letter a with diaeresis
       CARING  = 0x00C5,	// latin capital letter a with ring above
       CCCEDI  = 0x00C7,	// latin capital letter c with cedilla
       CEGRAVE = 0x00C8,	// latin capital letter e with grave
       CEACUTE = 0x00C9,	// latin capital letter e with acute
       CECIRCU = 0x00CA,	// latin capital letter e with circumflex
       CEDIAER = 0x00CB,	// latin capital letter e with diaeresis
       CIGRAVE = 0x00CC,	// latin capital letter i with grave
       CIACUTE = 0x00CD,	// latin capital letter i with acute
       CICIRCU = 0x00CE,	// latin capital letter i with circumflex
       CIDIAER = 0x00CF,	// latin capital letter i with diaeresis
       CNTILDE = 0x00D1,	// latin capital letter n with tilde
       COGRAVE = 0x00D2,	// latin capital letter o with grave
       COACUTE = 0x00D3,	// latin capital letter o with acute
       COCIRCU = 0x00D4,	// latin capital letter o with circumflex
       COTILDE = 0x00D5,	// latin capital letter o with tilde
       CODIAER = 0x00D6,	// latin capital letter o with diaeresis
       CUGRAVE = 0x00D9,	// latin capital letter u with grave
       CUACUTE = 0x00DA,	// latin capital letter u with acute
       CUCIRCU = 0x00DB,	// latin capital letter u with circumflex
       CUDIAER = 0x00DC,	// latin capital letter u with diaeresis
       CYACUTE = 0x00DD,	// latin capital letter y with acute
       SSSHARP = 0x00DF,	// latin small letter sharp s (german)
       SAGRAVE = 0x00E0,	// latin small letter a with grave
       SAACUTE = 0x00E1,	// latin small letter a with acute
       SACIRCU = 0x00E2,	// latin small letter a with circumflex
       SATILDE = 0x00E3,	// latin small letter a with tilde
       SADIAER = 0x00E4,	// latin small letter a with diaeresis
       SARING  = 0x00E5,	// latin small letter a with ring above
       SCCEDI  = 0x00E7,	// latin small letter c with cedilla
       SEGRAVE = 0x00E8,	// latin small letter e with grave
       SEACUTE = 0x00E9,	// latin small letter e with acute
       SECIRCU = 0x00EA,	// latin small letter e with circumflex
       SEDIAER = 0x00EB,	// latin small letter e with diaeresis
       SIGRAVE = 0x00EC,	// latin small letter i with grave
       SIACUTE = 0x00ED,	// latin small letter i with acute
       SICIRCU = 0x00EE,	// latin small letter i with circumflex
       SIDIAER = 0x00EF,	// latin small letter i with diaeresis
       SNTILDE = 0x00F1,	// latin small letter n with tilde
       SOGRAVE = 0x00F2,	// latin small letter o with grave
       SOACUTE = 0x00F3,	// latin small letter o with acute
       SOCIRCU = 0x00F4,	// latin small letter o with circumflex
       SOTILDE = 0x00F5,	// latin small letter o with tilde
       SODIAER = 0x00F6,	// latin small letter o with diaeresis
       DIV     = 0x00F7,	// division sign
       SUGRAVE = 0x00F9,	// latin small letter u with grave
       SUACUTE = 0x00FA,	// latin small letter u with acute
       SUCIRCU = 0x00FB,	// latin small letter u with circumflex
       SUDIAER = 0x00FC,	// latin small letter u with diaeresis
       SYACUTE = 0x00FD,	// latin small letter y with acute
       SYDIAER = 0x00FF,	// latin small letter y with diaeresis
       CGBREVE = 0X011E,	// latin capital letter g with breve
       SGBREVE = 0x011F,	// latin small letter g with breve
       CIDOT   = 0x0130,	// latin capital letter i with dot above
       SINODOT = 0x0131,	// latin small letter i dotless
       CSCEDI  = 0x015E,	// latin capital letter s with cedilla
       SSCEDI  = 0x015F,	// latin small letter s with cedilla
       CSCARON = 0x0160,	// latin capital letter s with caron
       SSCARON = 0x0161,	// latin small letter s with caron
       CZCARON = 0x017D,	// latin capital letter z with caron
       SZCARON = 0x017E,	// latin small letter z with caron
       EURO    = 0x20AC 	// symbole euro
       };

int base_letter( const int code );
int compose( const int letter, const int accent );
bool isalnum( const int code );
bool isalpha( const int code );
bool isdigit( const int code );
bool ishigh( const int code );			// high chars like "A1bp|"
bool islower( const int code );
bool islower_ambiguous( const int code );
bool islower_small( const int code );
bool islower_small_ambiguous( const int code );
bool isspace( const int code );
bool isupper( const int code );
bool isvowel( int code );
unsigned char map_to_byte( const int code );
const char * ucs_to_utf8( const int code );
int to_nearest_digit( const int code );
int to_nearest_letter( const int code );
int toupper( const int code );

} // end namespace UCS
