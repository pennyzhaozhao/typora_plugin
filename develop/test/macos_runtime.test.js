"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const vm = require("node:vm")
const os = require("node:os")
const { spawnSync } = require("node:child_process")

test("probe records WKWebView capabilities without privileged access", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../plugin/macos/probe.js"), "utf8")
  const attributes = {}
  const window = {
    File: { editor: {}, getMountFolder() {} },
    JSBridge: { invoke() {} },
    SystemJS: { import() {} },
    _options: { appVersion: "1.14.15" },
  }
  const context = {
    window,
    document: { readyState: "interactive", documentElement: { setAttribute(name, value) { attributes[name] = value } } },
    navigator: { userAgent: "WKWebView test" },
    location: { protocol: "file:" },
    console: { info() {} },
    Date,
  }
  vm.runInNewContext(source, context)
  assert.equal(window.__typoraMacProbe.typoraVersion, "1.14.15")
  assert.equal(window.__typoraMacProbe.capabilities.jsBridgeInvoke, true)
  assert.equal(window.__typoraMacProbe.capabilities.reqnode, false)
  assert.equal(attributes["data-typora-macos-probe"], "loaded")
})

test("runtime and bridge do not expose shell execution or wildcard CORS", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../../plugin/macos/bridge.js"), "utf8")
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  const core = fs.readFileSync(path.join(__dirname, "../../plugin/global/core/index.js"), "utf8")
  assert.doesNotMatch(bridge, /child_process|execSync|spawnSync|Access-Control-Allow-Origin["']\s*[:,]\s*["']\*/)
  assert.doesNotMatch(loader, /reqnode\(["']child_process/)
  assert.match(loader, /%%TYPORA_MACOS_BRIDGE_TOKEN%%/)
  assert.doesNotThrow(() => new vm.Script(loader))
  assert.doesNotMatch(loader, /window\.require\s*=/)
  assert.match(loader, /shellExecution: false/)
  assert.match(core, /secure macOS adapter does not expose arbitrary shell execution/)
})

test("WKWebView adapter supplies safe process and buffer compatibility shims", () => {
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  assert.match(loader, /request === "buffer"/)
  assert.match(loader, /request === "process"/)
  assert.match(loader, /id === "buffer"\) return \{ Buffer: window\.Buffer \}/)
  assert.match(loader, /id === "process"\) return window\.process/)
  assert.match(loader, /readdir: fs\.promises\.readdir/)
  assert.match(loader, /stat: fs\.promises\.stat/)
  assert.match(loader, /lstat: fs\.promises\.lstat/)
  assert.match(loader, /isSymbolicLink/)
  assert.doesNotMatch(loader, /require\(["']buffer["']\)/)
})

test("WKWebView directory walking and tabs tolerate unavailable Electron APIs", () => {
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  const tabs = fs.readFileSync(path.join(__dirname, "../../plugin/window_tab/index.js"), "utf8")
  const sidebar = fs.readFileSync(path.join(__dirname, "../../plugin/sidebar_enhance.js"), "utf8")
  assert.match(loader, /lstat: function \(file\)/)
  assert.match(loader, /stat: function \(file\)/)
  assert.match(tabs, /if \(process\.platform === "darwin"\) return/)
  assert.match(tabs, /if \(!ipcRenderer\?\.on\) return/)
  assert.match(tabs, /!this\.entities\.header/)
  assert.match(sidebar, /__typoraMacCapabilities\?\.documentFilesystem !== false/)
  assert.match(sidebar, /secure macOS adapter does not grant recursive document-directory access/)
  assert.doesNotThrow(() => new vm.Script(loader))
})

test("WKWebView module directory fallback does not throw an expected load error", () => {
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  assert.match(loader, /readBundle\(id, true\)/)
  assert.match(loader, /if \(allowMissing\) return null/)
  assert.doesNotMatch(loader, /catch \(firstError\)/)
})

test("macOS scripts detect platform and protect the production app", () => {
  const installer = fs.readFileSync(path.join(__dirname, "../../plugin/bin/install_macos.sh"), "utf8")
  assert.match(installer, /uname -s/)
  assert.match(installer, /--allow-production/)
  assert.match(installer, /fileprovider/)
  assert.match(installer, /CONFIG_ROOT="\$HOME\/\.config\/typora_plugin"/)
  assert.match(installer, /SUPPORTED_VERSION="1\.14\.15"/)
  assert.match(installer, /\/private\/tmp\/Typora-Plugin-Beta\.app/)
})

test("macOS runtime settings helper can enable an interacting plugin group", () => {
  const root = path.join(__dirname, "../..")
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "typora-plugin-settings-"))
  const settings = path.join(dir, "settings.user.toml")
  const plan = path.join(dir, "macos-runtime-test.json")
  const plugins = ["action_buttons", "preferences", "right_click_menu", "text_stylize"]
  const result = spawnSync(process.execPath, [
    path.join(root, "plugin/macos/bin/make_test_settings.js"),
    path.join(root, "plugin/global/settings/settings.default.toml"),
    plugins.join(","),
    settings,
    plan,
    "/private/tmp/test.md",
  ], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  const content = fs.readFileSync(settings, "utf8")
  for (const plugin of plugins) {
    assert.match(content, new RegExp(`\\[${plugin}\\]\\nENABLE = true`))
  }
  assert.match(content, /\[markmap\]\nENABLE = false/)
  assert.deepEqual(JSON.parse(fs.readFileSync(plan, "utf8")), {
    plugin: "shell_ui",
    plugins,
    document: "/private/tmp/test.md",
  })
})

test("macOS runtime tester covers the full plugin interaction shell", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../plugin/macos/runtime_test.js"), "utf8")
  assert.match(source, /pluginName === "shell_ui"/)
  assert.match(source, /#plugin-action-buttons/)
  assert.match(source, /\.plugin-preferences-mask/)
  assert.match(source, /#context-menu/)
  assert.match(source, /#plugin-text-stylize/)
  assert.doesNotThrow(() => new vm.Script(source))
})
