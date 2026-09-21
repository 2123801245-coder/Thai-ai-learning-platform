// 本线程预览的 backend 启动器（vite 那个是 .preview-launch.cjs）
//
// 为什么 backend 从 /tmp 副本跑：副本里有自己的 users.db，预览期间的注册、
// 学习进度、发码都不会写进主检出的库。vite 的 /api 代理指向 localhost:3001。
//
// detached + unref：命令运行器会回收普通 `&` 后台进程的进程组，必须这样派。
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/zhb/Desktop/个人/我的/项目/AI thai teacher";
const COPY = "/tmp/thaiai-preview-b732bbc2";
const LOG = "/tmp/thaiai-preview-backend.log";

const log = fs.openSync(LOG, "a");
fs.writeSync(
  log,
  `\n==== backend (copy ${COPY}) relaunch @ ${new Date().toISOString()} ====\n`
);

// 注意：命令运行器会把 PORT 设成 0，而 `process.env.PORT || "3001"` 拿到的是字符串 "0"
// （truthy）→ 后端会监听随机端口，表现就像「启动成功但打不开」。必须显式覆盖。
const preferred = Number(process.env.PREVIEW_BACKEND_PORT);
const port = Number.isInteger(preferred) && preferred > 0 ? preferred : 3001;

const child = spawn(process.execPath, [path.join(COPY, "backend", "app.js")], {
  cwd: path.join(COPY, "backend"),
  detached: true,
  stdio: ["ignore", log, log],
  env: { ...process.env, PORT: String(port) },
});

child.unref();
console.log(`backend=${child.pid} log=${LOG}`);
