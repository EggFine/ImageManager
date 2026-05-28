## v1.1.1

### 🛠 关键修复

- **修复自动更新功能** — v1.0.0 / v1.1.0 的 in-app 更新按钮在点击「立即更新」时会抛 `Cannot read private member from an object whose class did not declare it` 错误。根因是 Tauri Updater 返回的 `Update` 实例携带 JS 私有字段(`#xxx`),被放进 Vue reactive 系统后变成 Proxy,导致私有字段访问失败。
- 重构 `services/updater.ts`,把 `Update` 实例**完全移出** Vue 响应式系统(放在模块作用域),`UpdateInfo` 只携带纯数据字段(`version` / `body` / `date`),Pinia store 不再持有任何带类实例的对象。

### ⚠️ 给 v1.0.0 / v1.1.0 用户的重要提示

由于你机器上正在运行的是**有 bug 的更新器代码**,即使应用提示有 v1.1.1 可用,点「立即更新」依然会失败。本次升级**必须手动下载安装一次**:

1. 打开 [GitHub Releases 页面](https://github.com/EggFine/ImageManager/releases/latest)
2. 下载对应平台的安装包(Windows `.exe` 或 `.msi` / macOS `.dmg` / Linux `.AppImage` / `.deb`)
3. 直接覆盖安装,配置不会丢

装上 v1.1.1 之后,以后的版本就可以正常 in-app 一键升级了。

### 其他小调整

- 设置 → 关于页面按钮重排:第一排留三个 GitHub 入口(项目主页 / Star / 反馈问题),第二排「查看版本」放在「查看更新日志」之后
