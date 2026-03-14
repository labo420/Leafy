#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const TUNNEL_FILE = "/tmp/expo-tunnel-url.txt";
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN || "";

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
const targetPort = portFlag !== -1 && args[portFlag + 1] ? args[portFlag + 1] : null;

function killStaleProcesses() {
  try {
    execSync("pkill -f ngrok || true", { stdio: "ignore" });
  } catch {}

  try {
    execSync("pkill -f 'expo start' || true", { stdio: "ignore" });
  } catch {}

  try {
    execSync("pkill -f '@react-native-community/cli-server-api' || true", { stdio: "ignore" });
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
  http.get(NGROK_API, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        const httpTunnel = (json.tunnels || []).find(
          (t) => t.public_url && t.public_url.startsWith("http://") && t.public_url.includes(".exp.direct")
        );
        if (httpTunnel) {
          const expUrl = httpTunnel.public_url.replace("http://", "exp://");
          fs.writeFileSync(TUNNEL_FILE, expUrl, "utf8");
          console.log(`\n› Metro waiting on ${expUrl}`);
        }
      } catch {}
    });
  }).on("error", () => {});
}

const child = spawn("pnpm", ["exec", "expo", "start", ...args], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

let tunnelFound = false;

function handleOutput(data) {
  const text = data.toString();
  process.stdout.write(text);

  const match = text.match(/exp:\/\/[^\s]+\.exp\.direct/);
  if (match && !tunnelFound) {
    tunnelFound = true;
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
child.on("close", (code) => process.exit(code ?? 0));
