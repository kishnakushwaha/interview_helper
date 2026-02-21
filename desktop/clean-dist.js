const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
// Keep only final output folders and the instructions file
const keep = ['mac', 'win', 'INSTRUCTIONS.txt'];

console.log('🧹 Cleaning build artifacts...');

if (fs.existsSync(distDir)) {
    fs.readdirSync(distDir).forEach(file => {
        if (!keep.includes(file)) {
            const filePath = path.join(distDir, file);
            try {
                fs.rmSync(filePath, { recursive: true, force: true });
                console.log(`❌ Deleted: ${file}`);
            } catch (err) {
                console.error(`Failed to delete ${file}:`, err.message);
            }
        }
    });
    console.log('✨ Build folder organized! Keeping only:', keep.join(', '));
} else {
    console.log('No dist folder found.');
}
