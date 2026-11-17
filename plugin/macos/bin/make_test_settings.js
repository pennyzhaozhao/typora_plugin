#!/usr/bin/env node
"use strict"

const fs = require("fs")

const [sourceFile, pluginList, settingsFile, planFile, documentFile] = process.argv.slice(2)
if (!sourceFile || !pluginList || !settingsFile || !planFile) {
  console.error("usage: make_test_settings.js <settings.default.toml> <plugin[,plugin...]> <settings.user.toml> <macos-runtime-test.json>")
  process.exit(64)
}

const pluginNames = [...new Set(pluginList.split(",").map(name => name.trim()).filter(Boolean))]
if (pluginNames.length === 0) throw new Error("at least one plugin is required")

const source = fs.readFileSync(sourceFile, "utf8")
const sections = []
let section = null
for (const line of source.split(/\r?\n/)) {
  const heading = line.match(/^\[([^.[\]]+)]$/)
  if (heading) section = heading[1]
  if (section && /^ENABLE\s*=/.test(line) && !sections.includes(section)) sections.push(section)
}
for (const pluginName of pluginNames) {
  if (!sections.includes(pluginName)) throw new Error(`unknown plugin: ${pluginName}`)
}

const enabled = new Set(["global", ...pluginNames])
const content = sections.map(name => `[${name}]\nENABLE = ${enabled.has(name)}`).join("\n\n") + "\n"
fs.writeFileSync(settingsFile, content)
const plugin = pluginNames.length === 1 ? pluginNames[0] : "shell_ui"
fs.writeFileSync(planFile, JSON.stringify({ plugin, plugins: pluginNames, document: documentFile || undefined }, null, 2) + "\n")
