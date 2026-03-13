#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");

const TUNNEL_FILE = "/tmp/expo-tunnel-url.txt";
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";

try {
  execSync("pkill -f ngrok || true", { stdio: "ignore" });
} catch {}

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

setTimeout(() => {
  const args = process.argv.slice(2);
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
}, 2000);
