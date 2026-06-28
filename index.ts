#!/usr/bin/env bun

import { Command } from "commander"
import { runWakeup } from "./tui/wakeup";

const program = new Command();

program.name("jarvis-build").description("J.A.R.V.I.S").version("O.O.1")
program.command("wakeup").description("start OpenClaw in conversation mode")
.action(
    async()=>{
        await runWakeup()
    }
);

await program.parse(process.argv)
