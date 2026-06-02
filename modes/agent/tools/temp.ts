import { executeShell } from "./shell-tool";

const result = await executeShell("git status");

console.log(result);