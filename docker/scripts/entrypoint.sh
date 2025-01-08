#!/bin/sh

if [ -n "$DEP" ]
then
    if [ "$DEP" = "testing" ]
    then
        /scripts/testing.sh
    fi
fi

if [ -z "$REPO" ]
then
    /bin/bash
    exit $?;
fi

# Clone the git repo
git clone "$REPO" /home/user/pkg && \
cd /home/user/pkg && \
sudo pacman -Syu --noconfirm --noprogressbar &&\
makepkg -smf --noconfirm --noprogressbar --skippgpcheck --noarchive
exit $?;
