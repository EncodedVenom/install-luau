const core = require('@actions/core');
const io = require('@actions/io');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function fetch_url() {
    let asset_search;
    try {
        switch(os.platform()) {
            case 'win32':
                asset_search = 'windows';
                break;
            case 'linux':
                asset_search = 'ubuntu';
                break;
            case 'darwin':
                asset_search = 'mac';
                break;
            default:
                asset_search = 'INVALID';
        }
        if (asset_search === 'INVALID') {
            throw new Error(`Platform ${os.platform()} is not supported.`);
        }

        console.log(`Fetching Download Link (platform: ${os.platform()}, search term: ${asset_search})`);
        const response = await fetch('https://api.github.com/repos/luau-lang/luau/releases/latest');
        const data = await response.json();
        const asset = data.assets.find(asset => asset.name.includes(asset_search));

        console.log(`Asset Link: ${asset}`);
        
        if (!asset) {
          throw new Error('No matching asset found');
        }
    
        return asset.browser_download_url;
    } catch (error) {
      core.setFailed(`Failed to fetch the latest release URL: ${error.message}\nplatform: ${os.platform()}\nAsset name search: ${asset_search}\nAsset value: ${asset}`);
    }
  }

async function run() {
    try {
        const luau_url = await fetch_url();
        const working_dir = path.join(process.cwd(), "luau-install");

        await io.mkdirP(working_dir);

        console.log(`Downloading Luau from \"${luau_url}\"`);
        const response = await fetch(luau_url);
        const buffer = await response.buffer();
        const zip_path = path.join(working_dir, 'binary.zip');
        fs.writeFileSync(zip_path, buffer);

        console.log('Unzipping');

        const zip = new AdmZip(zip_path);
        zip.extractAllTo(working_dir, true);

        console.log('Marking as executable');

        fs.readdir(working_dir, (err, files) => {
            if (err) {
                core.setFailed(`Error reading directory: ${err}`);
                return;
            }

            files.forEach(file => {
                const file_path = path.join(working_dir, file);
                fs.stat(file_path, (err, stats) => {
                    if (err) {
                        core.setFailed(`Error stating file: ${err}`);
                        return;
                    }

                    if (stats.isFile()) {
                        fs.chmod(file_path, '755', err => {
                            if (err) {
                                core.setFailed(`Error setting executable permission for ${file_path}: ${err}`);
                            }
                        })
                    }
                });
            });
        });

        console.log("Adding to PATH");

        core.addPath(working_dir);

        core.saveState('working_dir', working_dir);
    } catch (error) {
        core.setFailed(`Failed to install luau: ${error.message}`);
    }
}

run();