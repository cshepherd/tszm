#!/bin/bash
cat << 'EOF'
ZORK I: The Great Underground Empire
Copyright (c) 1981, 1982, 1983 Infocom, Inc. All rights reserved.
ZORK is a registered trademark of Infocom, Inc.
Revision 88 / Serial number 840726
EOF

cat west-of-house.sixel
cat << 'EOF'
West of House
You are standing in an open field west of a white house, with a boarded front door.
There is a small mailbox here.
EOF

echo ">w"
cat forest.sixel
cat << 'EOF'
Forest
This is a forest, with trees in all directions. To the east, there appears to be sunlight.

>
EOF