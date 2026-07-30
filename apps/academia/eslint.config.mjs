import { dirname } from "path";
import { fileURLToPath } from "url";
import { nextEslintConfig } from "../../eslint.config.base.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Rules, ignores and the FlatCompat mechanism now live in the repo-root base
// config so every app shares one baseline; __dirname is passed through so
// eslint-config-next resolves from this workspace's node_modules.
export default nextEslintConfig(__dirname);
