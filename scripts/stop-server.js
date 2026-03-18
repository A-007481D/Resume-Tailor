import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, '.server.pid');

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

async function readPidFile() {
    const raw = await fs.readFile(PID_FILE, 'utf8');
    const pid = Number.parseInt(raw.trim(), 10);
    if (!Number.isInteger(pid)) {
        throw new Error('PID file is invalid.');
    }
    return pid;
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

async function stopWithSignal(pid, signal, retries, delayMs) {
    try {
        process.kill(pid, signal);
    } catch (error) {
        if (error.code === 'ESRCH') {
            return true;
        }
        throw error;
    }

    for (let i = 0; i < retries; i += 1) {
        await sleep(delayMs);
        if (!isProcessAlive(pid)) {
            return true;
        }
    }

    return !isProcessAlive(pid);
}

async function main() {
    let pid;

    try {
        pid = await readPidFile();
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('No PID file found. Server is likely not running.');
            return;
        }
        throw error;
    }

    if (!isProcessAlive(pid)) {
        await removePidFile();
        console.log(`Removed stale PID file for PID ${pid}.`);
        return;
    }

    const stoppedGracefully = await stopWithSignal(pid, 'SIGTERM', 20, 100);
    if (!stoppedGracefully && isProcessAlive(pid)) {
        console.log(`PID ${pid} did not stop after SIGTERM. Sending SIGKILL...`);
        await stopWithSignal(pid, 'SIGKILL', 10, 100);
    }

    if (isProcessAlive(pid)) {
        throw new Error(`Failed to stop server process ${pid}.`);
    }

    await removePidFile();
    console.log(`Server stopped (PID ${pid}).`);
}

main().catch((error) => {
    console.error('Failed to stop server:', error.message);
    process.exitCode = 1;
});

