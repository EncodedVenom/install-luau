const core = require('@actions/core');
const io = require('@actions/io');
const path = require('path');

async function cleanup() {
  try {
    const working_dir = core.getState('working_dir');
    if (working_dir) {
      await io.rmRF(working_dir);
    }
    console.log("Deleted Luau Working Directory.");
  } catch (error) {
    core.setFailed(error.message);
  }
}

cleanup();