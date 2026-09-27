// 工业视觉质检系统 - JavaScript主文件

// 全局变量
let currentFile = null;
let currentCategory = null;
let totalDetections = 0;
let normalCount = 0;
let abnormalCount = 0;
let totalDetectTime = 0;

// DOM元素
const categorySelect = document.getElementById('category-select');
const loadCategoryBtn = document.getElementById('load-category-btn');
const categoryInfo = document.getElementById('category-info');
const currentCategoryEl = document.getElementById('current-category');
const currentThresholdEl = document.getElementById('current-threshold');

const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const selectBtn = document.getElementById('select-btn');
const batchSelectBtn = document.getElementById('batch-select-btn');
const batchSelectPreviewBtn = document.getElementById('batch-select-preview-btn');
const batchInput = document.getElementById('batch-input');
const previewArea = document.getElementById('preview-area');
const previewImage = document.getElementById('preview-image');
const clearBtn = document.getElementById('clear-btn');
const detectBtn = document.getElementById('detect-btn');
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdValue = document.getElementById('threshold-value');
const resetThresholdBtn = document.getElementById('reset-threshold-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const resultContent = document.getElementById('result-content');
const visualizationContent = document.getElementById('visualization-content');
const historyContent = document.getElementById('history-content');
const loadingOverlay = document.getElementById('loading-overlay');
const statusBadge = document.getElementById('status-badge');

// 统计元素
const totalCount = document.getElementById('total-count');
const normalCountEl = document.getElementById('normal-count');
const abnormalCountEl = document.getElementById('abnormal-count');
const avgTime = document.getElementById('avg-time');

// 默认阈值
const DEFAULT_THRESHOLDS = {
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
};

// 转义 HTML 特殊字符，避免文件名等内容注入标记
function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadCategories();
    loadHistory();
    updateStats();
});

// 初始化事件监听
function initEventListeners() {
    // 离线实验对比按钮
    const comparisonBtn = document.getElementById('comparison-btn');
    if (comparisonBtn) {
        comparisonBtn.addEventListener('click', showComparison);
    }
    
    // 产品类别选择
    categorySelect.addEventListener('change', function() {
        loadCategoryBtn.disabled = !this.value;
        if (this.value !== currentCategory) {
            currentCategory = null;
            categoryInfo.style.display = 'none';
        }
    });
    
    // 加载类别按钮
    loadCategoryBtn.addEventListener('click', loadSelectedCategory);
    
    // 点击上传区域的图标或文字时打开单张选择。
    // 注意：隐藏的 file input 调用 click() 时也会产生冒泡事件。
    // 若不排除两个 input 和批量按钮，批量选择会被误切换为单张选择。
    uploadArea.addEventListener('click', function(e) {
        if (e.target === fileInput || e.target === batchInput) {
            return;
        }

        if (batchSelectBtn && (e.target === batchSelectBtn || batchSelectBtn.contains(e.target))) {
            return;
        }

        if (e.target === selectBtn || selectBtn.contains(e.target)) {
            openSingleFilePicker();
        } else if (!previewArea.contains(e.target) && !e.target.closest('button')) {
            openSingleFilePicker();
        }
    });
    
    // 选择按钮
    selectBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openSingleFilePicker();
    });
    
    // 批量选择按钮
    if (batchSelectBtn) {
        batchSelectBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openBatchFilePicker();
        });
    }

    // 单张预览状态下也可以直接切换到批量选择
    if (batchSelectPreviewBtn) {
        batchSelectPreviewBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openBatchFilePicker();
        });
    }
    
    // 批量文件选择
    if (batchInput) {
        batchInput.addEventListener('change', handleBatchFileSelect);
    }
    
    // 导出报告按钮
    const exportReportBtn = document.getElementById('export-report-btn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', exportReport);
    }
    
    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    // 清除按钮
    clearBtn.addEventListener('click', clearPreview);
    
    // 检测按钮
    detectBtn.addEventListener('click', startDetection);
    
    // 阈值滑块：拖动即时更新显示；松开后提交到服务端（仅当前运行生效，可随时重置）
    thresholdSlider.addEventListener('input', function() {
        thresholdValue.textContent = parseFloat(this.value).toFixed(2);
    });

    thresholdSlider.addEventListener('change', function() {
        if (!currentCategory) {
            showToast('请先选择产品类别', 'error');
            return;
        }
        const value = parseFloat(this.value);
        fetch('/api/set_threshold', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ threshold: value })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                currentThresholdEl.textContent = value.toFixed(2);
                showToast(`阈值已设为 ${value.toFixed(2)}（仅当前运行生效，点“重置阈值”恢复默认）`, 'info');
            } else {
                showToast(data.error || '阈值设置失败', 'error');
            }
        }).catch(() => {
            showToast('阈值设置失败，请重试', 'error');
        });
    });

    // 重置阈值
    resetThresholdBtn.addEventListener('click', resetThreshold);
    
    // 清空历史
    clearHistoryBtn.addEventListener('click', clearHistory);
}

function openSingleFilePicker() {
    if (!currentCategory) {
        showToast('请先选择产品类别并点击“加载模型”', 'error');
        return;
    }
    fileInput.value = '';
    fileInput.click();
}

function openBatchFilePicker() {
    if (!currentCategory) {
        showToast('请先选择产品类别并点击“加载模型”', 'error');
        return;
    }
    // 先清空，确保连续选择同一批文件时仍会触发 change 事件。
    batchInput.value = '';
    batchInput.click();
}

// 加载可用类别
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        
        // 清空下拉框
        categorySelect.innerHTML = '<option value="">-- 请选择产品类别 --</option>';
        
        // 添加类别选项
        data.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('加载类别失败:', error);
        showToast('加载类别失败', 'error');
    }
}

// 显示离线实验对比
async function showComparison() {
    try {
        const response = await fetch('/api/comparison');
        const data = await response.json();
        
        if (data.success) {
            const comparison = data.comparison;
            
            // 构建对比表格HTML
            let tableHtml = `
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 16px; margin-bottom: 8px;">6类配对实验对比</h3>
                    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">${comparison.description}</p>
                </div>
                <table class="results-table" style="font-size: 12px;">
                    <thead>
                        <tr>
                            <th>类别</th>
                            <th>基线AUROC</th>
                            <th>改进AUROC</th>
                            <th>变化</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (const [category, data] of Object.entries(comparison.paired_6class)) {
                const changeClass = data.change.startsWith('+') ? 'normal' : 'abnormal';
                tableHtml += `
                    <tr>
                        <td>${category}</td>
                        <td>${(data.baseline * 100).toFixed(2)}%</td>
                        <td>${(data.improved * 100).toFixed(2)}%</td>
                        <td class="${changeClass}">${data.change}</td>
                    </tr>
                `;
            }
            
            tableHtml += `
                    <tr style="font-weight: bold;">
                        <td>平均</td>
                        <td>${(comparison.average.baseline * 100).toFixed(2)}%</td>
                        <td>${(comparison.average.improved * 100).toFixed(2)}%</td>
                        <td class="abnormal">${comparison.average.change}</td>
                    </tr>
                    </tbody>
                </table>
                <div style="margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 12px; line-height: 1.7;">
                    <strong>分析：</strong>${comparison.analysis}
                    ${comparison.change_note ? '<br><strong>口径：</strong>' + comparison.change_note : ''}
                    ${(comparison.metric_definitions && comparison.metric_definitions.auroc) ? '<br><strong>指标说明：</strong>AUROC为排序能力指标，不等于检测准确率，也不等于产线误报率；表中F1为阈值取优的最优F1。' : ''}
                </div>
            `;

            const ad2 = comparison.mvtec_ad2_macro_average;
            const improvedCount = 8 - comparison.mvtec_ad2_regression_cases.length;
            // 同一轮像素级指标与误报率：与Image AUROC提升同时展示，避免只报单一有利指标。
            const pixel = comparison.mvtec_ad2_pixel_metrics || {};
            const pixelRows = [
                ['Pixel AUROC', pixel.pixel_auroc],
                ['AUPRO', pixel.aupro],
                ['Pixel AP', pixel.pixel_ap],
                ['Pixel F1（阈值取优）', pixel.pixel_f1_max]
            ].filter(([, v]) => v).map(([label, v]) => `
                        <tr>
                            <td>${label}</td>
                            <td>${(v.baseline * 100).toFixed(2)}%</td>
                            <td>${(v.improved * 100).toFixed(2)}%</td>
                            <td class="${v.change.startsWith('+') ? 'normal' : 'abnormal'}">${v.change}</td>
                        </tr>`).join('');
            const ad2Fpr = comparison.mvtec_ad2_normal_fpr || {};
            const fprRow = ad2Fpr.note ? `
                        <tr>
                            <td>正常图误报率（类别均值）</td>
                            <td>${(ad2Fpr.baseline * 100).toFixed(2)}%</td>
                            <td>${(ad2Fpr.improved * 100).toFixed(2)}%</td>
                            <td class="${ad2Fpr.improved <= ad2Fpr.baseline ? 'normal' : 'abnormal'}">${((ad2Fpr.improved - ad2Fpr.baseline) * 100).toFixed(2)} pp</td>
                        </tr>` : '';
            const m15 = comparison.mvtec_ad_15class_average || {};
            const m15Row = m15.normal_fpr_mean ? `
                <div style="margin-top: 16px; padding: 12px; background: #fef2f2; border-radius: 8px; font-size: 12px; line-height: 1.7;">
                    <strong>15类正常图误报率（类别均值）：</strong>${(m15.normal_fpr_mean * 100).toFixed(2)}%，中位${(m15.normal_fpr_median * 100).toFixed(2)}%。
                    ${(m15.recall_mean || m15.recall_mean === 0) ? `<br><strong>同工作点缺陷召回率（类别均值）：</strong>${(m15.recall_mean * 100).toFixed(2)}%。` : ''}
                    <strong>两者必须成对阅读</strong>——本系统面向批量预筛加人工复核，偏向高召回。
                    ${m15.normal_fpr_note || ''}
                </div>` : '';
            tableHtml += `
                <div style="margin-top: 20px; margin-bottom: 10px;">
                    <h3 style="font-size: 16px; margin-bottom: 8px;">MVTec AD 2 本地8类配对评测</h3>
                    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
                        ${comparison.mvtec_ad2_description}；当前页面展示已保存的离线记录，并非实时切换模型。
                    </p>
                </div>
                <table class="results-table" style="font-size: 12px;">
                    <thead>
                        <tr>
                            <th>指标</th>
                            <th>基线</th>
                            <th>改进模型</th>
                            <th>变化</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="font-weight: bold;">
                            <td>Image AUROC 宏平均</td>
                            <td>${(ad2.baseline * 100).toFixed(2)}%</td>
                            <td>${(ad2.improved * 100).toFixed(2)}%</td>
                            <td class="normal">${ad2.change}</td>
                        </tr>
                        ${pixelRows}
                        ${fprRow}
                    </tbody>
                </table>
                <div style="margin-top: 12px; padding: 12px; background: #eff6ff; border-radius: 8px; font-size: 12px; line-height: 1.7;">
                    <strong>结果边界：</strong>8类中${improvedCount}类提高、${comparison.mvtec_ad2_regression_cases.length}类下降；
                    下降类别为 ${comparison.mvtec_ad2_regression_cases.join('、')}。该结果为团队本地记录，不是官方服务器成绩。
                    ${pixel.note ? '<br><strong>须同时报告：</strong>' + pixel.note : ''}
                    ${ad2Fpr.note ? '<br>' + ad2Fpr.note : ''}
                </div>
                ${m15Row}
            `;
            
            // 显示在结果区域
            resultContent.innerHTML = `
                <div class="comparison-result">
                    ${tableHtml}
                </div>
            `;
            
            showToast('离线实验对比数据已加载', 'success');
        } else {
            showToast('获取对比数据失败', 'error');
        }
    } catch (error) {
        console.error('获取对比数据失败:', error);
        showToast('获取对比数据失败', 'error');
    }
}

// 加载选中的类别
async function loadSelectedCategory() {
    const category = categorySelect.value;
    if (!category) {
        showToast('请先选择产品类别', 'error');
        return;
    }
    
    // 显示加载状态
    loadCategoryBtn.disabled = true;
    loadCategoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
    updateStatus('加载模型中...', false);
    
    try {
        const response = await fetch('/api/select_category', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ category: category })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentCategory = category;
            
            // 更新UI
            currentCategoryEl.textContent = category;
            currentThresholdEl.textContent = data.threshold.toFixed(2);
            categoryInfo.style.display = 'flex';
            
            // 更新滑块
            thresholdSlider.value = data.threshold;
            thresholdValue.textContent = data.threshold.toFixed(2);
            
            showToast(`已加载 ${category} 类别模型`, 'success');
            updateStatus('系统就绪', true);
        } else {
            showToast(data.error || '加载失败', 'error');
            updateStatus('加载失败', false);
        }
    } catch (error) {
        console.error('加载类别失败:', error);
        showToast('加载类别失败，请重试', 'error');
        updateStatus('加载失败', false);
    } finally {
        loadCategoryBtn.disabled = false;
        loadCategoryBtn.innerHTML = '<i class="fas fa-download"></i> 加载模型';
    }
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// 处理文件
function handleFile(file) {
    // 检查是否已选择类别
    if (!currentCategory) {
        showToast('请先选择产品类别', 'error');
        return;
    }
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        showToast('请选择图像文件', 'error');
        return;
    }
    
    // 检查文件大小
    if (file.size > 16 * 1024 * 1024) {
        showToast('文件大小不能超过16MB', 'error');
        return;
    }
    
    currentFile = file;
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        uploadArea.style.display = 'none';
        previewArea.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// 清除预览
function clearPreview() {
    currentFile = null;
    fileInput.value = '';
    previewImage.src = '';
    uploadArea.style.display = 'block';
    previewArea.style.display = 'none';
}

// 处理批量文件选择
async function handleBatchFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (!currentCategory) {
        showToast('请先选择产品类别并点击“加载模型”', 'error');
        e.target.value = '';
        return;
    }

    const invalidFiles = Array.from(files).filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
        showToast('批量选择中包含非图像文件，请重新选择', 'error');
        e.target.value = '';
        return;
    }
    
    // 「批量选择」按设计是“选完即自动检测”，这里明确提示，避免与「选择单张」混淆。
    showToast(`已选择 ${files.length} 张，正在自动批量检测…`, 'info');

    // 显示加载动画
    showLoading(true, `正在自动批量检测 ${files.length} 张图片…`);
    updateStatus(`批量检测中... (0/${files.length})`, false);
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    
    try {
        const response = await fetch('/api/batch_detect', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 显示批量结果
            displayBatchResults(data.results, data.summary);
            
            // 更新统计
            data.results.forEach(result => {
                if (result.status) {
                    totalDetections++;
                    if (result.status === '正常') normalCount++;
                    else abnormalCount++;
                    totalDetectTime += result.detect_time || 0;
                }
            });
            updateStats();
            
            // 刷新检测历史，让批量结果立即出现在历史区域
            await loadHistory();
            
            showToast(`批量检测完成: ${data.summary.total}张, 异常${data.summary.abnormal}张`, 'success');
        } else {
            showToast(data.error || '批量检测失败', 'error');
        }
    } catch (error) {
        console.error('批量检测失败:', error);
        showToast('批量检测失败，请重试', 'error');
    } finally {
        showLoading(false);
        updateStatus('系统就绪', true);
        e.target.value = ''; // 清空input
    }
}

// 显示批量检测结果
function displayBatchResults(results, summary) {
    let html = `
        <div class="batch-summary">
            <div class="summary-item">
                <span class="summary-label">总检测数</span>
                <span class="summary-value">${summary.total}</span>
            </div>
            <div class="summary-item normal">
                <span class="summary-label">正常</span>
                <span class="summary-value">${summary.normal}</span>
            </div>
            <div class="summary-item abnormal">
                <span class="summary-label">异常</span>
                <span class="summary-value">${summary.abnormal}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">异常率</span>
                <span class="summary-value">${summary.abnormal_rate}%</span>
            </div>
        </div>
        <div class="batch-results">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>文件名</th>
                        <th>检测结果</th>
                        <th>异常分数</th>
                        <th>推理耗时</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach(result => {
        if (result.error) {
            html += `
                <tr class="error-row">
                    <td>${result.filename}</td>
                    <td colspan="3">错误: ${result.error}</td>
                </tr>
            `;
        } else {
            const statusClass = result.status === '正常' ? 'normal' : 'abnormal';
            html += `
                <tr class="${statusClass}-row">
                    <td>${result.filename}</td>
                    <td><span class="status-badge ${statusClass}">${result.status}</span></td>
                    <td>${result.score}</td>
                    <td>${result.detect_time}s</td>
                </tr>
            `;
        }
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    resultContent.innerHTML = html;

    // 同步更新“可视化分析”：可逐张切换查看批内每个样本。
    // 此前该区域不会随批量检测更新，会停留在上一次单张结果（张冠李戴）或空占位。
    renderBatchVisualizations(results, summary);
}

// 导出检测报告
function exportReport() {
    if (totalDetections === 0) {
        showToast('没有检测记录可导出', 'error');
        return;
    }
    
    window.location.href = '/api/export_report';
    showToast('正在导出检测报告...', 'info');
}

// 开始检测
async function startDetection() {
    if (!currentCategory) {
        showToast('请先选择产品类别', 'error');
        return;
    }
    
    if (!currentFile) {
        showToast('请先选择图像', 'error');
        return;
    }
    
    // 显示加载动画
    showLoading(true);
    updateStatus('AI检测中...', false);
    
    // 禁用按钮
    detectBtn.disabled = true;
    clearBtn.disabled = true;
    
    try {
        // 创建表单数据
        const formData = new FormData();
        formData.append('image', currentFile);
        
        // 发送请求
        const response = await fetch('/api/detect', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 显示结果
            displayResult(data.result);
            // 更新统计
            updateDetectionStats(data.result);
            // 添加到历史
            addToHistory(data.record);
            // 更新阈值显示
            updateThreshold(data.result.threshold);
            
            showToast('检测完成', 'success');
        } else {
            showToast(data.error || '检测失败', 'error');
        }
    } catch (error) {
        console.error('检测错误:', error);
        showToast('检测请求失败，请重试', 'error');
    } finally {
        // 隐藏加载动画
        showLoading(false);
        updateStatus('系统就绪', true);
        
        // 启用按钮
        detectBtn.disabled = false;
        clearBtn.disabled = false;
    }
}

// 显示检测结果
// 渲染可视化标签页（单张结果与批量结果共用）
function renderVisualizations(visualizations, caption, startType, host) {
    const target = host || visualizationContent;

    if (!visualizations) {
        target.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-image"></i>
                <p>${caption || '检测结果将在此显示'}</p>
            </div>
        `;
        return;
    }

    const types = [
        ['original', '原图', 'fa-image'],
        ['heatmap', '热力图', 'fa-fire'],
        ['overlay', '叠加图', 'fa-layer-group']
    ];
    const active = startType || 'original';

    target.innerHTML = `
        ${caption ? `<div class="vis-caption" style="font-size: 12px; color: #475569; background: #f1f5f9; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; line-height: 1.6;">${caption}</div>` : ''}
        <div class="visualization-tabs">
            ${types.map(([t, name, icon]) => `
            <button class="tab-btn${t === active ? ' active' : ''}" data-type="${t}">
                <i class="fas ${icon}"></i> ${name}
            </button>`).join('')}
        </div>
        <div class="visualization-image">
            <img id="vis-image" src="data:image/png;base64,${visualizations[active]}" alt="可视化结果">
        </div>
    `;

    const tabBtns = target.querySelectorAll('.tab-btn');
    const visImage = target.querySelector('#vis-image');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            visImage.src = `data:image/png;base64,${visualizations[this.dataset.type]}`;
        });
    });
}

// 批量检测的可视化区：可逐张切换查看批内每张样本
function renderBatchVisualizations(results, summary) {
    const withVis = results.filter(r => !r.error && r.visualizations);

    if (withVis.length === 0) {
        renderVisualizations(null, `批量检测共 ${summary.total} 张，没有可展示的可视化结果`);
        return;
    }

    // 默认选中最可疑样本
    const top = withVis.reduce((a, b) => (b.score > a.score ? b : a));

    visualizationContent.innerHTML = `
        <div class="batch-vis-selector">
            <div class="batch-vis-hint">
                <i class="fas fa-hand-pointer"></i>
                批量共 ${withVis.length} 张，点击任一样本查看其原图 / 热力图 / 叠加图（默认显示本批异常分数最高者）：
            </div>
            <div class="batch-vis-buttons">
                ${withVis.map((r, i) => `
                <button class="batch-vis-btn${r === top ? ' active' : ''}" data-index="${i}" title="${escapeHtml(r.filename)}">
                    <span class="bv-name">${escapeHtml(r.filename)}</span>
                    <span class="bv-meta ${r.status === '正常' ? 'bv-normal' : 'bv-abnormal'}">${r.status} · ${r.score}</span>
                </button>`).join('')}
            </div>
        </div>
        <div id="vis-host"></div>
    `;

    const host = document.getElementById('vis-host');
    const buttons = visualizationContent.querySelectorAll('.batch-vis-btn');

    const showItem = (item, btn) => {
        buttons.forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderVisualizations(
            item.visualizations,
            `当前查看：<strong>${escapeHtml(item.filename)}</strong>（分数 ${item.score}，阈值 ${item.threshold}，判定${item.status}）`,
            'heatmap',
            host
        );
    };

    buttons.forEach(btn => {
        btn.addEventListener('click', function () {
            showItem(withVis[Number(this.dataset.index)], this);
        });
    });

    showItem(top, buttons[withVis.indexOf(top)]);
}

function displayResult(result) {
    const { score, threshold, status, detect_time, category, visualizations } = result;
    const isAbnormal = status === '异常';
    
    // 结果信息
    resultContent.innerHTML = `
        <div class="result-info">
            <div class="result-item ${isAbnormal ? 'danger' : 'success'}">
                <div class="result-icon">
                    <i class="fas ${isAbnormal ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                </div>
                <div class="result-label">检测状态</div>
                <div class="result-value">${status}</div>
            </div>
            <div class="result-item">
                <div class="result-icon" style="color: #2563eb;">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="result-label">异常分数</div>
                <div class="result-value">${score.toFixed(2)}</div>
                <div class="result-sub">阈值: ${threshold.toFixed(2)}</div>
            </div>
            <div class="result-item">
                <div class="result-icon" style="color: #8b5cf6;">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="result-label">检测耗时</div>
                <div class="result-value">${detect_time.toFixed(2)}s</div>
            </div>
        </div>
    `;
    
    // 可视化结果
    renderVisualizations(visualizations);
}

// 更新检测统计
function updateDetectionStats(result) {
    totalDetections++;
    if (result.status === '正常') {
        normalCount++;
    } else {
        abnormalCount++;
    }
    totalDetectTime += result.detect_time;
    
    updateStats();
}

// 更新统计显示
function updateStats() {
    totalCount.textContent = totalDetections;
    normalCountEl.textContent = normalCount;
    abnormalCountEl.textContent = abnormalCount;
    
    if (totalDetections > 0) {
        const avg = totalDetectTime / totalDetections;
        avgTime.textContent = avg.toFixed(2) + 's';
    }
}

// 更新阈值
function updateThreshold(threshold) {
    thresholdSlider.value = threshold;
    thresholdValue.textContent = threshold.toFixed(2);
    currentThresholdEl.textContent = threshold.toFixed(2);
}

// 重置阈值
async function resetThreshold() {
    if (!currentCategory) {
        showToast('请先选择产品类别', 'error');
        return;
    }
    
    const defaultThreshold = DEFAULT_THRESHOLDS[currentCategory] || 30.0;
    
    try {
        const response = await fetch('/api/set_threshold', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ threshold: defaultThreshold })
        });
        
        const data = await response.json();
        if (data.success) {
            thresholdSlider.value = defaultThreshold;
            thresholdValue.textContent = defaultThreshold.toFixed(2);
            currentThresholdEl.textContent = defaultThreshold.toFixed(2);
            showToast(`阈值已重置为 ${defaultThreshold.toFixed(2)}`, 'info');
        }
    } catch (error) {
        showToast('重置失败', 'error');
    }
}

// 加载历史记录
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        
        if (data.history && data.history.length > 0) {
            renderHistory(data.history);
        }
    } catch (error) {
        console.error('加载历史失败:', error);
    }
}

// 添加到历史
function addToHistory(record) {
    const historyList = historyContent.querySelector('.history-list');
    
    if (!historyList) {
        historyContent.innerHTML = '<div class="history-list"></div>';
    }
    
    const list = historyContent.querySelector('.history-list');
    const isNormal = record.status === '正常';
    
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-status ${isNormal ? 'normal' : 'abnormal'}"></div>
        <div class="history-info">
            <div class="history-filename">${escapeHtml(record.filename)}</div>
            <div class="history-time">${escapeHtml(record.category)} | ${escapeHtml(record.timestamp)}</div>
        </div>
        <div class="history-score ${isNormal ? 'normal' : 'abnormal'}">
            ${Number(record.score).toFixed(2)}
        </div>
    `;
    
    list.insertBefore(item, list.firstChild);
}

// 渲染历史记录
function renderHistory(history) {
    if (history.length === 0) {
        historyContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <p>暂无检测记录</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="history-list">';
    
    history.forEach(record => {
        const isNormal = record.status === '正常';
        html += `
            <div class="history-item">
                <div class="history-status ${isNormal ? 'normal' : 'abnormal'}"></div>
                <div class="history-info">
                    <div class="history-filename">${escapeHtml(record.filename)}</div>
                    <div class="history-time">${escapeHtml(record.category || '-')} | ${escapeHtml(record.timestamp)}</div>
                </div>
                <div class="history-score ${isNormal ? 'normal' : 'abnormal'}">
                    ${Number(record.score).toFixed(2)}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    historyContent.innerHTML = html;
}

// 清空历史
async function clearHistory() {
    if (!confirm('确定要清空所有历史记录吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/clear_history', {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.success) {
            historyContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <p>暂无检测记录</p>
                </div>
            `;
            showToast('历史记录已清空', 'info');
        }
    } catch (error) {
        showToast('清空失败', 'error');
    }
}

// 显示/隐藏加载动画
function showLoading(show, text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = show ? (text || 'AI检测中...') : 'AI检测中...';
    }
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// 更新状态
function updateStatus(text, isReady) {
    statusBadge.innerHTML = `
        <i class="fas fa-circle" style="color: ${isReady ? '#4ade80' : '#eab308'}"></i>
        ${text}
    `;
}

// 显示提示消息
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 添加滑出动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .category-select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 14px;
        margin-bottom: 12px;
        background: white;
        cursor: pointer;
    }
    
    .category-select:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .category-content {
        padding: 16px;
    }
    
    .category-info {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
        padding: 12px;
        background: #f0fdf4;
        border-radius: 8px;
        font-size: 13px;
    }
    
    .info-label {
        color: #64748b;
    }
    
    .info-value {
        font-weight: 600;
        color: #1e293b;
    }
    
    .result-sub {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
    }
`;
document.head.appendChild(style);
