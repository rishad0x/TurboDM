import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const electronDir = path.join("node_modules", "electron");
const marker = path.join(electronDir, "path.txt");
const dist = path.join(electronDir, "dist");

function finish() {
    spawnSync(process.execPath, [path.join("scripts", "brand-exe.js")], { stdio: "inherit" });
    process.exit(0);
}

if (!fs.existsSync(electronDir)) {
    console.log("electron package not present yet — skipping binary download");
    process.exit(0);
}
if (fs.existsSync(marker) && fs.existsSync(dist)) {
    console.log("electron binary already present");
    finish();
}

console.log("downloading electron binary…");
const res = spawnSync(process.execPath, [path.join(electronDir, "install.js")], { stdio: "inherit" });
if (res.status !== 0) {
            console.warn("⚠ Electron binary download failed (offline?). Run `bun run postinstall` once online.");
}
finish();
