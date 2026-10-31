# 爱莎英语 · 字母港（PWA 可玩原型）

方块世界里的英语启蒙 —— M0 Sprint 1 体验版。
对应《我的世界·爱莎英语 产品与技术架构方案 V0.3》4.2「发布形式与端策略：PWA 优先」与「下一步 ②：字母港可交互原型」。

## 已实现

- **字母港 Lesson 1**：A apple / B boat / C crab 三轮「听音 → 点字母方块」任务（约 2 分钟）
- **激励闭环（方案 3.5 最小版）**：分级鼓励语 6 条轮换、金币（方块银行）、方块奖励、结算「宠物蛋」彩蛋
- **低挫败设计**：答错不扣分不惩罚，随机温和话术 + 轻微摇晃
- **PWA**：manifest + Service Worker 离线缓存 + 平台自适应安装引导（Android Chrome / iOS Safari / 华为鸿蒙）
- **设备自检页 `check.html`**：验收基准机 HUAWEI nova 14 Ultra 的 P0 四项实测（WebGL FPS / 麦克风 / 离线缓存 / 添加到桌面）

## 目录结构

```
aisha-english-pwa/
├── index.html              # 主入口：字母港原型（3D 场景 + HUD + 安装引导）
├── check.html              # 设备自检页（P0 四项，反馈问题时截图设备信息卡）
├── manifest.webmanifest    # PWA 清单（名称/图标/独立窗口）
├── sw.js                   # Service Worker（预缓存 + 离线兜底，发版升 CACHE 版本号）
├── js/game.js              # 游戏逻辑（Babylon.js 场景 / 玩法循环 / 激励反馈）
├── vendor/babylon.js       # Babylon.js 本地副本（离线可用，Pages 会 gzip）
├── icons/                  # 应用图标（tools/make_icons.py 生成）
├── tools/make_icons.py     # 图标生成脚本（PIL 像素画）
└── docs/sprint-1.md        # 首周冲刺计划
```

`.github/workflows/deploy.yml` 位于仓库根（本目录整体作为仓库根使用）。

## 本地运行

Service Worker 与麦克风要求安全上下文（HTTPS 或 localhost），**不能双击 HTML 打开**：

```bash
cd aisha-english-pwa
python -m http.server 8080
# 浏览器打开 http://localhost:8080/
```

电脑浏览器建议开 DevTools 手机模拟（触屏 + 竖屏）预览。

## GitHub Pages 部署（体验版托管 · 次选）

1. 在 GitHub 新建一个空仓库（例如 `aisha-english`，Public）。
2. 把本目录**全部内容**作为仓库根推送：

   ```bash
   cd aisha-english-pwa
   git init -b main
   git add -A
   git commit -m "feat: 字母港 PWA 原型 + P0 自检 + Pages 流水线"
   git remote add origin https://github.com/<你的用户名>/aisha-english.git
   git push -u origin main
   ```

3. 仓库 **Settings → Pages → Build and deployment → Source 选择 “GitHub Actions”**（首次必须手动选一次）。
4. 等 Actions 绿勾完成，访问 `https://<你的用户名>.github.io/aisha-english/`。

以后每次 `git push` 自动重新发布。注意：`github.io` 在中国大陆访问不稳定，**仅作体验版**；正式版按方案 4.2 切备案域名 + 国内对象存储/CDN（发布流程两侧同构，切换只改域名）。

## HUAWEI nova 14 Ultra 真机验收（P0 · 方案 4.2）

1. 手机华为浏览器打开体验版地址 → 先进「设备自检」页逐项确认：
   - **P0-1 WebGL**：实测 ≥ 45fps 良好；28–44 可用（需调优）；< 28 风险
   - **P0-2 麦克风**：授权后能录（3 秒）能放
   - **P0-3 离线缓存**：active 且缓存 ≥ 8 项
   - **P0-4 添加到桌面**：华为浏览器菜单 → 添加到桌面 → 桌面出现绿色「爱莎英语」图标，点开为无地址栏全屏
2. 回首页玩完 3 个任务：金币累加、鼓励语出现、结算有宠物蛋。
3. 断网再打开：应仍可完整玩（Service Worker 离线缓存生效）。

任一项不达标：在自检页截图「设备信息」卡反馈；兜底路径为微信小程序（鸿蒙版）。

## 已知限制（原型阶段）

- 英文发音使用系统 TTS（音色质量依设备而定）；正式版换外教录音 + 云端发音评测（方案 4.3）。
- 麦克风测试只验证「能录能放」；发音打分引擎待采购选型后接入。
- `vendor/babylon.js` 约 8.4MB：Pages 自动 gzip（约 2MB 首载），SW 首次缓存后离线秒开。
- 3D 资产为程序化体素占位；正式美术按方案 3.7「高清体素规范」（≥32×32 texel / 柔和光照 + AO + 边缘光）由外包执行。
