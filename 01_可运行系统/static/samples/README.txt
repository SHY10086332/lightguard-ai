# 测试样例说明

## 目录结构

- `standard_normal/` — 标准光照下的正常样品，用于演示"判定为正常"
- `defect/` — 缺陷样品，用于演示"判定为异常"与热力图定位

（本包未附带光照变化样张。光照域偏移相关结论来自 `原始实验记录/` 中的 MVTec AD 2 评测记录，而不是演示样张。）

## 使用方法

1. 启动系统：双击 `..\光稳智检_iCAN演示启动.bat`
2. 选择产品类别（如 bottle）并点击"加载模型"
3. 上传图片进行检测（单张需再点"开始检测"）
4. 查看检测结果、热力图与叠加图

## 预期结果

### 正常样品
- 检测结果：正常（异常分数低于该类别阈值）
- 热力图：以蓝/绿色为主，无集中红色响应

### 缺陷样品
- 检测结果：异常（异常分数高于该类别阈值）
- 热力图：缺陷位置出现集中红色响应

## 关于样例图像的来源与许可（重要）

本目录下的样例图像**取自 MVTec AD 数据集**，为未修改的原始文件，仅用于本项目的非商业竞赛演示与算法验证。

- **数据集**：MVTec AD — A Comprehensive Real-World Dataset for Unsupervised Anomaly Detection
- **版权**：Copyright 2019 MVTec Software GmbH
- **许可**：Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International（CC BY-NC-SA 4.0），
  许可全文见 <https://creativecommons.org/licenses/by-nc-sa/4.0/>
- **引用**：Paul Bergmann, Michael Fauser, David Sattlegger, Carsten Steger. *A Comprehensive Real-World Dataset for Unsupervised Anomaly Detection.* IEEE CVPR, 2019.
- **用途限制**：CC BY-NC-SA 4.0 仅允许**非商业**用途；任何商业化使用（含产品化试点）须先联系 MVTec Software GmbH 取得授权（paul.bergmann@mvtec.com）。
- **免责声明**：数据集按"现状"提供，版权方不对其适用性或准确性作任何担保。

使用本目录以外的图像（尤其是企业产线图像）时，请自行确认数据权属与授权。

## 注意事项

- 图片格式：JPG、PNG、BMP
- 图片大小：不超过 16MB
- 上传的文件会保存到 `../static/uploads/`，可随时清空
