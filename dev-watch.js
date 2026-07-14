const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = path.join(__dirname, 'plugin');

// Targets to copy file modifications to
const TARGETS = [];

if (process.platform === 'win32') {
	const localAppData = process.env.LOCALAPPDATA;
	const programFiles = process.env.ProgramFiles;

	if (localAppData) {
		TARGETS.push(path.join(localAppData, 'ONLYOFFICE/DesktopEditors/data/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
		TARGETS.push(path.join(localAppData, 'ONLYOFFICE/DesktopEditors/data/sdkjs-plugins/asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
	}
	if (programFiles) {
		TARGETS.push(path.join(programFiles, 'ONLYOFFICE/DesktopEditors/editors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
		TARGETS.push(path.join(programFiles, 'ONLYOFFICE/DesktopEditors/editors/sdkjs-plugins/asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
	}
} else {
	const USER_HOME = process.env.HOME || '/home/saravana';
	TARGETS.push(path.join(USER_HOME, '.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
	TARGETS.push(path.join(USER_HOME, '.local/share/onlyoffice/desktopeditors/sdkjs-plugins/asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
	TARGETS.push(path.join(USER_HOME, '.local/share/onlyoffice/desktopeditors/editors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}'));
}

console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log('\x1b[35m%s\x1b[0m', '   ONLYOFFICE Plugin Hot-Sync Watcher v1.1         ');
console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log(`Source Folder: ${SOURCE_DIR}`);
console.log('Targets:');
TARGETS.forEach(target => console.log(`  -> ${target}`));
console.log('\x1b[35m%s\x1b[0m', '==================================================');

// Helper function to recursively copy files
function copyRecursiveSync(src, dest) {
	const stats = fs.statSync(src);
	if (stats.isDirectory()) {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		fs.readdirSync(src).forEach(childItem => {
			copyRecursiveSync(path.join(src, childItem), path.join(dest, childItem));
		});
	} else {
		fs.copyFileSync(src, dest);
	}
}

// 1. Clear ONLYOFFICE CEF cache if requested
if (process.argv.includes('--clear-cache')) {
	console.log('\x1b[36mClearing ONLYOFFICE Desktop Editors CEF cache...\x1b[0m');
	if (process.platform === 'win32') {
		const localAppData = process.env.LOCALAPPDATA;
		if (localAppData) {
			const cacheDir = path.join(localAppData, 'ONLYOFFICE/DesktopEditors/data/cache');
			try {
				if (fs.existsSync(cacheDir)) {
					fs.rmSync(cacheDir, { recursive: true, force: true });
					console.log('\x1b[32m✓ Cache cleared successfully!\x1b[0m');
				} else {
					console.log('Cache directory not found (already clean).');
				}
			} catch (err) {
				console.log(`\x1b[31m✗ Could not clear cache: ${err.message}\x1b[0m`);
				console.log('\x1b[33mEnsure ONLYOFFICE Desktop Editors is fully closed before running this.\x1b[0m');
			}
		}
	} else {
		const USER_HOME = process.env.HOME || '/home/saravana';
		const cacheDir = path.join(USER_HOME, '.config/onlyoffice/DesktopEditors/cache');
		try {
			if (fs.existsSync(cacheDir)) {
				fs.rmSync(cacheDir, { recursive: true, force: true });
				console.log('\x1b[32m✓ Cache cleared successfully!\x1b[0m');
			} else {
				console.log('Cache directory not found (already clean).');
			}
		} catch (err) {
			console.log(`\x1b[31m✗ Could not clear cache: ${err.message}\x1b[0m`);
		}
	}
	console.log('\x1b[90m--------------------------------------------------\x1b[0m\n');
}

// 2. Perform initial sync
console.log('\x1b[36mPerforming initial sync of all plugin files...\x1b[0m');
TARGETS.forEach(target => {
	try {
		if (fs.existsSync(SOURCE_DIR)) {
			copyRecursiveSync(SOURCE_DIR, target);
			console.log(`  \x1b[32m✓\x1b[0m Fully synced to: ${target}`);
		}
	} catch (err) {
		console.warn(`  \x1b[33m✗ Warning: Could not sync to target ${target}: ${err.message}\x1b[0m`);
	}
});
console.log('\x1b[90m--------------------------------------------------\x1b[0m\n');

console.log('Tips for Development:');
if (process.platform === 'win32') {
	console.log('  * Launch ONLYOFFICE in Debug Mode via PowerShell:');
	console.log('    & "C:\\Program Files\\ONLYOFFICE\\DesktopEditors\\DesktopEditors.exe" --ascdesktop-support-debug-info');
} else {
	console.log('  * Launch ONLYOFFICE in Debug Mode via Terminal:');
	console.log('    onlyoffice-desktopeditors --ascdesktop-support-debug-info');
}
console.log('  * Right-click the plugin sidebar inside ONLYOFFICE and choose "Reload" to update the UI.');
console.log('  * Run this watcher with "--clear-cache" to wipe CEF cache:');
console.log('    node dev-watch.js --clear-cache');
console.log('\x1b[90m--------------------------------------------------\x1b[0m\n');

console.log('Watching for changes in "plugin/" directory...\n');

let debounceTimer = null;
fs.watch(SOURCE_DIR, { recursive: true }, (eventType, filename) => {
	if (!filename) return;

	// Debounce to prevent multiple fires
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		const srcPath = path.join(SOURCE_DIR, filename);

		if (!fs.existsSync(srcPath)) return;
		const stats = fs.statSync(srcPath);
		if (stats.isDirectory()) return;

		console.log(`\x1b[36m[Event: ${eventType}]\x1b[0m File modified: plugin/${filename}`);

		TARGETS.forEach(target => {
			const destPath = path.join(target, filename);
			const destDir = path.dirname(destPath);

			try {
				if (!fs.existsSync(destDir)) {
					fs.mkdirSync(destDir, { recursive: true });
				}
				fs.copyFileSync(srcPath, destPath);
				console.log(`  \x1b[32m✓\x1b[0m Copied to: ${destPath}`);
			} catch (err) {
				console.log(`  \x1b[31m✗ Error syncing to ${destPath}: ${err.message}\x1b[0m`);
			}
		});
		console.log('\x1b[90m--------------------------------------------------\x1b[0m');
	}, 100);
});

