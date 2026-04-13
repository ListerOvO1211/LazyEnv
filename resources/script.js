/*
 * LazyEnv - Cross-platform, recoverable, zero-pollution dev environment configurator
 * Copyright (C) 2026 Rein
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// ============================================================================
// LazyEnv - script.js
// Frontend: sidebar navigation, home env detection, settings env-var editor,
// install progress with streaming log, retry, window drag, i18n support
// ============================================================================

(function () {
    "use strict";

    // -----------------------------------------------------------------------
    // i18n shorthand
    // -----------------------------------------------------------------------
    var t = window.LazyEnvI18n.t;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    var currentPage = "home";
    var catalog = [];
    var selectedPackages = new Set();
    var installResults = new Map();
    var installLogs = new Map();
    var preInstallSnapshotId = "";
    var detectedEnvironments = [];
    var manualEnvironments = [];
    var installTotal = 0;
    var installCurrent = 0;
    var isMaximized = false;

    // Settings state
    var envVarScope = "user";   // "user" or "system"
    var envVarCache = [];       // [{name, value, type}]

    // -----------------------------------------------------------------------
    // Native bridge
    // -----------------------------------------------------------------------
    function sendNative(obj) {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify(obj));
        } else {
            console.log("[LazyEnv -> Native]", obj);
            handleMock(obj);
        }
    }

    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener("message", function (e) {
            var data;
            try { data = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (_) { return; }
            handleNative(data);
        });
    }

    // -----------------------------------------------------------------------
    // Native response handler
    // -----------------------------------------------------------------------
    function handleNative(d) {
        switch (d.action) {
            case "environmentsDetected":
                detectedEnvironments = d.environments || [];
                renderEnvironments();
                break;

            case "probeResult":
                handleProbeResult(d);
                break;

            case "wingetStatus":
                renderCheckItem("winget", d.available);
                break;

            case "catalogData":
                catalog = d.packages || [];
                renderCatalog();
                break;

            case "installStarted":
                preInstallSnapshotId = d.snapshotId || "";
                break;

            case "installProgress":
                installResults.set(d.packageId, {
                    status: d.status,
                    message: d.message || "",
                    command: d.command || (installResults.has(d.packageId) ? installResults.get(d.packageId).command : ""),
                    output: d.output || "",
                    exitCode: d.exitCode
                });
                if (typeof d.current === "number") installCurrent = d.current;
                if (typeof d.total === "number") installTotal = d.total;
                renderInstallList();
                updateProgressBar();
                break;

            case "installLog":
                if (!installLogs.has(d.packageId)) installLogs.set(d.packageId, []);
                var lines = installLogs.get(d.packageId);
                lines.push(d.line);
                if (lines.length > 200) lines.splice(0, lines.length - 200);
                updateLogPanel(d.packageId);
                break;

            case "installComplete":
                preInstallSnapshotId = d.snapshotId || preInstallSnapshotId;
                updateProgressBar();
                renderInstallList();
                break;

            case "snapshotCreated":
                loadSnapshots();
                break;

            case "snapshotList":
                renderSnapshots(d.snapshots || []);
                break;

            case "restoreResult":
                if (d.success) showToast(t("recovery.restoreSuccess"), "success");
                else showToast(t("recovery.restoreFailed"), "error");
                break;

            case "deleteResult":
                loadSnapshots();
                break;

            case "exportResult":
                if (d.success) showToast(t("recovery.exportSuccess"), "success");
                else showToast(t("recovery.exportFailed"), "error");
                break;

            case "importResult":
                if (d.success) {
                    showToast(t("recovery.importSuccess"), "success");
                    loadSnapshots();
                } else {
                    showToast(t("recovery.importFailed"), "error");
                }
                break;

            case "windowState":
                isMaximized = d.maximized;
                updateMaxBtn();
                break;

            case "uninstallResult":
                if (d.success) {
                    showToast(t("env.uninstallSuccess", d.command), "success");
                    sendNative({ action: "detectEnvironments" });
                } else {
                    showToast(t("env.uninstallFailed"), "error");
                }
                break;

            // Settings: environment variable responses
            case "envVarList":
                envVarCache = d.variables || [];
                renderEnvVarTable();
                break;

            case "envVarWriteResult":
                if (d.success) {
                    showToast(t("settings.saveSuccess"), "success");
                    loadEnvVars();
                } else {
                    showToast(t("settings.saveFailed", d.message || ""), "error");
                }
                break;

            case "envVarDeleteResult":
                if (d.success) {
                    showToast(t("settings.deleteSuccess"), "success");
                    loadEnvVars();
                } else {
                    showToast(t("settings.deleteFailed", d.message || ""), "error");
                }
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Mock for dev (no native host)
    // -----------------------------------------------------------------------
    function handleMock(obj) {
        if (obj.action === "detectEnvironments") {
            setTimeout(function () {
                handleNative({
                    action: "environmentsDetected",
                    environments: [
                        { name: "Python", command: "python", version: "Python 3.12.0", category: "language" },
                        { name: "Node.js", command: "node", version: "v22.13.0", category: "language" },
                        { name: "Git", command: "git", version: "git version 2.43.0", category: "tool" },
                        { name: "CMake", command: "cmake", version: "cmake version 3.28.1", category: "tool" },
                        { name: "Rust (rustc)", command: "rustc", version: "rustc 1.75.0", category: "language" },
                        { name: "Docker", command: "docker", version: "Docker version 24.0.7", category: "runtime" },
                        { name: "curl", command: "curl", version: "curl 8.4.0", category: "utility" },
                    ]
                });
            }, 800);
        }
        if (obj.action === "probeCommand") {
            setTimeout(function () {
                handleNative({
                    action: "probeResult",
                    found: true,
                    name: obj.command,
                    command: obj.command,
                    version: obj.command + " 0.1.0 (mock)",
                    category: obj.category || "other"
                });
            }, 600);
        }
        if (obj.action === "checkWinget") {
            setTimeout(function () { handleNative({ action: "wingetStatus", available: true }); }, 300);
        }
        if (obj.action === "getCatalog") {
            setTimeout(function () {
                handleNative({
                    action: "catalogData",
                    packages: [
                        { id: "Python.Python.3.12", name: "Python 3.12", category: "language", description: "General-purpose programming language" },
                        { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", category: "language", description: "JavaScript runtime built on V8" },
                        { id: "Rustlang.Rustup", name: "Rust (rustup)", category: "language", description: "Systems programming language" },
                        { id: "GoLang.Go", name: "Go", category: "language", description: "Statically typed compiled language" },
                        { id: "Git.Git", name: "Git", category: "tool", description: "Distributed version control" },
                        { id: "Kitware.CMake", name: "CMake", category: "tool", description: "Build system generator" },
                        { id: "Microsoft.VisualStudioCode", name: "VS Code", category: "editor", description: "Code editor by Microsoft" },
                        { id: "Docker.DockerDesktop", name: "Docker Desktop", category: "runtime", description: "Container platform" },
                    ]
                });
            }, 200);
        }
        if (obj.action === "install") {
            setTimeout(function () { handleNative({ action: "installStarted", snapshotId: "mock-snap" }); }, 100);
            var pkgs = obj.packages || [];
            pkgs.forEach(function (id, i) {
                var cmd = "winget install --id " + id + " --exact --silent --accept-package-agreements --accept-source-agreements";
                setTimeout(function () {
                    handleNative({ action: "installProgress", packageId: id, status: "running", message: "Installing...", command: cmd, current: i, total: pkgs.length });
                }, 300 + i * 2500);
                for (var l = 0; l < 5; l++) {
                    (function(line, pkgId) {
                        setTimeout(function () {
                            handleNative({ action: "installLog", packageId: pkgId, line: "  [mock] Processing step " + (line + 1) + "..." });
                        }, 600 + i * 2500 + line * 300);
                    })(l, id);
                }
                var success = Math.random() > 0.3;
                setTimeout(function () {
                    handleNative({
                        action: "installProgress", packageId: id,
                        status: success ? "success" : "failed",
                        message: success ? "Done" : "Error: package not found",
                        command: cmd,
                        output: success ? "" : "ERROR: No package found matching input criteria.",
                        exitCode: success ? 0 : 1,
                        current: i + 1, total: pkgs.length
                    });
                }, 1800 + i * 2500);
            });
            setTimeout(function () { handleNative({ action: "installComplete", snapshotId: "mock-snap" }); }, 2500 + pkgs.length * 2500);
        }
        if (obj.action === "retryInstall") {
            var rid = obj.packageId;
            var rcmd = "winget install --id " + rid + " --exact --silent --accept-package-agreements --accept-source-agreements";
            setTimeout(function () { handleNative({ action: "installProgress", packageId: rid, status: "running", message: "Retrying...", command: rcmd }); }, 200);
            setTimeout(function () { handleNative({ action: "installProgress", packageId: rid, status: "success", message: "Done", command: rcmd, output: "", exitCode: 0 }); }, 2000);
        }
        if (obj.action === "listSnapshots") {
            setTimeout(function () { handleNative({ action: "snapshotList", snapshots: [] }); }, 200);
        }
        if (obj.action === "listEnvVars") {
            setTimeout(function () {
                handleNative({
                    action: "envVarList",
                    variables: [
                        { name: "PATH", value: "C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Git\\cmd", type: "REG_EXPAND_SZ" },
                        { name: "JAVA_HOME", value: "C:\\Program Files\\Java\\jdk-21", type: "REG_SZ" },
                        { name: "GOPATH", value: "C:\\Users\\Rein\\go", type: "REG_SZ" },
                        { name: "CARGO_HOME", value: "C:\\Users\\Rein\\.cargo", type: "REG_SZ" },
                        { name: "TEMP", value: "%USERPROFILE%\\AppData\\Local\\Temp", type: "REG_EXPAND_SZ" },
                    ]
                });
            }, 300);
        }
        if (obj.action === "writeEnvVar") {
            setTimeout(function () { handleNative({ action: "envVarWriteResult", success: true }); }, 300);
        }
        if (obj.action === "deleteEnvVar") {
            setTimeout(function () { handleNative({ action: "envVarDeleteResult", success: true }); }, 300);
        }
        if (obj.action === "windowMinimize" || obj.action === "windowMaximize" || obj.action === "windowClose" || obj.action === "windowDragStart") {
            console.log("Window action:", obj.action);
        }
    }

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    function navigateTo(page) {
        currentPage = page;
        document.querySelectorAll(".page").forEach(function (p) {
            p.classList.remove("page--active");
        });
        var target = document.getElementById("page-" + page);
        if (target) target.classList.add("page--active");

        document.querySelectorAll(".sidebar__item").forEach(function (item) {
            item.classList.toggle("sidebar__item--active", item.dataset.page === page);
        });

        if (page === "home") sendNative({ action: "detectEnvironments" });
        if (page === "settings") loadEnvVars();
        if (page === "syscheck") initCheck();
        if (page === "packages" && catalog.length === 0) sendNative({ action: "getCatalog" });
        if (page === "recovery") loadSnapshots();
        if (page === "summary") renderSummary();
    }

    document.getElementById("sidebarNav").addEventListener("click", function (e) {
        var item = e.target.closest(".sidebar__item");
        if (item && item.dataset.page) navigateTo(item.dataset.page);
    });

    // Sidebar search - filter nav items
    document.getElementById("sidebarSearch").addEventListener("input", function (e) {
        var q = e.target.value.toLowerCase();
        document.querySelectorAll(".sidebar__item").forEach(function (item) {
            var text = item.textContent.toLowerCase();
            item.style.display = (!q || text.includes(q)) ? "" : "none";
        });
        document.querySelectorAll(".sidebar__section-label").forEach(function (label) {
            label.style.display = q ? "none" : "";
        });
    });

    // -----------------------------------------------------------------------
    // Language switcher
    // -----------------------------------------------------------------------
    var langSelect = document.getElementById("langSelect");
    langSelect.value = window.LazyEnvI18n.getLocale();

    langSelect.addEventListener("change", function () {
        window.LazyEnvI18n.setLocale(langSelect.value);
    });

    window.addEventListener("lazyenv:localeChanged", function () {
        t = window.LazyEnvI18n.t;
        renderEnvironments(document.getElementById("homeSearch").value);
        if (currentPage === "syscheck") renderChecks();
        if (catalog.length > 0) renderCatalog(document.getElementById("pkgSearch").value);
        updatePkgCount();
        if (installResults.size > 0) {
            renderInstallList();
            updateProgressBar();
        }
        if (currentPage === "settings") renderEnvVarTable();
        if (currentPage === "recovery") loadSnapshots();
        if (currentPage === "summary") renderSummary();
    });

    // -----------------------------------------------------------------------
    // Window controls
    // -----------------------------------------------------------------------
    document.getElementById("btnMin").addEventListener("click", function () {
        sendNative({ action: "windowMinimize" });
    });
    document.getElementById("btnMax").addEventListener("click", function () {
        sendNative({ action: "windowMaximize" });
    });
    document.getElementById("btnClose").addEventListener("click", function () {
        sendNative({ action: "windowClose" });
    });

    document.getElementById("dragRegion").addEventListener("dblclick", function () {
        sendNative({ action: "windowMaximize" });
    });

    document.getElementById("dragRegion").addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) return;
        sendNative({ action: "windowDragStart" });
    });

    function updateMaxBtn() {
        var svg = document.getElementById("btnMax").querySelector("svg");
        if (isMaximized) {
            svg.innerHTML = '<rect x="2" y="0" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/><rect x="0" y="2" width="7" height="7" stroke="currentColor" stroke-width="1" fill="var(--bg-base)"/>';
        } else {
            svg.innerHTML = '<rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none"/>';
        }
    }

    // -----------------------------------------------------------------------
    // Home: Installed Environments
    // -----------------------------------------------------------------------
    function getAllEnvironments() {
        var seen = new Set();
        var all = [];
        detectedEnvironments.forEach(function (e) {
            seen.add(e.command.toLowerCase());
            all.push(e);
        });
        manualEnvironments.forEach(function (e) {
            if (!seen.has(e.command.toLowerCase())) {
                seen.add(e.command.toLowerCase());
                all.push(e);
            }
        });
        return all;
    }

    function getCategoryLabel(cat) {
        var key = "category." + cat;
        var result = t(key);
        return result === key ? cat : result;
    }

    function renderEnvironments(filter) {
        var container = document.getElementById("envList");
        var envs = getAllEnvironments();

        if (filter) {
            var f = filter.toLowerCase();
            envs = envs.filter(function (e) {
                return e.name.toLowerCase().includes(f) || e.version.toLowerCase().includes(f) || e.category.toLowerCase().includes(f);
            });
        }

        if (envs.length === 0) {
            container.innerHTML = '<div class="empty-state">' +
                (detectedEnvironments.length === 0 && manualEnvironments.length === 0 ? t("env.scanning") : t("env.noMatch")) +
                '</div>';
            return;
        }

        var groups = {};
        var order = ["language", "tool", "runtime", "utility", "editor", "database", "other"];
        envs.forEach(function (e) {
            var cat = e.category || "other";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(e);
        });

        var html = "";
        order.concat(Object.keys(groups).filter(function (k) { return order.indexOf(k) === -1; })).forEach(function (cat) {
            if (!groups[cat]) return;
            html += '<div class="card-section"><div class="card-section__title">' + esc(getCategoryLabel(cat)) + ' (' + groups[cat].length + ')</div>';
            groups[cat].forEach(function (e) {
                var iconSvg = window.LazyEnvIcons.getIcon(e.command || e.name, e.category);
                html += '<div class="card-row" data-cmd="' + esc(e.command) + '">' +
                    '<div class="card-row__icon">' + iconSvg + '</div>' +
                    '<div class="card-row__body">' +
                    '<div class="card-row__title">' + esc(e.name) + '</div>' +
                    '<div class="card-row__subtitle">' + esc(e.version) + '</div>' +
                    '</div>' +
                    '<div class="card-row__actions">' +
                    '<button class="btn btn--sm btn-uninstall">' + esc(t("env.btnUninstall")) + '</button>' +
                    '</div></div>';
            });
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll(".btn-uninstall").forEach(function (btn) {
            btn.addEventListener("click", function (ev) {
                ev.stopPropagation();
                var row = btn.closest(".card-row");
                var name = row.querySelector(".card-row__title").textContent;
                showDialog(
                    t("env.confirmUninstallTitle"),
                    t("env.confirmUninstall", name),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("env.btnUninstall"), cls: "btn--danger", action: function () { sendNative({ action: "uninstallPackage", command: name }); } }
                    ]
                );
            });
        });
    }

    document.getElementById("homeSearch").addEventListener("input", function (e) {
        renderEnvironments(e.target.value);
    });

    document.getElementById("btnRefreshEnv").addEventListener("click", function () {
        document.getElementById("envList").innerHTML = '<div class="empty-state">' + t("env.scanning") + '</div>';
        detectedEnvironments = [];
        sendNative({ action: "detectEnvironments" });
    });

    // -----------------------------------------------------------------------
    // Home: Manual Add Environment
    // -----------------------------------------------------------------------
    var addEnvPanel = document.getElementById("addEnvPanel");

    document.getElementById("btnAddEnv").addEventListener("click", function () {
        addEnvPanel.classList.toggle("add-panel--visible");
        if (addEnvPanel.classList.contains("add-panel--visible")) {
            document.getElementById("addEnvCmd").focus();
        }
    });

    document.getElementById("btnCloseAddPanel").addEventListener("click", function () {
        addEnvPanel.classList.remove("add-panel--visible");
    });

    document.getElementById("btnDetectEnv").addEventListener("click", function () {
        var cmd = document.getElementById("addEnvCmd").value.trim();
        if (!cmd) return;
        var cat = document.getElementById("addEnvCategory").value;
        sendNative({ action: "probeCommand", command: cmd, category: cat });
    });

    document.getElementById("addEnvCmd").addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("btnDetectEnv").click();
        }
    });

    function handleProbeResult(d) {
        if (d.found) {
            manualEnvironments.push({
                name: d.name,
                command: d.command,
                version: d.version,
                category: d.category || "other"
            });
            document.getElementById("addEnvCmd").value = "";
            renderEnvironments(document.getElementById("homeSearch").value);
            showToast(t("probe.addedToast", d.name, d.version), "success");
        } else {
            showToast(d.message || t("probe.notFound"), "error");
        }
    }

    // -----------------------------------------------------------------------
    // Settings: Environment Variable Editor
    // -----------------------------------------------------------------------
    function loadEnvVars() {
        sendNative({ action: "listEnvVars", scope: envVarScope });
    }

    // Tab switching
    document.getElementById("envvarTabs").addEventListener("click", function (e) {
        var tab = e.target.closest(".tab");
        if (!tab || !tab.dataset.scope) return;
        envVarScope = tab.dataset.scope;
        document.querySelectorAll("#envvarTabs .tab").forEach(function (t) {
            t.classList.toggle("tab--active", t.dataset.scope === envVarScope);
        });
        loadEnvVars();
    });

    function renderEnvVarTable() {
        var tbody = document.getElementById("envvarBody");
        var filter = document.getElementById("envvarSearch").value.toLowerCase();
        var vars = envVarCache;

        if (filter) {
            vars = vars.filter(function (v) {
                return v.name.toLowerCase().includes(filter) || v.value.toLowerCase().includes(filter);
            });
        }

        if (vars.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
                (envVarCache.length === 0 ? t("settings.loading") : t("settings.noMatch")) +
                '</td></tr>';
            return;
        }

        var html = "";
        vars.forEach(function (v) {
            var isPath = v.name.toUpperCase() === "PATH" || v.name.toUpperCase() === "PATHEXT";
            var displayVal = v.value;
            if (isPath && displayVal.length > 80) {
                displayVal = displayVal.substring(0, 80) + "...";
            }
            html += '<tr data-name="' + esc(v.name) + '">' +
                '<td class="envvar-name">' + esc(v.name) +
                (v.type === "REG_EXPAND_SZ" ? ' <span class="envvar-type">EXP</span>' : '') +
                '</td>' +
                '<td class="envvar-value">' + esc(displayVal) + '</td>' +
                '<td class="envvar-actions">' +
                '<button class="btn btn--sm btn-edit-var" title="' + esc(t("settings.edit")) + '">' +
                '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>' +
                '</button>' +
                '<button class="btn btn--sm btn--danger btn-delete-var" title="' + esc(t("settings.delete")) + '">' +
                '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1H13a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>' +
                '</button>' +
                '</td></tr>';
        });

        tbody.innerHTML = html;

        // Bind edit buttons
        tbody.querySelectorAll(".btn-edit-var").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var name = btn.closest("tr").dataset.name;
                var v = envVarCache.find(function (x) { return x.name === name; });
                if (v) showEnvVarEditDialog(v.name, v.value, v.type, false);
            });
        });

        // Bind delete buttons
        tbody.querySelectorAll(".btn-delete-var").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var name = btn.closest("tr").dataset.name;
                showDialog(
                    t("settings.confirmDeleteTitle"),
                    t("settings.confirmDelete", name),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("settings.delete"), cls: "btn--danger", action: function () {
                            sendNative({ action: "deleteEnvVar", name: name, scope: envVarScope });
                        }}
                    ]
                );
            });
        });
    }

    document.getElementById("envvarSearch").addEventListener("input", function () {
        renderEnvVarTable();
    });

    // New variable button
    document.getElementById("btnAddEnvVar").addEventListener("click", function () {
        showEnvVarEditDialog("", "", "REG_SZ", true);
    });

    function showEnvVarEditDialog(name, value, type, isNew) {
        var isPathVar = name.toUpperCase() === "PATH";
        var title = isNew ? t("settings.newVarTitle") : t("settings.editVarTitle", name);

        var bodyHtml = '<div class="dialog-form">';
        bodyHtml += '<div class="dialog-form__group">';
        bodyHtml += '<label class="dialog-form__label">' + esc(t("settings.colName")) + '</label>';
        bodyHtml += '<input type="text" class="input" id="dlgVarName" value="' + esc(name) + '"' + (isNew ? '' : ' readonly') + '>';
        bodyHtml += '</div>';

        bodyHtml += '<div class="dialog-form__group">';
        bodyHtml += '<label class="dialog-form__label">' + esc(t("settings.colValue")) + '</label>';

        if (isPathVar) {
            // PATH editor: one entry per line
            var pathEntries = value.split(";").filter(function (p) { return p.trim(); });
            bodyHtml += '<div class="path-editor" id="dlgPathEditor">';
            pathEntries.forEach(function (entry, idx) {
                bodyHtml += '<div class="path-entry">' +
                    '<input type="text" class="input input--mono path-input" value="' + esc(entry) + '">' +
                    '<button class="btn--icon path-remove" data-idx="' + idx + '">' +
                    '<svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>' +
                    '</button></div>';
            });
            bodyHtml += '</div>';
            bodyHtml += '<button class="btn btn--sm mt-sm" id="dlgPathAdd">' + esc(t("settings.pathAdd")) + '</button>';
        } else {
            bodyHtml += '<textarea class="input input--mono dialog-form__textarea" id="dlgVarValue" rows="4">' + esc(value) + '</textarea>';
        }
        bodyHtml += '</div>';

        bodyHtml += '<div class="dialog-form__group">';
        bodyHtml += '<label class="dialog-form__label">' + esc(t("settings.type")) + '</label>';
        bodyHtml += '<select class="input" id="dlgVarType">';
        bodyHtml += '<option value="REG_SZ"' + (type === "REG_SZ" ? ' selected' : '') + '>REG_SZ</option>';
        bodyHtml += '<option value="REG_EXPAND_SZ"' + (type === "REG_EXPAND_SZ" ? ' selected' : '') + '>REG_EXPAND_SZ</option>';
        bodyHtml += '</select>';
        bodyHtml += '</div>';
        bodyHtml += '</div>';

        showDialogRaw(title, bodyHtml, [
            { text: t("dialog.cancel"), cls: "" },
            { text: t("settings.save"), cls: "btn--accent", action: function () {
                var newName = document.getElementById("dlgVarName").value.trim();
                if (!newName) { showToast(t("settings.nameRequired"), "error"); return false; }
                var newValue;
                if (isPathVar || (newName.toUpperCase() === "PATH")) {
                    var inputs = document.querySelectorAll("#dlgPathEditor .path-input");
                    var parts = [];
                    inputs.forEach(function (inp) { if (inp.value.trim()) parts.push(inp.value.trim()); });
                    newValue = parts.join(";");
                } else {
                    newValue = document.getElementById("dlgVarValue").value;
                }
                var newType = document.getElementById("dlgVarType").value;
                sendNative({
                    action: "writeEnvVar",
                    name: newName,
                    value: newValue,
                    type: newType,
                    scope: envVarScope
                });
            }}
        ]);

        // PATH editor: add/remove entries
        if (isPathVar) {
            var editor = document.getElementById("dlgPathEditor");
            document.getElementById("dlgPathAdd").addEventListener("click", function () {
                var div = document.createElement("div");
                div.className = "path-entry";
                div.innerHTML = '<input type="text" class="input input--mono path-input" value="">' +
                    '<button class="btn--icon path-remove"><svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.5"/></svg></button>';
                editor.appendChild(div);
                div.querySelector("input").focus();
                div.querySelector(".path-remove").addEventListener("click", function () { div.remove(); });
            });
            editor.querySelectorAll(".path-remove").forEach(function (btn) {
                btn.addEventListener("click", function () { btn.closest(".path-entry").remove(); });
            });
        }
    }

    // -----------------------------------------------------------------------
    // System Check
    // -----------------------------------------------------------------------
    var checkStates = { os: null, webview2: true, winget: null };

    function initCheck() {
        checkStates.os = "Windows";
        sendNative({ action: "checkWinget" });
        renderChecks();
    }

    function renderCheckItem(name, ok) {
        checkStates[name] = ok;
        renderChecks();
    }

    function renderChecks() {
        var items = [
            { label: t("check.os"), value: checkStates.os || t("check.detecting"), ok: checkStates.os === "Windows" ? "ok" : null },
            { label: t("check.webview2"), value: t("check.available"), ok: "ok" },
            { label: t("check.winget"), value: checkStates.winget === null ? t("check.checking") : (checkStates.winget ? t("check.available") : t("check.notFound")), ok: checkStates.winget === null ? null : (checkStates.winget ? "ok" : "fail") }
        ];

        var container = document.getElementById("checkResults");
        container.innerHTML = items.map(function (c) {
            var icon = "";
            if (c.ok === "ok") icon = '<svg width="18" height="18" viewBox="0 0 16 16" fill="var(--success)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
            else if (c.ok === "fail") icon = '<svg width="18" height="18" viewBox="0 0 16 16" fill="var(--error)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>';
            else icon = '<div class="spinner-sm"></div>';
            return '<div class="card-row"><div class="card-row__icon">' + icon + '</div>' +
                '<div class="card-row__body"><div class="card-row__title">' + esc(c.label) + '</div>' +
                '<div class="card-row__subtitle">' + esc(c.value) + '</div></div></div>';
        }).join("");
    }

    document.getElementById("btnRunChecks").addEventListener("click", function () {
        checkStates = { os: null, webview2: true, winget: null };
        initCheck();
    });

    // -----------------------------------------------------------------------
    // Packages
    // -----------------------------------------------------------------------
    function renderCatalog(filter) {
        var container = document.getElementById("packageList");
        var pkgs = catalog;

        if (filter) {
            var f = filter.toLowerCase();
            pkgs = pkgs.filter(function (p) {
                return p.name.toLowerCase().includes(f) || p.id.toLowerCase().includes(f) || p.category.toLowerCase().includes(f);
            });
        }

        var groups = {};
        var order = ["language", "tool", "editor", "runtime", "database", "utility"];
        pkgs.forEach(function (p) {
            var cat = p.category || "other";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        });

        var html = "";
        order.concat(Object.keys(groups).filter(function (k) { return order.indexOf(k) === -1; })).forEach(function (cat) {
            if (!groups[cat]) return;
            html += '<div class="card-section"><div class="card-section__title">' + esc(getCategoryLabel(cat)) + '</div>';
            groups[cat].forEach(function (p) {
                var sel = selectedPackages.has(p.id);
                var iconSvg = window.LazyEnvIcons.getIcon(p.id || p.name, p.category);
                html += '<div class="card-row card-row--selectable' + (sel ? ' card-row--selected' : '') + '" data-id="' + esc(p.id) + '">' +
                    '<div class="card-row__check">' +
                    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>' +
                    '</div>' +
                    '<div class="card-row__icon">' + iconSvg + '</div>' +
                    '<div class="card-row__body">' +
                    '<div class="card-row__title">' + esc(p.name) + '</div>' +
                    '<div class="card-row__subtitle">' + esc(p.description) + '</div>' +
                    '</div></div>';
            });
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll(".card-row--selectable").forEach(function (row) {
            row.addEventListener("click", function () {
                var id = row.dataset.id;
                if (selectedPackages.has(id)) { selectedPackages.delete(id); row.classList.remove("card-row--selected"); }
                else { selectedPackages.add(id); row.classList.add("card-row--selected"); }
                updatePkgCount();
            });
        });
    }

    function updatePkgCount() {
        var n = selectedPackages.size;
        document.getElementById("pkgSelectedCount").textContent = t("packages.selectedCount", n);
        document.getElementById("btnStartInstall").disabled = n === 0;
    }

    document.getElementById("pkgSearch").addEventListener("input", function (e) {
        renderCatalog(e.target.value);
    });

    document.getElementById("btnSelectAll").addEventListener("click", function () {
        catalog.forEach(function (p) { selectedPackages.add(p.id); });
        renderCatalog(document.getElementById("pkgSearch").value);
        updatePkgCount();
    });

    document.getElementById("btnDeselectAll").addEventListener("click", function () {
        selectedPackages.clear();
        renderCatalog(document.getElementById("pkgSearch").value);
        updatePkgCount();
    });

    document.getElementById("btnStartInstall").addEventListener("click", function () {
        if (selectedPackages.size === 0) return;
        navigateTo("install");
        startInstall();
    });

    // -----------------------------------------------------------------------
    // Installation
    // -----------------------------------------------------------------------
    function startInstall() {
        installResults.clear();
        installLogs.clear();
        installTotal = selectedPackages.size;
        installCurrent = 0;
        selectedPackages.forEach(function (id) {
            installResults.set(id, { status: "pending", message: t("install.waiting"), command: "", output: "" });
            installLogs.set(id, []);
        });
        renderInstallList();
        updateProgressBar();
        sendNative({ action: "install", packages: Array.from(selectedPackages) });
    }

    function renderInstallList() {
        var list = document.getElementById("installList");
        var html = "";

        installResults.forEach(function (r, id) {
            var pkg = catalog.find(function (p) { return p.id === id; });
            var name = pkg ? pkg.name : id;
            var iconHtml = "";
            var cls = "";
            var statusText = "";

            switch (r.status) {
                case "pending":
                    iconHtml = '<div class="status-dot status-dot--pending"></div>';
                    statusText = t("install.pending");
                    break;
                case "running":
                    iconHtml = '<div class="spinner-sm"></div>';
                    cls = " card-row--running";
                    statusText = t("install.installing");
                    break;
                case "success":
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 16 16" fill="var(--success)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
                    cls = " card-row--success";
                    statusText = t("install.installed");
                    break;
                case "failed":
                    iconHtml = '<svg width="16" height="16" viewBox="0 0 16 16" fill="var(--error)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>';
                    cls = " card-row--failed";
                    statusText = t("install.failed", r.exitCode);
                    break;
            }

            var pkgIcon = window.LazyEnvIcons.getIcon(id || name, pkg ? pkg.category : "");
            html += '<div class="install-item' + cls + '" data-pkg-id="' + esc(id) + '">';
            html += '<div class="card-row">';
            html += '<div class="card-row__icon">' + pkgIcon + '</div>';
            html += '<div class="card-row__status">' + iconHtml + '</div>';
            html += '<div class="card-row__body">';
            html += '<div class="card-row__title">' + esc(name) + '</div>';
            html += '<div class="card-row__subtitle">' + esc(statusText) + '</div>';
            html += '</div>';
            if (r.status === "failed") {
                html += '<div class="card-row__actions"><button class="btn btn--sm btn--accent btn-retry" data-id="' + esc(id) + '">' + esc(t("install.btnRetry")) + '</button></div>';
            }
            html += '</div>';

            // Command + log
            if (r.command) {
                html += '<div class="install-item__cmd">' + esc(r.command) + '</div>';
            }

            var logLines = installLogs.get(id) || [];
            if (logLines.length > 0 || r.status === "running") {
                html += '<div class="install-item__log" id="log-' + esc(id) + '">';
                logLines.forEach(function (line) {
                    html += '<div class="log-line">' + esc(line) + '</div>';
                });
                if (r.status === "running" && logLines.length === 0) {
                    html += '<div class="log-line log-line--dim">' + esc(t("install.waitingOutput")) + '</div>';
                }
                html += '</div>';
            }

            if (r.status === "failed" && r.output) {
                html += '<div class="install-item__error">' + esc(r.output) + '</div>';
            }

            html += '</div>';
        });

        list.innerHTML = html || '<div class="empty-state">' + esc(t("install.noPackages")) + '</div>';

        // Retry buttons
        list.querySelectorAll(".btn-retry").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pkgId = btn.dataset.id;
                installResults.set(pkgId, { status: "pending", message: t("install.retrying"), command: "", output: "" });
                installLogs.set(pkgId, []);
                renderInstallList();
                sendNative({ action: "retryInstall", packageId: pkgId });
            });
        });

        // Auto-scroll logs
        installResults.forEach(function (r, id) {
            if (r.status === "running") {
                var logEl = document.getElementById("log-" + id);
                if (logEl) logEl.scrollTop = logEl.scrollHeight;
            }
        });
    }

    function updateLogPanel(packageId) {
        var logEl = document.getElementById("log-" + packageId);
        if (!logEl) { renderInstallList(); return; }
        var lines = installLogs.get(packageId) || [];
        var html = "";
        lines.forEach(function (line) {
            html += '<div class="log-line">' + esc(line) + '</div>';
        });
        logEl.innerHTML = html;
        logEl.scrollTop = logEl.scrollHeight;
    }

    function updateProgressBar() {
        var fill = document.getElementById("installProgressFill");
        var text = document.getElementById("installProgress");
        var pct = document.getElementById("installPercent");

        var done = 0;
        var failed = 0;
        installResults.forEach(function (r) {
            if (r.status === "success" || r.status === "skipped" || r.status === "failed") done++;
            if (r.status === "failed") failed++;
        });

        var total = installResults.size || 1;
        var percent = Math.round((done / total) * 100);

        fill.style.width = percent + "%";
        if (failed > 0 && done === total) fill.classList.add("progress-bar__fill--error");
        else fill.classList.remove("progress-bar__fill--error");

        text.textContent = t("install.progressText", done, total);
        pct.textContent = percent + "%";
    }

    // -----------------------------------------------------------------------
    // Recovery
    // -----------------------------------------------------------------------
    function loadSnapshots() {
        sendNative({ action: "listSnapshots" });
    }

    function renderSnapshots(snaps) {
        var list = document.getElementById("snapshotList");
        if (snaps.length === 0) {
            list.innerHTML = '<div class="empty-state">' + esc(t("recovery.emptyState")) + '</div>';
            return;
        }

        var html = "";
        snaps.forEach(function (s) {
            html += '<div class="card-row" data-id="' + esc(s.id) + '">' +
                '<div class="card-row__icon"><svg width="18" height="18" viewBox="0 0 16 16" fill="var(--accent)"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg></div>' +
                '<div class="card-row__body">' +
                '<div class="card-row__title">' + esc(s.description) + '</div>' +
                '<div class="card-row__subtitle">' + esc(s.timestamp) + ' | ' + t("recovery.userCount", s.userVarCount || 0) + ' | ' + t("recovery.systemCount", s.systemVarCount || 0) + '</div>' +
                '</div>' +
                '<div class="card-row__actions">' +
                '<button class="btn btn--sm btn-restore">' + esc(t("recovery.btnRestore")) + '</button>' +
                '<button class="btn btn--sm btn-export">' + esc(t("recovery.btnExport")) + '</button>' +
                '<button class="btn btn--sm btn--danger btn-delete">' + esc(t("recovery.btnDelete")) + '</button>' +
                '</div></div>';
        });

        list.innerHTML = html;

        list.querySelectorAll(".card-row").forEach(function (row) {
            var id = row.dataset.id;
            if (!id) return;
            row.querySelector(".btn-restore").addEventListener("click", function (e) {
                e.stopPropagation();
                showDialog(
                    t("recovery.confirmRestoreTitle"),
                    t("recovery.confirmRestore"),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("recovery.btnRestore"), cls: "btn--accent", action: function () { sendNative({ action: "restoreSnapshot", snapshotId: id }); } }
                    ]
                );
            });
            row.querySelector(".btn-export").addEventListener("click", function (e) {
                e.stopPropagation();
                sendNative({ action: "exportSnapshot", snapshotId: id });
            });
            row.querySelector(".btn-delete").addEventListener("click", function (e) {
                e.stopPropagation();
                showDialog(
                    t("recovery.confirmDeleteTitle"),
                    t("recovery.confirmDelete"),
                    [
                        { text: t("dialog.cancel"), cls: "" },
                        { text: t("recovery.btnDelete"), cls: "btn--danger", action: function () { sendNative({ action: "deleteSnapshot", snapshotId: id }); } }
                    ]
                );
            });
        });
    }

    document.getElementById("btnCreateSnapshot").addEventListener("click", function () {
        showDialogRaw(
            t("recovery.createTitle"),
            '<div class="dialog-form"><div class="dialog-form__group">' +
            '<label class="dialog-form__label">' + esc(t("recovery.descLabel")) + '</label>' +
            '<input type="text" class="input" id="dlgSnapDesc" value="">' +
            '</div></div>',
            [
                { text: t("dialog.cancel"), cls: "" },
                { text: t("recovery.create"), cls: "btn--accent", action: function () {
                    var desc = document.getElementById("dlgSnapDesc").value.trim() || t("recovery.defaultDesc");
                    sendNative({ action: "createSnapshot", description: desc });
                }}
            ]
        );
        setTimeout(function () { var el = document.getElementById("dlgSnapDesc"); if (el) el.focus(); }, 100);
    });

    document.getElementById("btnImportSnapshot").addEventListener("click", function () {
        sendNative({ action: "importSnapshot" });
    });

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    function renderSummary() {
        var container = document.getElementById("summaryContent");
        if (installResults.size === 0) {
            container.innerHTML = '<div class="empty-state">' + esc(t("summary.emptyState")) + '</div>';
            return;
        }

        var html = '<table class="data-table"><thead><tr>' +
            '<th>' + esc(t("summary.colName")) + '</th>' +
            '<th>' + esc(t("summary.colStatus")) + '</th>' +
            '<th>' + esc(t("summary.colCommand")) + '</th>' +
            '<th>' + esc(t("summary.colMessage")) + '</th>' +
            '</tr></thead><tbody>';

        installResults.forEach(function (r, id) {
            var pkg = catalog.find(function (p) { return p.id === id; });
            var name = pkg ? pkg.name : id;
            var badgeCls = "";
            var badgeText = "";
            switch (r.status) {
                case "success": badgeCls = "badge--success"; badgeText = t("summary.success"); break;
                case "failed":  badgeCls = "badge--error";   badgeText = t("summary.failed");  break;
                case "skipped": badgeCls = "badge--warning"; badgeText = t("summary.skipped"); break;
                default:        badgeCls = "";               badgeText = r.status;  break;
            }
            html += '<tr><td>' + esc(name) + '</td>' +
                '<td><span class="badge ' + badgeCls + '">' + badgeText + '</span></td>' +
                '<td class="text-mono text-sm">' + esc(r.command || "-") + '</td>' +
                '<td class="text-sm">' + esc(r.output || r.message || "-") + '</td></tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // -----------------------------------------------------------------------
    // Dialog
    // -----------------------------------------------------------------------
    function showDialog(title, message, buttons) {
        showDialogRaw(title, '<p>' + esc(message) + '</p>', buttons);
    }

    function showDialogRaw(title, bodyHtml, buttons) {
        var overlay = document.getElementById("dialogOverlay");
        document.getElementById("dialogTitle").textContent = title;
        document.getElementById("dialogBody").innerHTML = bodyHtml;

        var footer = document.getElementById("dialogFooter");
        footer.innerHTML = "";
        buttons.forEach(function (b) {
            var btn = document.createElement("button");
            btn.className = "btn " + (b.cls || "");
            btn.textContent = b.text;
            btn.addEventListener("click", function () {
                if (b.action) {
                    var result = b.action();
                    if (result === false) return; // prevent close
                }
                overlay.classList.remove("dialog-overlay--visible");
            });
            footer.appendChild(btn);
        });

        overlay.classList.add("dialog-overlay--visible");
    }

    document.getElementById("dialogOverlay").addEventListener("click", function (e) {
        if (e.target === this) this.classList.remove("dialog-overlay--visible");
    });

    // -----------------------------------------------------------------------
    // Toast notification
    // -----------------------------------------------------------------------
    function showToast(msg, type) {
        var container = document.getElementById("toastContainer");
        var el = document.createElement("div");
        el.className = "toast" + (type ? " toast--" + type : "");
        el.textContent = msg;
        container.appendChild(el);
        requestAnimationFrame(function () { el.classList.add("toast--visible"); });
        setTimeout(function () { el.classList.remove("toast--visible"); }, 3000);
        setTimeout(function () { el.remove(); }, 3500);
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------
    function esc(s) {
        if (!s) return "";
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    navigateTo("home");

})();
