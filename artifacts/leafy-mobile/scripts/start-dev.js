#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const TUNNEL_FILE = "/tmp/expo-tunnel-url.txt";
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN || "";

// Workaround: The system-managed .replit workflow file may specify a different PORT
// than artifact.toml's localPort. The canvas health check uses the artifact port,
// so we read it here and override the CLI --port arg to ensure Expo starts on the
// correct port. A TCP bridge from the workflow port is created as a fallback so
// the workflow's waitForPort check still passes.
function readArtifactPort() {
  try {
    const tomlPath = path.join(__dirname, "..", ".replit-artifact", "artifact.toml");
    const content = fs.readFileSync(tomlPath, "utf8");
    const match = content.match(/^PORT\s*=\s*"(\d+)"/m);
    if (match) return Number(match[1]);
  } catch {}
  return null;
}

const ARTIFACT_PORT = readArtifactPort();

function findNgrokBin() {
  const candidates = [
    path.join(__dirname, "../../../node_modules/.pnpm/@expo+ngrok-bin-linux-x64@2.3.41/node_modules/@expo/ngrok-bin-linux-x64/ngrok"),
    path.join(__dirname, "../../node_modules/.pnpm/@expo+ngrok-bin-linux-x64@2.3.41/node_modules/@expo/ngrok-bin-linux-x64/ngrok"),
    "/home/runner/workspace/node_modules/.pnpm/@expo+ngrok-bin-linux-x64@2.3.41/node_modules/@expo/ngrok-bin-linux-x64/ngrok",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const cliPort = portFlag !== -1 && args[portFlag + 1] ? args[portFlag + 1] : null;

// Keep --tunnel flag so Expo manages ngrok internally

const expoPort = ARTIFACT_PORT || (cliPort ? Number(cliPort) : 8081);
const workflowPort = cliPort ? Number(cliPort) : null;

if (ARTIFACT_PORT) {
  if (portFlag !== -1 && args[portFlag + 1]) {
    args[portFlag + 1] = String(ARTIFACT_PORT);
  } else {
    args.push("--port", String(ARTIFACT_PORT));
  }
}

const targetPort = String(expoPort);

function killStaleProcesses() {
  try {
    execSync("pkill -f ngrok || true", { stdio: "ignore" });
  } catch {}

  try {
    execSync("pkill -f 'expo start' || true", { stdio: "ignore" });
  } catch {}

  try {
    execSync("pkill -f metro || true", { stdio: "ignore" });
  } catch {}

  try {
    execSync("pkill -f '@react-native-community/cli-server-api' || true", { stdio: "ignore" });
  } catch {}

  // Give killed processes time to release ports
  try {
    execSync("sleep 1", { stdio: "ignore" });
  } catch {}

  if (targetPort) {
    try {
      const lsofOut = execSync(`lsof -ti :${targetPort} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (lsofOut) {
        const pids = lsofOut.split("\n").filter(Boolean);
        for (const pid of pids) {
          if (pid !== String(process.pid)) {
            try { process.kill(Number(pid), "SIGKILL"); } catch {}
          }
        }
        console.log(`Killed stale process(es) on port ${targetPort}: ${pids.join(", ")}`);
      }
    } catch {}
  }
}

killStaleProcesses();

const ngrokBin = findNgrokBin();
if (ngrokBin) {
  try {
    execSync(`"${ngrokBin}" authtoken ${NGROK_AUTH_TOKEN}`, { stdio: "ignore" });
    console.log("ngrok authtoken set.");
  } catch (e) {
    console.warn("Failed to set ngrok authtoken:", e.message);
  }
}

if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);

function pollNgrokAPI() {
  try {
    const req = http.get(NGROK_API, { timeout: 5000 }, (res) => {
      if (!res || res.statusCode !== 200) {
        console.warn(`ngrok API returned status ${res?.statusCode || "unknown"}`);
        return;
      }
      let data = "";
      res.on("data", (chunk) => { if (chunk) data += chunk; });
      res.on("end", () => {
        try {
          if (!data) return;
          const json = JSON.parse(data);
          if (!json || !Array.isArray(json.tunnels)) return;
          const httpTunnel = json.tunnels.find(
            (t) => t && t.public_url && t.public_url.startsWith("http://") && t.public_url.includes(".exp.direct")
          );
          if (httpTunnel) {
            const expUrl = httpTunnel.public_url.replace("http://", "exp://");
            fs.writeFileSync(TUNNEL_FILE, expUrl, "utf8");
            console.log(`\n› Metro waiting on ${expUrl}`);
          }
        } catch (e) {
          console.warn("Failed to parse ngrok API response:", e.message);
        }
      });
    });
    req.on("error", (err) => { console.warn("ngrok API error:", err.message); });
    req.on("timeout", () => { req.destroy(); });
  } catch (e) {
    console.warn("pollNgrokAPI error:", e.message);
  }
}

if (workflowPort && workflowPort !== expoPort) {
  const proxyServer = net.createServer((socket) => {
    const target = net.connect(expoPort, "127.0.0.1");
    socket.pipe(target);
    target.pipe(socket);
    socket.on("error", () => target.destroy());
    target.on("error", () => socket.destroy());
  });
  proxyServer.listen(workflowPort, "0.0.0.0", () => {
    console.log(`Port bridge: ${workflowPort} → ${expoPort}`);
  });
  proxyServer.on("error", (err) => {
    console.warn(`Port bridge failed on ${workflowPort}: ${err.message}`);
  });
}

let tunnelFound = false;
let intentionalExit = false;
let restartAttempts = 0;
const MAX_RESTARTS = 5;

process.on("SIGTERM", () => { intentionalExit = true; process.exit(0); });
process.on("SIGINT", () => { intentionalExit = true; process.exit(0); });

function startExpo() {
  console.log(`Starting Expo on port ${expoPort}... (attempt ${restartAttempts + 1})`);

  const spawnEnv = Object.assign({}, process.env);
  delete spawnEnv.CI;

  const child = spawn("pnpm", ["exec", "expo", "start", ...args], {
    stdio: ["inherit", "pipe", "pipe"],
    env: spawnEnv,
  });

  function handleOutput(data) {
    const text = data.toString();
    process.stdout.write(text);

    const match = text.match(/exp:\/\/[^\s]+\.exp\.direct/);
    if (match && !tunnelFound) {
      tunnelFound = true;
      restartAttempts = 0;
      fs.writeFileSync(TUNNEL_FILE, match[0], "utf8");
    }

    if ((text.includes("Tunnel connected") || text.includes("Tunnel ready")) && !tunnelFound) {
      setTimeout(() => {
        if (!tunnelFound) {
          pollNgrokAPI();
          setTimeout(() => { if (!tunnelFound) pollNgrokAPI(); }, 3000);
        }
      }, 2000);
    }
  }

  child.stdout.on("data", handleOutput);
  child.stderr.on("data", (data) => {
    process.stderr.write(data);
    handleOutput(data);
  });

  child.on("close", (code) => {
    if (intentionalExit || code === 0) {
      process.exit(code ?? 0);
      return;
    }
    restartAttempts++;
    if (restartAttempts <= MAX_RESTARTS) {
      const delay = Math.min(3000 * restartAttempts, 15000);
      console.warn(`\nExpo exited with code ${code}. Restarting in ${delay / 1000}s... (${restartAttempts}/${MAX_RESTARTS})`);
      tunnelFound = false;
      setTimeout(startExpo, delay);
    } else {
      console.error(`Expo failed after ${MAX_RESTARTS} restart attempts. Giving up.`);
      process.exit(code ?? 1);
    }
  });
}

startExpo();
