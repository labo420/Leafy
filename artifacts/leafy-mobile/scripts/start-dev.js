#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const LOCK_FILE = "/tmp/expo-start-dev.pid";
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN || "";
const REPLIT_EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN || "";

function ensureSingleInstance() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const oldPid = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
      if (oldPid && oldPid !== process.pid) {
        try {
          process.kill(oldPid, 0);
          let cmdline = "";
          try { cmdline = fs.readFileSync(`/proc/${oldPid}/cmdline`, "utf8"); } catch {}
          if (cmdline.includes("start-dev")) {
            console.log(`Killing previous start-dev.js instance (PID ${oldPid})...`);
            process.kill(oldPid, "SIGTERM");
            try { execSync(`pkill -P ${oldPid} || true`, { stdio: "ignore" }); } catch {}
          }
        } catch {}
      }
    }
  } catch {}
  fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");
}

ensureSingleInstance();

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

const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const cliPort = portFlag !== -1 && args[portFlag + 1] ? Number(args[portFlag + 1]) : null;

const PUBLIC_PORT = ARTIFACT_PORT || cliPort || 23546;
const METRO_PORT = PUBLIC_PORT + 1;

if (portFlag !== -1 && args[portFlag + 1]) {
  args[portFlag + 1] = String(METRO_PORT);
} else {
  args.push("--port", String(METRO_PORT));
}

function killStaleProcesses() {
  try { execSync("pkill -f ngrok || true", { stdio: "ignore" }); } catch {}
  try { execSync("pkill -f 'expo start' || true", { stdio: "ignore" }); } catch {}
  try { execSync("pkill -f metro || true", { stdio: "ignore" }); } catch {}
  try { execSync("pkill -f '@react-native-community/cli-server-api' || true", { stdio: "ignore" }); } catch {}
  try { execSync("sleep 1", { stdio: "ignore" }); } catch {}

  for (const port of [PUBLIC_PORT, METRO_PORT]) {
    try {
      const lsofOut = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (lsofOut) {
        const pids = lsofOut.split("\n").filter(Boolean);
        for (const pid of pids) {
          if (pid !== String(process.pid)) {
            try { process.kill(Number(pid), "SIGKILL"); } catch {}
          }
        }
        console.log(`Killed stale process(es) on port ${port}: ${pids.join(", ")}`);
      }
    } catch {}
  }
}

killStaleProcesses();

const ngrokBin = (() => {
  const candidates = [
    path.join(__dirname, "../../../node_modules/.pnpm/@expo+ngrok-bin-linux-x64@2.3.41/node_modules/@expo/ngrok-bin-linux-x64/ngrok"),
    "/home/runner/workspace/node_modules/.pnpm/@expo+ngrok-bin-linux-x64@2.3.41/node_modules/@expo/ngrok-bin-linux-x64/ngrok",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
})();

if (ngrokBin && NGROK_AUTH_TOKEN) {
  try {
    execSync(`"${ngrokBin}" authtoken ${NGROK_AUTH_TOKEN}`, { stdio: "ignore" });
    console.log("ngrok authtoken set.");
  } catch (e) {
    console.warn("Failed to set ngrok authtoken:", e.message);
  }
}

function rewriteManifest(body) {
  if (!REPLIT_EXPO_DOMAIN) return body;
  const port = String(METRO_PORT);
  const escapedDomain = REPLIT_EXPO_DOMAIN.replace(/\./g, "\\.");
  const sources = [
    `localhost:${port}`,
    `127\\.0\\.0\\.1:${port}`,
    `172\\.31\\.[0-9]+\\.[0-9]+:${port}`,
    `${escapedDomain}:${port}`,
  ];
  let result = body;
  for (const src of sources) {
    result = result
      .replace(new RegExp(`https://${src}/`, "g"), `https://${REPLIT_EXPO_DOMAIN}/`)
      .replace(new RegExp(`http://${src}/`, "g"), `http://${REPLIT_EXPO_DOMAIN}/`)
      .replace(new RegExp(`"${src}"`, "g"), `"${REPLIT_EXPO_DOMAIN}"`);
  }
  return result;
}

function isManifestRequest(req) {
  const accept = (req.headers["accept"] || "").toLowerCase();
  return accept.includes("application/expo+json") || req.headers["expo-platform"] !== undefined;
}

function startManifestProxy() {
  const proxyServer = http.createServer((clientReq, clientRes) => {
    const options = {
      hostname: "127.0.0.1",
      port: METRO_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: { ...clientReq.headers },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      if (isManifestRequest(clientReq)) {
        const chunks = [];
        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          let body = Buffer.concat(chunks).toString("utf8");
          body = rewriteManifest(body);
          const rewrittenHeaders = { ...proxyRes.headers };
          rewrittenHeaders["content-length"] = String(Buffer.byteLength(body, "utf8"));
          delete rewrittenHeaders["transfer-encoding"];
          clientRes.writeHead(proxyRes.statusCode, rewrittenHeaders);
          clientRes.end(body, "utf8");
        });
      } else {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes);
      }
    });

    proxyReq.on("error", (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502);
        clientRes.end("Proxy error: " + err.message);
      }
    });

    clientReq.pipe(proxyReq);
  });

  proxyServer.on("upgrade", (req, socket, head) => {
    const target = net.connect(METRO_PORT, "127.0.0.1", () => {
      target.write(
        `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
      );
      if (head && head.length > 0) target.write(head);
      target.pipe(socket);
      socket.pipe(target);
    });
    target.on("error", () => socket.destroy());
    socket.on("error", () => target.destroy());
  });

  proxyServer.listen(PUBLIC_PORT, "0.0.0.0", () => {
    const expUrl = REPLIT_EXPO_DOMAIN
      ? `exp://${REPLIT_EXPO_DOMAIN}`
      : `exp://localhost:${PUBLIC_PORT}`;
    console.log(`Manifest proxy: port ${PUBLIC_PORT} → Metro ${METRO_PORT}`);
    console.log(`\n› Scan QR code or open: ${expUrl}\n`);
  });

  proxyServer.on("error", (err) => {
    console.warn(`Proxy server error on port ${PUBLIC_PORT}: ${err.message}`);
  });
}

let intentionalExit = false;
let restartAttempts = 0;
const MAX_RESTARTS = 8;

function cleanupAndExit(code) {
  intentionalExit = true;
  try { fs.unlinkSync(LOCK_FILE); } catch {}
  process.exit(code ?? 0);
}
process.on("SIGTERM", () => cleanupAndExit(0));
process.on("SIGINT", () => cleanupAndExit(0));

let proxyStarted = false;

function startExpo() {
  killStaleProcesses();
  console.log(`Starting Expo on port ${METRO_PORT}... (attempt ${restartAttempts + 1})`);

  const spawnEnv = Object.assign({}, process.env);
  delete spawnEnv.CI;

  const child = spawn("pnpm", ["exec", "expo", "start", ...args], {
    stdio: ["inherit", "pipe", "pipe"],
    env: spawnEnv,
    cwd: path.join(__dirname, ".."),
  });

  function handleOutput(data) {
    const text = data.toString();
    process.stdout.write(text);

    if (!proxyStarted && (text.includes("Metro waiting") || text.includes("Waiting on"))) {
      proxyStarted = true;
      setTimeout(startManifestProxy, 500);
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
      setTimeout(startExpo, delay);
    } else {
      console.error(`Expo failed after ${MAX_RESTARTS} restart attempts. Giving up.`);
      process.exit(code ?? 1);
    }
  });
}

startExpo();
