const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const lockfile = require('proper-lockfile');

const FILE_NAME = 'build_numbers.json';

async function run() {
    let release;
    try {
        // Lock the file to prevent concurrent access
        release = await lockfile.lock(FILE_NAME);

        // Retrieve inputs
        const token = core.getInput('token', { required: true });
        const branch = core.getInput('branch', { required: false}) || 'build-numbers';
        const identifier = core.getInput('identifier', { required: true });
        core.info(`Checking out branch: ${branch}`);
        core.info(`Processing identifier: ${identifier}`);

        // Initialize GitHub client and Git instance
        const octokit = github.getOctokit(token);
        const git = simpleGit();

        // Check out the branch
        await git.checkout(branch).catch(async () => {
            // If the branch doesn't exist, create it
            await git.checkoutLocalBranch(branch);
            await git.push(['--set-upstream', 'origin', branch]);
        });

        // Pull the latest changes
        await git.pull('origin', branch);

        // Load or initialize the build numbers JSON file
        let buildNumbers = {};
        const filePath = path.join(process.cwd(), FILE_NAME);
        if (fs.existsSync(filePath)) {
            buildNumbers = await fs.readJson(filePath);
        }

        // Generate a new build number
        if (!buildNumbers[identifier]) {
            buildNumbers[identifier] = 0;
            core.info(`No build number found for ${identifier}, initializing`);
        } else {
            core.info(`Old build number: ${buildNumbers[identifier]}`);
        }
        buildNumbers[identifier]++;
        core.info(`New build number: ${buildNumbers[identifier]}`);

        // Write the updated build numbers back to the JSON file
        await fs.writeJson(filePath, buildNumbers, { spaces: 2 });

        // Commit and push the changes
        await git.add(FILE_NAME);
        await git.commit(`Update build number for ${identifier} to ${buildNumbers[identifier]}`);
        await git.push('origin', branch);

        // Output the new build number
        core.setOutput('build-number', buildNumbers[identifier]);
        // Set an environment variable for the build number
        core.exportVariable('BUILD_NUMBER', buildNumbers[identifier]);
    } catch (error) {
        core.error(`Specific error context: ${error.message}`);
        core.setFailed(`Action failed with error: ${error.message}`);
    } finally {
        // Always release the lock
        if (release) {
            await release();
        }
    }
}

run();