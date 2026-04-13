# LazyEnv

**English** | [中文](README_zh-CN.md)

**Cross-platform, recoverable, zero-pollution questionnaire-style development environment configuration tool.**

Version: 0.2.0

---

## Overview

LazyEnv is a Windows-native desktop application that guides developers through setting up their development environment via an interactive questionnaire interface. It leverages WebView2 for a modern Win11 Fluent Design UI while providing robust environment variable management with full snapshot and rollback capabilities.

### Core Design Principles

| Principle | Description |
|-----------|-------------|
| **Cross-platform** | Abstracted architecture with platform-specific backends; Windows native support via Win32 + WebView2 (P0) |
| **Recoverable** | Full environment variable snapshot and restore system; automatic pre-install snapshots (P1) |
| **Zero-pollution** | All changes are tracked and reversible; no hidden side effects on the host system |

---

## Architecture

```
LazyEnv/
|-- main.cpp                 // WinMain entry, window creation, message dispatch
|-- webview_host.cpp/h       // WebView2 host management
|-- installer.cpp/h          // Package installation (winget), PATH management
|-- rollback.cpp/h           // Environment variable snapshot & rollback engine
|-- resources/
|   |-- index.html           // Questionnaire UI structure
|   |-- style.css            // Win11 Fluent Design styling
|   |-- script.js            // Frontend interaction logic
|-- LazyEnv.rc               // Icon and version information
|-- CMakeLists.txt           // Build configuration
```

### Communication Model

The application uses a bidirectional message bridge between the native C++ backend and the WebView2 frontend:

- **Web to Native**: `window.chrome.webview.postMessage(JSON.stringify(obj))`
- **Native to Web**: `ICoreWebView2::PostWebMessageAsString(json)`

All messages are JSON-encoded with an `action` field for routing.

---

## Features

### Windows Native Support

- Win32 window with WebView2 embedded browser
- Dark theme matching Windows 11 system appearance
- Minimum window size enforcement (800x600)
- Centered window on launch

### Environment Variable Management

- Read/write environment variables via Windows Registry API
- User-level and system-level variable support
- Automatic PATH management for installed packages
- `WM_SETTINGCHANGE` broadcast for immediate effect

### Fault Tolerance & Recovery

- Automatic snapshot before any installation
- Manual snapshot creation with descriptions
- Full environment restore from any snapshot
- Snapshot storage in `%LOCALAPPDATA%/LazyEnv/snapshots/` as JSON files
- Snapshot listing, restore, and deletion via UI

### Cross-platform Consistency Abstraction

- Namespace-based module separation (`lazyenv::`)
- Platform-agnostic interfaces (`Installer`, `RollbackManager`)
- Backend can be swapped for Linux/macOS implementations
- Frontend is fully platform-independent (HTML/CSS/JS)

---

## Package Catalog

LazyEnv ships with a curated catalog of common development tools:

| Category | Packages |
|----------|----------|
| Languages | Python 3.12, Node.js LTS, Rust, Go, Java JDK 21 |
| Build Tools | CMake, Ninja, LLVM/Clang |
| Version Control | Git, GitHub CLI |
| Editors | VS Code, Neovim |
| Containers | Docker Desktop |
| Databases | PostgreSQL 16, Redis |
| Utilities | jq, ripgrep, fd, fzf, WinSCP |

---

## Build Instructions

### Prerequisites

- Windows 10 version 1903+ or Windows 11
- Visual Studio 2022 with C++ desktop development workload
- CMake 3.24+
- Microsoft Edge WebView2 Runtime (usually pre-installed on Windows 10/11)

### Build Steps

```powershell
# Clone or navigate to the project directory
cd E:\Dev\LazyEnv

# Configure (CMake will auto-download WebView2 SDK and WIL)
cmake -B build -G "Visual Studio 17 2022" -A x64

# Build
cmake --build build --config Release

# The executable will be at build/Release/LazyEnv.exe
# Resources are automatically copied to build/Release/resources/
```

### Icon

The resource file references `resources/lazyenv.ico`. You can generate one or provide your own 256x256 ICO file. To build without an icon, comment out the `IDI_APPICON ICON` line in `LazyEnv.rc`.

---

## Usage

1. **Launch** `LazyEnv.exe`
2. **System Check** - Verifies OS, WebView2 runtime, and winget availability
3. **Select Packages** - Choose development tools from the categorized catalog
4. **Install** - Packages are installed via winget with real-time progress; a snapshot is created automatically before installation begins
5. **Recovery** - View, create, restore, or delete environment snapshots
6. **Summary** - Review all changes made during the session

---

## Data Storage

| Item | Location |
|------|----------|
| Snapshots | `%LOCALAPPDATA%/LazyEnv/snapshots/*.json` |
| WebView2 cache | `%LOCALAPPDATA%/LazyEnv/WebView2/` |

No other files are created or modified outside of these directories and the Windows Registry environment variable keys.

---

## License

MIT License
