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

#include <cctype>

#include "ucs.h"


int UCS::base_letter( const int code )
  {
  switch( code )
    {
    case CAGRAVE:
    case CAACUTE:
    case CACIRCU:
    case CATILDE:
    case CADIAER:
    case CARING : return 'A';
    case CCCEDI : return 'C';
    case CEGRAVE:
    case CEACUTE:
    case CECIRCU:
    case CEDIAER: return 'E';
    case CGBREVE: return 'G';
    case CIGRAVE:
    case CIACUTE:
    case CICIRCU:
    case CIDIAER:
    case CIDOT  : return 'I';
    case CNTILDE: return 'N';
    case COGRAVE:
    case COACUTE:
    case COCIRCU:
    case COTILDE:
    case CODIAER: return 'O';
    case CSCEDI : return 'S';
    case CUGRAVE:
    case CUACUTE:
    case CUCIRCU:
    case CUDIAER: return 'U';
    case CYACUTE: return 'Y';
    case SAGRAVE:
    case SAACUTE:
    case SACIRCU:
    case SATILDE:
    case SADIAER:
    case SARING : return 'a';
    case SCCEDI : return 'c';
    case SEGRAVE:
    case SEACUTE:
    case SECIRCU:
    case SEDIAER: return 'e';
    case SGBREVE: return 'g';
    case SIGRAVE:
    case SIACUTE:
    case SICIRCU:
    case SIDIAER:
    case SINODOT: return 'i';
    case SNTILDE: return 'n';
    case SOGRAVE:
    case SOACUTE:
    case SOCIRCU:
    case SOTILDE:
    case SODIAER: return 'o';
    case SSCEDI : return 's';
    case SUGRAVE:
    case SUACUTE:
    case SUCIRCU:
    case SUDIAER: return 'u';
    case SYACUTE:
    case SYDIAER: return 'y';
    default:      return 0;
    }
  }


int UCS::compose( const int letter, const int accent )
  {
  switch( letter )
    {
    case 'A': if( accent == '\'') return CAACUTE;
              if( accent == '`' ) return CAGRAVE;
              if( accent == '^' ) return CACIRCU;
              if( accent == ':' ) return CADIAER; break;
    case 'E': if( accent == '\'') return CEACUTE;
              if( accent == '`' ) return CEGRAVE;
              if( accent == '^' ) return CECIRCU;
              if( accent == ':' ) return CEDIAER; break;
    case 'G': return CGBREVE;
    case '[':
    case 'I': if( accent == '\'') return CIACUTE;
              if( accent == '`' ) return CIGRAVE;
              if( accent == '^' ) return CICIRCU;
              if( accent == ':' ) return CIDIAER; break;
    case 'N': if( accent != ':' ) return CNTILDE; break;
    case 'O': if( accent == '\'') return COACUTE;
              if( accent == '`' ) return COGRAVE;
              if( accent == '^' ) return COCIRCU;
              if( accent == ':' ) return CODIAER; break;
    case 'S': return CSCARON;
    case 'U':
    case 'V': if( accent == '\'') return CUACUTE;
              if( accent == '`' ) return CUGRAVE;
              if( accent == '^' ) return CUCIRCU;
              if( accent == ':' ) return CUDIAER; break;
    case 'Z': return CZCARON;
    case 'a': if( accent == '\'') return SAACUTE;
              if( accent == '`' ) return SAGRAVE;
              if( accent == '^' ) return SACIRCU;
              if( accent == ':' ) return SADIAER; break;
    case 'e': if( accent == '\'') return SEACUTE;
              if( accent == '`' ) return SEGRAVE;
              if( accent == '^' ) return SECIRCU;
              if( accent == ':' ) return SEDIAER; break;
    case '9':
    case 'g': return SGBREVE;
    case '|':
    case ']':
    case 'i':
    case 'l': if( accent == '\'') return SIACUTE;
              if( accent == '`' ) return SIGRAVE;
              if( accent == '^' ) return SICIRCU;
              if( accent == ':' ) return SIDIAER; break;
    case 'n': if( accent != ':' ) return SNTILDE; break;
    case 'o': if( accent == '\'') return SOACUTE;
              if( accent == '`' ) return SOGRAVE;
              if( accent == '^' ) return SOCIRCU;
              if( accent == ':' ) return SODIAER; break;
    case 's': return SSCARON;
    case 'u':
    case 'v': if( accent == '\'') return SUACUTE;
              if( accent == '`' ) return SUGRAVE;
              if( accent == '^' ) return SUCIRCU;
              if( accent == ':' ) return SUDIAER; break;
    case 'y': if( accent == '\'') return SYACUTE;
              if( accent == ':' ) return SYDIAER; break;
    case 'z': return SZCARON;
    }
  return 0;
  }


bool UCS::isalnum( const int code )
  {
  return ( UCS::isalpha( code ) || UCS::isdigit( code ) );
  }


bool UCS::isalpha( const int code )
  {
  return ( ( code < 128 && std::isalpha( code ) ) || base_letter( code ) );
  }


bool UCS::isdigit( const int code )
  {
  return ( code <= '9' && code >= '0' );
  }


bool UCS::ishigh( const int code )
  {
  if( isupper( code ) || isdigit( code ) ) return true;
  switch( code )
    {
    case 'b': case 'd': case 'f': case 'g': case 'h': case 'i': case 'j':
    case 'k': case 'l': case 'p': case 'q': case 't': case 'y': case '|':
      return true;
    default : return false;
    }
  }


bool UCS::islower( const int code )
  {
  if( code < 128 && std::islower( code ) ) return true;
  const int base = base_letter( code );
  return ( base && std::islower( base ) );
  }


bool UCS::islower_ambiguous( const int code )
  {
  if( islower_small_ambiguous( code ) ) return true;
  switch( code )
    {
    case 'k': case 'p': case SCCEDI:
    case SIGRAVE: case SIACUTE: case SICIRCU: case SIDIAER:
    case SOGRAVE: case SOACUTE: case SOCIRCU: case SOTILDE: case SODIAER:
    case SUGRAVE: case SUACUTE: case SUCIRCU: case SUDIAER:
    case  SSCEDI: case SSCARON: case SZCARON:
      return true;
    default : return false;
    }
  }


bool UCS::islower_small( const int code )
  {
  if( code >= 128 || !std::islower( code ) ) return false;
  switch( code )
    {
    case 'a': case 'c': case 'e': case 'm': case 'n': case 'o':
    case 'r': case 's': case 'u': case 'v': case 'w': case 'x':
    case 'z': return true;
    default : return false;
    }
  }


bool UCS::islower_small_ambiguous( const int code )
  {
  if( code >= 128 || !std::islower( code ) ) return false;
  switch( code )
    {
    case 'c': case 'o': case 's': case 'u': case 'v': case 'w':
    case 'x': case 'z': return true;
    default : return false;
    }
  }


bool UCS::isspace( const int code )
  {
  return ( code < 128 && std::isspace( code ) );
  }


bool UCS::isupper( const int code )
  {
  if( code < 128 && std::isupper( code ) ) return true;
  const int base = base_letter( code );
  return ( base && std::isupper( base ) );
  }


bool UCS::isvowel( int code )
  {
  if( code >= 128 ) code = base_letter( code );
  if( !code || !std::isalpha( code ) ) return false;
  code = std::tolower( code );
  return ( code == 'a' || code == 'e' || code == 'i' ||
           code == 'o' || code == 'u' );
  }


unsigned char UCS::map_to_byte( const int code )
  {
  if( code < 0 ) return 0;
  if( code < 256 ) return code;
  switch( code )
    {
    case CGBREVE: return 0xD0;
    case SGBREVE: return 0xF0;
    case CIDOT  : return 0xDD;
    case SINODOT: return 0xFD;
    case CSCEDI : return 0xDE;
    case SSCEDI : return 0xFE;
    case CSCARON: return 0xA6;
    case SSCARON: return 0xA8;
    case CZCARON: return 0xB4;
    case SZCARON: return 0xB8;
    case EURO   : return 0xA4;
    default     : return 0;
    }
  }


const char * UCS::ucs_to_utf8( const int code )
  {
  static char s[7];

  if( code < 0 || code > 0x7FFFFFFF ) { s[0] = 0; return s; } // invalid code
  if( code < 128 ) { s[0] = code; s[1] = 0; return s; }       // plain ascii

  int i, mask;
  if( code < 0x800 ) { i = 2; mask = 0xC0; }		// 110X XXXX
  else if( code < 0x10000 ) { i = 3; mask = 0xE0; }	// 1110 XXXX
  else if( code < 0x200000 ) { i = 4; mask = 0xF0; }	// 1111 0XXX
  else if( code < 0x4000000 ) { i = 5; mask = 0xF8; }	// 1111 10XX
  else { i = 6; mask = 0xFC; }				// 1111 110X

  s[i] = 0; --i;
  int d = 0;
  for( ; i > 0; --i, d+=6 )
    s[i] = 0x80 | ( ( code >> d ) & 0x3F );		// 10XX XXXX
  s[0] = mask | ( code >> d );
  return s;
  }


int UCS::to_nearest_digit( const int code )
  {
  switch( code )
    {
    case 'O':
    case 'Q':
    case 'o':     return '0';
    case '|':
    case 'I':
    case 'L':
    case 'l':
    case SINODOT: return '1';
    case 'Z':
    case 'z':     return '2';
    case 'A':
    case 'q':     return '4';
    case 'S':
    case 's':     return '5';
    case 'G':
    case 'b':
    case SOACUTE: return '6';
    case 'J':
    case 'T':     return '7';
    case '&':
    case 'B':     return '8';
    case 'g':     return '9';
    default:      return code;
    }
  }


int UCS::to_nearest_letter( const int code )
  {
  switch( code )
    {
    case '0': return 'O';
    case '1': return 'l';
    case '2': return 'Z';
    case '4': return 'q';
    case '5': return 'S';
    case '6': return SOACUTE;
    case '7': return 'I';
    case '8': return 'B';
    case '9': return 'g';
    default:  return code;
    }
  }


int UCS::toupper( const int code )
  {
  if( code < 128 ) return std::toupper( code );
  switch( code )
    {
    case SAGRAVE: return CAGRAVE;
    case SAACUTE: return CAACUTE;
    case SACIRCU: return CACIRCU;
    case SATILDE: return CATILDE;
    case SADIAER: return CADIAER;
    case SARING : return CARING;
    case SCCEDI : return CCCEDI;
    case SEGRAVE: return CEGRAVE;
    case SEACUTE: return CEACUTE;
    case SECIRCU: return CECIRCU;
    case SEDIAER: return CEDIAER;
    case SGBREVE: return CGBREVE;
    case SIGRAVE: return CIGRAVE;
    case SIACUTE: return CIACUTE;
    case SICIRCU: return CICIRCU;
    case SIDIAER: return CIDIAER;
    case SNTILDE: return CNTILDE;
    case SOGRAVE: return COGRAVE;
    case SOACUTE: return COACUTE;
    case SOCIRCU: return COCIRCU;
    case SOTILDE: return COTILDE;
    case SODIAER: return CODIAER;
    case SSCEDI : return CSCEDI;
    case SUGRAVE: return CUGRAVE;
    case SUACUTE: return CUACUTE;
    case SUCIRCU: return CUCIRCU;
    case SUDIAER: return CUDIAER;
    case SYACUTE: return CYACUTE;
    default:      return code;
    }
  }
