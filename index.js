const core = require('@actions/core');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const lockfile = require('proper-lockfile');

const FILE_NAME = 'build_numbers.json';

run();

async function run() {
    let release;
    try {
        const branch = core.getInput('branch', { required: false }) || 'build-numbers';
        const identifier = core.getInput('identifier', { required: true });
        const increment = core.getBooleanInput('increment', { required: false }) || true;
        core.info(`Using branch: ${branch}`);
        core.info(`Using identifier: ${identifier}`);
        core.info(`Increment flag: ${increment}`);

        const git = simpleGit();
        await setCredentials(git);
        await checkout(git, branch);

        // Ensure the build_numbers.json file exists before attempting to lock it and pull again
        const filePath = path.join(process.cwd(), FILE_NAME);
        release = await lockFile(filePath, git, branch);

        let buildNumbers = await fs.readJson(filePath);
        initializeBuildNumber(buildNumbers, identifier);

        if (increment || buildNumbers[identifier] === 0) {
            await incrementBuildNumber(buildNumbers, identifier, filePath);
            await commitAndPush(git, identifier, buildNumbers, branch);
        } else {
            core.info(`Build number retrieval only, no increment performed.`);
        }

        setOutput(buildNumbers[identifier])
    } catch (error) {
        core.setFailed(`Action failed with error: ${error.message}`);
    } finally {
        if (release) {
            await release();
        }
    }
}

async function setCredentials(git) {
    await git.addConfig("user.name", "GitHub Action");
    await git.addConfig("user.email", "action@github.com");
}

async function checkout(git, branch) {
    await git.checkout(branch).catch(async () => {
        await git.checkout(["--orphan", branch]);
        await git.rm(['-rf', '.']);
        await git.commit('Initialize branch');
        await git.push(["--set-upstream", "origin", branch]);
    });
}

async function lockFile(filePath, git, branch) {
    if (!fs.existsSync(filePath)) {
        await fs.writeJson(filePath, {});
    }
    let release = await lockfile.lock(filePath);
    await git.pull("origin", branch);
    return release;
}

function initializeBuildNumber(buildNumbers, identifier) {
    if (!buildNumbers[identifier]) {
        buildNumbers[identifier] = 0;
        core.info(`No build number found for ${identifier}, initializing`);
    } else {
        core.info(`Current build number: ${buildNumbers[identifier]}`);
    }
}

async function incrementBuildNumber(buildNumbers, identifier, filePath) {
    buildNumbers[identifier]++;
    core.info(`New build number: ${buildNumbers[identifier]}`);

    await fs.writeJson(filePath, buildNumbers, {spaces: 2});
}

async function commitAndPush(git, identifier, buildNumbers, branch) {
    await git.add(FILE_NAME);
    await git.commit(`Update build number for ${identifier} to ${buildNumbers[identifier]}`);
    await git.push("origin", branch);
}

function setOutput(buildNumber) {
    core.setOutput('build-number', buildNumber);
    core.exportVariable('BUILD_NUMBER', buildNumber);
}
