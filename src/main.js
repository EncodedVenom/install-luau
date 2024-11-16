const core = require('@actions/core');
const io = require('@actions/io');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const os = require('os');

const should_debug_log = core.getInput('verbose') !== "false" ?? false;
const version_target = core.getInput('version');
const version_string = (version_target !== 'latest' || version_target !== null) ? `tags/${version_target}` : 'latest';

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
                asset_search = 'mac';
                break;
            default:
                asset_search = 'INVALID';
                throw new Error(`Platform ${os.platform()} is not supported.`);
        }

        return new Promise((resolve, reject) => {
            fetch(`https://api.github.com/repos/luau-lang/luau/releases/${version_string}`).then(async (response) => {
                debug_log("[DEBUG] Response: ");
                debug_log(response);
                response.json().then(async (json_data) => {
                    
                    debug_log("[DEBUG] JSON Data: ");
                    debug_log(json_data);
                    if (json_data === undefined || (json_data.messsage && json_data.message.includes("rate limit"))) {
                        console.log("Install-Luau is being ratelimited! (Retry in 5 seconds)");
                        reject();
                        return;
                    }
                    if (json_data.assets === undefined) {
                        console.log("Install-Luau is being ratelimited! (Retry in 5 seconds)");
                        reject('Assets did not exist');
                        return;
                    }
                    const asset = json_data.assets.find(asset => asset.name.includes(asset_search));
                    if (asset && asset.browser_download_url)
                        resolve(asset.browser_download_url);
                    else {
                        console.log("Install-Luau is being ratelimited! (Retry in 5 seconds)");
                        reject();
                    }
                })
            });
        });
    } catch (error) {
      core.setFailed(`Failed to fetch the latest release URL: ${error.message}\nplatform: ${os.platform()}\nAsset name search: ${asset_search}\nURL: ${asset_url}`);
    }
  }

let retries = 0;

async function run() {
    try {
        const working_dir = path.join(process.cwd(), "luau-install");


        if (fs.existsSync(working_dir)) {
            await io.rmRF(working_dir);
            console.log("Deleted Luau Working Directory.");
            return;
        }

        await io.mkdirP(working_dir);

        let luau_url;
        if (retries > 9) {
            throw Error("Max Retries Hit (app is being ratelimited)");
        }
        try {
            luau_url = await fetch_url();
        } catch {
            retries++;
            if (os.platform() === 'darwin' && retires === 1) {
                core.info("macOS runners get ratelimited frequently. Consider using another runner.");
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
            run();
            return;
        }

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
    } catch (error) {
        core.setFailed(`Failed to install luau: ${error.message}`);
    }
}

run();
