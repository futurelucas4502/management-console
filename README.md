[![Build Status](https://travis-ci.com/futurelucas4502/management-console.svg?branch=master)](https://travis-ci.com/futurelucas4502/management-console)
# City of Truro Mariners - Management Console
A2 Computer Science coursework for the City of Truro Mariners Model Boat Club

API is closed source as it handles payments therefore has private keys etc

And yes my commit messages are canerous xD if I was working in a team they would be nicer but im only working on my own so it doesn't really matter

I know what I'm doing:tm:

## Documentation:

If your OS or architecture is not supported you can build the app for your OS as long as its supported by node and electron:

1. Install node.js: https://nodejs.org/en/download/
2. Clone or download the repository (if using zip extract the zip file)
3. Change into the folder that was cloned/extracted
4. Open a terminal and run `npm install`
5. Then run `npm build` for windows, or `npm run-script build` for linux or for macOS `npm run build`

On Linux you may get an error as keytar needs an additional dependency see [here](https://github.com/atom/node-keytar#on-linux).

6. Then change into the dist directory on windows you will have an exe, on mac a dmg and on linux an appimage file

### How to run the program:

* On Windows you can just run the exe
* On macOS you can run the dmg and install it (turns out thats a lie it will be fixed next monday (4th may as it's my b day therefore i'll be 18 and be able to use an apple dev license to code sign correctly))
* On linux you get an AppImage the idea is that an AppImage will work on any linux system whether it runs with debian or not it works like a portable application that doesnt get installed and to run it you must do this (below is an example for version 1.0.26 on arm64):
    1. Give the AppImage the correct permissions like so (this only needs to be done once on the file) `sudo chmod a+x ./The\ City\ Of\ Truro\ Mariners\ -\ Management\ Console-1.0.26-arm64.AppImage`
    2. Then run this `./The\ City\ Of\ Truro\ Mariners\ -\ Management\ Console-1.0.26-arm64.AppImage --no-sandbox`

### To create a desktop shortcut on Linux do this:

1. Move the AppImage to anywhere you want it. (in this example it will be in the same folder as the shortcut)
2. Next open terminal and run `>Management-Console.sh`
3. Open the file using `sudo nano Management-Console.sh`
4. Copy paste this code: <br />
`#!/bin/bash` <br />
`./The\ City\ Of\ Truro\ Mariners\ -\ Management\ Console-1.0.26-arm64.AppImage --no-sandbox` <br />
(example for version 1.0.26 on arm64) <br />
5. Then save by pressing ctrl+x then y then enter
6. Then visit [here](https://askubuntu.com/a/305776) to learn how to make the file run by double clicking or if on ubuntu and using gnome run `gsettings set org.gnome.nautilus.preferences executable-text-activation 'launch'`
7. Then right click on Management-Console.sh go to the permissons tab and mark it as executable
8. Double-click and enjoy!

## Contact Details:

Lucas Wilson <lucaswilson4502@outlook.com>
