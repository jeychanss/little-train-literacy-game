import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const theme = process.argv[2];
const allowedThemes = ["train", "rescue"];

if (!allowedThemes.includes(theme)) {
  console.error(`用法: npm run theme -- <${allowedThemes.join("|")}>`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, "../src/themes/active-theme.json");
const current = JSON.parse(await readFile(configPath, "utf8"));

if (current.theme === theme) {
  console.log(`默认主题已经是 ${theme}`);
  process.exit(0);
}

await writeFile(configPath, `${JSON.stringify({ theme }, null, 2)}\n`, "utf8");
console.log(`默认主题已切换为 ${theme}`);
