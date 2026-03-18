import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, '.server.pid');
const SERVER_FILE = path.join(ROOT_DIR, 'server.js');

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function readExistingPid() {
    try {
        const raw = await fs.readFile(PID_FILE, 'utf8');
        const pid = Number.parseInt(raw.trim(), 10);
        return Number.isInteger(pid) ? pid : null;
    } catch {
        return null;
    }
}

async function writePidFile(pid) {
    await fs.writeFile(PID_FILE, `${pid}\n`, 'utf8');
}

async function removePidFile() {
    try {
        await fs.unlink(PID_FILE);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

async function main() {
    const existingPid = await readExistingPid();

    if (existingPid && isProcessAlive(existingPid)) {
        console.log(`Server is already running (PID ${existingPid}).`);
        return;
    }

    if (existingPid) {
        await removePidFile();
    }

    const child = spawn(process.execPath, [SERVER_FILE], {
        cwd: ROOT_DIR,
        detached: true,
        stdio: 'ignore'
    });

    child.unref();

    await sleep(500);

    if (!isProcessAlive(child.pid)) {
        await removePidFile();
        throw new Error('Server exited immediately. Check for port conflicts or startup errors in server.js.');
    }

    await writePidFile(child.pid);
    console.log(`Server started in background (PID ${child.pid}).`);
    console.log('Use `npm stop` to stop it.');
}

main().catch(async (error) => {
    console.error('Failed to start server:', error.message);
    process.exitCode = 1;
});
