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
        // Retrieve inputs
        const token = core.getInput('token', { required: true });
        const branch = core.getInput('branch', { required: false }) || 'build-numbers';
        const identifier = core.getInput('identifier', { required: true });
        const increment = core.getBooleanInput('increment', { required: false }) || true;
        core.info(`Checking out branch: ${branch}`);
        core.info(`Processing identifier: ${identifier}`);
        core.info(`Increment flag is set to: ${increment}`);

        // Initialize GitHub client and Git instance
        const octokit = github.getOctokit(token);
        const git = simpleGit();

        // Check out the branch
        await git.checkout(branch).catch(async () => {
            // If the branch doesn't exist, create an empty branch
            await git.checkout(['--orphan', branch]);
        });

        // Pull the latest changes
        await git.pull('origin', branch);

        // Ensure the build_numbers.json file exists before attempting to lock it
        const filePath = path.join(process.cwd(), FILE_NAME);
        if (!fs.existsSync(filePath)) {
            await fs.writeJson(filePath, {}); // Create an empty JSON file
        }

        // Lock the file to prevent concurrent access
        release = await lockfile.lock(filePath);

        // Load the build numbers JSON file
        let buildNumbers = await fs.readJson(filePath);

        // Initialize build number if it doesn't exist
        if (!buildNumbers[identifier]) {
            buildNumbers[identifier] = 0;
            core.info(`No build number found for ${identifier}, initializing`);
        } else {
            core.info(`Current build number: ${buildNumbers[identifier]}`);
        }

        // Increment the build number if the flag is set
        if (increment || buildNumbers[identifier] === 0) {
            buildNumbers[identifier]++;
            core.info(`New build number: ${buildNumbers[identifier]}`);

            // Write the updated build numbers back to the JSON file
            await fs.writeJson(filePath, buildNumbers, { spaces: 2 });

            // Set the author identity for the commit
            await git.addConfig('user.name', 'GitHub Action');
            await git.addConfig('user.email', 'action@github.com');

            // Commit and push the changes
            await git.add(FILE_NAME);
            await git.commit(`Update build number for ${identifier} to ${buildNumbers[identifier]}`);
            await git.push(['--set-upstream', 'origin', branch]);
        } else {
            core.info(`Build number retrieval only, no increment performed.`);
        }

        // Output the build number
        core.setOutput('build-number', buildNumbers[identifier]);

        // Set an environment variable for the build number
        core.exportVariable('BUILD_NUMBER', buildNumbers[identifier]);

    } catch (error) {
        core.setFailed(`Action failed with error: ${error.message}`);
    } finally {
        // Always release the lock
        if (release) {
            await release();
        }
    }
}

run();
