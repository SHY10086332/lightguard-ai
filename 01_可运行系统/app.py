# -*- coding: utf-8 -*-
"""
工业视觉质检系统 - Flask后端
"""

import os
import sys
import json
import time
import uuid
import urllib.parse
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image
import numpy as np

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from model import PatchCore, get_available_categories, PRODUCT_CATEGORIES

# 创建Flask应用
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB限制
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'static', 'uploads')

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'gif'}

# 全局模型变量
model: PatchCore = None

# 当前选择的产品类别
current_category: str = None

# 检测历史记录
history = []


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def init_model():
    """初始化模型（不加载具体类别，等待用户选择）"""
    global model
    print("[系统] 初始化模型结构...")
    model = PatchCore(device='cpu')
    print("[系统] 模型结构初始化完成")
    print(f"[系统] 可用产品类别: {get_available_categories()}")


@app.route('/')
def index():
    """首页"""
    return render_template('index.html')


@app.route('/api/categories', methods=['GET'])
def get_categories():
    """获取可用的产品类别"""
    available = get_available_categories()
    return jsonify({
        'categories': available,
        'current': current_category,
        'threshold': model.threshold if model and current_category else None
    })


@app.route('/api/select_category', methods=['POST'])
def select_category():
    """选择产品类别"""
    global current_category
    
    data = request.get_json()
    category = data.get('category')
    
    if not category:
        return jsonify({'error': '请选择产品类别'}), 400
    
    if category not in PRODUCT_CATEGORIES:
        return jsonify({'error': f'不支持的类别: {category}'}), 400
    
    try:
        # 加载该类别的记忆库
        weights_dir = os.path.join(os.path.dirname(__file__), 'weights')
        model.load_category(category, weights_dir=weights_dir)
        current_category = category
        
        return jsonify({
            'success': True,
            'category': category,
            'threshold': model.threshold,
            'message': f'已加载 {category} 类别'
        })
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': f'加载失败: {str(e)}'}), 500


@app.route('/api/detect', methods=['POST'])
def detect():
    """
    检测接口
    
    接收图像文件，返回检测结果
    """
    # 检查是否已选择类别
    if current_category is None:
        return jsonify({'error': '请先选择产品类别'}), 400
    
    # 检查是否有文件
    if 'image' not in request.files:
        return jsonify({'error': '未找到图像文件'}), 400
    
    file = request.files['image']
    
    # 检查文件名
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    # 检查文件类型
    if not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件类型'}), 400
    
    try:
        # 读取图像
        image = Image.open(file.stream).convert('RGB')
        
        # 记录开始时间
        start_time = time.time()
        
        # 进行检测
        anomaly_score, anomaly_map, is_anomaly = model.predict(image)
        
        # 计算检测时间
        detect_time = time.time() - start_time
        
        # 生成可视化结果
        visualizations = model.visualize(image, anomaly_map)
        
        # 判断状态
        status = '异常' if is_anomaly else '正常'
        
        # 保存上传的文件：路径使用安全文件名（防止路径穿越），
        # 但历史记录保留原始文件名，避免中文名被 secure_filename 剥离后无法区分样本。
        safe_name = secure_filename(file.filename) or 'image.png'
        unique_filename = f"{uuid.uuid4().hex}_{safe_name}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        image.save(filepath)
        display_name = os.path.basename(file.filename) or safe_name
        
        # 记录历史
        record = {
            'id': uuid.uuid4().hex,
            'filename': display_name,
            'category': current_category,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'score': round(anomaly_score, 2),
            'threshold': round(model.threshold, 2),
            'status': status,
            'detect_time': round(detect_time, 3)
        }
        history.insert(0, record)
        
        # 返回结果
        return jsonify({
            'success': True,
            'result': {
                'score': round(anomaly_score, 2),
                'threshold': round(model.threshold, 2),
                'status': status,
                'detect_time': round(detect_time, 3),
                'category': current_category,
                'visualizations': visualizations
            },
            'record': record
        })
    
    except Exception as e:
        return jsonify({'error': f'检测失败: {str(e)}'}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """获取检测历史"""
    return jsonify({'history': history[:50]})  # 返回最近50条记录


@app.route('/api/clear_history', methods=['POST'])
def clear_history():
    """清空检测历史"""
    global history
    history = []
    return jsonify({'success': True, 'message': '历史记录已清空'})


@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    return jsonify({
        'status': 'running',
        'model_loaded': model is not None,
        'category_loaded': current_category is not None,
        'current_category': current_category,
        'history_count': len(history),
        'threshold': model.threshold if model and current_category else None
    })


@app.route('/api/set_threshold', methods=['POST'])
def set_threshold():
    """设置异常阈值"""
    data = request.get_json()
    threshold = data.get('threshold')
    
    if threshold is None or threshold <= 0:
        return jsonify({'error': '阈值必须大于0'}), 400
    
    model.threshold = float(threshold)
    return jsonify({'success': True, 'threshold': model.threshold})


@app.route('/api/comparison', methods=['GET'])
def get_comparison():
    """获取基线与改进模型的离线实验对比数据
    
    注意：此接口返回离线实验的对比结果，不涉及实时模型切换。
    当前运行模型固定为：光稳智检改进模型。
    """
    # 从单一数据源读取离线结果，避免页面与文档出现不同轮次的混合数据。
    results_path = os.path.join(os.path.dirname(__file__), 'experiment_results.json')
    with open(results_path, 'r', encoding='utf-8') as file:
        results = json.load(file)
    paired = results['baseline_vs_improved_6class']
    # 只取真正的类别条目，避免把 description/average/change_note 等说明字段
    # 当成类别传给前端（前端会读取每个条目的 change 字段并渲染成一行）。
    paired_categories = {
        key: value for key, value in paired.items()
        if key not in ('description', 'average', 'change_note')
        and isinstance(value, dict) and 'change' in value
    }
    ad2 = results['mvtec_ad2_results']
    comparison_data = {
        'description': paired['description'],
        'note': '当前运行模型为改进模型；以下为同一轮离线配对记录，非实时切换。',
        'paired_6class': paired_categories,
        'average': paired['average'],
        'change_note': paired.get('change_note', ''),
        'analysis': results['summary']['conclusion'],
        'metric_definitions': results.get('metric_definitions', {}),
        'mvtec_ad2_highlights': ad2['effective_cases'],
        'mvtec_ad2_macro_average': ad2['macro_average'],
        'mvtec_ad2_regression_cases': ad2['regression_cases'],
        'mvtec_ad2_description': ad2['description'],
        # 诚实披露：同一轮中像素级指标与正常图误报率并未改善。
        'mvtec_ad2_pixel_metrics': ad2.get('pixel_level_metrics', {}),
        'mvtec_ad2_normal_fpr': ad2.get('normal_fpr', {}),
        'mvtec_ad_15class_average': results.get('mvtec_ad_15class_average', {}),
    }
    
    return jsonify({
        'success': True,
        'comparison': comparison_data
    })


@app.route('/api/batch_detect', methods=['POST'])
def batch_detect():
    """
    批量检测接口
    
    接收多个图像文件，返回批量检测结果
    """
    # 检查是否已选择类别
    if current_category is None:
        return jsonify({'error': '请先选择产品类别'}), 400
    
    # 检查是否有文件
    if 'images' not in request.files:
        return jsonify({'error': '未找到图像文件'}), 400
    
    files = request.files.getlist('images')
    
    if len(files) == 0:
        return jsonify({'error': '未选择文件'}), 400
    
    results = []
    
    for file in files:
        if file.filename == '' or not allowed_file(file.filename):
            continue
        
        try:
            # 读取图像
            image = Image.open(file.stream).convert('RGB')
            
            # 记录开始时间
            start_time = time.time()
            
            # 进行检测
            anomaly_score, anomaly_map, is_anomaly = model.predict(image)
            
            # 计算检测时间
            detect_time = time.time() - start_time
            
            # 生成可视化结果
            visualizations = model.visualize(image, anomaly_map)
            
            # 判断状态
            status = '异常' if is_anomaly else '正常'
            
            # 保存文件用安全名，展示用原始名（保留中文，便于区分样本）
            safe_name = secure_filename(file.filename) or 'image.png'
            unique_filename = f"{uuid.uuid4().hex}_{safe_name}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            image.save(filepath)
            display_name = os.path.basename(file.filename) or safe_name
            
            # 记录结果
            result = {
                'filename': display_name,
                'score': round(anomaly_score, 2),
                'threshold': round(model.threshold, 2),
                'status': status,
                'detect_time': round(detect_time, 3),
                'visualizations': visualizations
            }
            results.append(result)
            
            # 记录历史
            record = {
                'id': uuid.uuid4().hex,
                'filename': display_name,
                'category': current_category,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'score': round(anomaly_score, 2),
                'threshold': round(model.threshold, 2),
                'status': status,
                'detect_time': round(detect_time, 3)
            }
            history.insert(0, record)
            
        except Exception as e:
            results.append({
                'filename': file.filename,
                'error': str(e)
            })
    
    # 统计结果
    total = len(results)
    normal_count = sum(1 for r in results if r.get('status') == '正常')
    abnormal_count = sum(1 for r in results if r.get('status') == '异常')
    
    return jsonify({
        'success': True,
        'results': results,
        'summary': {
            'total': total,
            'normal': normal_count,
            'abnormal': abnormal_count,
            'abnormal_rate': round(abnormal_count / total * 100, 2) if total > 0 else 0
        }
    })


@app.route('/api/export_report', methods=['GET'])
def export_report():
    """导出检测报告为CSV"""
    import csv
    import io
    from flask import Response
    
    if len(history) == 0:
        return jsonify({'error': '没有检测记录'}), 400
    
    # 创建CSV内容
    output = io.StringIO()
    writer = csv.writer(output)
    
    # 写入表头
    writer.writerow(['序号', '文件名', '产品类别', '检测时间', '异常分数', '阈值', '检测结果', '推理耗时(秒)'])
    
    # 写入数据
    for i, record in enumerate(history, 1):
        writer.writerow([
            i,
            record['filename'],
            record['category'],
            record['timestamp'],
            record['score'],
            record['threshold'],
            record['status'],
            record['detect_time']
        ])
    
    # 统计信息
    total = len(history)
    normal_count = sum(1 for r in history if r['status'] == '正常')
    abnormal_count = sum(1 for r in history if r['status'] == '异常')
    
    writer.writerow([])
    writer.writerow(['统计信息'])
    writer.writerow(['总检测数', total])
    writer.writerow(['正常数量', normal_count])
    writer.writerow(['异常数量', abnormal_count])
    writer.writerow(['异常率', f"{round(abnormal_count / total * 100, 2)}%" if total > 0 else "0%"])
    writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    
    # 返回CSV文件（带 UTF-8 BOM，Excel 直接打开中文不乱码）
    output.seek(0)
    return Response(
        '\ufeff' + output.getvalue(),
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f"attachment; filename*=UTF-8''{urllib.parse.quote('光稳智检_检测报告_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.csv')}"
        }
    )


@app.route('/static/<path:filename>')
def static_files(filename):
    """静态文件服务"""
    return send_from_directory('static', filename)


# 启动时初始化模型
print("=" * 60)
print("  工业视觉质检系统启动中...")
print("=" * 60)
init_model()
print("=" * 60)
print("  系统启动完成！")
print("  访问地址: http://localhost:5000")
print("  请先选择产品类别，然后上传图像进行检测")
print("=" * 60)


if __name__ == '__main__':
    # 本地/局域网演示：debug 必须关闭（Werkzeug 调试器允许远程执行代码）
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        use_reloader=False
    )
