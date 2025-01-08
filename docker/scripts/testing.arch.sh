#!/bin/bash

# Enable the [core-testing] repository by uncommenting the relevant lines in the configuration file
sudo sed -i 's/^#\[core-testing\]/\[core-testing\]/' /etc/pacman.conf

# Enable the [extra-testing] repository by uncommenting the relevant lines in the configuration file
sudo sed -i 's/^#\[extra-testing\]/\[extra-testing\]/' /etc/pacman.conf

# Uncomment the 'Include = /etc/pacman.d/mirrorlist' line in the configuration file if necessary
sudo sed -i '/testing\]/{n;s/^#//}' /etc/pacman.conf

# Update the package list and upgrade the system
sudo pacman -Syu
