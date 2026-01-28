const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

let mainWindow;

async function startBackend() {
  // backend is ESM, so use dynamic import
  const backendPath = isDev
    ? path.join(process.cwd(), "backend", "app.js")
    : path.join(process.resourcesPath, "app.asar.unpacked", "backend", "app.js");

  const dbPath = isDev
    ? path.join(process.cwd(), "backend", "db.js")
    : path.join(process.resourcesPath, "app.asar.unpacked", "backend", "db.js");

  const { default: appServer } = await import(`file://${backendPath}`);
  const { connectDB } = await import(`file://${dbPath}`);

  // IMPORTANT: for offline, use local mongo
  // example: mongodb://127.0.0.1:27017/pos
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pos";
  await connectDB(MONGO_URI);

  const PORT = process.env.PORT || 3000;

  return new Promise((resolve, reject) => {
    const server = appServer.listen(PORT, "127.0.0.1", () => {
      console.log(`✅ Backend running on http://127.0.0.1:${PORT}`);
      resolve({ server, PORT });
    });
    server.on("error", reject);
  });
}

async function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(url);

  if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  const { PORT } = await startBackend();

  // In BOTH dev & prod, load backend URL (since backend serves dist in prod)
  // In dev, you can either load Vite OR load backend.
  // For simplicity: load backend so your /api always works same way.
  await createWindow(`http://127.0.0.1:${PORT}`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});