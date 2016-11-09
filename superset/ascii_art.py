from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

error = (
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM8OI++=~~~~~~=+?IODMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMD$~~~~~~~~~~~~~~~~~~~~~~~=$MMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMN8?:~~~~~~~~~~~~~~~~~~~~~~~~~~=+8NMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMO=~~~~~~~~~~~~~~~~~+I??~~~~~~~~~~~~~+DMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMNI~~~~~~~~~~~~~~~~~~IIIII=~~~~~~~~~~~~~~=NMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMM+=~~~~~~~~~~~~~~~~~~~=III+~~~~~~~~~~~~~~~~~?8MMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMM?~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+++=~~~~8MMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMI=~~~~~~~~~~~~~~~~~~~~~~~~~III?I~~~~~~~~,:++++++~~8MMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMN7~~~~~~~~~~~~~~~~==+=~~~~~~=IIIII~~~~~~:.  ..:=++=~=MMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMO=~~~~~~~~~~~~~~~~+++=~~~~~~~~??I?I~~~~~~.     ...,~~~~IMMMMMMMMMMMMM\n"+
"MMMMMMMMMMM~~~~~~~~~~~~~~~~~+++:,~~~~~~~~~~~?=~~~~~:.       ..~~~~~OMMMMMMMMMMMM\n"+
"MMMMMMMMM$=~~~~~~~~~~~~~~~=++:.. ..~~~~~~~~~~~~~~~~,.     . . :~~~~~OMMMMMMMMMMM\n"+
"MMMMMMMMM~~~~~~~~~~~~~~~~+++,.     .~~~~~~~~~~~~~~~..    .. . .~~~~~=OMMMMMMMMMM\n"+
"MMMMMMMM?~~~~~~~~~~~~~~~=+~.        .~~~~~~~~~~~~~~.    ,MMMMM,=~~~~~~NMMMMMMMMM\n"+
"MMMMMMMN~~~~~~~~~~~~~~~~~,.         .,~~~~~~~~~~~~~..   ZMMM,+Z:~~~~~~$MMMMMMMMM\n"+
"MMMMMM8?~~~~~~~~~~~~~~~~~..         ..~~~~~~~~~~~~~:.   DMMM,+D~~~~~~~~IMMMMMMMM\n"+
"MMMMMMI~~~~~~~~~~~~~~~~~~..     :MMMO~~~~~~~~~~~~~~~,.. ?MMMMMI~~~~~~~~~MMMMMMMM\n"+
"MMMMMM=~~~~~~~~~~~~~~~~~~..     MMM+=M:~~~~~~~~~~~~~:.  .:IM$~~~~~~~~~~~8MMMMMMM\n"+
"MMMMMD~~~~~~~~~~~~~~~~~~~:.     MMM:,M:~~~~~~~~~~~~~~~.......:~~~~~~~~~~$MMMMMMM\n"+
"MMMMMI~~~~~~~~~~~~~~~~~~~~,     MMMMMM~~~~~~~~~~~~~~~~~~,..:~~~~~~~~~~~~+MMMMMMM\n"+
"MMMMD+~~~~~~~~~~~~~~~~~~~~~.    $MMMM$~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=MMMMMMM\n"+
"MMMM8~~~~~~~~~~~~~~~~~~~~~~:.    .  .:~~~~~~,..:.  .=~~~~~~~~~~~~~~~~~~~~MMMMMMM\n"+
"MMMMO~~~~~~~~~~~~~~~~~~~~~~~:,     .:~~~~~=8.. .+ . =8ZI~~~~~~~~~~~~~~~~=MMMMMMM\n"+
"MMMMZ=~~~~~~~~~~~~~~~~~~~~~~~~:,,,:~~~~~~IZ8:. .O....888?~~~~~~~~~~~~~~~+MMMMMMM\n"+
"MMMMO=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~?888=...I~I88888O?~~~~~~~~~~~~~~7MMMMMMM\n"+
"MMMMO~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Z888OO88888888888O?~~~~~~~~~~~~~OMMMMMMM\n"+
"MMMMD+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=8888888888888888888~~~~~~~~~~~~+MMMMMMMM\n"+
"MMMMM7~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~?8888888888888888888?~~~~~~~~~~=$MMMMMMMM\n"+
"MMMMMD~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=$8888888888888888888O~~~~~~~~~~8MMMMMMMMM\n"+
"MMMMMN=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+Z88888888888888888ZZ7=~~~~~~~~?MMMMMMMMMM\n"+
"MMMMMMZ=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+Z88888888Z7I===~~~~~~~~~~~~~=OMMMMMMMMMMM\n"+
"MMMMMMN$~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=$88888O7?=~~~~~~~~~~~~~~~~~~OMMMMMMMMMMMM\n"+
"MMMMMMMM?~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~I8OZ+~~~~~~~~~~~~~~~~~~~~=DMMMMMMMMMMMMMM\n"+
"MMMMMMMM8=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+$+=~~~~~~~~~~~~~~~~~~~~+MMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMD7~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=$DMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMM?~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=$OMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMD7=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+ZMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMZ7=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~78MMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMM8OI=~~~~~~~~~~~~~~~~~~~=+?ZDNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMNDZ7?++~=~==~+?IONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n"+
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM")

stacktrace="""
-------------------------------------------------------------------------------------------------------
=======================================================================================================
-------------------------------------------------------------------------------------------------------
             ___                          ___          ___
            (   )                        (   )        (   )
    .--.     | |_       .---.    .--.     | |   ___    | |_      ___ .-.      .---.    .--.      .--.
  /  _  \   (   __)    / .-, \  /    \    | |  (   )  (   __)   (   )   \    / .-, \  /    \    /    \\
 . .' `. ;   | |      (__) ; | |  .-. ;   | |  ' /     | |       | ' .-. ;  (__) ; | |  .-. ;  |  .-. ;
 | '   | |   | | ___    .'`  | |  |(___)  | |,' /      | | ___   |  / (___)   .'`  | |  |(___) |  | | |
 _\_`.(___)  | |(   )  / .'| | |  |       | .  '.      | |(   )  | |         / .'| | |  |      |  |/  |
(   ). '.    | | | |  | /  | | |  | ___   | | `. \     | | | |   | |        | /  | | |  | ___  |  ' _.'
 | |  `\ |   | ' | |  ; |  ; | |  '(   )  | |   \ \    | ' | |   | |        ; |  ; | |  '(   ) |  .'.-.
 ; '._,' '   ' `-' ;  ' `-'  | '  `-' |   | |    \ .   ' `-' ;   | |        ' `-'  | '  `-' |  '  `-' /
  '.___.'     `.__.   `.__.'_.  `.__,'   (___ ) (___)   `.__.   (___)       `.__.'_.  `.__,'    `.__.'

-------------------------------------------------------------------------------------------------------
=======================================================================================================
-------------------------------------------------------------------------------------------------------
"""

boat = """\
        + +
        )`.).
      )``)``) .~~
      ).-'.-')|)
    |-).-).-'_'-/
 ~~~\ `o-o-o'  /~~~~
  ~~~'---.____/~~~"""
