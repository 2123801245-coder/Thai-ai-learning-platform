// 本线程预览启动器：派生常驻 vite(:5173)。detached + unref，父进程退出后子进程存活
// （命令运行器的进程组回收机制会杀掉普通 `&` 后台进程，所以必须这样派）。
//
// 为什么 vite 从主检出跑（而不是 /tmp 副本）：主检出目前没有 iCloud dataless 占位
// 文件（唯一 0 字节的 src/components/ui/avatar.jsx 在 git 里本来就是空文件），
// 而 /tmp 副本必须软链 node_modules 到 iCloud，反而更慢。真正的坑是「写 iCloud 的
// 依赖缓存」与「iCloud 同步事件淹没 watcher」，两者都由 .preview.vite.config.mjs 处理。
//
// backend 另跑（.preview-backend.cjs）：从 /tmp 副本启动，用它自己的 users.db，
// 不写主检出的库；vite 的 /api 代理指向 localhost:3001。
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/zhb/Desktop/个人/我的/项目/AI thai teacher";

const log = fs.openSync("/tmp/thaiai-vite.log", "a");
const child = spawn(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
    "--config",
    ".preview.vite.config.mjs",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ],
  {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env },
  }
);

child.unref();
fs.writeSync(log, `\n==== vite (main checkout) pid=${child.pid} @ ${new Date().toISOString()} ====\n`);
console.log(`vite=${child.pid}`);
