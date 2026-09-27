# 权重文件不在本仓库中（体积原因）

GitHub 对**单个文件**有 100 MB 硬上限，而本项目的模型文件远超该限制：

| 文件 | 大小 | 说明 |
|---|---|---|
| `pretrained/wide_resnet50_2_v2.pth` | 约 263 MB | WideResNet-50-2 的 IMAGENET1K_V2 预训练骨干权重，用于离线运行 |
| `weights/*.pth`（15 个） | 合计约 375 MB | 15 类产品各自的正常特征记忆库 |

因此本仓库**只包含源代码与前端资源**，权重文件通过 **Releases 附件**提供。

## 如何获取并放置

1. 打开本仓库的 **Releases** 页面，下载最新版本的权重包（`lightguard-weights.zip`）。
2. 解压后得到 `pretrained/` 与 `weights/` 两个目录。
3. 将这两个目录放到本仓库的 `01_可运行系统/` 目录下，使目录结构变为：

```
01_可运行系统/
├── app.py
├── model.py
├── pretrained/
│   └── wide_resnet50_2_v2.pth
└── weights/
    ├── bottle.pth
    ├── cable.pth
    └── ...（共 15 个）
```

4. 之后按根目录 `README.md` 的说明启动即可。

## 为什么不用 Git LFS

Git LFS 免费额度为 1 GB 存储 / 1 GB 月流量，本项目的权重合计约 640 MB，
一次完整克隆就会消耗掉大部分流量额度，容易导致评审下载失败。
Releases 附件（单文件上限 2 GB）更稳妥，评委也无需安装 Git LFS 即可下载。
