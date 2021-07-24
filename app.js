const { screen, app, BrowserWindow, Menu, Tray, Notification, ipcMain, globalShortcut } = require('electron')
const path = require('path');
var storage = require('electron-json-storage')
var shajs = require('sha.js')
const password = require('secure-random-password');
const { autoUpdater } = require('electron-updater');


var io = require('socket.io-client');
socket = io.connect('https://teams.hikyu.de', { secure: true, reconnection: true, rejectUnauthorized: false });
socket.on("connect_error", (err) => {
  console.log(`connect_error due to 1 ${err.message}`);
});
socket.on('connect_error', err => console.log(err));
socket.on('connect_failed', err => console.log(err));
socket.on('disconnect', err => console.log(err));


let window;
let isQuiting;
let tray;

var shown = true;
app.on('before-quit', function () {
  isQuiting = true;
});

app.on('ready', () => {
  const iconPath = path.join(__dirname, 'src/icon.ico');
  tray = new Tray(iconPath);

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  window = new BrowserWindow({
    width: 300,
    height: 500,
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
    },
    alwaysOnTop: true,
    maximizable: false,
    resizable: false,
    fullscreenable: false,
    x: width - 300,
    y: 0,
    //show: false
  });
  window.setMenu(null);
  // window.webContents.openDevTools()


  //! On close tray menu
  window.on('close', function (event) {
    // if (!isQuiting) {
    //   event.preventDefault();
    //   window.hide();
    //   event.returnValue = false;
    // }
  });

  window.on('moved', (e) => {
    let bounds = e.sender.getBounds();
    let [x, y] = [bounds.x, bounds.y];

    let data = storage.getSync('data');
    data.position = [x, y];
    storage.set('data', data);
  })





  startup();
});





async function startup() {
  autoUpdater.checkForUpdatesAndNotify();

  registerShortcuts()

  //! Set Position based off last position
  if(storage.getSync('data').position)
    window.setPosition(...storage.getSync('data').position);


  //! Render page
  if(!storage.getSync('data').userData)
    window.loadFile('views/createProfile.html');
  else
    window.loadFile('views/index.html');


  // let data = storage.getSync('data');
  // delete data.userData;
  // storage.set('data', data);

}

function registerShortcuts() {
  const ret = globalShortcut.register('CommandOrControl+K', () => {

    if(shown) window.hide();
    else window.show();

    shown = !shown;
  })
  if (!ret) {
    console.log('registration failed')
  }
}


autoUpdater.on('update-available', () => {
  console.log(11);
});
autoUpdater.on('update-downloaded', () => {
  console.log(22);
});


ipcMain.on('createProfile', async (event, arg) => {
  const { name, email } = arg;
  const secretKey = password.randomPassword({ length: 64, characters: password.lower + password.upper + password.digits })
  const hashedSecretKey = shajs('sha256').update(secretKey).digest('hex');

  

  let data = storage.getSync('data');
  data.userData = {
    name: name,
    email: email,
    secretKey: secretKey
  };
  storage.set('data', data);
  
  window.loadFile('views/index.html');

})

socket.on('checkAccount_yourPublicKey', publicKey => {

  let data = storage.getSync('data');
  data.userData.publicKey = publicKey;
  storage.set('data', data);

})


ipcMain.on('changeTab', (event, arg) => {
  window.loadFile('views/'+arg+'.html');
})


ipcMain.on('profile_requestProfile', (event, arg) => {
  let data = storage.getSync('data');

  window.webContents.send('profile_sendProfile', { publicKey: data.userData.publicKey, username: data.userData.name });
})
ipcMain.on('profile_requestIndex', async (event, arg) => {
  let data = storage.getSync('data');
  const hashedSecretKey = shajs('sha256').update(data.userData.secretKey).digest('hex');

  window.webContents.send('profile_sendIndex', { username: data.userData.name });

  socket.emit('checkAccount', { name: data.userData.name, email: data.userData.email, secretKey: data.userData.secretKey })
})
ipcMain.on('profile_save', async (event, arg) => {
  let data = storage.getSync('data');
  data.userData.name = arg.username;
  storage.set('data', data);

  const hashedSecretKey = shajs('sha256').update(data.userData.secretKey).digest('hex');

  socket.emit('changeUsername', { username: arg.username, secretKey: hashedSecretKey })
})