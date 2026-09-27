# 第三方素材署名与许可（Third-Party Notices）

本项目在开发与演示中使用了以下第三方素材。分发本项目或其中任一素材时，须一并保留本文件的署名信息。

---

## 1. MVTec AD 数据集（样例图像与评测数据）

- **数据集**：MVTec AD — A Comprehensive Real-World Dataset for Unsupervised Anomaly Detection
- **版权**：Copyright 2019 MVTec Software GmbH
- **许可**：Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International（**CC BY-NC-SA 4.0**）
  许可全文：<https://creativecommons.org/licenses/by-nc-sa/4.0/>
- **引用**：Paul Bergmann, Michael Fauser, David Sattlegger, Carsten Steger. *A Comprehensive Real-World Dataset for Unsupervised Anomaly Detection.* IEEE CVPR, 2019.
- **使用范围**：`01_可运行系统/static/samples/` 下的 13 张样例图像取自该数据集的测试集原始文件，未作修改；`原始实验记录/` 中的指标由该数据集评测得到。
- **限制**：CC BY-NC-SA 4.0 仅允许**非商业**用途。任何商业化使用（含产品化试点）须先联系 MVTec Software GmbH 取得书面授权（paul.bergmann@mvtec.com）。
- **免责声明**：数据集按"现状"提供，版权方不对其适用性或准确性作任何担保。

## 2. MVTec AD 2 数据集（评测数据）

- 版权与许可同第 1 项（Copyright MVTec Software GmbH，CC BY-NC-SA 4.0）。
- 本项目**不随仓库分发该数据集**，仅提供在其公开测试集上得到的评测结果（见 `原始实验记录/mvtec_ad2_8class.json` 与 `mvtec_ad2_per_condition.json`）。

## 3. Font Awesome Free 6.4.0（界面图标）

- **来源**：<https://fontawesome.com>（经 cdnjs 获取）
- **许可**（三重许可，按组件分别适用）：
  - 图标 Icons：CC BY 4.0 — <https://creativecommons.org/licenses/by/4.0/>
  - 字体 Fonts：SIL OFL 1.1 — <https://scripts.sil.org/OFL>
  - 代码 Code：MIT — <https://opensource.org/licenses/MIT>
- **署名**：Font Awesome Free 6.4.0 by @fontawesome — <https://fontawesome.com>（Copyright Fonticons, Inc.）
- **位置**：`01_可运行系统/static/vendor/fontawesome/`（本地内置，以保证断网环境下图标正常显示；本项目仅使用其实心 `fas` 图标，故只内置 `fa-solid` 字体）

## 4. WideResNet-50-2 预训练权重

- **来源**：TorchVision 提供的 IMAGENET1K_V2 权重（torchvision 本体采用 BSD-3-Clause 许可）
- **位置**：不在本仓库中，见 `01_可运行系统/pretrained/README_权重获取说明.md`
- **说明**：本项目将其随演示包分发以支持离线运行；再分发前请自行确认权重条款。

## 5. 学术引用

若本项目的方法或结果对您的研究有帮助，请一并引用：

- Roth, K., Pemula, L., Zepeda, J., Schölkopf, B., Brox, T., Gehler, P. *Towards Total Recall in Industrial Anomaly Detection.* CVPR 2022.（PatchCore 基线）

---

## 关于本项目自身

本项目**改进模型并未沿用 PatchCore 的贪心 k-center coreset 采样**，而是改为固定容量的均匀随机抽样；多尺度特征提取、记忆库最近邻评分等基础模块沿用已有公开方法。详见 `光稳智检_技术文档.md` 第 1、4 节。
