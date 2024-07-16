const core = require('@actions/core');
const io = require('@actions/io');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const os = require('os');

const should_debug_log = core.getInput('verbose') !== "false" ?? false;

const debug_log = (input) => {
    if (should_debug_log)
        console.log(input)
} 

async function fetch_url() {
    let asset_search = "INVALID";
    let asset_url = "NULL";
    try {
        switch(os.platform()) {
            case 'win32':
                asset_search = 'windows';
                break;
            case 'linux':
                asset_search = 'ubuntu';
                break;
            case 'darwin':
                core.info("macOS runner support is unstable. Please switch to windows-latest or ubuntu-latest for your runner.");
                asset_search = 'mac';
                break;
            default:
                asset_search = 'INVALID';
        }
        if (asset_search === 'INVALID') {
            throw new Error(`Platform ${os.platform()} is not supported.`);
        }

        return new Promise((resolve, reject) => {
            fetch('https://api.github.com/repos/luau-lang/luau/releases/latest').then(async (response) => {
                debug_log("[DEBUG] Response: " + toString(response));
                response.json().then(async (json_data) => {
                    
                    debug_log("[DEBUG] JSON Data: " + toString(json_data));
                    if (json_data === undefined || (json_data.messsage && json_data.message.includes("rate limit"))) {
                        console.log("Install-Luau is being ratelimited! (Retry in 5 seconds)");
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        reject();
                        return;
                    }
                    if (json_data.assets === undefined) {
                        reject('Assets did not exist somehow.');
                        return;
                    }
                    const asset = json_data.assets.find(asset => asset.name.includes(asset_search));
                    if (asset)
                        resolve(asset.browser_download_url);
                    else
                        reject();
                })
            });
        });

        // console.log(`Fetching Download Link (platform: ${os.platform()}, search term: ${asset_search})`);
        // const response = await fetch('https://api.github.com/repos/luau-lang/luau/releases/latest');
        // const data = await response.json();
        // const asset = data.assets.find(asset => asset.name.includes(asset_search));

        // asset_url = asset.browser_download_url;
        
        // if (!asset) {
        //   throw new Error('No matching asset found');
        // }
    
        // return asset.browser_download_url;
    } catch (error) {
      core.setFailed(`Failed to fetch the latest release URL: ${error.message}\nplatform: ${os.platform()}\nAsset name search: ${asset_search}\nURL: ${asset_url}`);
    }
  }

let retries = 0;

async function run() {
    try {
        let luau_url;
        if (retries > 8) {
            throw Error("Max Retries Hit (something went terribly wrong).");
        }
        try {
            luau_url = await fetch_url();
        } catch {
            retries++;
            run();
            return;
        }
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