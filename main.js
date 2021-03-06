const { ipcMain, app, BrowserWindow, Menu, dialog, Notification, Tray, shell } = require('electron')
const path = require('path');
const { autoUpdater } = require('electron-updater');
const request = require('request');
const crypto = require('crypto');
const log = require('electron-log');
const ENC_KEY = "eb45707674371ce8259b2153c7b6a453"; // set random encryption key
const IV = "70cd8558247bed84"; // set random initialisation vector
// ENC_KEY and IV can be generated as crypto.randomBytes(32).toString('hex');
const isDev = require('electron-is-dev');
var connectionurl
var dialogOpen = false
const contextMenu = require('electron-context-menu');
const fs = require('fs');
const keytar = require('keytar');
var admincheck
var currentusername
var currentpassword
var messagesNotify
var notification
var messagesNotificationClick = false
// create an empty array
var array = [];
const gotTheLock = app.requestSingleInstanceLock()
const { exec } = require('child_process');


contextMenu({}); // Creates default right click menu

Menu.setApplicationMenu(null);
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let tray = null

autoUpdater.autoInstallOnAppQuit = true // only needed if using checkforupdates without notifying
autoUpdater.autoDownload = true

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      spellcheck: true
    }
  })

  if (process.platform === 'linux') win.setIcon(path.join(__dirname, "assets", "images", "icon-linux.png"))

  if (isDev) {
    // connectionurl = "http://localhost/my-app/" // Development
    connectionurl = "https://thecityoftruromariners.futurelucas4502.co.uk/" // For testing features specific to interaction with other users
    log.info('Running in development');
  } else {
    connectionurl = "https://thecityoftruromariners.futurelucas4502.co.uk/" // Release
    log.info('Running in production');
    // Runs auto updater
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })

  win.on('close', function (event) {
    event.preventDefault();
    win.hide();
    if (process.platform === 'darwin') {
      app.dock.hide()
    }
  });

  const createTray = () => {
    tray = new Tray(path.join(__dirname, 'assets', 'images', 'tray-icon.png'))
    tray.setToolTip("The City Of Truro Mariners - Management Console")
    tray.setContextMenu(Menu.buildFromTemplate([{
      label: 'Open', click: function () {
        win.show();
        if (process.platform === 'darwin') {
          app.dock.show()
        }
      }
    }, {
      label: 'Quit', click: function () {
        win.destroy()
        app.quit()
      }
    }]))
  }
  createTray()
  tray.on("click", (event, arg) => {
    win.show();
    if (process.platform === 'darwin') {
      app.dock.show()
    }
  })

  const monitorTray = () => {
    if (process.platform === 'linux') {


      /* Here we check if the screen has been locked and unlocked.
        If the monitor returns SCREEN_UNLOCKED, then that has to be our case
        And we destroy and recreate the tray
      */
      const monitor = exec(`
      dbus-monitor --session "type='signal',interface='org.gnome.ScreenSaver'" |
      while read x; do
      case "$x" in 
        *"boolean true"*) echo SCREEN_LOCKED;;
        *"boolean false"*) echo SCREEN_UNLOCKED;;  
      esac
      done
    `);

      monitor.stdout.on('data', (data) => {
        const out = data.toString().trim();
        if (out === 'SCREEN_UNLOCKED') {
          tray.destroy();
          createTray();
        }
      });
    }
  };

  monitorTray();

  var checkRemembered = keytar.findCredentials("The City Of Truro Mariners - Management Console")
  checkRemembered.then((result) => {
    if (result.length != 0) {
      currentusername = result[0].account
      currentpassword = result[0].password
      win.webContents.send("auto-login")
      request.post({ url: connectionurl, form: { formname: "login", username: currentusername, password: currentpassword, datetime: require('moment')().format('YYYY-MM-DD HH:mm:ss') } }, function (err, _, body) {
        if (err) {
          keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername)
          win.webContents.send("incorrect")
          if (!dialogOpen) {
            dialogOpen = true
            return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
              dialogOpen = false
            });
          }
        }
        if (body == "Incorrect") {
          keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername)
          return incorrect()
        }
        if (body == "Query Error") {
          keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername)
          win.webContents.send("incorrect")
          if (!dialogOpen) {
            dialogOpen = true
            return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
              dialogOpen = false
            });
          }
        }
        if (body == "1") {
          admincheck = true
        } else if (body == "0") {
          admincheck = false
        } else {
          keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername)
          win.webContents.send("incorrect")
          if (!dialogOpen) {
            dialogOpen = true
            return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Unknown Error', message: 'An unknown error eccured please check your internet connection or try and visit https://thecityoftruromariners.futurelucas4502.co.uk/ if it fails your service provider may be blocking us if however you can connect this is likely a server issue if it happens repeatedly contact me at lucaswilson4502@outlook.com' }).then(response => {
              dialogOpen = false
            });
          }
        }
        win.loadFile(path.join(__dirname, 'src', 'main.html'))
        messagesNotify = setInterval(function () {
          messageNotify()
        }, 10000);
      })
    } else {
      // and load the login.html of the app.
      win.loadFile(path.join(__dirname, 'src', 'login.html'))
    }
    win.show()
    if (process.platform === 'darwin') {
      app.dock.show()
    }
  })
}

function sendStatusToWindow(text) {
  log.info(text);
  win.webContents.send('message', text);
}

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('A new update is available! Downloading now...');
})
autoUpdater.on('update-not-available', (info) => {
  win.setProgressBar(0);
  sendStatusToWindow("You're on the latest version!");
})
autoUpdater.on('error', (err) => {
  win.setProgressBar(0);
  sendStatusToWindow('Update error.');
})
autoUpdater.on('download-progress', (event, bytesPerSecond, percent, total, transferred) => {
  sendStatusToWindow('Download Progress: ' + ((event.percent + "").split("."))[0] + '%');
  win.setProgressBar(event.percent / 100);
})
autoUpdater.on('update-downloaded', (info) => {
  win.setProgressBar(0);
  sendStatusToWindow('An update was downloaded it will be installed on exit. Please wait 1-2 minutes before reopening.');
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

ipcMain.on('restart_app', () => {
  setImmediate(() => {
    tray.destroy()
    win.destroy()
    autoUpdater.quitAndInstall();
  })
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (!gotTheLock) {
  log.info('App already running switching to app now...');
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    win.show()
    if (process.platform === 'darwin') {
      app.dock.show()
    }
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.on('ready', function () {
    createWindow();
    app.setAppUserModelId("The City Of Truro Mariners - Management Console")
  });

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow()
    }
    win.show();
    if (process.platform === 'darwin') {
      app.dock.show()
    }
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const connectionErrorMessage = {
  type: "error",
  buttons: ['OK'],
  title: "Connection error",
  message: "Please check your internet connection.",
  detail: "If you are connected our service provider may be down sorry for any inconvenience. If you still can't get back on after a few hours please contact me at: lucaswilson4502@outlook.com and I will look into the issue."
};

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

//url should be https://thecityoftruromariners.futurelucas4502.co.uk/ not localhost

// generic post code

// request.post({url:connectionurl, form: {formname:"formname",username:currentusername,password:currentpassword}},function(err,_,body){
//   if (err) {
//     if (!dialogOpen){
//       dialogOpen = true
//       return dialog.showMessageBox(win,connectionErrorMessage).then(response => {
//         dialogOpen = false
//       });
//     }
//   }
//   if (body == "Unauthorised"){
//     return logout(true);
//   }
//   //code to be run if successful
// })

// PHP API related scripts:

ipcMain.on('login', (event, arg) => {
  // user and pass sent to server api to verify and then logs in if correct
  currentusername = arg.username
  currentpassword = encrypt(arg.password)
  request.post({ url: connectionurl, form: { formname: "login", username: currentusername, password: currentpassword, datetime: require('moment')().format('YYYY-MM-DD HH:mm:ss') } }, function (err, _, body) {
    if (err) {
      event.sender.send("incorrect")
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Incorrect") {
      return incorrect()
    }
    if (body == "Query Error") {
      event.sender.send("incorrect")
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "1") {
      admincheck = true
    } else if (body == "0") {
      admincheck = false
    } else {
      event.sender.send("incorrect")
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Unknown Error', message: 'An unknown error eccured please check your internet connection or try and visit https://thecityoftruromariners.futurelucas4502.co.uk/ if it fails your service provider may be blocking us if however you can connect this is likely a server issue if it happens repeatedly contact me at lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (arg.rememberMe == true) {
      keytar.setPassword("The City Of Truro Mariners - Management Console", currentusername, currentpassword)
    }
    if (arg.rememberMe == false) {
      keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername)
    }
    win.loadFile(path.join(__dirname, 'src', 'main.html'))
    messagesNotify = setInterval(function () {
      messageNotify()
    }, 10000);
  })
  function incorrect() {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Login Error', message: 'Incorrect Username or Password' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("incorrect")
  }
});

ipcMain.on("request-access", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "request-access", email: arg } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Mailer Error") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "error", buttons: ['OK'], title: "Request Error", message: "Access request failed. Please try again or contact TruroMariners@gmail.com to request access manually." }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Request Confirmed") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Success", message: "A request was sent to: TruroMariners@gmail.com. Make sure to check your emails as you will be asked for more information to confirm your identity." }).then(response => {
          dialogOpen = false
        });
      }
      win.loadFile(path.join(__dirname, 'src', 'login.html'))
    }
    if (body == "Already Access") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Account Already Exists", message: "An account with your email already exists. If you are a new member check your emails for details if you have forgotten your password press forgot password. If you believe this to be a mistake please contact: TruroMariners@gmail.com" }).then(response => {
          dialogOpen = false
        });
      }
      win.loadFile(path.join(__dirname, 'src', 'login.html'))
    }
  });
})

ipcMain.on("main-ready", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "mainReady", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true)
    }
    event.sender.send('main-data', body)
  });
});

ipcMain.on('members-ready', (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "membersReady", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send('member-data', body)
  })
});

ipcMain.on('add-member', (event, arg) => {
  if (arg.userType == "Standard") {
    var userType = 0
  } else {
    var userType = 1
  }
  request.post({ url: connectionurl, form: { formname: "addMember", username: currentusername, password: currentpassword, newusername: arg.username, newpassword: encrypt(arg.password), email: arg.email, usertype: userType, newpasswordplain: arg.password } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Already Exists") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Member Add Error', message: 'An Account with this username or email already exists please choose something different' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Success") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Success", message: "A new account was successfully created." }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Mailer Error") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Email Error", message: "A new account was successfully created. However the email provided was invalid so they have not been emailed their details." }).then(response => {
          dialogOpen = false
        });
      }
    }
  });
})

ipcMain.on("delete-self?", (event, arg) => {
  if (currentusername == arg) {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Delete error', message: 'You cannot delete yourself.' }).then(response => {
        dialogOpen = false
      });
    }
  } else {
    event.sender.send("delete-user-result", arg)
  }

})

ipcMain.on("delete-user", (event, arg) => {
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "deleteMember", username: currentusername, password: currentpassword, deleteusername: arg.username } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      return win.reload()
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Delete Error', message: 'Incorrect Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("member-delete-incorrect")
  }
});

ipcMain.on("edit-self?", (event, arg) => {
  if (currentusername == arg) {
    if (!dialogOpen) {
      dialogOpen = true
      return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Edit error', message: 'You cannot edit yourself from here.' }).then(response => {
        dialogOpen = false
      });
    }
  }
  event.sender.send("edit-self-result")
})

ipcMain.on("edit-user", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "editMember", username: currentusername, password: currentpassword, editusername: arg.username, editemail: arg.email, editprivileges: arg.userType } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Already Exists") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Member Add Error', message: 'An Account with this email already exists please choose something different' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("events-ready", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "eventsReady", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send('event-data', body)
  })
})

ipcMain.on("add-event", (event, arg) => {
  if (arg.approved == "Yes") {
    var approved = 1
  } else {
    var approved = 0
  }
  request.post({ url: connectionurl, form: { formname: "addEvent", username: currentusername, password: currentpassword, title: arg.title, description: arg.description, datetime: arg.datetime, location: arg.location, accepted: approved } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Submitted") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Success", message: "Your event was submitted and is waiting approval", detail: "It will not appear here until an admin has approved it." }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("delete-event", (event, arg) => {
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "deleteEvent", username: currentusername, password: currentpassword, ID: arg.ID } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      win.reload()
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Delete Error', message: 'Incorrect Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("event-delete-incorrect")
  }
})

ipcMain.on("edit-event", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "editEvent", username: currentusername, password: currentpassword, title: arg.title, description: arg.description, datetime: arg.datetime, location: arg.location, accepted: arg.accepted, ID: arg.id } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("reset-password", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "resetPassword", email: arg, datetime: require('moment')().format('YYYY-MM-DD HH:mm:ss') } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "NoAccount") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Account not found', message: 'Check the entered email is correct.' }).then(response => {
          dialogOpen = false
        });
      }
      event.sender.send("account-not-found")
    }
    if (body == "Success") {
      win.loadFile(path.join(__dirname, 'src', 'passwordReset.html'))
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

var resetcode
ipcMain.on("verify", (event, arg) => {
  resetcode = arg
  win.loadFile(path.join(__dirname, 'src', 'passwordResetConfirmed.html'))
})

ipcMain.on("password-reset", (event, arg) => {
  if (arg.pass1 == arg.pass2) {
    request.post({ url: connectionurl, form: { formname: "resetPasswordConfirmed", code: resetcode, newpass: encrypt(arg.pass1), datetime: require('moment')().format('YYYY-MM-DD HH:mm:ss') } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Incorrect") {
        if (!dialogOpen) {
          dialogOpen = true
          dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Password Reset not found', message: 'Check the entered code is correct and that its been less than 10mins since the code was sent if its been longer please request a new code.' }).then(response => {
            dialogOpen = false
          });
        }
        win.loadFile(path.join(__dirname, 'src', 'passwordReset.html'))
      }
      if (body == "Success") {
        if (!dialogOpen) {
          dialogOpen = true
          dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Success", message: "Your Password Was Changed Successfully" }).then(response => {
            dialogOpen = false
          });
        }
        win.loadFile(path.join(__dirname, 'src', 'login.html'))
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
    })
  }
  else {
    if (!dialogOpen) {
      dialogOpen = true
      return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: "The Passwords Don't Match", message: 'Please Try Again.' }).then(response => {
        dialogOpen = false
      });
    }
  }
})

ipcMain.on('messages-ready', (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "messagesReady", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    try {
      event.sender.send('messages-users', JSON.parse(body))
    } catch (error) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
  })
  if (messagesNotificationClick) {
    loadMessages(event, 0, (notification.title).substring(14), false, true, (notification.title).substring(14))
    messagesNotificationClick = false
  }
});

var contact

function loadMessages(event, ID, username, messagesend, jump, clickedmessagefrom) {
  contact = username
  request.post({ url: connectionurl, form: { formname: "messagesLoad", username: currentusername, password: currentpassword, ID: ID, contact: username } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    try {
      event.sender.send('messages-data', JSON.parse(body), currentusername, messagesend, jump, clickedmessagefrom)
    } catch (error) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
  })
}

ipcMain.on('messages-load', (event, ID, username, messagesend, jump) => {
  if (win.isFocused()) {
    loadMessages(event, ID, username, messagesend, jump)
  }
});

ipcMain.on('message-send', (event, username, message, ID, file) => {
  request.post({ url: connectionurl, form: { formname: "messageSend", username: currentusername, password: currentpassword, contact: username, message: message, file: file, datetime: require('moment')().format('YYYY-MM-DD HH:mm:ss') } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Send Error', message: 'Message failed to send please try again and if this happens multiple times contact me at: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
  setTimeout(function () {
    loadMessages(event, ID, username, true)
  }, 1000)
});

ipcMain.on('message-read', (event, arg) => {
  if (win.isFocused()) {
    request.post({ url: connectionurl, form: { formname: "message-read", username: currentusername, password: currentpassword, ID: arg } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Query Error', message: 'Message failed to be set as read please try again and if this happens multiple times contact me at: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
    })
  }
})

function messageNotify() {
  request.post({ url: connectionurl, form: { formname: "messagesLoadNotify", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    var i = 0
    try {
      var result = JSON.parse(body)
    } catch (error) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
      return
    }
    for (i; i < result.length; i++) {
      if (!array.includes(result[i].ID)) {
        // add object to array
        array.push(result[i].ID);
        if (contact != result[i].messageFrom || !win.isFocused()) {
          if (result[i].file) {
            var messagebody = result[i].message
          } else {
            var messagebody = "Image/File"
          }
          notification = new Notification({ title: "Message from: " + result[i].messageFrom, body: messagebody, icon: path.join(__dirname, 'assets', 'images', 'icon.png') })
          notification.show()
          notification.on('click', (event, arg) => {
            win.show()
            if (process.platform === 'darwin') {
              app.dock.show()
            }
            win.loadFile(path.join(__dirname, 'src', 'messaging.html'))
            messagesNotificationClick = true
            win.moveTop()
            win.focus()
          })
        }
      }
    }
  })
}

ipcMain.on("payMembership", function (event, arg) {
  request.post({ url: connectionurl, form: { formname: "membership-payment", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send("client_secret", body)
  })
})

ipcMain.on("payment-success", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "membership-payment-success", username: currentusername, password: currentpassword, ID: arg, datetime: require('moment')().format('YYYY-MM-DD HH:mm:ss') } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
  })
  if (!dialogOpen) {
    dialogOpen = true
    return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Payment Success', message: 'Payment Successful' }).then(response => {
      dialogOpen = false
    });
  }
})

ipcMain.on("payments-ready", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "payments", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send("payments-data", JSON.parse(body))
  })
})

ipcMain.on("add-outgoing", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "addOutgoing", username: currentusername, password: currentpassword, item: arg.item, description: arg.description, datetime: arg.datetime, location: arg.location, member: arg.member } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Success") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Success", message: "Your expenditure was successfully added!", detail: "It will show up in the 'Load expenditure' section." }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("accounting-ready", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "usernamesAccounting", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send("load-usernames-data", JSON.parse(body))
  })
})

ipcMain.on("payment-add", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "addPayment", username: currentusername, password: currentpassword, datetime: arg.datetime, inperson: arg.inperson, type: arg.type, memberusername: arg.username, amount: arg.value, description: arg.description } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Success") {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: "info", buttons: ['OK'], title: "Success", message: "A payment was successfully added!", detail: "It will show up in the 'Load payments' section." }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("loadExpenditure", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "loadExpenditure", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send('expenditure-data', body)
  })
})

ipcMain.on("edit-expend", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "editExpend", username: currentusername, password: currentpassword, item: arg.item, description: arg.description, datetime: arg.datetime, location: arg.location, member: arg.member, ID: arg.id } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("delete-expend", (event, arg) => {
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "deleteExpend", username: currentusername, password: currentpassword, ID: arg.ID } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      win.reload()
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Delete Error', message: 'Incorrect Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("expend-delete-incorrect")
  }
})

ipcMain.on("loadPayments", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "loadPayments", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send('paymentsData', body)
  })
})

ipcMain.on("edit-payment", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "editPayment", username: currentusername, password: currentpassword, description: arg.description, datetime: arg.datetime, inPerson: arg.inPerson, member: arg.username, amount: arg.amount, ID: arg.ID } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("delete-payment", (event, arg) => {
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "deletePayment", username: currentusername, password: currentpassword, ID: arg.ID } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      win.reload()
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Delete Error', message: 'Incorrect Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("payment-delete-incorrect")
  }
})

ipcMain.on("attend-event", (event, id, title) => {
  request.post({ url: connectionurl, form: { formname: "attendEvent", username: currentusername, password: currentpassword, title: title, id: id } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Already Attending") {
      win.reload()
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Already Attending', message: 'You are already attending this event!' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Success") {
      win.reload()
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Attend status success', message: 'Adding attending status was successful!' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("event-attending-ready", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "eventsAttendingReady", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send('event-attending-data', body)
  })
})

ipcMain.on("load-all-attending", (event, arg) => {
  request.post({ url: connectionurl, form: { formname: "loadAllAttending", username: currentusername, password: currentpassword } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    event.sender.send('event-attending-data-all', body)
  })
})

ipcMain.on("un-attend", (event, id) => {
  request.post({ url: connectionurl, form: { formname: "unattendEvent", username: currentusername, password: currentpassword, id: id } }, function (err, _, body) {
    if (err) {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Unauthorised") {
      return logout(true);
    }
    if (body == "Query Error") {
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
          dialogOpen = false
        });
      }
    }
    if (body == "Success") {
      win.reload()
      if (!dialogOpen) {
        dialogOpen = true
        return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Remove status success', message: 'Removing attending status was successful!' }).then(response => {
          dialogOpen = false
        });
      }
    }
  })
})

ipcMain.on("change-username", (event, arg) => {
  if (arg.username == "" || arg.username == null || arg.username == '') {
    if (!dialogOpen) {
      dialogOpen = true
      return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Username Error', message: 'Please enter a username it cannot be blank.' }).then(response => {
        dialogOpen = false
      });
    }
  }
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "changeUsername", username: currentusername, password: currentpassword, updateUsername: arg.username } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Success") {
        try { keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername) } catch { }
        currentusername = arg.username
        win.reload()
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Success', message: 'Your username was successfully changed!' }).then(response => {
            dialogOpen = false
          });
        }
      }
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Error', message: 'Incorrect Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("change-username-incorrect")
  }
})

ipcMain.on("change-password", (event, arg) => {
  if (arg.password == "" || arg.password == null || arg.password == '' || arg.newpassword != arg.newPasswordConfirm || arg.newpassword == "" || arg.newpassword == null || arg.newpassword == '') {
    if (!dialogOpen) {
      dialogOpen = true
      return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Error', message: 'Password is either blank or not the same.' }).then(response => {
        dialogOpen = false
      });
    }
  }
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "changePassword", username: currentusername, password: currentpassword, updatePassword: encrypt(arg.newpassword) } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Success") {
        var checkRemembered = keytar.findCredentials("The City Of Truro Mariners - Management Console")
        checkRemembered.then((result) => {
          if (result.length != 0) {
            try { keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername) } catch { }
            currentpassword = encrypt(arg.newpassword)
            try { keytar.setPassword("The City Of Truro Mariners - Management Console", currentusername, currentpassword) } catch { }
          }
        })
        win.reload()
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Success', message: 'Your password was successfully changed!' }).then(response => {
            dialogOpen = false
          });
        }
      }
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Error', message: 'Incorrect Current Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("change-password-incorrect")
  }
})

ipcMain.on("change-email", (event, arg) => {
  if (encrypt(arg.password) == currentpassword) {
    request.post({ url: connectionurl, form: { formname: "changeEmail", username: currentusername, password: currentpassword, updateEmail: arg.email } }, function (err, _, body) {
      if (err) {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, connectionErrorMessage).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Unauthorised") {
        return logout(true);
      }
      if (body == "Query Error") {
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Server Error', message: 'A Server Error Occured Please Try Again If This Has Happened Multiple Times Contact Me At: lucaswilson4502@outlook.com' }).then(response => {
            dialogOpen = false
          });
        }
      }
      if (body == "Success") {
        win.reload()
        if (!dialogOpen) {
          dialogOpen = true
          return dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Success', message: 'Your email was successfully changed!' }).then(response => {
            dialogOpen = false
          });
        }
      }
    })
  } else {
    if (!dialogOpen) {
      dialogOpen = true
      dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Error', message: 'Incorrect Password!' }).then(response => {
        dialogOpen = false
      });
    }
    event.sender.send("change-email-incorrect")
  }
})

// In Program Scripts:

ipcMain.on('logout', function (event, arg) {
  logout()
});

function logout(authFail) {
  win.loadFile(path.join(__dirname, 'src', 'login.html'));
  clearInterval(messagesNotify)
  try { keytar.deletePassword("The City Of Truro Mariners - Management Console", currentusername) } catch { }
  currentusername = null
  currentpassword = null
  array = []
  win.webContents.on('did-finish-load', () => {
    if (authFail == true) {
      if (!dialogOpen) {
        dialogOpen = true
        dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Error', message: 'Unauthorised Access!' }).then(response => {
          dialogOpen = false
          authFail = false
        });
      }
    }
  })
}

ipcMain.on('page-ready', (event, arg) => {
  event.sender.send('admin-check', admincheck)
});

var encrypt = ((val) => {
  let cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, IV);
  let encrypted = cipher.update(val, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
});

ipcMain.on("too-large", (event, arg) => {
  if (!dialogOpen) {
    dialogOpen = true
    return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'Send Error', message: 'Message failed to send this file is too large. Max file size is around 8MB, actual size may vary.' }).then(response => {
      dialogOpen = false
    });
  }
})

ipcMain.on("file-not-found", (event, arg) => {
  if (!dialogOpen) {
    dialogOpen = true
    return dialog.showMessageBox(win, { type: 'error', buttons: ['OK'], title: 'File Error', message: 'File failed to be converted if you cancelled the dialog ignore this message if not then the file is not supported.' }).then(response => {
      dialogOpen = false
    });
  }
})

ipcMain.on("save-file", (event, arg, extension) => {

  let options = {
    //Placeholder 1
    title: "Save file",

    //Placeholder 2
    defaultPath: "File",

    //Placeholder 4
    buttonLabel: "Save File",

    //Placeholder 3
    filters: [
      { name: 'File', extensions: [extension] }
    ]
  }

  dialog.showSaveDialog(win, options).then(response => {
    fs.writeFile(response.filePath, arg, function (err) {
      // file saved or err
    });
  });
})

ipcMain.on("update-check", (event, arg) => {
  // Runs auto updater
  autoUpdater.checkForUpdatesAndNotify();
})

ipcMain.on("payment-online", (event, arg) => {
  shell.openExternal('https://dashboard.stripe.com/test/payments/' + arg)
})