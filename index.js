const core = require('@actions/core');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const lockfile = require('proper-lockfile');
const os = require('os');

const FILE_NAME = 'build_numbers.json';
const WORKTREE_DIR = path.join(os.tmpdir(), 'build-numbers-worktree');

run();

async function run() {
    const git = simpleGit();
    let fileLock;
    try {
        const branch = core.getInput('branch', { required: false }) || 'build-numbers';
        const identifier = core.getInput('identifier', { required: true });
        const increment = core.getBooleanInput('increment', { required: false }) || true;
        core.info(`Using branch: ${branch}`);
        core.info(`Using identifier: ${identifier}`);
        core.info(`Increment flag: ${increment}`);

        await setCredentials(git);
        await setupWorktree(git, branch);

        const filePath = path.join(WORKTREE_DIR, FILE_NAME);
        fileLock = await lockFile(filePath, git, branch);

        let buildNumbers = await fs.readJson(filePath);
        initializeBuildNumber(buildNumbers, identifier);

        if (increment || buildNumbers[identifier] === 0) {
            await incrementBuildNumber(buildNumbers, identifier, filePath);
            await commitAndPush(git, identifier, buildNumbers, branch);
        } else {
            core.info(`Build number retrieval only, no increment performed.`);
        }

        setOutput(buildNumbers[identifier]);
    } catch (error) {
        core.setFailed(`Action failed with error: ${error.message}`);
    } finally {
        if (fileLock) {
            await fileLock();
        }
        await removeWorktree(git, branch);
    }
}

async function setCredentials(git) {
    await git.addConfig("user.name", "GitHub Action");
    await git.addConfig("user.email", "action@github.com");
}

async function setupWorktree(git, branch) {
    await fs.ensureDir(WORKTREE_DIR);
    await git.worktree(["add", WORKTREE_DIR, branch]).catch(async () => {
        await git.worktree(["add", WORKTREE_DIR, "--orphan", branch]);
        await fs.writeJson(path.join(WORKTREE_DIR, FILE_NAME), {});
        const worktreeGit = simpleGit(WORKTREE_DIR);
        await worktreeGit.add(FILE_NAME);
        await worktreeGit.commit("Initial commit to initialize branch");
        await worktreeGit.push(["--set-upstream", "origin", branch]);
    });
}

async function lockFile(filePath, git, branch) {
    if (!fs.existsSync(filePath)) {
        await fs.writeJson(filePath, {});
    }
    let fileLock = await lockfile.lock(filePath);
    const worktreeGit = simpleGit(WORKTREE_DIR);
    await worktreeGit.pull("origin", branch);
    return fileLock;
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
    const worktreeGit = simpleGit(WORKTREE_DIR);
    await worktreeGit.add(FILE_NAME);
    await worktreeGit.commit(`Update build number for ${identifier} to ${buildNumbers[identifier]}`);
    await worktreeGit.push("origin", branch);
}

async function removeWorktree(git, branch) {
    await git.worktree(["remove", WORKTREE_DIR]);
    await fs.remove(WORKTREE_DIR);
}

function setOutput(buildNumber) {
    core.setOutput('build-number', buildNumber);
    core.exportVariable('BUILD_NUMBER', buildNumber);
}
