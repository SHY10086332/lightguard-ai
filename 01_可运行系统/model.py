# -*- coding: utf-8 -*-
"""
工业视觉质检系统 - AI模型模块
基于PatchCore算法的异常检测模型
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as transforms
import numpy as np
from PIL import Image
import cv2
import io
import base64
from typing import Tuple, Optional, Dict, List
import warnings
warnings.filterwarnings('ignore')


def _load_pretrained_backbone(backbone):
    """加载骨干网络：优先使用包内内置权重（离线可用），否则联网下载。
    注意：wide_resnet50_2 / resnet50 必须使用 IMAGENET1K_V2 权重，
    记忆库特征是用 V2 权重提取的；使用默认 V1 权重会导致特征空间不一致、检测分数失效。
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    pretrained_dir = os.path.join(base_dir, 'pretrained')

    if backbone == 'wide_resnet50_2':
        local = os.path.join(pretrained_dir, 'wide_resnet50_2_v2.pth')
        if os.path.exists(local):
            net = models.wide_resnet50_2(weights=None)
            net.load_state_dict(torch.load(local, map_location='cpu', weights_only=True))
            print('[模型] 已从本地加载 WideResNet-50 (IMAGENET1K_V2) 权重，无需联网')
            return net
        return models.wide_resnet50_2(weights=models.Wide_ResNet50_2_Weights.IMAGENET1K_V2)
    elif backbone == 'resnet50':
        local = os.path.join(pretrained_dir, 'resnet50_v2.pth')
        if os.path.exists(local):
            net = models.resnet50(weights=None)
            net.load_state_dict(torch.load(local, map_location='cpu', weights_only=True))
            print('[模型] 已从本地加载 ResNet-50 (IMAGENET1K_V2) 权重，无需联网')
            return net
        return models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    elif backbone == 'resnet18':
        return models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    else:
        raise ValueError(f"不支持的骨干网络: {backbone}")


class FeatureExtractor(nn.Module):
    """多尺度特征提取器"""

    def __init__(self, backbone='wide_resnet50_2', layers=['layer2', 'layer3']):
        super().__init__()
        # 加载预训练模型（本地内置优先，保证断网环境也能启动）
        self.backbone = _load_pretrained_backbone(backbone)
        
        self.layers = layers
        self.features = {}
        
        # 注册钩子函数
        for layer_name in layers:
            layer = dict(self.backbone.named_modules())[layer_name]
            layer.register_forward_hook(self._get_hook(layer_name))
        
        # 冻结参数
        for param in self.backbone.parameters():
            param.requires_grad = False
    
    def _get_hook(self, layer_name):
        """获取钩子函数"""
        def hook(module, input, output):
            self.features[layer_name] = output
        return hook
    
    def forward(self, x):
        """前向传播"""
        self.backbone(x)
        return {k: self.features[k] for k in self.layers}


# ============================================================
# 团队实验阈值（原始汇总见提交包“原始实验记录”；独立校准流程待补）
# 阈值单位：特征距离量纲（非0-1归一化分数）
# ============================================================
REAL_THRESHOLDS = {
    'bottle': 32.97,
    'cable': 37.67,
    'capsule': 30.21,
    'carpet': 26.84,
    'grid': 30.89,
    'hazelnut': 38.58,
    'leather': 32.69,
    'metal_nut': 40.32,
    'pill': 29.78,
    'screw': 34.90,
    'tile': 30.70,
    'toothbrush': 42.74,
    'transistor': 40.19,
    'wood': 31.83,
    'zipper': 25.72,
}


# 支持的产品类别
PRODUCT_CATEGORIES: List[str] = list(REAL_THRESHOLDS.keys())


class PatchCore:
    """PatchCore异常检测模型"""
    
    def __init__(
        self,
        backbone='wide_resnet50_2',
        layers=['layer2', 'layer3'],
        num_neighbors=9,
        image_size=224,
        device='cpu',
        model_mode='improved'  # 'baseline' 或 'improved'
    ):
        self.backbone = backbone
        self.layers = layers
        self.num_neighbors = num_neighbors
        self.image_size = image_size
        self.device = device
        self.model_mode = model_mode  # 模型模式
        
        # 特征提取器
        self.feature_extractor = FeatureExtractor(backbone=backbone, layers=layers)
        self.feature_extractor = self.feature_extractor.to(device)
        self.feature_extractor.eval()
        
        # 记忆库
        self.memory_bank: Optional[np.ndarray] = None
        self.memory_bank_tensor: Optional[torch.Tensor] = None
        
        # 当前产品类别和阈值
        self.current_category: Optional[str] = None
        self.threshold: float = 30.0  # 默认阈值（特征距离量纲）
        
        # 数据变换（与训练/评估代码一致：Resize 256 + CenterCrop 224）
        self.transform = transforms.Compose([
            transforms.Resize((image_size + 32, image_size + 32)),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
    
    def extract_features(self, image: torch.Tensor) -> Tuple[torch.Tensor, Tuple[int, int]]:
        """提取图像特征"""
        with torch.no_grad():
            features = self.feature_extractor(image)

            # 各层特征图空间尺寸不同（layer2:28x28, layer3:14x14），
            # 需先插值到最小尺寸再拼接（与训练代码 MultiScaleFeatureAggregator 一致）
            raw_feats = [features[layer_name] for layer_name in self.layers]
            target_h = min(f.shape[2] for f in raw_feats)
            target_w = min(f.shape[3] for f in raw_feats)

            feature_list = []
            for feat in raw_feats:
                if feat.shape[2] != target_h or feat.shape[3] != target_w:
                    feat = F.interpolate(
                        feat, size=(target_h, target_w),
                        mode='bilinear', align_corners=False
                    )
                B, C, H, W = feat.shape
                feat = feat.reshape(B, C, -1).permute(0, 2, 1)  # [B, H*W, C]
                feature_list.append(feat)

            # 拼接特征
            fused = torch.cat(feature_list, dim=2)  # [B, H*W, C1+C2]

            # 获取空间尺寸
            spatial_size = (target_h, target_w)

            return fused, spatial_size
    
    def load_category(self, category: str, weights_dir: str = 'weights'):
        """
        加载指定产品类别的记忆库
        
        Args:
            category: 产品类别名称（如 'bottle', 'cable' 等）
            weights_dir: 权重文件目录
        """
        if category not in PRODUCT_CATEGORIES:
            raise ValueError(f"不支持的产品类别: {category}，可选类别: {PRODUCT_CATEGORIES}")
        
        # 根据模型模式选择权重文件
        if self.model_mode == 'baseline':
            weight_path = os.path.join(weights_dir, 'baseline', f'{category}.pth')
        else:
            weight_path = os.path.join(weights_dir, f'{category}.pth')
        
        if not os.path.exists(weight_path):
            raise FileNotFoundError(f"权重文件不存在: {weight_path}")
        
        # 加载权重
        save_dict = torch.load(weight_path, map_location=self.device, weights_only=False)
        
        self.memory_bank = save_dict['memory_bank']
        self.memory_bank_tensor = torch.from_numpy(self.memory_bank).float().to(self.device)
        self.current_category = category
        
        # 设置真实阈值
        self.threshold = REAL_THRESHOLDS.get(category, 30.0)
        
        print(f"[模型] 模式: {self.model_mode}")
        print(f"[模型] 已加载 {category} 类别记忆库")
        print(f"[模型] 记忆库大小: {self.memory_bank.shape}")
        print(f"[模型] 异常阈值: {self.threshold:.2f}")
    
    def predict(self, image: Image.Image) -> Tuple[float, np.ndarray, bool]:
        """
        预测单张图像
        
        Args:
            image: PIL Image
        
        Returns:
            anomaly_score: 异常分数（特征距离）
            anomaly_map: 异常热力图（归一化到0-1）
            is_anomaly: 是否异常
        """
        if self.memory_bank_tensor is None:
            raise RuntimeError("记忆库未加载，请先调用 load_category()")
        
        # 预处理
        img_tensor = self.transform(image).unsqueeze(0).to(self.device)
        
        # 提取特征
        patches, spatial_size = self.extract_features(img_tensor)
        B, N, D = patches.shape
        
        # 计算到记忆库的距离
        dists = torch.cdist(patches, self.memory_bank_tensor, p=2.0)  # [B, N, M]
        
        # 获取k个最近邻
        k = min(self.num_neighbors, dists.shape[2])
        topk_dists, _ = dists.topk(k, dim=2, largest=False)  # [B, N, k]
        
        # 计算patch级分数
        patch_scores = topk_dists.mean(dim=2)  # [B, N]
        
        # 重塑为空间形式
        H, W = spatial_size
        score_map = patch_scores.reshape(B, H, W)
        
        # 上采样到原始图像尺寸
        anomaly_map = F.interpolate(
            score_map.unsqueeze(1),
            size=(self.image_size, self.image_size),
            mode='bilinear',
            align_corners=False
        )
        
        # 图像级分数：取所有patch的最大值
        anomaly_score = score_map.reshape(B, -1).max(dim=1)[0].item()
        
        # 固定尺度归一化：以该校准阈值为基准（patch距离≥阈值的区域标红），
        # 不做逐图min-max拉伸，避免正常图也出现"满图报警"的误导性热力图
        anomaly_map = anomaly_map.squeeze().cpu().numpy()
        scale = self.threshold if self.threshold and self.threshold > 0 else 1.0
        anomaly_map = np.clip(anomaly_map / scale, 0.0, 1.0)
        
        # 判断是否异常
        is_anomaly = anomaly_score > self.threshold
        
        return anomaly_score, anomaly_map, is_anomaly
    
    def visualize(self, image: Image.Image, anomaly_map: np.ndarray) -> dict:
        """
        生成可视化结果
        
        Args:
            image: 原始图像
            anomaly_map: 异常热力图（0-1）
        
        Returns:
            dict: 包含原图、热力图、叠加图的base64编码
        """
        # 转换图像为numpy数组
        img_array = np.array(image.resize((self.image_size, self.image_size)))
        
        # 生成热力图
        heatmap = cv2.applyColorMap((anomaly_map * 255).astype(np.uint8), cv2.COLORMAP_JET)
        heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        
        # 叠加图
        overlay = (img_array * 0.6 + heatmap * 0.4).astype(np.uint8)
        
        # 转换为base64
        def to_base64(img_array):
            img = Image.fromarray(img_array)
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode()
        
        return {
            'original': to_base64(img_array),
            'heatmap': to_base64(heatmap),
            'overlay': to_base64(overlay)
        }


def get_available_categories(weights_dir: str = 'weights') -> List[str]:
    """获取可用的产品类别"""
    available = []
    for category in PRODUCT_CATEGORIES:
        weight_path = os.path.join(weights_dir, f'{category}.pth')
        if os.path.exists(weight_path):
            available.append(category)
    return available


if __name__ == '__main__':
    # 测试模型
    print("可用的产品类别:", get_available_categories())
    
    # 创建模型
    model = PatchCore(device='cpu')
    
    # 加载bottle类别
    model.load_category('bottle')
    
    # 测试预测
    test_image = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
    score, heatmap, is_anomaly = model.predict(test_image)
    print(f"异常分数: {score:.4f}")
    print(f"是否异常: {is_anomaly}")
    print(f"阈值: {model.threshold:.2f}")
    print(f"热力图形状: {heatmap.shape}")
