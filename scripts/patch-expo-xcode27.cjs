// Parche automático para compatibilidad de @expo/cli con Xcode 27+ (DeviceHub.app) sin bloqueos de osascript
const fs = require('fs');
const path = require('path');

const cliRoot = path.join(__dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'src', 'start');

function stripTraces(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const cleaned = content
    .split('\n')
    .filter((line) => !line.includes('[TRACE]'))
    .join('\n');
  if (cleaned !== content) {
    fs.writeFileSync(filePath, cleaned, 'utf8');
  }
}

// Limpiar trazas de depuración si existen
[
  path.join(cliRoot, 'startAsync.js'),
  path.join(cliRoot, 'server', 'metro', 'instantiateMetro.js'),
  path.join(cliRoot, 'server', 'metro', 'MetroBundlerDevServer.js'),
  path.join(cliRoot, 'platforms', 'PlatformManager.js'),
  path.join(cliRoot, 'platforms', 'ios', 'AppleDeviceManager.js'),
].forEach(stripTraces);

// 1. SimulatorAppPrerequisite.js — Evitar osascript('id of app "Simulator"') que abre diálogo bloqueante en macOS
const prereqPath = path.join(cliRoot, 'doctor', 'apple', 'SimulatorAppPrerequisite.js');
if (fs.existsSync(prereqPath)) {
  let content = fs.readFileSync(prereqPath, 'utf8');
  content = content.replace(
    /async function getSimulatorAppIdAsync\(\) \{[\s\S]*?\n\}/,
    `async function getSimulatorAppIdAsync() {
    if (require("fs").existsSync("/Applications/Xcode.app/Contents/Applications/DeviceHub.app")) {
        return "com.apple.dt.Devices";
    }
    if (require("fs").existsSync("/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app")) {
        return "com.apple.iphonesimulator";
    }
    try {
        return (await (0, _osascript().execAsync)('id of app "Simulator"')).trim();
    } catch {}
    return null;
}`
  );
  content = content.replace(
    /if \(result !== "com\.apple\.iphonesimulator" && result !== "com\.apple\.CoreSimulator\.SimulatorTrampoline"(?: && result !== "com\.apple\.dt\.Devices")?\)/,
    `if (result !== "com.apple.iphonesimulator" && result !== "com.apple.CoreSimulator.SimulatorTrampoline" && result !== "com.apple.dt.Devices")`
  );
  content = content.replace(
    /\[\s*"simctl",\s*"help"\s*\]/,
    `["--find", "simctl"]`
  );
  fs.writeFileSync(prereqPath, content, 'utf8');
}

// 2. ensureSimulatorAppRunning.js — Usar pgrep/open con URL scheme devices://device/open?id=<UDID> en Xcode 27 (DeviceHub.app)
const ensureRunningPath = path.join(cliRoot, 'platforms', 'ios', 'ensureSimulatorAppRunning.js');
if (fs.existsSync(ensureRunningPath)) {
  let content = fs.readFileSync(ensureRunningPath, 'utf8');
  content = content.replace(
    /async function ensureSimulatorAppRunningAsync\(device, \{ maxWaitTime\s*\} = \{\}\) \{[\s\S]*?\n\}/,
    `async function ensureSimulatorAppRunningAsync(device, { maxWaitTime } = {}) {
    if (await isSimulatorAppRunningAsync()) {
        await openSimulatorAppAsync(device);
        return;
    }
    _log.log(\`\\u203A Opening the iOS simulator, this might take a moment.\`);
    await openSimulatorAppAsync(device);
    if (!await waitForSimulatorAppToStart({
        maxWaitTime
    })) {
        throw new _errors.CommandError("SIMULATOR_TIMEOUT", \`Simulator app did not open fast enough. Try opening Simulator first, then running your app.\`);
    }
}`
  );
  content = content.replace(
    /async function isSimulatorAppRunningAsync\(\) \{[\s\S]*?\n\}/,
    `async function isSimulatorAppRunningAsync() {
    try {
        const out = require("child_process").execSync("ps -ax -o comm=", { stdio: "pipe" }).toString();
        return out.includes("DevicesTrampoline") || out.includes("DeviceHub") || out.includes("Simulator.app");
    } catch {
        return false;
    }
}`
  );
  content = content.replace(
    /async function openSimulatorAppAsync\(device\) \{[\s\S]*?\n\}/,
    `async function openSimulatorAppAsync(device) {
    const hasDeviceHub = require("fs").existsSync("/Applications/Xcode.app/Contents/Applications/DeviceHub.app");
    const appTarget = hasDeviceHub ? "/Applications/Xcode.app/Contents/Applications/DeviceHub.app" : "Simulator";
    const args = ["-a", appTarget];
    if (device && device.udid) {
        if (hasDeviceHub) {
            args.push(\`devices://device/open?id=\${device.udid}\`);
        } else {
            args.push("--args", "-CurrentDeviceUDID", device.udid);
        }
    }
    await (0, _spawnAsync().default)("open", args);
}`
  );
  fs.writeFileSync(ensureRunningPath, content, 'utf8');
}

// 3. AppleDeviceManager.js — Asegurar que la ventana GUI del simulador se abra en DeviceHub.app y evitar tell application "Simulator" to activate
const managerPath = path.join(cliRoot, 'platforms', 'ios', 'AppleDeviceManager.js');
if (fs.existsSync(managerPath)) {
  let content = fs.readFileSync(managerPath, 'utf8');
  content = content.replace(
    /if \(simulatorOpenedByApp\) \{\s*(?:await \(0, _ensureSimulatorAppRunning\.ensureSimulatorAppRunningAsync\)\(\{ udid: simulatorOpenedByApp\.udid \}\);\s*)?return simulatorOpenedByApp;\s*\}/,
    `if (simulatorOpenedByApp) {
            await (0, _ensureSimulatorAppRunning.ensureSimulatorAppRunningAsync)({ udid: simulatorOpenedByApp.udid });
            return simulatorOpenedByApp;
        }`
  );
  if (!content.includes('// Open DeviceHub window before bootAsync')) {
    content = content.replace(
      `    const bootedDevice = await (0, _delay.waitForActionAsync)({`,
      `    // Open DeviceHub window before bootAsync
    await (0, _ensureSimulatorAppRunning.ensureSimulatorAppRunningAsync)({ udid });
    const bootedDevice = await (0, _delay.waitForActionAsync)({`
    );
  }
  content = content.replace(
    /async activateWindowAsync\(\) \{[\s\S]*?\n    \}/,
    `async activateWindowAsync() {
        await (0, _ensureSimulatorAppRunning.ensureSimulatorAppRunningAsync)(this.device);
    }`
  );
  fs.writeFileSync(managerPath, content, 'utf8');
}

// 4. getBestSimulator.js — Ignorar CurrentDeviceUDID en caché si su runtime ya no está disponible
const bestSimPath = path.join(cliRoot, 'platforms', 'ios', 'getBestSimulator.js');
if (fs.existsSync(bestSimPath)) {
  let content = fs.readFileSync(bestSimPath, 'utf8');
  content = content.replace(
    `    if (defaultId && !osType) {
        return defaultId;
    }`,
    `    // Verificar siempre que el simulador por defecto siga disponible (isAvailable === true)`
  );
  content = content.replace(
    `        if ((defaultSimulator == null ? void 0 : defaultSimulator.osType) === osType) {
            return defaultId;
        }`,
    `        if (defaultSimulator && (!osType || defaultSimulator.osType === osType)) {
            return defaultId;
        }`
  );
  fs.writeFileSync(bestSimPath, content, 'utf8');
}

// 5. simctl.js — En iOS 27 Simulator, iniciar el proceso de la app (simctl launch) antes de simctl openurl para evitar timeout (code 60)
const simctlPath = path.join(cliRoot, 'platforms', 'ios', 'simctl.js');
if (fs.existsSync(simctlPath)) {
  let content = fs.readFileSync(simctlPath, 'utf8');
  if (!content.includes('// Pre-launch app before openurl')) {
    content = content.replace(
      `        await simctlAsync([
            "openurl",
            resolveId(device),
            options.url
        ]);`,
      `        // Pre-launch app before openurl for iOS 27 compatibility
        if (options.appId) {
            try {
                await simctlAsync(["launch", resolveId(device), options.appId]);
            } catch {}
        }
        await simctlAsync([
            "openurl",
            resolveId(device),
            options.url
        ]);`
    );
    fs.writeFileSync(simctlPath, content, 'utf8');
  }
}

// 6. open.js — En macOS, usar /usr/bin/open directamente en lugar de better-opn (que invoca osascript openChrome.applescript y puede bloquear)
const openPath = path.join(__dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'src', 'utils', 'open.js');
if (fs.existsSync(openPath)) {
  let content = fs.readFileSync(openPath, 'utf8');
  content = content.replace(
    /async function openBrowserAsync\(target, options\) \{[\s\S]*?\n\}/,
    `async function openBrowserAsync(target, options) {
    if (process.platform === "darwin") {
        require("child_process").spawn("/usr/bin/open", [target], { detached: true, stdio: "ignore" }).unref();
        return true;
    }
    return await (0, _betterOpn().default)(target, options);
}`
  );
  fs.writeFileSync(openPath, content, 'utf8');
}

// 7. port.js — Si el puerto 8081 está ocupado por una instancia anterior de este mismo proyecto, cerrarla automáticamente y reutilizar 8081 sin preguntar
const portPath = path.join(__dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'src', 'utils', 'port.js');
if (fs.existsSync(portPath)) {
  let content = fs.readFileSync(portPath, 'utf8');
  if (!content.includes('// Auto-replace stale project dev server')) {
    content = content.replace(
      `            if (runningProcess.directory === projectRoot) {
                message += \` running this app in another window\`;
                if (reuseExistingPort) {
                    return null;
                }
            }`,
      `            if (runningProcess.directory === projectRoot) {
                if (reuseExistingPort) {
                    return null;
                }
                // Auto-replace stale project dev server
                try {
                    process.kill(runningProcess.pid, "SIGKILL");
                    await new Promise((r) => setTimeout(r, 400));
                    const freedPort = await (0, _freeportAsync().default)(defaultPort, {
                        hostnames: [
                            host ?? null
                        ]
                    });
                    if (freedPort === defaultPort) {
                        return defaultPort;
                    }
                } catch {}
                message += \` running this app in another window\`;
            }`
    );
    fs.writeFileSync(portPath, content, 'utf8');
  }
}


