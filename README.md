# 光稳智检 LIGHTGUARD AI

南阳理工学院 iCAN 大学生创新创业大赛 AI 应用创新挑战赛高校组软件赛道项目展示站。

## 在线展示

启用 GitHub Pages 后，网站地址为：

`https://<GitHub用户名>.github.io/lightguard-ai/`

## 项目定位

本仓库是项目的静态公网展示站，包含项目背景、技术方案、真实系统截图、核对后的实验数据和本地运行说明。

AI检测程序使用 Flask、PyTorch 与本地模型权重，不能直接在 GitHub Pages 静态服务器中运行。可运行程序通过赛事提交包或 GitHub Release 单独提供。

## Pages部署

仓库设置中进入 `Settings → Pages`：

1. Source 选择 `Deploy from a branch`；
2. Branch 选择 `main`；
3. Folder 选择 `/ (root)`；
4. 保存并等待部署完成。

## 数据说明

- MVTec AD 2八类本地记录：Image AUROC宏平均58.96% → 62.07%，+3.11个百分点，5类提高、3类下降。
- bottle类别一次配对记录：记忆库构建739.56秒 → 7.74秒，约95.5倍，仅代表该类别与该次运行。
- 不将AUROC表述为生产线准确率，不将本地实验记录表述为官方排行榜成绩。

## 许可证与用途

本项目仅用于科研、教学与比赛展示。数据集、模型与第三方工具分别遵循其原始许可证。
