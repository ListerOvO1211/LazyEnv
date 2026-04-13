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
// LazyEnv - i18n.js
// Internationalization module with locale dictionaries and translation API.
// Supports: en, zh-CN
// ============================================================================

(function () {
    "use strict";

    // -----------------------------------------------------------------------
    // Language packs
    // -----------------------------------------------------------------------
    var locales = {

        // ===================================================================
        // English
        // ===================================================================
        "en": {
            // Titlebar
            "titlebar.label":                   "LazyEnv",
            "btn.minimize":                     "Minimize",
            "btn.maximize":                     "Maximize",
            "btn.close":                        "Close",

            // Sidebar
            "sidebar.search":                   "Search pages...",
            "sidebar.overview":                 "Overview",
            "sidebar.home":                     "Home",
            "sidebar.settings":                 "Settings",
            "sidebar.setup":                    "Setup",
            "sidebar.syscheck":                 "System Check",
            "sidebar.packages":                 "Packages",
            "sidebar.install":                  "Install",
            "sidebar.maintenance":              "Maintenance",
            "sidebar.recovery":                 "Recovery",
            "sidebar.summary":                  "Summary",

            // Home
            "home.title":                       "Home",
            "home.desc":                        "Detected development environments on this machine.",
            "home.refresh":                     "Refresh",
            "home.addManual":                   "Add",
            "home.searchPlaceholder":           "Search environments...",
            "home.addTitle":                    "Manually add environment",
            "home.addCmdPlaceholder":           "e.g. python, node, rustc, gcc",
            "home.detect":                      "Detect",

            // Categories
            "category.language":                "Language / Runtime",
            "category.tool":                    "Build Tool",
            "category.runtime":                 "Container / VM",
            "category.utility":                 "Utility",
            "category.editor":                  "Editor / IDE",
            "category.database":                "Database",
            "category.other":                   "Other",

            // Environment cards
            "env.scanning":                     "Scanning system...",
            "env.noMatch":                      "No matching environments found.",
            "env.btnUninstall":                 "Uninstall",
            "env.confirmUninstallTitle":        "Confirm Uninstall",
            "env.confirmUninstall":             "Uninstall {0} via winget?",
            "env.uninstallSuccess":             "Uninstalled: {0}",
            "env.uninstallFailed":              "Uninstall failed.",

            // Probe
            "probe.detecting":                  "Detecting...",
            "probe.found":                      "Found: {0}",
            "probe.notFound":                   "Not found.",
            "probe.addedToast":                 "Added: {0} ({1})",

            // Settings (Environment Variable Editor)
            "settings.title":                   "Settings",
            "settings.desc":                    "Manage environment variables directly. Changes take effect immediately.",
            "settings.snapshotHint":            "A snapshot will be automatically created before any modification for safe rollback.",
            "settings.userVars":                "User Variables",
            "settings.systemVars":              "System Variables",
            "settings.addNew":                  "New Variable",
            "settings.searchPlaceholder":       "Search variables...",
            "settings.colName":                 "Name",
            "settings.colValue":                "Value",
            "settings.colActions":              "Actions",
            "settings.loading":                 "Loading environment variables...",
            "settings.noMatch":                 "No matching variables found.",
            "settings.edit":                    "Edit",
            "settings.delete":                  "Delete",
            "settings.save":                    "Save",
            "settings.type":                    "Type",
            "settings.newVarTitle":             "New Variable",
            "settings.editVarTitle":            "Edit: {0}",
            "settings.nameRequired":            "Variable name is required.",
            "settings.pathAdd":                 "Add Entry",
            "settings.saveSuccess":             "Variable saved successfully.",
            "settings.saveFailed":              "Failed to save variable: {0}",
            "settings.deleteSuccess":           "Variable deleted successfully.",
            "settings.deleteFailed":            "Failed to delete variable: {0}",
            "settings.confirmDeleteTitle":      "Confirm Delete",
            "settings.confirmDelete":           "Delete environment variable \"{0}\"?",

            // System Check
            "syscheck.title":                   "System Check",
            "syscheck.desc":                    "Verify system prerequisites before installation.",
            "syscheck.rerun":                   "Re-run Checks",
            "check.os":                         "Operating System",
            "check.webview2":                   "WebView2 Runtime",
            "check.winget":                     "winget Package Manager",
            "check.detecting":                  "Detecting...",
            "check.available":                  "Available",
            "check.checking":                   "Checking...",
            "check.notFound":                   "Not found",

            // Packages
            "packages.title":                   "Packages",
            "packages.desc":                    "Select development tools to install.",
            "packages.selectAll":               "Select All",
            "packages.deselectAll":             "Deselect All",
            "packages.searchPlaceholder":       "Search packages...",
            "packages.startInstall":            "Start Installation",
            "packages.selectedCount":           "{0} selected",

            // Install
            "install.title":                    "Installation",
            "install.desc":                     "Installing selected packages...",
            "install.progressText":             "{0} / {1} packages",
            "install.pending":                  "Pending",
            "install.installing":               "Installing...",
            "install.installed":                "Installed",
            "install.failed":                   "Failed (exit {0})",
            "install.skipped":                  "Already installed",
            "install.waitingOutput":            "Waiting for output...",
            "install.noPackages":               "No packages queued.",
            "install.btnRetry":                 "Retry",
            "install.retrying":                 "Retrying...",
            "install.waiting":                  "Waiting...",

            // Recovery
            "recovery.title":                   "Recovery",
            "recovery.desc":                    "Manage environment snapshots. Restore previous states or import/export configurations.",
            "recovery.create":                  "Create Snapshot",
            "recovery.import":                  "Import",
            "recovery.emptyState":              "No snapshots yet. Create one to get started.",
            "recovery.userCount":               "User: {0}",
            "recovery.systemCount":             "System: {0}",
            "recovery.btnRestore":              "Restore",
            "recovery.btnExport":               "Export",
            "recovery.btnDelete":               "Delete",
            "recovery.confirmRestoreTitle":     "Confirm Restore",
            "recovery.confirmRestore":          "Restore environment from this snapshot? Current variables will be overwritten.",
            "recovery.confirmDeleteTitle":      "Confirm Delete",
            "recovery.confirmDelete":           "Delete this snapshot permanently?",
            "recovery.restoreSuccess":          "Environment restored successfully.",
            "recovery.restoreFailed":           "Restore failed. Check admin permissions.",
            "recovery.exportSuccess":           "Snapshot exported successfully.",
            "recovery.exportFailed":            "Failed to export snapshot.",
            "recovery.importSuccess":           "Snapshot imported successfully.",
            "recovery.importFailed":            "Failed to import snapshot. Check file format.",
            "recovery.createTitle":             "Create Snapshot",
            "recovery.descLabel":               "Description (optional)",
            "recovery.defaultDesc":             "Manual snapshot",

            // Summary
            "summary.title":                    "Summary",
            "summary.desc":                     "Installation results overview.",
            "summary.emptyState":               "No installation data yet.",
            "summary.colName":                  "Package",
            "summary.colStatus":                "Status",
            "summary.colCommand":               "Command",
            "summary.colMessage":               "Details",
            "summary.success":                  "Success",
            "summary.failed":                   "Failed",
            "summary.skipped":                  "Skipped",

            // Dialog
            "dialog.cancel":                    "Cancel",

            // Language switcher
            "lang.label":                       "Language"
        },

        // ===================================================================
        // Simplified Chinese
        // ===================================================================
        "zh-CN": {
            // Titlebar
            "titlebar.label":                   "LazyEnv",
            "btn.minimize":                     "\u6700\u5c0f\u5316",
            "btn.maximize":                     "\u6700\u5927\u5316",
            "btn.close":                        "\u5173\u95ed",

            // Sidebar
            "sidebar.search":                   "\u641c\u7d22\u9875\u9762...",
            "sidebar.overview":                 "\u6982\u89c8",
            "sidebar.home":                     "\u4e3b\u9875",
            "sidebar.settings":                 "\u8bbe\u7f6e",
            "sidebar.setup":                    "\u914d\u7f6e",
            "sidebar.syscheck":                 "\u7cfb\u7edf\u68c0\u67e5",
            "sidebar.packages":                 "\u8f6f\u4ef6\u5305",
            "sidebar.install":                  "\u5b89\u88c5",
            "sidebar.maintenance":              "\u7ef4\u62a4",
            "sidebar.recovery":                 "\u6062\u590d",
            "sidebar.summary":                  "\u6458\u8981",

            // Home
            "home.title":                       "\u4e3b\u9875",
            "home.desc":                        "\u68c0\u6d4b\u5230\u7684\u672c\u673a\u5f00\u53d1\u73af\u5883\u3002",
            "home.refresh":                     "\u5237\u65b0",
            "home.addManual":                   "\u6dfb\u52a0",
            "home.searchPlaceholder":           "\u641c\u7d22\u73af\u5883...",
            "home.addTitle":                    "\u624b\u52a8\u6dfb\u52a0\u5f00\u53d1\u73af\u5883",
            "home.addCmdPlaceholder":           "\u4f8b\u5982 python, node, rustc, gcc",
            "home.detect":                      "\u68c0\u6d4b",

            // Categories
            "category.language":                "\u8bed\u8a00 / \u8fd0\u884c\u65f6",
            "category.tool":                    "\u6784\u5efa\u5de5\u5177",
            "category.runtime":                 "\u5bb9\u5668 / \u865a\u62df\u673a",
            "category.utility":                 "\u5b9e\u7528\u5de5\u5177",
            "category.editor":                  "\u7f16\u8f91\u5668 / IDE",
            "category.database":                "\u6570\u636e\u5e93",
            "category.other":                   "\u5176\u4ed6",

            // Environment cards
            "env.scanning":                     "\u6b63\u5728\u626b\u63cf\u7cfb\u7edf...",
            "env.noMatch":                      "\u672a\u627e\u5230\u5339\u914d\u7684\u73af\u5883\u3002",
            "env.btnUninstall":                 "\u5378\u8f7d",
            "env.confirmUninstallTitle":        "\u786e\u8ba4\u5378\u8f7d",
            "env.confirmUninstall":             "\u786e\u5b9a\u8981\u901a\u8fc7 winget \u5378\u8f7d {0} \u5417\uff1f",
            "env.uninstallSuccess":             "\u5df2\u5378\u8f7d: {0}",
            "env.uninstallFailed":              "\u5378\u8f7d\u5931\u8d25\u3002",

            // Probe
            "probe.detecting":                  "\u68c0\u6d4b\u4e2d...",
            "probe.found":                      "\u5df2\u627e\u5230: {0}",
            "probe.notFound":                   "\u672a\u627e\u5230\u3002",
            "probe.addedToast":                 "\u5df2\u6dfb\u52a0: {0} ({1})",

            // Settings (Environment Variable Editor)
            "settings.title":                   "\u8bbe\u7f6e",
            "settings.desc":                    "\u76f4\u63a5\u7ba1\u7406\u73af\u5883\u53d8\u91cf\u3002\u66f4\u6539\u7acb\u5373\u751f\u6548\u3002",
            "settings.snapshotHint":            "\u4efb\u4f55\u4fee\u6539\u524d\u4f1a\u81ea\u52a8\u521b\u5efa\u5feb\u7167\uff0c\u4ee5\u4fbf\u5b89\u5168\u56de\u6eda\u3002",
            "settings.userVars":                "\u7528\u6237\u53d8\u91cf",
            "settings.systemVars":              "\u7cfb\u7edf\u53d8\u91cf",
            "settings.addNew":                  "\u65b0\u5efa\u53d8\u91cf",
            "settings.searchPlaceholder":       "\u641c\u7d22\u53d8\u91cf...",
            "settings.colName":                 "\u540d\u79f0",
            "settings.colValue":                "\u503c",
            "settings.colActions":              "\u64cd\u4f5c",
            "settings.loading":                 "\u6b63\u5728\u52a0\u8f7d\u73af\u5883\u53d8\u91cf...",
            "settings.noMatch":                 "\u672a\u627e\u5230\u5339\u914d\u7684\u53d8\u91cf\u3002",
            "settings.edit":                    "\u7f16\u8f91",
            "settings.delete":                  "\u5220\u9664",
            "settings.save":                    "\u4fdd\u5b58",
            "settings.type":                    "\u7c7b\u578b",
            "settings.newVarTitle":             "\u65b0\u5efa\u53d8\u91cf",
            "settings.editVarTitle":            "\u7f16\u8f91: {0}",
            "settings.nameRequired":            "\u53d8\u91cf\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002",
            "settings.pathAdd":                 "\u6dfb\u52a0\u6761\u76ee",
            "settings.saveSuccess":             "\u53d8\u91cf\u5df2\u4fdd\u5b58\u3002",
            "settings.saveFailed":              "\u4fdd\u5b58\u53d8\u91cf\u5931\u8d25: {0}",
            "settings.deleteSuccess":           "\u53d8\u91cf\u5df2\u5220\u9664\u3002",
            "settings.deleteFailed":            "\u5220\u9664\u53d8\u91cf\u5931\u8d25: {0}",
            "settings.confirmDeleteTitle":      "\u786e\u8ba4\u5220\u9664",
            "settings.confirmDelete":           "\u5220\u9664\u73af\u5883\u53d8\u91cf \"{0}\"\uff1f",

            // System Check
            "syscheck.title":                   "\u7cfb\u7edf\u68c0\u67e5",
            "syscheck.desc":                    "\u5b89\u88c5\u524d\u9a8c\u8bc1\u7cfb\u7edf\u5148\u51b3\u6761\u4ef6\u3002",
            "syscheck.rerun":                   "\u91cd\u65b0\u68c0\u67e5",
            "check.os":                         "\u64cd\u4f5c\u7cfb\u7edf",
            "check.webview2":                   "WebView2 \u8fd0\u884c\u65f6",
            "check.winget":                     "winget \u5305\u7ba1\u7406\u5668",
            "check.detecting":                  "\u68c0\u6d4b\u4e2d...",
            "check.available":                  "\u53ef\u7528",
            "check.checking":                   "\u68c0\u67e5\u4e2d...",
            "check.notFound":                   "\u672a\u627e\u5230",

            // Packages
            "packages.title":                   "\u8f6f\u4ef6\u5305",
            "packages.desc":                    "\u9009\u62e9\u8981\u5b89\u88c5\u7684\u5f00\u53d1\u5de5\u5177\u3002",
            "packages.selectAll":               "\u5168\u9009",
            "packages.deselectAll":             "\u53d6\u6d88\u5168\u9009",
            "packages.searchPlaceholder":       "\u641c\u7d22\u8f6f\u4ef6\u5305...",
            "packages.startInstall":            "\u5f00\u59cb\u5b89\u88c5",
            "packages.selectedCount":           "\u5df2\u9009\u62e9 {0} \u4e2a",

            // Install
            "install.title":                    "\u5b89\u88c5",
            "install.desc":                     "\u6b63\u5728\u5b89\u88c5\u5df2\u9009\u8f6f\u4ef6\u5305...",
            "install.progressText":             "{0} / {1} \u4e2a\u8f6f\u4ef6\u5305",
            "install.pending":                  "\u7b49\u5f85\u4e2d",
            "install.installing":               "\u5b89\u88c5\u4e2d...",
            "install.installed":                "\u5df2\u5b89\u88c5",
            "install.failed":                   "\u5931\u8d25 (\u9000\u51fa\u7801 {0})",
            "install.skipped":                  "\u5df2\u5b58\u5728",
            "install.waitingOutput":            "\u7b49\u5f85\u8f93\u51fa...",
            "install.noPackages":               "\u6ca1\u6709\u6392\u961f\u7684\u8f6f\u4ef6\u5305\u3002",
            "install.btnRetry":                 "\u91cd\u8bd5",
            "install.retrying":                 "\u91cd\u8bd5\u4e2d...",
            "install.waiting":                  "\u7b49\u5f85\u4e2d...",

            // Recovery
            "recovery.title":                   "\u6062\u590d",
            "recovery.desc":                    "\u7ba1\u7406\u73af\u5883\u5feb\u7167\u3002\u53ef\u6062\u590d\u5230\u5386\u53f2\u72b6\u6001\u6216\u5bfc\u5165\u5bfc\u51fa\u914d\u7f6e\u3002",
            "recovery.create":                  "\u521b\u5efa\u5feb\u7167",
            "recovery.import":                  "\u5bfc\u5165",
            "recovery.emptyState":              "\u6682\u65e0\u5feb\u7167\u3002\u521b\u5efa\u4e00\u4e2a\u4ee5\u5f00\u59cb\u4f7f\u7528\u3002",
            "recovery.userCount":               "\u7528\u6237\u53d8\u91cf: {0}",
            "recovery.systemCount":             "\u7cfb\u7edf\u53d8\u91cf: {0}",
            "recovery.btnRestore":              "\u6062\u590d",
            "recovery.btnExport":               "\u5bfc\u51fa",
            "recovery.btnDelete":               "\u5220\u9664",
            "recovery.confirmRestoreTitle":     "\u786e\u8ba4\u6062\u590d",
            "recovery.confirmRestore":          "\u786e\u5b9a\u8981\u4ece\u6b64\u5feb\u7167\u6062\u590d\u73af\u5883\u5417\uff1f\u5f53\u524d\u53d8\u91cf\u5c06\u88ab\u8986\u76d6\u3002",
            "recovery.confirmDeleteTitle":      "\u786e\u8ba4\u5220\u9664",
            "recovery.confirmDelete":           "\u786e\u5b9a\u8981\u6c38\u4e45\u5220\u9664\u6b64\u5feb\u7167\u5417\uff1f",
            "recovery.restoreSuccess":          "\u73af\u5883\u5df2\u6210\u529f\u6062\u590d\u3002",
            "recovery.restoreFailed":           "\u6062\u590d\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u7ba1\u7406\u5458\u6743\u9650\u3002",
            "recovery.exportSuccess":           "\u5feb\u7167\u5df2\u6210\u529f\u5bfc\u51fa\u3002",
            "recovery.exportFailed":            "\u5bfc\u51fa\u5feb\u7167\u5931\u8d25\u3002",
            "recovery.importSuccess":           "\u5feb\u7167\u5df2\u6210\u529f\u5bfc\u5165\u3002",
            "recovery.importFailed":            "\u5bfc\u5165\u5feb\u7167\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u6587\u4ef6\u683c\u5f0f\u3002",
            "recovery.createTitle":             "\u521b\u5efa\u5feb\u7167",
            "recovery.descLabel":               "\u63cf\u8ff0\uff08\u53ef\u9009\uff09",
            "recovery.defaultDesc":             "\u624b\u52a8\u5feb\u7167",

            // Summary
            "summary.title":                    "\u6458\u8981",
            "summary.desc":                     "\u5b89\u88c5\u7ed3\u679c\u6982\u89c8\u3002",
            "summary.emptyState":               "\u6682\u65e0\u5b89\u88c5\u6570\u636e\u3002",
            "summary.colName":                  "\u8f6f\u4ef6\u5305",
            "summary.colStatus":                "\u72b6\u6001",
            "summary.colCommand":               "\u547d\u4ee4",
            "summary.colMessage":               "\u8be6\u60c5",
            "summary.success":                  "\u6210\u529f",
            "summary.failed":                   "\u5931\u8d25",
            "summary.skipped":                  "\u5df2\u8df3\u8fc7",

            // Dialog
            "dialog.cancel":                    "\u53d6\u6d88",

            // Language switcher
            "lang.label":                       "\u8bed\u8a00"
        }
    };

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    var currentLocale = "en";

    // Detect system language
    (function detectLocale() {
        var lang = navigator.language || navigator.userLanguage || "en";
        if (lang.toLowerCase().startsWith("zh")) {
            currentLocale = "zh-CN";
        } else {
            currentLocale = "en";
        }
        // Check localStorage override
        var saved = localStorage.getItem("lazyenv_locale");
        if (saved && locales[saved]) {
            currentLocale = saved;
        }
    })();

    // -----------------------------------------------------------------------
    // Translation function
    // t(key)            -> returns translated string
    // t(key, arg1, ...) -> replaces {0}, {1}, ... with arguments
    // -----------------------------------------------------------------------
    function t(key) {
        var dict = locales[currentLocale] || locales["en"];
        var str = dict[key];
        if (str === undefined) {
            // Fallback to English
            str = locales["en"][key];
        }
        if (str === undefined) {
            // Return key itself as last resort
            return key;
        }
        // Replace placeholders {0}, {1}, ...
        if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
                str = str.replace("{" + (i - 1) + "}", arguments[i]);
            }
        }
        return str;
    }

    // -----------------------------------------------------------------------
    // Apply translations to static HTML elements
    // Elements with data-i18n attribute get their textContent replaced.
    // Elements with data-i18n-placeholder get their placeholder replaced.
    // Elements with data-i18n-title get their title replaced.
    // -----------------------------------------------------------------------
    function applyStaticTranslations() {
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            var key = el.getAttribute("data-i18n");
            if (key) el.textContent = t(key);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
            var key = el.getAttribute("data-i18n-placeholder");
            if (key) el.placeholder = t(key);
        });
        document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
            var key = el.getAttribute("data-i18n-title");
            if (key) el.title = t(key);
        });
    }

    // -----------------------------------------------------------------------
    // Set locale and re-apply
    // -----------------------------------------------------------------------
    function setLocale(locale) {
        if (!locales[locale]) return;
        currentLocale = locale;
        localStorage.setItem("lazyenv_locale", locale);
        document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
        applyStaticTranslations();
        // Dispatch event so dynamic content can re-render
        window.dispatchEvent(new CustomEvent("lazyenv:localeChanged", { detail: { locale: locale } }));
    }

    function getLocale() {
        return currentLocale;
    }

    function getAvailableLocales() {
        return Object.keys(locales);
    }

    // -----------------------------------------------------------------------
    // Public API (attached to window)
    // -----------------------------------------------------------------------
    window.LazyEnvI18n = {
        t: t,
        setLocale: setLocale,
        getLocale: getLocale,
        getAvailableLocales: getAvailableLocales,
        applyStaticTranslations: applyStaticTranslations
    };

    // Apply on DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            applyStaticTranslations();
        });
    } else {
        applyStaticTranslations();
    }

})();
