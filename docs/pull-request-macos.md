# Draft upstream pull request

## Title

`feat: add experimental native macOS WKWebView support`

## Base and head

- Base: `obgnail/typora_plugin:master`
- Head: `pennyzhaozhao/typora_plugin:feature/macos-support`

## Description

This PR proposes experimental support for Typora 1.14.15's native macOS WKWebView runtime while preserving the existing Windows/Linux paths. It does not redistribute Typora, modify minified Typora sources, weaken Gatekeeper/SIP, or claim notarization or official support.

### Architecture

- A small WKWebView loader preserves Typora's native `window.require` and supplies only the CommonJS/path/process/buffer compatibility required by the plugin framework.
- A loopback Node.js bridge provides an explicit RPC method allowlist for required filesystem operations. It requires a 256-bit token and exact file Origin, separates read and write roots, rejects symlinks, limits request/read size, and exposes no general shell or network execution.
- The macOS installer creates a separate `/private/tmp` application copy, keeps configuration outside the signed bundle, records transactional/original backups, rotates credentials, writes a private LaunchAgent, and performs inside-out ad-hoc development signing.
- The uninstaller restores the original bundle state, cleans LaunchAgent credentials, supports repeated invocation, and rolls back a partial uninstall.

### Compatibility evidence

The original framework container and these six plugins were interactively tested in Typora 1.14.15 on macOS arm64:

- `callouts`
- `editor_width_slider`
- `collapse_paragraph`
- `fence_enhance`
- `command_palette`
- `markmap`

Each test verified JavaScript initialization, rendered UI, real interaction, and persistence where applicable. Command-palette and modifier-click shortcuts passed, repeated cold startup passed, and authenticated runtime reports were observed beyond the former ten-second lifecycle timeout. The universal vendor app and architecture-specific synthetic CI cover arm64/x86_64 mechanics; physical x86_64 interactive testing remains outstanding.

### Security review

The review fixed writable plugin roots, absent Origin enforcement, symlink traversal, overly detailed unauthenticated health output, unbounded reads, weak permissions, repeat-install signing failures, and incomplete installer/uninstaller rollback. Residual same-user token exposure and development-only library-validation entitlements are documented in `docs/macos-security-audit.md`.

### Tests

- Node.js 22.23.5 full suite: 1,671 tests; 1,670 passed; 0 failed; 1 skipped; no hang
- Focused macOS/security suite: 18 passed; 0 failed
- Synthetic dry-run/install/reinstall/failed-install rollback/failed-uninstall rollback/uninstall: passed locally
- Real isolated app uninstall/reinstall and `codesign --verify --deep --strict`: passed
- GitHub Actions: Ubuntu Node 22/24 and macOS 15 arm64/x86_64 results must be inserted here after the public run completes

### Limitations

- experimental support for Typora 1.14.15 only
- only the six listed plugins are claimed compatible
- ad-hoc signed and not Apple-notarized
- same-user processes can read the embedded bridge token
- no physical Intel Mac interactive run yet
- macOS CI uses a synthetic Typora fixture and cannot replace interactive testing

### Reviewer notes

The macOS implementation is isolated behind platform-specific loader, bridge, installer, signing, and documentation files. Windows/Linux behavior and the upstream release workflow remain intact. No version tag or release publication is part of this PR.
