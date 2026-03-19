const { fork } = require('child_process');
const path = require('path');
const logger = require('./logger');

const activeWorkers = new Set();
const WORKER_PATH = path.join(__dirname, '..', 'worker', 'index.js');
const WORKER_TIMEOUT = parseInt(process.env.API_TIMEOUT) || 600000;

function spawnWorker(message) {
  return new Promise((resolve, reject) => {
    const worker = fork(WORKER_PATH);
    activeWorkers.add(worker);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.warn({ pid: worker.pid }, 'Worker timed out, killing');
      worker.kill();
      activeWorkers.delete(worker);
      reject(new Error('Worker timed out'));
    }, WORKER_TIMEOUT);

    worker.on('message', (msg) => {
      if (settled) return;
      if (msg.type === 'result') {
        settled = true;
        clearTimeout(timer);
        activeWorkers.delete(worker);
        resolve(msg.data);
      } else if (msg.type === 'error') {
        settled = true;
        clearTimeout(timer);
        activeWorkers.delete(worker);
        reject(new Error(msg.message));
      }
    });

    worker.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeWorkers.delete(worker);
      reject(err);
    });

    worker.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeWorkers.delete(worker);
      if (code !== 0 && code !== null) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });

    worker.send(message);
  });
}

function killAllWorkers() {
  for (const worker of activeWorkers) {
    logger.info({ pid: worker.pid }, 'Killing worker on shutdown');
    worker.kill();
  }
  activeWorkers.clear();
}

function getActiveCount() {
  return activeWorkers.size;
}

module.exports = { spawnWorker, killAllWorkers, getActiveCount };
