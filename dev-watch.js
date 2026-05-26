const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = path.join(__dirname, 'plugin');
const USER_HOME = process.env.HOME || '/home/saravana';

// Targets to copy file modifications to
const TARGETS = [
	path.join(USER_HOME, '.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}'),
	path.join(USER_HOME, '.local/share/onlyoffice/desktopeditors/sdkjs-plugins/asc.{6298516B-E753-435E-A2E4-2C76A28C73B2}'),
	path.join(USER_HOME, '.local/share/onlyoffice/desktopeditors/editors/sdkjs-plugins/{6298516B-E753-435E-A2E4-2C76A28C73B2}')
];

console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log('\x1b[35m%s\x1b[0m', '   ONLYOFFICE Plugin Hot-Sync Watcher v1.0         ');
console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log(`Source Folder: ${SOURCE_DIR}`);
console.log('Targets:');
TARGETS.forEach(target => console.log(`  -> ${target}`));
console.log('\nWatching for changes in "plugin/" directory...\n');

// Ensure target directories exist
TARGETS.forEach(target => {
	if (!fs.existsSync(target)) {
		fs.mkdirSync(target, { recursive: true });
	}
});

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
