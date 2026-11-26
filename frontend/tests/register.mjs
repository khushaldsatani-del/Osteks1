// Lets Node's built-in test runner load the app's source files, which
// import each other without file extensions ("./format") the way Vite
// allows. Used by `npm test` (node --import ./tests/register.mjs --test).
import { register } from "node:module";

register("./resolve-extensionless.mjs", import.meta.url);
