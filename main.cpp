// LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
// Copyright (C) 2026 Rein
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// ============================================================================
// LazyEnv - main.cpp
// WinMain entry: borderless window, DPI-aware, native<->web bridge
// ============================================================================

#include "webview_host.h"
#include "installer.h"
#include "rollback.h"

#include <Windows.h>
#include <windowsx.h>
#include <shellapi.h>
#include <dwmapi.h>
#include <shellscalingapi.h>
#include <ShObjIdl.h>
#include <VersionHelpers.h>

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "shcore.lib")

#include <string>
#include <sstream>
#include <fstream>
#include <filesystem>
#include <thread>
#include <format>
#include <vector>
#include <algorithm>

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
static constexpr wchar_t kWindowClass[] = L"LazyEnvMainWindow";
static constexpr wchar_t kWindowTitle[] = L"LazyEnv";
static constexpr int     kDefaultWidth  = 1100;
static constexpr int     kDefaultHeight = 750;

static lazyenv::WebViewHost     g_webview;
static lazyenv::Installer       g_installer;
static lazyenv::RollbackManager g_rollback;
// g_msgMutex is no longer needed; postMessage is now thread-safe via message queue
static HWND                     g_mainWindow = nullptr;
static bool                     g_isMaximized = false;

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
namespace {

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 32);
    for (char c : s) {
        switch (c) {
            case '\"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned char>(c));
                    out += buf;
                } else {
                    out += c;
                }
                break;
        }
    }
    return out;
}

std::string extractJsonValue(const std::string& json, const std::string& key) {
    std::string needle = "\"" + key + "\"";
    auto pos = json.find(needle);
    if (pos == std::string::npos) return "";
    pos = json.find('\"', pos + needle.size() + 1);
    if (pos == std::string::npos) return "";
    ++pos;
    std::string result;
    for (; pos < json.size(); ++pos) {
        if (json[pos] == '\\' && pos + 1 < json.size()) {
            ++pos;
            switch (json[pos]) {
                case '\"': result += '\"'; break;
                case '\\': result += '\\'; break;
                case 'n':  result += '\n'; break;
                case 'r':  result += '\r'; break;
                case 't':  result += '\t'; break;
                default:   result += json[pos]; break;
            }
        } else if (json[pos] == '\"') {
            break;
        } else {
            result += json[pos];
        }
    }
    return result;
}

std::vector<std::string> extractJsonArray(const std::string& json,
                                          const std::string& key) {
    std::vector<std::string> result;
    std::string needle = "\"" + key + "\"";
    auto pos = json.find(needle);
    if (pos == std::string::npos) return result;
    pos = json.find('[', pos);
    if (pos == std::string::npos) return result;
    auto end = json.find(']', pos);
    if (end == std::string::npos) return result;
    std::string arr = json.substr(pos + 1, end - pos - 1);
    size_t i = 0;
    while (i < arr.size()) {
        auto q1 = arr.find('\"', i);
        if (q1 == std::string::npos) break;
        auto q2 = arr.find('\"', q1 + 1);
        if (q2 == std::string::npos) break;
        result.push_back(arr.substr(q1 + 1, q2 - q1 - 1));
        i = q2 + 1;
    }
    return result;
}

std::wstring getHtmlUri() {
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::filesystem::path base = std::filesystem::path(exePath).parent_path();
    std::filesystem::path htmlPath = base / "resources" / "index.html";

    // Convert to file:// URI
    // Windows path: C:\foo\bar -> file:///C:/foo/bar
    std::wstring wpath = htmlPath.wstring();
    // Replace backslashes with forward slashes
    for (auto& ch : wpath) {
        if (ch == L'\\') ch = L'/';
    }
    return L"file:///" + wpath;
}

// Detect installed development environments on the system
std::string detectInstalledEnvironments() {
    struct EnvCheck {
        std::string name;
        std::string command;
        std::string versionFlag;
        std::string category;
    };

    std::vector<EnvCheck> checks = {
        {"Python",       "python",    "--version", "language"},
        {"Python 3",     "python3",   "--version", "language"},
        {"Node.js",      "node",      "--version", "language"},
        {"Go",           "go",        "version",   "language"},
        {"Rust (rustc)", "rustc",     "--version", "language"},
        {"Rust (cargo)", "cargo",     "--version", "language"},
        {"Java",         "java",      "-version",  "language"},
        {"Ruby",         "ruby",      "--version", "language"},
        {"PHP",          "php",       "--version", "language"},
        {"Perl",         "perl",      "--version", "language"},
        {"Lua",          "lua",       "-v",        "language"},
        {"Dart",         "dart",      "--version", "language"},
        {"Kotlin",       "kotlin",    "-version",  "language"},
        {"Swift",        "swift",     "--version", "language"},
        {"Zig",          "zig",       "version",   "language"},
        {"Deno",         "deno",      "--version", "language"},
        {"Bun",          "bun",       "--version", "language"},
        {"Git",          "git",       "--version", "tool"},
        {"CMake",        "cmake",     "--version", "tool"},
        {"Ninja",        "ninja",     "--version", "tool"},
        {"Make",         "make",      "--version", "tool"},
        {"GCC",          "gcc",       "--version", "tool"},
        {"G++",          "g++",       "--version", "tool"},
        {"Clang",        "clang",     "--version", "tool"},
        {"MSVC (cl)",    "cl",        "",          "tool"},
        {"Docker",       "docker",    "--version", "runtime"},
        {"npm",          "npm",       "--version", "tool"},
        {"yarn",         "yarn",      "--version", "tool"},
        {"pnpm",         "pnpm",      "--version", "tool"},
        {"pip",          "pip",       "--version", "tool"},
        {"conda",        "conda",     "--version", "tool"},
        {"dotnet",       "dotnet",    "--version", "language"},
        {"PowerShell",   "pwsh",      "--version", "tool"},
        {"GitHub CLI",   "gh",        "--version", "tool"},
        {"FFmpeg",       "ffmpeg",    "-version",  "utility"},
        {"curl",         "curl",      "--version", "utility"},
        {"wget",         "wget",      "--version", "utility"},
        {"jq",           "jq",        "--version", "utility"},
        {"ripgrep",      "rg",        "--version", "utility"},
        {"fd",           "fd",        "--version", "utility"},
        {"fzf",          "fzf",       "--version", "utility"},
    };

    std::ostringstream os;
    os << "[";
    bool first = true;

    for (auto& chk : checks) {
        std::string output;
        std::string cmd = chk.command;
        if (!chk.versionFlag.empty()) {
            cmd += " " + chk.versionFlag;
        }
        cmd += " 2>&1";

        int rc = lazyenv::Installer::runCommand(cmd, output, 5000);

        // Extract first line of output as version
        std::string version;
        if (rc == 0 && !output.empty()) {
            auto nl = output.find('\n');
            version = output.substr(0, nl == std::string::npos ? output.size() : nl);
            while (!version.empty() && (version.back() == '\r' || version.back() == '\n' || version.back() == ' '))
                version.pop_back();
            if (version.size() > 120) version = version.substr(0, 120);
        }

        if (rc == 0 && !version.empty()) {
            if (!first) os << ",";
            first = false;
            os << "{\"name\":\"" << jsonEscape(chk.name)
               << "\",\"command\":\"" << jsonEscape(chk.command)
               << "\",\"version\":\"" << jsonEscape(version)
               << "\",\"category\":\"" << jsonEscape(chk.category)
               << "\"}";
        }
    }
    os << "]";
    return os.str();
}

// Probe a single command: run "command --version" (and fallbacks) to detect it
std::string probeCommand(const std::string& command, const std::string& category) {
    // Try common version flags
    std::vector<std::string> flags = {"--version", "-version", "-v", "version", ""};

    for (auto& flag : flags) {
        std::string cmd = command;
        if (!flag.empty()) cmd += " " + flag;
        cmd += " 2>&1";

        std::string output;
        int rc = lazyenv::Installer::runCommand(cmd, output, 5000);

        if (rc == 0 && !output.empty()) {
            auto nl = output.find('\n');
            std::string version = output.substr(0, nl == std::string::npos ? output.size() : nl);
            while (!version.empty() && (version.back() == '\r' || version.back() == '\n' || version.back() == ' '))
                version.pop_back();
            if (version.size() > 120) version = version.substr(0, 120);

            if (!version.empty()) {
                return std::format(
                    "{{\"action\":\"probeResult\",\"found\":true,"
                    "\"name\":\"{}\",\"command\":\"{}\","
                    "\"version\":\"{}\",\"category\":\"{}\"}}",
                    jsonEscape(command), jsonEscape(command),
                    jsonEscape(version), jsonEscape(category));
            }
        }
    }

    return std::format(
        "{{\"action\":\"probeResult\",\"found\":false,"
        "\"command\":\"{}\",\"message\":\"Command not found or not recognized.\"}}",
        jsonEscape(command));
}

} // anonymous namespace

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
std::string handleWebMessage(const std::string& message) {
    std::string action = extractJsonValue(message, "action");

    // ------ Window controls ------
    if (action == "windowMinimize") {
        ShowWindow(g_mainWindow, SW_MINIMIZE);
        return "";
    }
    if (action == "windowMaximize") {
        if (g_isMaximized) {
            ShowWindow(g_mainWindow, SW_RESTORE);
            g_isMaximized = false;
        } else {
            ShowWindow(g_mainWindow, SW_MAXIMIZE);
            g_isMaximized = true;
        }
        return std::format("{{\"action\":\"windowState\",\"maximized\":{}}}", g_isMaximized ? "true" : "false");
    }
    if (action == "windowClose") {
        PostMessage(g_mainWindow, WM_CLOSE, 0, 0);
        return "";
    }

    // ------ Window drag (triggered from JS on titlebar mousedown) ------
    if (action == "windowDragStart") {
        // Post to the main window's message queue so it executes outside
        // the WebView2 callback context. This allows the system drag loop
        // to work correctly.
        PostMessageW(g_mainWindow, lazyenv::WM_WEBVIEW_DRAG_START, 0, 0);
        return "";
    }

    // ------ Detect installed environments ------
    if (action == "detectEnvironments") {
        std::thread([]() {
            std::string envJson = detectInstalledEnvironments();
            std::string respMsg = "{\"action\":\"environmentsDetected\",\"environments\":" + envJson + "}";
            g_webview.postMessage(respMsg);
        }).detach();
        return "{\"action\":\"detectStarted\"}";
    }

    // ------ Probe a single command (manual add) ------
    if (action == "probeCommand") {
        std::string cmd = extractJsonValue(message, "command");
        std::string cat = extractJsonValue(message, "category");
        if (cat.empty()) cat = "other";

        std::thread([cmd, cat]() {
            std::string result = probeCommand(cmd, cat);
            g_webview.postMessage(result);
        }).detach();
        return "{\"action\":\"probeStarted\"}";
    }

    // ------ Uninstall package ------
    if (action == "uninstallPackage") {
        std::string pkgName = extractJsonValue(message, "command");
        std::thread([pkgName]() {
            std::string output;
            std::string cmd = "winget uninstall --name \"" + pkgName + "\" --silent --accept-source-agreements 2>&1";
            int rc = lazyenv::Installer::runCommand(cmd, output, 300000);
            std::string respMsg = std::format(
                "{{\"action\":\"uninstallResult\",\"command\":\"{}\",\"success\":{},\"output\":\"{}\"}}",
                jsonEscape(pkgName), rc == 0 ? "true" : "false", jsonEscape(output.substr(0, 500)));
            g_webview.postMessage(respMsg);
        }).detach();
        return "{\"action\":\"uninstallStarted\"}";
    }

    // ------ Get catalog ------
    if (action == "getCatalog") {
        auto catalog = lazyenv::getDefaultCatalog();
        std::ostringstream os;
        os << "{\"action\":\"catalogData\",\"packages\":[";
        for (size_t i = 0; i < catalog.size(); ++i) {
            auto& p = catalog[i];
            os << "{\"id\":\"" << jsonEscape(p.id)
               << "\",\"name\":\"" << jsonEscape(p.displayName)
               << "\",\"category\":\"" << jsonEscape(p.category)
               << "\",\"description\":\"" << jsonEscape(p.description)
               << "\"}";
            if (i + 1 < catalog.size()) os << ",";
        }
        os << "]}";
        return os.str();
    }

    // ------ Check winget ------
    if (action == "checkWinget") {
        bool ok = lazyenv::Installer::isWingetAvailable();
        return std::format("{{\"action\":\"wingetStatus\",\"available\":{}}}", ok ? "true" : "false");
    }

    // ------ Install packages (async, with streaming log) ------
    if (action == "install") {
        auto ids = extractJsonArray(message, "packages");
        auto catalog = lazyenv::getDefaultCatalog();
        std::string snapId = g_rollback.createSnapshot("Pre-install snapshot");

        std::thread([ids, catalog, snapId]() {
            int total = static_cast<int>(ids.size());
            int current = 0;

            for (auto& id : ids) {
                lazyenv::PackageInfo pkg;
                bool found = false;
                for (auto& p : catalog) {
                    if (p.id == id) { pkg = p; found = true; break; }
                }
                if (!found) {
                    pkg.id = id;
                    pkg.displayName = id;
                }

                std::string cmdLine = std::format(
                    "winget install --id {} --exact --silent "
                    "--accept-package-agreements --accept-source-agreements",
                    pkg.id);

                // Send "running" status
                {
                    std::string m = std::format(
                        "{{\"action\":\"installProgress\",\"packageId\":\"{}\","
                        "\"status\":\"running\",\"message\":\"Installing {}...\","
                        "\"command\":\"{}\",\"current\":{},\"total\":{}}}",
                        jsonEscape(id), jsonEscape(pkg.displayName),
                        jsonEscape(cmdLine), current, total);
                    g_webview.postMessage(m);
                }

                // Run with streaming output
                std::string fullOutput;
                std::string pkgId = id;  // copy for lambda capture
                int exitCode = lazyenv::Installer::runCommandStreaming(
                    cmdLine, fullOutput,
                    [pkgId](const std::string& line) {
                        std::string m = std::format(
                            "{{\"action\":\"installLog\",\"packageId\":\"{}\","
                            "\"line\":\"{}\"}}",
                            jsonEscape(pkgId), jsonEscape(line));
                        g_webview.postMessage(m);
                    },
                    600000);

                ++current;

                // Determine final status
                std::string statusStr;
                if (exitCode == 0) {
                    statusStr = "success";
                    if (pkg.addToPath && !pkg.defaultPath.empty())
                        lazyenv::Installer::addToUserPath(pkg.defaultPath);
                } else if (fullOutput.find("already installed") != std::string::npos ||
                           fullOutput.find("No available upgrade") != std::string::npos) {
                    statusStr = "skipped";
                } else {
                    statusStr = "failed";
                }

                {
                    std::string m = std::format(
                        "{{\"action\":\"installProgress\",\"packageId\":\"{}\","
                        "\"status\":\"{}\",\"message\":\"{}\","
                        "\"command\":\"{}\",\"output\":\"{}\","
                        "\"exitCode\":{},\"current\":{},\"total\":{}}}",
                        jsonEscape(id), statusStr,
                        jsonEscape(pkg.displayName + ": " + statusStr),
                        jsonEscape(cmdLine),
                        jsonEscape(fullOutput.substr(0, 2000)),
                        exitCode, current, total);
                    g_webview.postMessage(m);
                }
            }

            {
                std::string m = std::format(
                    "{{\"action\":\"installComplete\",\"snapshotId\":\"{}\"}}",
                    jsonEscape(snapId));
                g_webview.postMessage(m);
            }
        }).detach();

        return std::format("{{\"action\":\"installStarted\",\"snapshotId\":\"{}\"}}", jsonEscape(snapId));
    }

    // ------ Retry single package (also streaming) ------
    if (action == "retryInstall") {
        std::string id = extractJsonValue(message, "packageId");
        auto catalog = lazyenv::getDefaultCatalog();

        std::thread([id, catalog]() {
            lazyenv::PackageInfo pkg;
            for (auto& p : catalog) {
                if (p.id == id) { pkg = p; break; }
            }
            if (pkg.id.empty()) {
                pkg.id = id;
                pkg.displayName = id;
            }

            std::string cmdLine = std::format(
                "winget install --id {} --exact --silent "
                "--accept-package-agreements --accept-source-agreements",
                pkg.id);

            {
                std::string m = std::format(
                    "{{\"action\":\"installProgress\",\"packageId\":\"{}\","
                    "\"status\":\"running\",\"message\":\"Retrying {}...\","
                    "\"command\":\"{}\"}}",
                    jsonEscape(id), jsonEscape(pkg.displayName), jsonEscape(cmdLine));
                g_webview.postMessage(m);
            }

            std::string fullOutput;
            std::string retryId = id;  // copy for lambda capture
            int exitCode = lazyenv::Installer::runCommandStreaming(
                cmdLine, fullOutput,
                [retryId](const std::string& line) {
                    std::string m = std::format(
                        "{{\"action\":\"installLog\",\"packageId\":\"{}\","
                        "\"line\":\"{}\"}}",
                        jsonEscape(retryId), jsonEscape(line));
                    g_webview.postMessage(m);
                },
                600000);

            std::string statusStr;
            if (exitCode == 0) {
                statusStr = "success";
            } else if (fullOutput.find("already installed") != std::string::npos ||
                       fullOutput.find("No available upgrade") != std::string::npos) {
                statusStr = "skipped";
            } else {
                statusStr = "failed";
            }

            {
                std::string m = std::format(
                    "{{\"action\":\"installProgress\",\"packageId\":\"{}\","
                    "\"status\":\"{}\",\"message\":\"{}\","
                    "\"command\":\"{}\",\"output\":\"{}\",\"exitCode\":{}}}",
                    jsonEscape(id), statusStr,
                    jsonEscape(pkg.displayName + ": " + statusStr),
                    jsonEscape(cmdLine),
                    jsonEscape(fullOutput.substr(0, 2000)),
                    exitCode);
                g_webview.postMessage(m);
            }
        }).detach();

        return "{\"action\":\"retryStarted\"}";
    }

    // ------ Create snapshot ------
    if (action == "createSnapshot") {
        std::string desc = extractJsonValue(message, "description");
        std::string id = g_rollback.createSnapshot(desc);
        return std::format("{{\"action\":\"snapshotCreated\",\"id\":\"{}\"}}", jsonEscape(id));
    }

    // ------ List snapshots ------
    if (action == "listSnapshots") {
        auto snaps = g_rollback.listSnapshots();
        std::ostringstream os;
        os << "{\"action\":\"snapshotList\",\"snapshots\":[";
        for (size_t i = 0; i < snaps.size(); ++i) {
            os << "{\"id\":\"" << jsonEscape(snaps[i].id)
               << "\",\"timestamp\":\"" << jsonEscape(snaps[i].timestamp)
               << "\",\"description\":\"" << jsonEscape(snaps[i].description)
               << "\",\"userVarCount\":" << snaps[i].user_env.size()
               << ",\"systemVarCount\":" << snaps[i].system_env.size()
               << "}";
            if (i + 1 < snaps.size()) os << ",";
        }
        os << "]}";
        return os.str();
    }

    // ------ Restore snapshot ------
    if (action == "restoreSnapshot") {
        std::string id = extractJsonValue(message, "snapshotId");
        bool ok = g_rollback.restoreSnapshot(id);
        return std::format("{{\"action\":\"restoreResult\",\"success\":{},\"snapshotId\":\"{}\"}}",
                           ok ? "true" : "false", jsonEscape(id));
    }

    // ------ Delete snapshot ------
    if (action == "deleteSnapshot") {
        std::string id = extractJsonValue(message, "snapshotId");
        bool ok = g_rollback.deleteSnapshot(id);
        return std::format("{{\"action\":\"deleteResult\",\"success\":{},\"snapshotId\":\"{}\"}}",
                           ok ? "true" : "false", jsonEscape(id));
    }

    // ------ Export snapshot to file ------
    if (action == "exportSnapshot") {
        std::string id = extractJsonValue(message, "snapshotId");

        // Open a Save File dialog on the UI thread via PostMessage would be
        // complex; instead we use the COM file dialog directly here since
        // handleWebMessage is called from the UI thread context.
        HWND owner = g_mainWindow;
        std::thread([id, owner]() {
            // Must CoInitialize for file dialog on this thread
            CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

            IFileSaveDialog* pDialog = nullptr;
            HRESULT hr = CoCreateInstance(CLSID_FileSaveDialog, nullptr,
                                          CLSCTX_INPROC_SERVER,
                                          IID_PPV_ARGS(&pDialog));
            if (SUCCEEDED(hr)) {
                COMDLG_FILTERSPEC filter[] = {
                    { L"JSON Files", L"*.json" },
                    { L"All Files", L"*.*" }
                };
                pDialog->SetFileTypes(2, filter);
                pDialog->SetDefaultExtension(L"json");

                std::wstring defaultName = L"snapshot_" +
                    std::wstring(id.begin(), id.end()).substr(0, 8) + L".json";
                pDialog->SetFileName(defaultName.c_str());

                hr = pDialog->Show(owner);
                if (SUCCEEDED(hr)) {
                    IShellItem* pItem = nullptr;
                    hr = pDialog->GetResult(&pItem);
                    if (SUCCEEDED(hr)) {
                        PWSTR filePath = nullptr;
                        pItem->GetDisplayName(SIGDN_FILESYSPATH, &filePath);
                        if (filePath) {
                            // Convert wide path to UTF-8
                            int len = WideCharToMultiByte(CP_UTF8, 0, filePath, -1,
                                                         nullptr, 0, nullptr, nullptr);
                            std::string destPath(len - 1, '\0');
                            WideCharToMultiByte(CP_UTF8, 0, filePath, -1,
                                               destPath.data(), len, nullptr, nullptr);
                            CoTaskMemFree(filePath);

                            bool ok = g_rollback.exportSnapshot(id, destPath);
                            std::string m = std::format(
                                "{{\"action\":\"exportResult\",\"success\":{},"
                                "\"snapshotId\":\"{}\"}}",
                                ok ? "true" : "false", jsonEscape(id));
                            g_webview.postMessage(m);
                        }
                        pItem->Release();
                    }
                }
                pDialog->Release();
            }
            CoUninitialize();
        }).detach();

        return "";
    }

    // ------ Import snapshot from file ------
    if (action == "importSnapshot") {
        HWND owner = g_mainWindow;
        std::thread([owner]() {
            CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

            IFileOpenDialog* pDialog = nullptr;
            HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr,
                                          CLSCTX_INPROC_SERVER,
                                          IID_PPV_ARGS(&pDialog));
            if (SUCCEEDED(hr)) {
                COMDLG_FILTERSPEC filter[] = {
                    { L"JSON Files", L"*.json" },
                    { L"All Files", L"*.*" }
                };
                pDialog->SetFileTypes(2, filter);

                hr = pDialog->Show(owner);
                if (SUCCEEDED(hr)) {
                    IShellItem* pItem = nullptr;
                    hr = pDialog->GetResult(&pItem);
                    if (SUCCEEDED(hr)) {
                        PWSTR filePath = nullptr;
                        pItem->GetDisplayName(SIGDN_FILESYSPATH, &filePath);
                        if (filePath) {
                            int len = WideCharToMultiByte(CP_UTF8, 0, filePath, -1,
                                                         nullptr, 0, nullptr, nullptr);
                            std::string srcPath(len - 1, '\0');
                            WideCharToMultiByte(CP_UTF8, 0, filePath, -1,
                                               srcPath.data(), len, nullptr, nullptr);
                            CoTaskMemFree(filePath);

                            std::string newId = g_rollback.importSnapshot(srcPath);
                            bool ok = !newId.empty();
                            std::string m = std::format(
                                "{{\"action\":\"importResult\",\"success\":{},"
                                "\"snapshotId\":\"{}\"}}",
                                ok ? "true" : "false", jsonEscape(newId));
                            g_webview.postMessage(m);
                        }
                        pItem->Release();
                    }
                }
                pDialog->Release();
            }
            CoUninitialize();
        }).detach();

        return "";
    }

    // ------ Check command ------
    if (action == "checkCommand") {
        std::string cmd = extractJsonValue(message, "command");
        bool ok = lazyenv::Installer::isCommandAvailable(cmd);
        return std::format("{{\"action\":\"commandCheck\",\"command\":\"{}\",\"available\":{}}}",
                           jsonEscape(cmd), ok ? "true" : "false");
    }

    // ------ List environment variables (for Settings page) ------
    if (action == "listEnvVars") {
        std::string scope = extractJsonValue(message, "scope");
        bool sys = (scope == "system");

        // Use captureRegistryKey indirectly via a temporary snapshot approach,
        // or directly enumerate the registry. We'll enumerate directly.
        HKEY root = sys ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER;
        const wchar_t* subKey = sys
            ? L"SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"
            : L"Environment";

        HKEY hKey = nullptr;
        LONG rc = RegOpenKeyExW(root, subKey, 0, KEY_READ, &hKey);

        std::ostringstream os;
        os << "{\"action\":\"envVarList\",\"variables\":[";
        bool first = true;

        if (rc == ERROR_SUCCESS) {
            DWORD index = 0;
            wchar_t nameBuf[1024];
            BYTE valueBuf[32768];
            DWORD nameLen, valueLen, type;

            while (true) {
                nameLen = 1024;
                valueLen = 32768;
                rc = RegEnumValueW(hKey, index, nameBuf, &nameLen,
                                   nullptr, &type, valueBuf, &valueLen);
                if (rc != ERROR_SUCCESS) break;

                // Convert name to UTF-8
                int nl = WideCharToMultiByte(CP_UTF8, 0, nameBuf, nameLen,
                                            nullptr, 0, nullptr, nullptr);
                std::string nameUtf8(nl, '\0');
                WideCharToMultiByte(CP_UTF8, 0, nameBuf, nameLen,
                                   nameUtf8.data(), nl, nullptr, nullptr);

                // Convert value to UTF-8 (handle REG_SZ and REG_EXPAND_SZ)
                std::string valueUtf8;
                if (type == REG_SZ || type == REG_EXPAND_SZ) {
                    int wchars = static_cast<int>(valueLen / sizeof(wchar_t));
                    if (wchars > 0 && reinterpret_cast<wchar_t*>(valueBuf)[wchars - 1] == L'\0')
                        wchars--;
                    int vl = WideCharToMultiByte(CP_UTF8, 0,
                                                reinterpret_cast<wchar_t*>(valueBuf), wchars,
                                                nullptr, 0, nullptr, nullptr);
                    valueUtf8.resize(vl);
                    WideCharToMultiByte(CP_UTF8, 0,
                                       reinterpret_cast<wchar_t*>(valueBuf), wchars,
                                       valueUtf8.data(), vl, nullptr, nullptr);
                } else if (type == REG_DWORD && valueLen >= 4) {
                    DWORD dval = *reinterpret_cast<DWORD*>(valueBuf);
                    valueUtf8 = std::to_string(dval);
                } else {
                    valueUtf8 = "(binary data)";
                }

                std::string typeStr;
                switch (type) {
                    case REG_SZ:        typeStr = "REG_SZ"; break;
                    case REG_EXPAND_SZ: typeStr = "REG_EXPAND_SZ"; break;
                    case REG_DWORD:     typeStr = "REG_DWORD"; break;
                    default:            typeStr = "REG_BINARY"; break;
                }

                if (!first) os << ",";
                first = false;
                os << "{\"name\":\"" << jsonEscape(nameUtf8)
                   << "\",\"value\":\"" << jsonEscape(valueUtf8)
                   << "\",\"type\":\"" << typeStr << "\"}";

                index++;
            }
            RegCloseKey(hKey);
        }

        os << "]}";
        return os.str();
    }

    // ------ Write environment variable (for Settings page) ------
    if (action == "writeEnvVar") {
        std::string name  = extractJsonValue(message, "name");
        std::string value = extractJsonValue(message, "value");
        std::string typeStr = extractJsonValue(message, "type");
        std::string scope = extractJsonValue(message, "scope");
        bool sys = (scope == "system");

        uint32_t regType = REG_SZ;
        if (typeStr == "REG_EXPAND_SZ") regType = REG_EXPAND_SZ;

        bool ok = lazyenv::RollbackManager::writeEnvVariable(name, value, regType, sys);
        if (ok) lazyenv::RollbackManager::broadcastEnvironmentChange();

        return std::format(
            "{{\"action\":\"envVarWriteResult\",\"success\":{},\"name\":\"{}\"}}",
            ok ? "true" : "false", jsonEscape(name));
    }

    // ------ Delete environment variable (for Settings page) ------
    if (action == "deleteEnvVar") {
        std::string name  = extractJsonValue(message, "name");
        std::string scope = extractJsonValue(message, "scope");
        bool sys = (scope == "system");

        HKEY root = sys ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER;
        const wchar_t* subKey = sys
            ? L"SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"
            : L"Environment";

        // Convert name to wide
        int wl = MultiByteToWideChar(CP_UTF8, 0, name.c_str(), -1, nullptr, 0);
        std::wstring wname(wl - 1, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, name.c_str(), -1, wname.data(), wl);

        HKEY hKey = nullptr;
        LONG rc = RegOpenKeyExW(root, subKey, 0, KEY_SET_VALUE, &hKey);
        bool ok = false;
        if (rc == ERROR_SUCCESS) {
            rc = RegDeleteValueW(hKey, wname.c_str());
            ok = (rc == ERROR_SUCCESS);
            RegCloseKey(hKey);
        }

        if (ok) lazyenv::RollbackManager::broadcastEnvironmentChange();

        return std::format(
            "{{\"action\":\"envVarDeleteResult\",\"success\":{},\"name\":\"{}\"}}",
            ok ? "true" : "false", jsonEscape(name));
    }

    // ------ Read env var ------
    if (action == "readEnv") {
        std::string name = extractJsonValue(message, "name");
        std::string systemStr = extractJsonValue(message, "system");
        bool sys = (systemStr == "true");
        std::string val = lazyenv::RollbackManager::readEnvVariable(name, sys);
        return std::format("{{\"action\":\"envValue\",\"name\":\"{}\",\"value\":\"{}\"}}",
                           jsonEscape(name), jsonEscape(val));
    }

    return "{\"action\":\"error\",\"message\":\"Unknown action\"}";
}

// ---------------------------------------------------------------------------
// Window procedure - borderless with DWM shadow
// ---------------------------------------------------------------------------
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_CREATE: {
        // Extend frame into client area for shadow effect
        MARGINS margins = { 0, 0, 0, 1 };
        DwmExtendFrameIntoClientArea(hwnd, &margins);

        // Enable dark mode title bar (for shadow color)
        BOOL darkMode = TRUE;
        DwmSetWindowAttribute(hwnd, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */,
                              &darkMode, sizeof(darkMode));
        return 0;
    }

    case WM_NCCALCSIZE: {
        if (wParam == TRUE) {
            auto* params = reinterpret_cast<NCCALCSIZE_PARAMS*>(lParam);
            if (g_isMaximized) {
                HMONITOR mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                MONITORINFO mi{};
                mi.cbSize = sizeof(mi);
                GetMonitorInfoW(mon, &mi);
                params->rgrc[0] = mi.rcWork;
            }
            return 0;
        }
        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    case WM_NCHITTEST: {
        // Only handle resize edges at the native level.
        // Title-bar dragging is handled via JS -> windowDragStart message.
        POINT pt = { static_cast<int>(static_cast<short>(LOWORD(lParam))),
                     static_cast<int>(static_cast<short>(HIWORD(lParam))) };
        ScreenToClient(hwnd, &pt);
        RECT rc;
        GetClientRect(hwnd, &rc);

        constexpr int border = 6;
        bool onLeft   = pt.x < border;
        bool onRight  = pt.x >= rc.right - border;
        bool onTop    = pt.y < border;
        bool onBottom = pt.y >= rc.bottom - border;

        if (onTop && onLeft)     return HTTOPLEFT;
        if (onTop && onRight)    return HTTOPRIGHT;
        if (onBottom && onLeft)  return HTBOTTOMLEFT;
        if (onBottom && onRight) return HTBOTTOMRIGHT;
        if (onLeft)              return HTLEFT;
        if (onRight)             return HTRIGHT;
        if (onTop)               return HTTOP;
        if (onBottom)            return HTBOTTOM;

        return HTCLIENT;
    }

    case WM_SIZE: {
        g_isMaximized = (wParam == SIZE_MAXIMIZED);
        g_webview.resize();
        if (g_webview.getController()) {
            std::string stateMsg = std::format("{{\"action\":\"windowState\",\"maximized\":{}}}",
                                               g_isMaximized ? "true" : "false");
            g_webview.postMessage(stateMsg);
        }
        return 0;
    }

    case WM_GETMINMAXINFO: {
        auto* mmi = reinterpret_cast<MINMAXINFO*>(lParam);
        mmi->ptMinTrackSize.x = 800;
        mmi->ptMinTrackSize.y = 600;

        // Constrain maximized size to the work area (excludes taskbar)
        HMONITOR mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi{};
        mi.cbSize = sizeof(mi);
        if (GetMonitorInfoW(mon, &mi)) {
            mmi->ptMaxPosition.x = mi.rcWork.left - mi.rcMonitor.left;
            mmi->ptMaxPosition.y = mi.rcWork.top  - mi.rcMonitor.top;
            mmi->ptMaxSize.x     = mi.rcWork.right  - mi.rcWork.left;
            mmi->ptMaxSize.y     = mi.rcWork.bottom - mi.rcWork.top;
        }
        return 0;
    }

    case WM_ACTIVATE: {
        MARGINS margins = { 0, 0, 0, 1 };
        DwmExtendFrameIntoClientArea(hwnd, &margins);
        return 0;
    }

    // WebView2 thread-safe message delivery
    case lazyenv::WM_WEBVIEW_POST_MESSAGE: {
        g_webview.processPendingMessages();
        return 0;
    }

    // Deferred drag start (posted from WebView2 callback context)
    case lazyenv::WM_WEBVIEW_DRAG_START: {
        ReleaseCapture();
        SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
        return 0;
    }

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;

    default:
        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }
}

// ---------------------------------------------------------------------------
// WinMain
// ---------------------------------------------------------------------------
int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, LPWSTR, int nCmdShow) {
    // Enable Per-Monitor DPI awareness (v2)
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    // Initialize COM
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    // Check WebView2 runtime
    if (!lazyenv::WebViewHost::isRuntimeAvailable()) {
        MessageBoxW(nullptr,
            L"Microsoft Edge WebView2 Runtime is required but not found.\n"
            L"Please install it from:\n"
            L"https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
            L"LazyEnv - Missing Dependency",
            MB_ICONERROR | MB_OK);
        return 1;
    }

    // Register window class
    WNDCLASSEXW wc{};
    wc.cbSize        = sizeof(wc);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = WndProc;
    wc.hInstance      = hInstance;
    wc.hCursor        = LoadCursor(nullptr, IDC_ARROW);
    wc.hbrBackground  = CreateSolidBrush(RGB(25, 25, 25));
    wc.lpszClassName  = kWindowClass;
    wc.hIcon          = LoadIconW(hInstance, L"IDI_APPICON");
    wc.hIconSm        = LoadIconW(hInstance, L"IDI_APPICON");
    RegisterClassExW(&wc);

    // Create window (centered)
    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    int x = (screenW - kDefaultWidth) / 2;
    int y = (screenH - kDefaultHeight) / 2;

    g_mainWindow = CreateWindowExW(
        0,
        kWindowClass,
        kWindowTitle,
        WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU,
        x, y, kDefaultWidth, kDefaultHeight,
        nullptr, nullptr, hInstance, nullptr);

    if (!g_mainWindow) {
        MessageBoxW(nullptr, L"Failed to create main window.", L"LazyEnv", MB_ICONERROR);
        return 1;
    }

    // Get file:// URI for the HTML page
    std::wstring htmlUri = getHtmlUri();

    // Initialize WebView2 with file:// navigation
    g_webview.setMessageHandler(handleWebMessage);
    if (!g_webview.initialize(g_mainWindow, htmlUri)) {
        MessageBoxW(nullptr, L"Failed to initialize WebView2.", L"LazyEnv", MB_ICONERROR);
        return 1;
    }

    ShowWindow(g_mainWindow, nCmdShow);
    UpdateWindow(g_mainWindow);

    // Message loop
    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    CoUninitialize();
    return static_cast<int>(msg.wParam);
}
