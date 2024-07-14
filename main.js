const core = require('@actions/core');
const io = require('@actions/io');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function fetch_url() {
    try {
        const response = await fetch('https://api.github.com/repos/luau-lang/luau/releases/latest');
        const data = await response.json();
        const asset = data.assets.find(asset => asset.name.includes('ubuntu'));
        
        if (!asset) {
          throw new Error('No matching asset found');
        }
    
        return asset.browser_download_url;
    } catch (error) {
      core.setFailed(`Failed to fetch the latest release URL: ${error.message}`);
    }
  }

async function run() {
    try {
        const luau_url = await fetch_url();
        const working_dir = path.join(process.cwd(), "luau-install");

        await io.mkdirP(working_dir);

        const response = await fetch(luau_url);
        const buffer = await response.buffer();
        const zip_path = path.join(working_dir, 'binary.zip');
        fs.writeFileSync(zip_path, buffer);

        const zip = new AdmZip(zip_path);
        zip.extractAllTo(working_dir, true);

        core.addPath(working_dir);

        core.saveState('working_dir', working_dir);
    } catch (error) {
        core.setFailed(`Failed to install luau: ${error.message}`);
    }
}

run();