#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Generating EtherView Documentation with Navigation...');
console.log('📁 Creating docs directory...');

// Create docs directory if it doesn't exist
const docsDir = path.join(__dirname, 'docs');
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
}

// Check if etherview.md exists
const mdFile = path.join(__dirname, 'etherview.md');
if (!fs.existsSync(mdFile)) {
    console.error('❌ etherview.md not found in the current directory!');
    console.log('Please make sure etherview.md is in the EtherView main directory.');
    process.exit(1);
}

// Copy the HTML file
const htmlSource = path.join(__dirname, 'docs', 'index.html');
const htmlContent = fs.readFileSync(htmlSource, 'utf8');

// Update the fetch path in the HTML
const updatedHtml = htmlContent.replace(
    "fetch('./etherview.md')",
    "fetch('../etherview.md')"
);

fs.writeFileSync(path.join(docsDir, 'index.html'), updatedHtml);

console.log('✅ Documentation generated successfully!');
console.log('\n📖 To view the documentation:');
console.log('1. Open the docs/index.html file in your browser');
console.log('   Double-click: docs/index.html');
console.log('\n   Or run a local server:');
console.log('   npx serve docs -p 3000');
console.log('   Then visit: http://localhost:3000');
console.log('\n🎯 Features:');
console.log('   • Automatic sidebar navigation');
console.log('   • Section tabs as shown in your image');
console.log('   • Smooth scrolling between sections');
console.log('   • Responsive design with mobile menu');
console.log('   • Table of contents for each section');
console.log('   • Markdown formatting preserved');
console.log('\n📝 The documentation includes:');
console.log('   • Abstract');
console.log('   • Introduction (5 subsections)');
console.log('   • Literature Review (3 subsections)');
console.log('   • Methodology (7 subsections)');