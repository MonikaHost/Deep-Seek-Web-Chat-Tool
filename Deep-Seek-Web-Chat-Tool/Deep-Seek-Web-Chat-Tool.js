// ==UserScript==
// @name         Deepseek Chat 实时网页检索对话工具版
// @namespace    Monika_host
// @version      3.4.5
// @description  支持流式响应、历史记录、多服务API配置、模型选择、参数设置、Agent浏览器操控（参考pi-agent-browser），增强Markdown渲染
// @author       Monika_host
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      *
// @connect      cdn.jsdelivr.net
// @connect      dashscope.aliyuncs.com
// @connect      api.siliconflow.cn
// @license      MIT
// @resource     icon https://img.alicdn.com/imgextra/i2/O1CN01bYc1m81RrcSAyOjMu_!!6000000002165-54-tps-60-60.apng
// @resource     icon_backup https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/deepseek.svg
// @grant        GM_getResourceURL
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js
// @icon         https://deepseek.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    // 加载Markdown渲染资源
    function loadMarkdownResources() {
        return new Promise((resolve) => {
            // 加载KaTeX（数学公式渲染）
            const katexScript = document.createElement('script');
            katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
            const katexCSS = document.createElement('link');
            katexCSS.rel = 'stylesheet';
            katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';

            katexScript.onload = () => {
                // 加载Highlight.js
                const hljsScript = document.createElement('script');
                hljsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
                hljsScript.onload = () => {
                    // 加载Mermaid
                    const mermaidScript = document.createElement('script');
                    mermaidScript.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js';
                    mermaidScript.onload = () => {
                        // 更新Mermaid配置并添加错误处理
                        try {
                            if (typeof mermaid !== 'undefined') {
                                mermaid.initialize({
                                    startOnLoad: false,
                                    theme: 'dark',
                                    securityLevel: 'loose',
                                    flowchart: {
                                        curve: 'basis',
                                        useMaxWidth: false
                                    },
                                    sequence: {
                                        showSequenceNumbers: true
                                    },
                                    gantt: {
                                        axisFormat: '%Y-%m-%d'
                                    }
                                });
                            }
                        } catch (e) {
                            console.error('Mermaid初始化错误:', e);
                        }
                        resolve();
                    };
                    document.head.appendChild(mermaidScript);
                };
                document.head.appendChild(hljsScript);
            };

            document.head.appendChild(katexScript);
            document.head.appendChild(katexCSS);
        });
    }

    // 安全渲染数学公式函数 - 增强版，支持延迟渲染
    function renderMathFormula(formula, isBlock = false) {
        try {
            if (typeof katex !== 'undefined') {
                const options = {
                    displayMode: isBlock,
                    throwOnError: false,
                    strict: false,
                    output: 'html'
                };
                return katex.renderToString(formula.trim(), options);
            } else {
                // KaTeX尚未加载，返回占位符，稍后重新渲染
                const placeholderId = `math-placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const placeholder = isBlock ?
                    `<div class="latex-math-block" data-math-placeholder="${placeholderId}" data-formula="${encodeURIComponent(formula.trim())}" data-is-block="true">$$${formula.trim()}$$</div>` :
                    `<span class="latex-math-inline" data-math-placeholder="${placeholderId}" data-formula="${encodeURIComponent(formula.trim())}" data-is-block="false">$${formula.trim()}$</span>`;
                return placeholder;
            }
        } catch (error) {
            console.warn('KaTeX渲染错误:', error);
            // 如果KaTeX不可用或渲染失败，回退到原始LaTeX显示
            return isBlock ? `$$${formula.trim()}$$` : `$${formula.trim()}$`;
        }
    }

    // 重新渲染所有数学公式占位符
    function rerenderMathPlaceholders() {
        if (typeof katex === 'undefined') return;

        document.querySelectorAll('[data-math-placeholder]').forEach(element => {
            try {
                const formula = decodeURIComponent(element.getAttribute('data-formula'));
                const isBlock = element.getAttribute('data-is-block') === 'true';
                const options = {
                    displayMode: isBlock,
                    throwOnError: false,
                    strict: false,
                    output: 'html'
                };
                const rendered = katex.renderToString(formula.trim(), options);

                // 替换占位符为渲染后的公式
                const newElement = document.createElement(isBlock ? 'div' : 'span');
                newElement.className = element.className;
                newElement.innerHTML = rendered;

                element.parentNode.replaceChild(newElement, element);
            } catch (error) {
                console.warn('重新渲染数学公式失败:', error);
            }
        });
    }

    // 增强版Markdown渲染函数
    function renderMarkdown(content) {
        let output = content;

        // 1. 处理数学公式 - 使用KaTeX渲染
        output = output
            .replace(/\$\$(.*?)\$\$/gs, (match, formula) => {
                const rendered = renderMathFormula(formula, true);
                return `<div class="latex-math-block">${rendered}</div>`;
            })
            .replace(/\$(.*?)\$/gs, (match, formula) => {
                const rendered = renderMathFormula(formula, false);
                return `<span class="latex-math-inline">${rendered}</span>`;
            })
            // 处理 \(...\) 格式的行内公式
            .replace(/\\\(([\s\S]*?)\\\)/gs, (match, formula) => {
                const rendered = renderMathFormula(formula, false);
                return `<span class="latex-math-inline">${rendered}</span>`;
            })
            // 处理 \[...\] 格式的块级公式
            .replace(/\\\[([\s\S]*?)\\\]/gs, (match, formula) => {
                const rendered = renderMathFormula(formula, true);
                return `<div class="latex-math-block">${rendered}</div>`;
            });

        // 2. 处理表格 - 增强版
        output = output.replace(/(?:\|.*\|(?:\r?\n|\r))+/g, (table) => {
            const lines = table.trim().split('\n').filter(line => line.trim());
            if (lines.length < 2) return table; // 不是有效的表格

            // 检查是否有分隔线
            const hasSeparator = lines[1].includes('---') || lines[1].includes(':|') || lines[1].includes('|:');

            let headers = [];
            let body = [];

            if (hasSeparator && lines.length >= 2) {
                // 有表头和分隔线
                headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
                body = lines.slice(2);
            } else {
                // 没有分隔线，第一行作为表头
                headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
                body = lines.slice(1);
            }

            // 构建HTML表格
            let html = '<table class="ds-markdown-table">';

            // 表头
            html += '<thead><tr>';
            headers.forEach(header => {
                html += `<th>${header}</th>`;
            });
            html += '</tr></thead>';

            // 表格体
            if (body.length > 0) {
                html += '<tbody>';
                body.forEach(row => {
                    const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
                    html += '<tr>';
                    cells.forEach(cell => {
                        html += `<td>${cell}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody>';
            }

            html += '</table>';
            return html;
        });

        // 3. 处理任务列表
        output = output.replace(/^\s*[-*+]\s+\[ \]\s+(.+)$/gm, '<li class="ds-task-item"><input type="checkbox"> $1</li>');
        output = output.replace(/^\s*[-*+]\s+\[x\]\s+(.+)$/gm, '<li class="ds-task-item"><input type="checkbox" checked> $1</li>');

        // 将任务列表项包装在ul中
        output = output.replace(/(<li class="ds-task-item">.*<\/li>)+/g, '<ul class="ds-task-list">$&</ul>');

        // 4. 处理普通列表
        output = output.replace(/^\s*[-*+]\s+(?!\[[ x]\])(.+)$/gm, '<li>$1</li>');
        output = output.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');

        // 将普通列表项包装在ul或ol中
        output = output.replace(/(<li>(?!.*<input).*<\/li>)+/g, (match) => {
            const items = match.match(/<li>.*?<\/li>/g) || [];
            if (items.length > 0) {
                // 检查是否为有序列表
                const isOrdered = content.includes('\n1.') || content.includes('\n2.') || content.includes('\n3.');
                return isOrdered ? `<ol class="ds-ordered-list">${match}</ol>` : `<ul class="ds-unordered-list">${match}</ul>`;
            }
            return match;
        });

        // 5. 处理标题
        output = output.replace(/^#\s+(.+)$/gm, '<h1 class="ds-markdown-h1">$1</h1>');
        output = output.replace(/^##\s+(.+)$/gm, '<h2 class="ds-markdown-h2">$1</h2>');
        output = output.replace(/^###\s+(.+)$/gm, '<h3 class="ds-markdown-h3">$1</h3>');
        output = output.replace(/^####\s+(.+)$/gm, '<h4 class="ds-markdown-h4">$1</h4>');
        output = output.replace(/^#####\s+(.+)$/gm, '<h5 class="ds-markdown-h5">$1</h5>');
        output = output.replace(/^######\s+(.+)$/gm, '<h6 class="ds-markdown-h6">$1</h6>');

        // 6. 处理加粗和斜体
        output = output.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        output = output.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // 7. 处理代码块（fenced code blocks，支持 ``` 和 ``）
        output = output.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            var langClass = lang ? ' class="language-' + lang + '"' : '';
            return '<pre><code' + langClass + '>' + code.trim() + '</code></pre>';
        });
        output = output.replace(/``(\w*)\n([\s\S]*?)``/g, (match, lang, code) => {
            var langClass = lang ? ' class="language-' + lang + '"' : '';
            return '<pre><code' + langClass + '>' + code.trim() + '</code></pre>';
        });

        // 8. 处理内联代码
        output = output.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // 8. 处理链接
        output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // 9. 处理块引用
        output = output.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

        // 10. 处理水平线
        output = output.replace(/^---$/gm, '<hr>');
        output = output.replace(/^\*\*\*$/gm, '<hr>');
        output = output.replace(/^___$/gm, '<hr>');

        // 11. 处理换行（两个空格或反斜杠）
        output = output.replace(/  \n/g, '<br>');
        output = output.replace(/\\\n/g, '<br>');

        return output;
    }

    // 渲染代码高亮
    function renderCodeHighlight(element) {
        if (typeof hljs !== 'undefined') {
            element.querySelectorAll('pre code').forEach(block => {
                try {
                    hljs.highlightElement(block);
                } catch (e) {
                    console.warn('代码高亮错误:', e);
                }
            });
        }
    }

    // 渲染Mermaid图表
    function renderMermaidDiagrams(element) {
        if (typeof mermaid !== 'undefined') {
            element.querySelectorAll('.ds-mermaid').forEach(el => {
                try {
                    if (!el.hasAttribute('data-rendered')) {
                        const code = el.textContent.trim();
                        if (code) {
                            mermaid.render('mermaid-' + Date.now(), code, (svgCode) => {
                                el.innerHTML = svgCode;
                            });
                            el.setAttribute('data-rendered', 'true');
                        }
                    }
                } catch (e) {
                    console.error('Mermaid渲染错误:', e);
                    el.innerHTML = `<div class="mermaid-error">图表渲染失败: ${e.message}</div>`;
                    el.setAttribute('data-rendered', 'error');
                }
            });
        }
    }

    // 添加CSS样式
    GM_addStyle(`
    /* KaTeX数学公式样式 */
    .latex-math-inline {
        display: inline-block;
        margin: 0 2px;
        vertical-align: middle;
        line-height: 1.2;
    }

    .latex-math-block {
        display: block;
        text-align: center;
        margin: 20px 0;
        padding: 15px;
        overflow-x: auto;
        overflow-y: hidden;
        position: relative;
    }

    /* 确保KaTeX公式正确显示 */
    .latex-math-inline .katex,
    .latex-math-block .katex {
        font-size: 1.05em;
    }

    .latex-math-block .katex {
        font-size: 1.1em;
    }

    /* 块级公式容器美化 */
    .latex-math-block {
        background: linear-gradient(145deg, rgba(20, 20, 35, 0.95), rgba(15, 15, 30, 0.95));
        border-radius: 8px;
        border: 1px solid rgba(80, 120, 200, 0.3);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .latex-math-block:hover {
        border-color: rgba(100, 150, 255, 0.5);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
    }

    /* 行内公式容器美化 */
    .latex-math-inline {
        padding: 2px 4px;
        background: rgba(40, 40, 60, 0.1);
        border-radius: 4px;
        border: 1px solid rgba(100, 150, 255, 0.2);
    }

    .latex-math-inline:hover {
        background: rgba(50, 50, 80, 0.15);
        border-color: rgba(120, 180, 255, 0.3);
    }

    /* 表格样式增强 */

    /* 表格样式增强 - 修复边框半径问题 */
    .ds-markdown-table {
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
        margin: 15px 0;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .ds-markdown-table th {
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.6), rgba(0, 86, 179, 0.6));
        color: #ffffff;
        font-weight: bold;
        padding: 12px 15px;
        text-align: center;
        border-bottom: 2px solid rgba(0, 86, 179, 0.8);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .ds-markdown-table th:first-child {
        border-top-left-radius: 8px;
    }

    .ds-markdown-table th:last-child {
        border-top-right-radius: 8px;
    }

    .ds-markdown-table td {
        padding: 10px 15px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        color: #2c3e50;
    }

    .ds-markdown-table tr:nth-child(even) {
        background: rgba(0, 0, 0, 0.04);
    }

    .ds-markdown-table tr:hover {
        background: rgba(0, 123, 255, 0.15);
        transition: background 0.3s ease;
    }

    .ds-markdown-table tr:last-child td:first-child {
        border-bottom-left-radius: 8px;
    }

    .ds-markdown-table tr:last-child td:last-child {
        border-bottom-right-radius: 8px;
    }

    .ds-markdown-table tr:last-child td {
        border-bottom: none;
    }

    /* 列表样式 */
    .ds-task-list {
        list-style: none;
        padding-left: 0;
        margin: 10px 0;
    }

    .ds-task-item {
        margin: 5px 0;
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        display: flex;
        align-items: center;
    }

    .ds-task-item input[type="checkbox"] {
        margin-right: 10px;
    }

    .ds-unordered-list,
    .ds-ordered-list {
        margin: 10px 0;
        padding-left: 25px;
    }

    .ds-unordered-list li,
    .ds-ordered-list li {
        margin: 5px 0;
        padding: 3px 0;
    }

    /* 标题渐变色效果 */
    .ds-markdown-h1 {
        font-size: 2em;
        margin: 20px 0 15px;
        background: linear-gradient(90deg, #ff6b6b, #4ecdc4);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        padding-bottom: 5px;
        border-bottom: 2px solid rgba(78, 205, 196, 0.3);
    }

    .ds-markdown-h2 {
        font-size: 1.7em;
        margin: 18px 0 13px;
        background: linear-gradient(90deg, #4ecdc4, #1a936f);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(26, 147, 111, 0.3);
    }

    .ds-markdown-h3 {
        font-size: 1.4em;
        margin: 16px 0 11px;
        background: linear-gradient(90deg, #1a936f, #114b5f);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .ds-markdown-h4 {
        font-size: 1.2em;
        margin: 14px 0 9px;
        background: linear-gradient(90deg, #114b5f, #0d3a4a);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .ds-markdown-h5 {
        font-size: 1.1em;
        margin: 12px 0 7px;
        background: linear-gradient(90deg, #0d3a4a, #082a35);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .ds-markdown-h6 {
        font-size: 1em;
        margin: 10px 0 5px;
        background: linear-gradient(90deg, #082a35, #041a1f);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    /* 增强的内联代码样式 */
    .inline-code {
        background: linear-gradient(145deg, #1a1a2e, #16213e);
        color: #66fcf1;
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
        border: 1px solid rgba(102, 252, 241, 0.3);
        box-shadow: 0 3px 6px rgba(0,0,0,0.3),
                    inset 0 1px 1px rgba(255,255,255,0.1);
        display: inline-block;
        transform: translateY(-1px);
        transition: all 0.3s ease;
        font-size: 90%;
        line-height: 1.4;
    }

    .inline-code:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 10px rgba(0,0,0,0.4),
                    inset 0 1px 2px rgba(255,255,255,0.2);
        color: #45a29e;
    }

    /* 代码块样式 */
    .ds-message-content pre {
        background: rgba(10, 10, 20, 0.95) !important;
        padding: 15px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 15px 0;
        border: 1px solid rgba(80, 120, 200, 0.4);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
        position: relative;
    }

    .ds-message-content pre > .code-title {
        display: block;
        position: absolute;
        top: -12px;
        left: 15px;
        background: linear-gradient(90deg, #0f2027, #203a43, #2c5364);
        color: #fff;
        padding: 5px 15px;
        border-radius: 5px 5px 0 0;
        font-family: monospace;
        font-size: 12px;
        text-transform: uppercase;
        z-index: 1;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }

    /* 链接样式 */
    .ds-message-content a {
        color: #4ecdc4;
        text-decoration: none;
        border-bottom: 1px dotted rgba(78, 205, 196, 0.5);
        transition: all 0.3s ease;
    }

    .ds-message-content a:hover {
        color: #ff6b6b;
        border-bottom: 1px solid #ff6b6b;
    }

    /* 块引用样式 */
    blockquote {
        border-left: 4px solid rgba(78, 205, 196, 0.7);
        padding: 10px 15px;
        margin: 15px 0;
        background: rgba(78, 205, 196, 0.1);
        border-radius: 0 8px 8px 0;
        color: #e0e0e0;
        font-style: italic;
    }

    /* 水平线样式 */
    hr {
        border: none;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(78, 205, 196, 0.5), transparent);
        margin: 20px 0;
    }

    /* Mermaid图表样式 */
    .ds-mermaid {
        background: rgba(25, 25, 35, 0.9);
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border: 1px solid rgba(100, 200, 255, 0.2);
        overflow: auto;
        max-height: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .mermaid-error {
        color: #ff9999;
        padding: 10px;
        border: 1px solid #ff9999;
        border-radius: 4px;
        background: rgba(255, 153, 153, 0.1);
    }

    /* 淡入淡出动画 */
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }

    /* 模态框淡入动画 */
    @keyframes modalFadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    /* 模态框淡出动画 */
    @keyframes modalFadeOut {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.95);
        }
    }

    /* 设置界面样式 - 新增 */
    .ds-settings-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(200, 200, 200, 0.4);
        z-index: 2147483647;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(15px) saturate(180%);
        -webkit-backdrop-filter: blur(15px) saturate(180%);
        animation: fadeIn 0.5s ease-out forwards;
    }

    .ds-settings-overlay.fade-out {
        animation: fadeOut 0.5s ease-in forwards;
    }

    .ds-settings-modal {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(245, 245, 245, 0.4) 100%);
        border-radius: 12px;
        width: 90%;
        max-width: 1200px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        animation: modalFadeIn 0.5s ease-out forwards;
    }

    .ds-settings-modal.fade-out {
        animation: modalFadeOut 0.5s ease-in forwards;
    }

    .ds-edit-modal {
        max-width: 600px;
    }

    .ds-settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background: linear-gradient(135deg, rgba(240, 240, 240, 0.4) 0%, rgba(230, 230, 230, 0.4) 100%);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-settings-title {
        font-size: 18px;
        font-weight: bold;
        color: #2c3e50;
    }

    .ds-settings-close {
        cursor: pointer;
        font-size: 24px;
        color: #ff6b6b;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s ease;
    }

    .ds-settings-close:hover {
        background: rgba(255, 107, 107, 0.2);
        transform: rotate(90deg);
    }

    .ds-settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(250, 250, 250, 0.4) 100%);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-section-title {
        font-size: 16px;
        font-weight: bold;
        color: #4ecdc4;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid rgba(78, 205, 196, 0.3);
    }

    .ds-services-list {
        display: grid;
        gap: 12px;
        margin-bottom: 25px;
    }

    .ds-service-card {
        background: rgba(255, 255, 255, 0.4);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 15px;
        transition: all 0.3s ease;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-service-card:hover {
        background: rgba(255, 255, 255, 0.4);
        border-color: rgba(0, 0, 0, 0.2);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }

    .ds-service-active {
        background: rgba(0, 123, 255, 0.15);
        border-color: rgba(0, 123, 255, 0.8);
        box-shadow: 0 0 20px rgba(0, 123, 255, 0.3);
    }

    .ds-service-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .ds-service-name {
        font-size: 16px;
        font-weight: bold;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .ds-service-icon {
        font-size: 18px;
    }

    .ds-current-badge {
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        margin-left: 8px;
    }

    .ds-service-actions {
        display: flex;
        gap: 6px;
    }

    .ds-action-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .ds-btn-select {
        background: linear-gradient(135deg, #00c853, #009624);
        color: white;
    }

    .ds-btn-select:hover {
        background: linear-gradient(135deg, #009624, #006414);
        transform: scale(1.05);
    }

    .ds-btn-edit {
        background: linear-gradient(135deg, #ff9800, #f57c00);
        color: white;
    }

    .ds-btn-edit:hover {
        background: linear-gradient(135deg, #f57c00, #e65100);
        transform: scale(1.05);
    }

    .ds-btn-delete {
        background: linear-gradient(135deg, #f44336, #c62828);
        color: white;
    }

    .ds-btn-delete:hover {
        background: linear-gradient(135deg, #c62828, #b71c1c);
        transform: scale(1.05);
    }

    .ds-service-details {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .ds-detail-row {
        display: flex;
        margin-bottom: 6px;
        font-size: 13px;
    }

    .ds-detail-label {
        color: #666666;
        min-width: 80px;
        margin-right: 10px;
    }

    .ds-detail-value {
        color: #2c3e50;
        flex: 1;
        word-break: break-all;
    }

    .ds-url-value {
        font-family: monospace;
        font-size: 12px;
        color: #4ecdc4;
    }

    .ds-empty-message {
        text-align: center;
        color: #666666;
        padding: 20px;
        font-style: italic;
    }

    /* 表单样式 */
    .ds-config-form {
        background: rgba(250, 250, 250, 0.9);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
    }

    .ds-add-form {
        border-color: rgba(0, 0, 0, 0.2);
        background: rgba(245, 245, 245, 0.9);
    }

    .ds-form-field {
        margin-bottom: 15px;
    }

    .ds-form-label {
        display: block;
        margin-bottom: 5px;
        color: #2c3e50;
        font-size: 13px;
        font-weight: 500;
    }

    .ds-form-input,
    .ds-form-textarea {
        width: 100%;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        color: #333333;
        font-size: 14px;
        transition: all 0.3s ease;
        box-sizing: border-box;
    }

    .ds-form-input:focus,
    .ds-form-textarea:focus {
        outline: none;
        border-color: rgba(0, 0, 0, 0.4);
        background: rgba(255, 255, 255, 1);
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
    }

    .ds-form-input:hover,
    .ds-form-textarea:hover {
        background: rgba(255, 255, 255, 0.98);
        border-color: rgba(0, 0, 0, 0.3);
    }

    .ds-form-input::placeholder,
    .ds-form-textarea::placeholder {
        color: rgba(0, 0, 0, 0.4);
    }

    .ds-form-textarea {
        min-height: 80px;
        resize: vertical;
        font-family: monospace;
    }

    .ds-form-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 15px;
    }

    /* 获取模型列表按钮样式 */
    .ds-btn-fetch {
        padding: 8px 12px;
        background: linear-gradient(135deg, #6f42c1, #5a32a3);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.3s ease;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .ds-btn-fetch:hover {
        background: linear-gradient(135deg, #5a32a3, #4a268a);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(111, 66, 193, 0.4);
    }

    .ds-btn-fetch:active {
        transform: translateY(0);
    }

    .ds-btn-fetch:disabled {
        background: #6c757d;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }

    /* 输入框容器 */
    .ds-input-with-button {
        display: flex;
        gap: 8px;
        align-items: stretch;
    }

    .ds-input-with-button .ds-form-input {
        flex: 1;
        min-width: 0;
    }

    /* 响应式调整 */
    @media (max-width: 768px) {
        .ds-input-with-button {
            flex-direction: column;
            gap: 6px;
        }

        .ds-btn-fetch {
            width: 100%;
            justify-content: center;
        }
    }

    /* 按钮样式 */
    .ds-btn-primary,
    .ds-btn-secondary,
    .ds-btn-success {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .ds-btn-primary {
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
    }

    .ds-btn-primary:hover {
        background: linear-gradient(135deg, #0056b3, #003d82);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 123, 255, 0.4);
    }

    .ds-btn-secondary {
        background: linear-gradient(135deg, #6c757d, #545b62);
        color: white;
    }

    .ds-btn-secondary:hover {
        background: linear-gradient(135deg, #545b62, #3d4146);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(108, 117, 125, 0.4);
    }

    .ds-btn-success {
        background: linear-gradient(135deg, #28a745, #1e7e34);
        color: white;
    }

    .ds-btn-success:hover {
        background: linear-gradient(135deg, #1e7e34, #155724);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
    }

    /* 模板按钮 */
    .ds-template-container {
        margin-bottom: 15px;
    }

    .ds-template-title {
        color: #888;
        font-size: 13px;
        margin-bottom: 8px;
    }

    .ds-template-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .ds-template-btn {
        padding: 6px 12px;
        background: rgba(220, 220, 220, 0.5);
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 15px;
        color: #555555;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.3s ease;
    }

    .ds-template-btn:hover {
        background: rgba(200, 200, 200, 0.6);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        color: #000000;
    }

    /* 当前服务信息 */
    .ds-current-info {
        background: rgba(220, 220, 220, 0.3);
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 8px;
        padding: 15px;
    }

    .ds-current-service {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .ds-current-name {
        font-size: 18px;
        font-weight: bold;
        color: #2c3e50;
    }

    .ds-current-details {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 12px;
        color: #555555;
    }

    .ds-current-details span {
        background: rgba(255, 255, 255, 0.05);
        padding: 4px 8px;
        border-radius: 4px;
    }

    /* 设置底部 */
    .ds-settings-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background: linear-gradient(135deg, rgba(240, 240, 240, 0.4) 0%, rgba(230, 230, 230, 0.4) 100%);
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-footer-info {
        display: flex;
        gap: 15px;
        font-size: 13px;
        color: #666666;
    }

    .ds-footer-buttons {
        display: flex;
        gap: 8px;
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
        .ds-settings-modal {
            width: 95%;
            max-height: 95vh;
        }

        .ds-service-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }

        .ds-service-actions {
            width: 100%;
            justify-content: flex-start;
        }

        .ds-current-details {
            flex-direction: column;
            gap: 6px;
        }

        .ds-footer-info {
            flex-direction: column;
            gap: 5px;
        }

        .ds-footer-buttons {
            flex-wrap: wrap;
        }

        .ds-form-buttons {
            flex-wrap: wrap;
        }
    }

    /* 滚动条美化 */
    .ds-settings-content::-webkit-scrollbar {
        width: 8px;
    }

    .ds-settings-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
    }

    .ds-settings-content::-webkit-scrollbar-thumb {
        background: rgba(0, 123, 255, 0.5);
        border-radius: 4px;
    }

    .ds-settings-content::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 123, 255, 0.7);
    }

    /* 简洁人格设置模态框样式 */
    .ds-personality-quick-modal {
        max-width: 600px;
        max-height: 80vh;
    }

    .ds-personality-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        max-height: 65vh;
    }

    /* 提示文字 */
    .ds-personality-hint {
        background: linear-gradient(135deg, rgba(78, 205, 196, 0.1) 0%, rgba(78, 205, 196, 0.05) 100%);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid rgba(78, 205, 196, 0.2);
        font-size: 13px;
        color: #2c3e50;
        line-height: 1.5;
        backdrop-filter: blur(5px) saturate(180%);
        -webkit-backdrop-filter: blur(5px) saturate(180%);
    }

    /* 文本编辑器 */
    .ds-personality-textarea {
        width: 100%;
        flex: 1;
        min-height: 200px;
        padding: 15px;
        border: 2px solid rgba(0, 0, 0, 0.15);
        border-radius: 10px;
        font-size: 14px;
        font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
        line-height: 1.6;
        resize: vertical;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(5px) saturate(180%);
        -webkit-backdrop-filter: blur(5px) saturate(180%);
        transition: all 0.3s ease;
        color: #2c3e50;
        box-sizing: border-box;
    }

    .ds-personality-textarea:focus {
        outline: none;
        border-color: #4ecdc4;
        box-shadow: 0 0 0 4px rgba(78, 205, 196, 0.2);
        background: rgba(255, 255, 255, 0.98);
    }

    .ds-personality-textarea::placeholder {
        color: #999;
        font-style: italic;
        line-height: 1.8;
    }

    /* 按钮区域 */
    .ds-personality-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 5px;
    }

    .ds-buttons-left {
        display: flex;
        gap: 8px;
    }

    /* 按钮样式 */
    .ds-personality-buttons .ds-btn-secondary,
    .ds-personality-buttons .ds-btn-primary {
        padding: 10px 16px;
        font-size: 14px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }

    .ds-personality-buttons .ds-btn-secondary {
        background: linear-gradient(135deg, #6c757d, #545b62);
        color: white;
    }

    .ds-personality-buttons .ds-btn-secondary:hover {
        background: linear-gradient(135deg, #545b62, #3d4146);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
    }

    .ds-personality-buttons .ds-btn-primary {
        background: linear-gradient(135deg, #4ecdc4, #3bb5ad);
        color: white;
        padding: 12px 20px;
        font-size: 15px;
    }

    .ds-personality-buttons .ds-btn-primary:hover {
        background: linear-gradient(135deg, #3bb5ad, #2a9d8f);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
    }

    /* 响应式优化 */
    @media (max-width: 768px) {
        .ds-personality-quick-modal {
            max-width: 95vw;
            max-height: 85vh;
        }

        .ds-personality-content {
            padding: 15px;
            max-height: 70vh;
        }

        .ds-personality-textarea {
            min-height: 180px;
            max-height: 250px;
        }

        .ds-personality-buttons {
            flex-direction: column;
            gap: 8px;
        }

        .ds-buttons-left {
            width: 100%;
            justify-content: stretch;
        }

        .ds-buttons-left .ds-btn-secondary {
            flex: 1;
            justify-content: center;
        }

        .ds-personality-buttons .ds-btn-primary {
            width: 100%;
            justify-content: center;
        }
    }

    /* 原有样式保持不变 */
    @keyframes fadeInOut {
        0% { opacity: 0; }
        100% { opacity: 1; }
    }

    @keyframes fadeOut {
        0% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(20px); }
    }

    .ds-chat-icon img {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        transition: all 0.3s ease;
        animation: breath 2s infinite alternate;
    }

    .ds-chat-icon:hover img {
        transform: scale(1.1);
        filter: drop-shadow(0 0 8px rgba(0, 123, 255, 0.6));
        animation: pulse 0.5s infinite alternate;
    }

    @keyframes breath {
        0% { opacity: 0.9; }
        100% { opacity: 1; }
    }

    @keyframes pulse {
        0% { transform: scale(1); }
        100% { transform: scale(1.15); }
    }

    .ds-chat-window {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 340px;
        max-width: 70vw;
        max-height: 70vh;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(245, 245, 245, 0.4) 100%);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px);
        z-index: 2147483646;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        animation: fadeInOut 0.5s ease-in-out forwards;
        transition: all 1s ease-in-out;
    }

    .ds-chat-window.active {
        display: flex;
        opacity: 1;
        transform: translateY(0);
    }

    .ds-chat-window.fullscreen {
        width: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        bottom: 0 !important;
        right: 0 !important;
        border-radius: 0 !important;
        animation: fadeInOut 1.2s ease-in-out forwards;
    }

    .ds-chat-icon {
        position: fixed;
        bottom: 5px;
        right: 5px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.4), rgba(0, 86, 179, 0.4));
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 24px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 123, 255, 0.3);
        transition: all 0.3s ease;
        z-index: 2147483647;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 2px solid rgba(255, 255, 255, 0.8);
        overflow: hidden;
        animation: pulse 2s infinite;
    }

    .ds-chat-icon:hover {
        transform: scale(1.1) translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 123, 255, 0.6), 0 0 30px rgba(0, 123, 255, 0.4);
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.6), rgba(0, 86, 179, 0.6));
        animation: none;
    }

    .ds-chat-icon img {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        image-rendering: -webkit-optimize-contrast;
        -webkit-user-drag: none;
        user-select: none;
    }

    .ds-chat-icon:active {
        transform: scale(0.95);
    }

    /* 图标加载失败时的样式 */
    .ds-chat-icon::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent);
        border-radius: 50%;
        pointer-events: none;
    }

    /* 图标脉冲动画 */
    @keyframes pulse {
        0% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 123, 255, 0.3);
        }
        50% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 25px rgba(0, 123, 255, 0.5);
        }
        100% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 123, 255, 0.3);
        }
    }

    .ds-chat-icon:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.3);
        background-color: rgba(0, 123, 255, 0.6);
    }

    .ds-chat-header {
        padding: 10px 15px;
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.4) 0%, rgba(0, 86, 179, 0.4) 100%);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 15px 15px 0 0;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .ds-chat-title {
        font-weight: bold;
        color: #2372c3;
    }

    .ds-chat-close {
        cursor: pointer;
        font-size: 18px;
        color: #ff6666;
        margin-left: 5px;
    }

    .ds-chat-fullscreen {
        cursor: pointer;
        font-size: 18px;
        margin-right: 5px;
    }

    /* HTML预览按钮 */
    .ds-preview-html {
        background-color: rgba(0, 123, 255, 0.3);
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 5px;
        font-size: 12px;
    }

    .ds-preview-html:hover {
        background-color: rgba(0, 123, 255, 0.5);
    }

    /* HTML预览窗口 */
    .ds-html-preview {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        height: 80%;
        background: white;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .ds-preview-header {
        padding: 10px 15px;
        background: #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #ddd;
    }

    .ds-preview-iframe {
        flex: 1;
        border: none;
    }

    .ds-preview-close {
        cursor: pointer;
        font-size: 18px;
        color: #ff6666;
    }

    .ds-preview-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 2147483646;
    }

    .ds-chat-content {
        flex: 1;
        padding: 0px;
        overflow-y: auto;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(250, 250, 250, 0.4) 100%);
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-chat-message {
        background-color: rgba(255, 255, 255, 0.4);
        margin-bottom: 10px;
        padding: 8px 12px;
        border-radius: 10px;
        line-height: 1.5;
        word-wrap: break-word;
        color: #333333;
        font-size: 14px;
        border: 1px solid rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-user-message {
        background: linear-gradient(135deg, rgba(240, 240, 240, 0.4) 0%, rgba(230, 230, 230, 0.4) 100%);
        color: #2c3e50;
        margin-left: auto;
        text-align: right;
        font-size: 14px;
        padding: 8px 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-ai-message {
        background-color: rgba(255, 255, 255, 0.4);
        margin-right: 10%;
        font-size: 14px;
        padding: 8px 12px;
        line-height: 1.5;
        color: #2c3e50;
        border: 1px solid rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-chat-input-area {
        padding: 10px;
        display: flex;
        flex-direction: column;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(245, 245, 245, 0.4) 100%);
        border-top: 1px solid rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-chat-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        margin-bottom: 8px;
        outline: none;
        transition: all 0.3s ease;
        font-size: 15px;
        color: #333333;
        background-color: rgba(255, 255, 255, 0.95);
        box-sizing: border-box;
    }

    .ds-chat-input:hover {
        border-color: rgba(0, 0, 0, 0.2);
        background-color: rgba(255, 255, 255, 0.98);
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
    }

    .ds-chat-input:focus {
        border-color: rgba(0, 0, 0, 0.3);
        background-color: rgba(255, 255, 255, 1);
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.15);
    }

    .ds-chat-input::placeholder {
        color: rgba(0, 0, 0, 0.4);
    }

    .ds-chat-settings {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #666666;
        align-items: center;
        padding: 0 5px;
        gap: 8px;
        flex-wrap: nowrap;
    }

    .ds-chat-settings-btn {
        cursor: pointer;
        text-decoration: underline;
        padding: 2px 5px;
        border-radius: 3px;
        transition: all 0.3s ease;
        color: #555555;
    }

    .ds-chat-settings-btn:hover {
        background-color: rgba(0, 0, 0, 0.05);
        color: #000000;
    }

    /* 服务选择器样式 */
    .ds-service-select {
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        color: #333333;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        max-width: 120px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ds-service-select:hover {
        border-color: rgba(0, 0, 0, 0.3);
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
    }

    .ds-service-select:focus {
        outline: none;
        border-color: rgba(0, 0, 0, 0.4);
        background: rgba(255, 255, 255, 1);
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.15);
    }

    /* 模型选择器样式 */
    .ds-model-select {
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        color: #333333;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ds-model-select:hover {
        border-color: rgba(0, 0, 0, 0.3);
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
    }

    .ds-model-select:focus {
        outline: none;
        border-color: rgba(0, 0, 0, 0.4);
        background: rgba(255, 255, 255, 1);
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.15);
    }

    /* 调整聊天设置区域的布局 */
    .ds-chat-settings {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #666;
        align-items: center;
        padding: 0 5px;
        gap: 8px;
        flex-wrap: nowrap;
    }

    /* 通知样式 */
    .ds-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #00c853, #009624);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        z-index: 2147483648;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
    }

    .ds-notification.error {
        background: linear-gradient(135deg, #f44336, #c62828);
    }

    .ds-notification.warning {
        background: linear-gradient(135deg, #ff9800, #f57c00);
    }

    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .ds-thinking {
        color: #e87be4;
        font-style: italic;
    }

    .ds-error {
        color: #ff0000;
    }

    .ds-reasoning-content {
        color: #888;
        font-size: 0.9em;
        border-left: 2px solid #ddd;
        padding-left: 10px;
        margin-bottom: 10px;
    }

    .ds-context-toggle {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        font-size: 12px;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
    }

    .ds-context-toggle input {
        margin-right: 5px;
    }

    /* Agent模式激活状态指示器 */
    .ds-chat-header.agent-active {
        background: linear-gradient(135deg, rgba(156, 39, 176, 0.6) 0%, rgba(103, 58, 183, 0.6) 100%) !important;
        border-bottom: 2px solid rgba(156, 39, 176, 0.8);
    }

    .ds-chat-header.agent-active .ds-chat-title::after {
        content: ' 🤖';
        animation: pulse 1.5s infinite;
    }

    .ds-agent-status {
        display: inline-block;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(156, 39, 176, 0.3);
        color: #fff;
        margin-left: 6px;
        vertical-align: middle;
    }

    .ds-context-summary {
        font-size: 11px;
        color: #666;
        margin-top: 5px;
        font-style: italic;
    }

    .ds-chat-message {
        white-space: pre-wrap;
        word-break: break-word;
        visibility: visible !important;
        display: block !important;
        opacity: 1 !important;
    }

    .ds-ai-message {
        font-size: 14px;
        line-height: 1.5;
        padding: 8px 12px;
        margin: 0px 0px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        color: #2372c3 !important;
    }

    .ds-message-content {
        font-size: 14px !important;
        line-height: 1.5 !important;
        color: #2372c3 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        min-height: 1em;
        background: none !important;
        background-color: transparent !important;
        background-image: none !important;
        text-shadow: none !important;
    }

    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
    }

    .ds-message-content::after {
        content: '|';
        position: relative;
        display: inline;
        color: transparent !important;
        animation: blink 1s infinite;
        margin-left: 2px;
    }

    .ds-message-content:not(:empty)::after {
        display: none;
    }

    /* Agent Console Panel - Terminal Style */
    .ds-console-panel {
        background: #0d1117;
        border-top: 1px solid #30363d;
        border-bottom: 1px solid #30363d;
        font-family: 'Menlo', 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        line-height: 1.5;
        color: #8b949e;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
        position: relative;
    }

    .ds-console-panel.active {
        max-height: 240px;
        overflow-y: auto;
    }

    .ds-console-content {
        padding: 8px 12px;
    }

    .ds-console-line {
        white-space: pre-wrap;
        word-break: break-all;
        padding: 1px 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
    }

    .ds-console-prompt {
        color: #7ee787;
        user-select: none;
        flex-shrink: 0;
    }

    .ds-console-cmd {
        color: #ffa657;
    }

    .ds-console-result {
        color: #8b949e;
    }

    .ds-console-success {
        color: #3fb950;
    }

    .ds-console-error {
        color: #f85149;
    }

    .ds-console-info {
        color: #58a6ff;
    }

    .ds-console-separator {
        border: none;
        border-top: 1px solid #21262d;
        margin: 4px 0;
    }

    .ds-console-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 12px;
        background: #161b22;
        border-bottom: 1px solid #30363d;
        font-size: 11px;
        color: #8b949e;
        cursor: pointer;
        user-select: none;
    }

    .ds-console-header:hover {
        background: #1c2128;
    }

    .ds-console-header .ds-console-title {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .ds-console-header .ds-console-clear {
        cursor: pointer;
        color: #8b949e;
        font-size: 14px;
        padding: 0 4px;
    }

    .ds-console-header .ds-console-clear:hover {
        color: #f85149;
    }

    .ds-console-panel::-webkit-scrollbar {
        width: 6px;
    }

    .ds-console-panel::-webkit-scrollbar-track {
        background: #0d1117;
    }

    .ds-console-panel::-webkit-scrollbar-thumb {
        background: #30363d;
        border-radius: 3px;
    }

    /* Console badge in header */
    .ds-console-badge {
        display: inline-block;
        font-size: 9px;
        padding: 1px 5px;
        border-radius: 6px;
        background: #238636;
        color: #fff;
        margin-left: 4px;
        vertical-align: middle;
    }
    `);


// ============================================================
// BrowserAgent — 浏览器控制代理 (参考 pi-agent-browser 设计)
// ============================================================
class BrowserAgent {
    constructor() {
        this.elements = {};
        this.refIndex = 1;
        this.screenshotCount = 0;
    }

    static getToolDescriptions() {
        var desc = `
## Browser Agent Tools

You are a browser AI agent that controls the browser to accomplish user goals.

### Available Commands (all in [TOOL] prefix)

| Command | Description | Example |
|---------|-------------|---------|
| navigate <url> | Navigate to URL | navigate https://www.google.com |
| snapshot -i | List interactive elements with @ref handles | snapshot -i |
| click @eN | Click an element | click @e3 |
| fill @eN "text" | Clear field and type text | fill @e5 "search query" |
| type @eN "text" | Type text without clearing | type @e5 "more text" |
| select @eN "value" | Select dropdown option | select @e7 "Option B" |
| press <key> | Press a keyboard key | press Enter |
| scroll down [px] | Scroll down | scroll down 500 |
| scroll up [px] | Scroll up | scroll up 200 |
| get text | Get page body text | get text |
| get title | Get page title | get title |
| get url | Get current URL | get url |
| extract @eN | Get element text content | extract @e1 |
| screenshot | Take a screenshot (base64 image) | screenshot |
| wait <ms> | Wait for milliseconds | wait 2000 |
| done | Task complete, summarize results | done |

### @ref System
snapshot -i returns elements as:
@e1 <button> "Search" [100,200 80x36]
@e2 <input> type=text placeholder="Type here"

### Workflow
1. navigate to target page then wait 2000
2. snapshot -i to see interactive elements
3. click/fill/select to interact
4. wait 1500 then snapshot -i or screenshot to check
5. Repeat until goal is achieved
6. done to finish and summarize

### Rules
- Always wait after navigation/actions for page to respond
- Use snapshot -i after each interaction to see what changed
- Keep going until the user's goal is fully achieved
- When done, use done and provide a clear summary
`;
        return desc;
    }

    reset() {
        this.elements = {};
        this.refIndex = 1;
    }

    snapshot() {
        this.elements = {};
        this.refIndex = 1;
        const selectors = [
            'a[href]', 'button',
            'input:not([type="hidden"]):not([type="submit"]):not([type="reset"])', 'textarea', 'select',
            '[contenteditable]', '[tabindex]:not([tabindex="-1"])',
            '[onclick]', '[role="button"]', '[role="link"]',
            '[role="tab"]', '[role="menuitem"]', '[role="option"]',
            '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
            'details summary', 'label'
        ];
        const allElements = document.querySelectorAll(selectors.join(','));
        const result = [];
        allElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const ref = '@e' + this.refIndex;
            this.elements[ref] = el;
            this.refIndex++;
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || '').trim().substring(0, 120);
            const attrs = {};
            if (el.type) attrs.type = el.type;
            if (el.name) attrs.name = el.name;
            if (el.href) attrs.href = el.href.substring(0, 200);
            if (el.placeholder) attrs.placeholder = el.placeholder;
            const pos = Math.round(rect.left) + ',' + Math.round(rect.top) + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height);
            result.push({ ref: ref, tag: tag, text: text, attrs: attrs, pos: pos });
        });
        return result;
    }

    _resolve(ref) {
        if (this.elements[ref]) return this.elements[ref];
        var num = parseInt(ref.replace('@e', ''));
        if (!isNaN(num)) {
            var key = '@e' + num;
            if (this.elements[key]) return this.elements[key];
        }
        return null;
    }

    _simulateClick(el) {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.click();
    }

    click(ref) {
        var el = this._resolve(ref);
        if (!el) return { error: 'Element ' + ref + ' not found. Re-snapshot.' };
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this._simulateClick(el);
        return { success: true, ref: ref, tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().substring(0, 80) };
    }

    fill(ref, text) {
        var el = this._resolve(ref);
        if (!el) return { error: 'Element ' + ref + ' not found' };
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.value = '';
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return { success: true, ref: ref, value: text };
    }

    type(ref, text) {
        var el = this._resolve(ref);
        if (!el) return { error: 'Element ' + ref + ' not found' };
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        var start = el.selectionStart || el.value.length;
        var end = el.selectionEnd || el.value.length;
        el.value = el.value.substring(0, start) + text + el.value.substring(end);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return { success: true, ref: ref, value: el.value };
    }

    select(ref, value) {
        var el = this._resolve(ref);
        if (!el) return { error: 'Element ' + ref + ' not found' };
        if (el.tagName !== 'SELECT') return { error: ref + ' is not a select element' };
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, ref: ref, selected: el.value };
    }

    press(key) {
        var keyMap = { 'enter': 'Enter', 'tab': 'Tab', 'escape': 'Escape', 'esc': 'Escape', 'backspace': 'Backspace', 'delete': 'Delete', 'space': ' ' };
        var normalizedKey = keyMap[key.toLowerCase()] || key;
        var activeEl = document.activeElement;
        if (activeEl) {
            activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: normalizedKey, bubbles: true, cancelable: true }));
            activeEl.dispatchEvent(new KeyboardEvent('keyup', { key: normalizedKey, bubbles: true, cancelable: true }));
        }
        if (normalizedKey === 'Enter' && activeEl && activeEl.form) {
            var submitBtn = activeEl.form.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn) setTimeout(function() { submitBtn.click(); }, 100);
        }
        return { success: true, key: normalizedKey };
    }

    scroll(direction, px) {
        if (!px) px = 300;
        var amount = direction === 'up' ? -px : px;
        window.scrollBy({ top: amount, left: 0, behavior: 'smooth' });
        return { success: true, direction: direction, px: px, newPosition: window.scrollY };
    }

    getText() {
        var text = document.body.innerText.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        return { url: location.href, title: document.title, text: text.substring(0, 3000) + (text.length > 3000 ? '...' : '') };
    }

    getTitle() { return { title: document.title }; }
    getUrl() { return { url: location.href }; }

    extract(ref) {
        var el = this._resolve(ref);
        if (!el) return { error: 'Element ' + ref + ' not found' };
        return { ref: ref, text: (el.textContent || '').trim().substring(0, 2000) };
    }

    async screenshot() {
        try {
            if (typeof html2canvas === 'undefined') {
                await new Promise(function(resolve, reject) {
                    var s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            var canvas = await html2canvas(document.body, {
                useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
                scale: 0.8, logging: false,
                width: Math.min(document.body.scrollWidth, 1920),
                height: Math.min(document.body.scrollHeight, 10800)
            });
            this.screenshotCount++;
            return { success: true, screenshot: canvas.toDataURL('image/jpeg', 0.6), size: canvas.width + 'x' + canvas.height };
        } catch (e) {
            return { warning: 'Screenshot failed, using text snapshot', error: e.message, textSnapshot: this.getText() };
        }
    }

    wait(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, Math.min(ms, 10000)); });
    }

    async executeCommand(line) {
        line = line.trim();
        if (!line) return null;
        var parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        if (parts.length === 0) return null;
        var cmd = parts[0].toLowerCase();
        var args = parts.slice(1).map(function(a) { return a.replace(/^"(.*)"$/, '$1'); });
        switch (cmd) {
            case 'navigate': if (args[0]) { location.href = args[0]; return { info: 'Navigating to ' + args[0] + '...' }; } return { error: 'Usage: navigate <url>' };
            case 'snapshot':
                if (args[0] === '-i') {
                    var elements = this.snapshot();
                    if (elements.length === 0) return { info: 'No interactive elements found', elements: [] };
                    var formatted = elements.map(function(e) {
                        var s = e.ref + ' <' + e.tag + '>';
                        if (e.text) s += ' "' + e.text.substring(0, 80) + '"';
                        s += ' [' + e.pos + ']';
                        if (e.attrs.type) s += ' type=' + e.attrs.type;
                        if (e.attrs.placeholder) s += ' placeholder="' + e.attrs.placeholder + '"';
                        if (e.attrs.href) s += ' href=' + e.attrs.href.substring(0, 100);
                        return s;
                    }).join('\n');
                    return { info: 'Found ' + elements.length + ' interactive elements', elements: elements, formatted: formatted };
                }
                return { error: 'Usage: snapshot -i' };
            case 'click': if (args[0]) return this.click(args[0]); return { error: 'Usage: click @eN' };
            case 'fill': if (args.length >= 2) return this.fill(args[0], args.slice(1).join(' ')); return { error: 'Usage: fill @eN "text"' };
            case 'type': if (args.length >= 2) return this.type(args[0], args.slice(1).join(' ')); return { error: 'Usage: type @eN "text"' };
            case 'select': if (args.length >= 2) return this.select(args[0], args[1]); return { error: 'Usage: select @eN "value"' };
            case 'press': if (args[0]) return this.press(args[0]); return { error: 'Usage: press <key>' };
            case 'scroll':
                if (args[0] === 'down' || args[0] === 'up') {
                    var px = parseInt(args[1]) || 300;
                    return this.scroll(args[0], px);
                }
                return { error: 'Usage: scroll down/up [px]' };
            case 'get':
                if (args[0] === 'text') return this.getText();
                if (args[0] === 'title') return this.getTitle();
                if (args[0] === 'url') return this.getUrl();
                return { error: 'Usage: get text|title|url' };
            case 'extract': if (args[0]) return this.extract(args[0]); return { error: 'Usage: extract @eN' };
            case 'screenshot': return await this.screenshot();
            case 'wait': var ms = parseInt(args[0]) || 1000; await this.wait(ms); return { info: 'Waited ' + ms + 'ms' };
            case 'done': return { done: true, info: 'Task complete' };
            default: return null;
        }
    }

    extractCommands(text) {
        var commands = [];
        // 匹配 [TOOL] 开头的行，每行一个命令
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var match = line.match(/^\[TOOL\]\s*(.+)$/i);
            if (match) {
                commands.push(match[1].trim());
            }
        }
        // 如果没有 [TOOL] 前缀，尝试直接匹配合法命令
        if (commands.length === 0) {
            for (var j = 0; j < lines.length; j++) {
                var trimmed = lines[j].trim();
                if (/^(navigate|snapshot|click|fill|type|select|press|scroll|get|extract|screenshot|wait|done)\b/i.test(trimmed)) {
                    commands.push(trimmed);
                }
            }
        }
        return commands;
    }
}
// ============================================================
// End BrowserAgent
// ============================================================


    // 初始化API配置
    let apiConfigs = GM_getValue('apiConfigs', [
        {
            id: 'deepseek',
            name: '深度求索',
            apiUrl: 'https://api.deepseek.com/v1/chat/completions',
            apiKey: '',
            models: ['deepseek-chat', 'deepseek-coder'],
            temperature: 0.7,
            maxTokens: 4000,
            maxContextTokens: 256000
        },
        {
            id: 'aliyun',
            name: '阿里云',
            apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            apiKey: '',
            models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
            temperature: 0.7,
            maxTokens: 4000,
            maxContextTokens: 256000
        },
        {
            id: 'siliconflow',
            name: '硅基流动',
            apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
            apiKey: '',
            models: ['deepseek-ai/DeepSeek-V3.2', 'zai-org/GLM-4.6V'],
            temperature: 0.7,
            maxTokens: 4000,
            maxContextTokens: 256000
        }
    ]);

    let currentApiIndex = GM_getValue('currentApiIndex', 0);

    // 确保索引有效
    if (currentApiIndex >= apiConfigs.length) {
        currentApiIndex = 0;
        GM_setValue('currentApiIndex', currentApiIndex);
    }

    // 全局配置
    let config = {
        chatHistory: GM_getValue('chatHistory', []),
        usePageContext: GM_getValue('usePageContext', true),
        browserAgentMode: GM_getValue('browserAgentMode', false),
        agentMaxIterations: GM_getValue('agentMaxIterations', 25),
        personalityPrompt: GM_getValue('personalityPrompt', '你是锐锐，一个18岁、热爱数学的可爱女孩。你性格聪明冷静，内心善良，对朋友真诚，伙伴遇困定会援手相助。\n你外貌甜美，皮肤白皙，大眼睛灵动有神。总是身着背带制服，搭配白色腿袜和小皮鞋，乌黑亮丽的高马尾活泼摆动，头上戴着红色蝴蝶结发箍。充满青春活力。\n你的性格特点:聪明、冷静、善良、真诚。\n你的说话风格:逻辑清晰，又温柔贴心。')
    };

    // 获取当前选中的API配置
    function getCurrentApiConfig() {
        return apiConfigs[currentApiIndex];
    }

    // 设置当前API配置
    function setCurrentApiConfig(index) {
        if (index >= 0 && index < apiConfigs.length) {
            currentApiIndex = index;
            GM_setValue('currentApiIndex', currentApiIndex);
        }
    }

    // 获取当前选中的模型（全局函数，供其他地方使用）
    function getCurrentModel() {
        const currentApi = getCurrentApiConfig();
        if (currentApi && currentApi.models && currentApi.models.length > 0) {
            // 返回当前服务的第一个模型作为默认值
            return currentApi.models[0];
        }
        return 'deepseek-chat'; // 默认模型
    }

    // 获取当前配置（动态生成，基于当前选中的API配置）
    function getCurrentConfig() {
        const currentApi = getCurrentApiConfig();
        // 获取当前选中的模型
        const selectedModel = getCurrentModel();

        return {
            apiKey: currentApi.apiKey,
            apiUrl: currentApi.apiUrl,
            model: selectedModel,
            temperature: currentApi.temperature,
            maxTokens: currentApi.maxTokens,
            maxContextTokens: currentApi.maxContextTokens,
            chatHistory: config.chatHistory,
            usePageContext: config.usePageContext,
            personalityPrompt: config.personalityPrompt
        };
    }

    // 打开设置模态框
    function openSettingsModal() {
        // 创建设置覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'ds-settings-overlay';
        document.body.appendChild(overlay);

        // 创建设置模态框
        const modal = document.createElement('div');
        modal.className = 'ds-settings-modal';
        overlay.appendChild(modal);

        // 设置头部
        const header = document.createElement('div');
        header.className = 'ds-settings-header';
        modal.appendChild(header);

        const title = document.createElement('div');
        title.className = 'ds-settings-title';
        title.innerText = '🔧 多服务 API 配置与人格设置';
        header.appendChild(title);

        const closeBtn = document.createElement('div');
        closeBtn.className = 'ds-settings-close';
        closeBtn.innerHTML = '×';
        closeBtn.title = '关闭';
        header.appendChild(closeBtn);

        // 设置内容区域
        const content = document.createElement('div');
        content.className = 'ds-settings-content';
        modal.appendChild(content);

        // 服务列表区域
        const servicesSection = document.createElement('div');
        servicesSection.className = 'ds-services-section';
        content.appendChild(servicesSection);

        // 服务列表标题
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'ds-section-title';
        sectionTitle.innerHTML = '📋 已配置的服务';
        servicesSection.appendChild(sectionTitle);

        // 服务列表容器
        const servicesList = document.createElement('div');
        servicesList.className = 'ds-services-list';
        servicesSection.appendChild(servicesList);

        // 渲染服务列表函数
        function renderServicesList() {
            servicesList.innerHTML = '';

            if (apiConfigs.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'ds-empty-message';
                emptyMsg.innerHTML = '暂无配置的服务，请添加新的服务配置';
                servicesList.appendChild(emptyMsg);
                return;
            }

            apiConfigs.forEach((config, index) => {
                const serviceCard = document.createElement('div');
                serviceCard.className = `ds-service-card ${index === currentApiIndex ? 'ds-service-active' : ''}`;
                servicesList.appendChild(serviceCard);

                // 服务头部
                const cardHeader = document.createElement('div');
                cardHeader.className = 'ds-service-header';
                serviceCard.appendChild(cardHeader);

                const serviceName = document.createElement('div');
                serviceName.className = 'ds-service-name';
                serviceName.innerHTML = `<span class="ds-service-icon">🌐</span> ${config.name} ${index === currentApiIndex ? '<span class="ds-current-badge">当前</span>' : ''}`;
                cardHeader.appendChild(serviceName);

                const serviceActions = document.createElement('div');
                serviceActions.className = 'ds-service-actions';
                cardHeader.appendChild(serviceActions);

                // 操作按钮
                const selectBtn = document.createElement('button');
                selectBtn.className = 'ds-action-btn ds-btn-select';
                selectBtn.innerHTML = '✓ 选择';
                selectBtn.title = '选择此服务作为当前API';
                selectBtn.onclick = () => {
                    setCurrentApiConfig(index);
                    renderServicesList();
                    updateCurrentServiceInfo();
                };
                serviceActions.appendChild(selectBtn);

                const editBtn = document.createElement('button');
                editBtn.className = 'ds-action-btn ds-btn-edit';
                editBtn.innerHTML = '✏️ 编辑';
                editBtn.title = '编辑此服务配置';
                editBtn.onclick = () => {
                    editServiceConfig(index);
                };
                serviceActions.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'ds-action-btn ds-btn-delete';
                deleteBtn.innerHTML = '🗑️ 删除';
                deleteBtn.title = '删除此服务配置';
                deleteBtn.onclick = () => {
                    if (confirm(`确定要删除服务 "${config.name}" 吗？`)) {
                        apiConfigs.splice(index, 1);
                        if (currentApiIndex >= apiConfigs.length) {
                            currentApiIndex = Math.max(0, apiConfigs.length - 1);
                        }
                        GM_setValue('apiConfigs', apiConfigs);
                        GM_setValue('currentApiIndex', currentApiIndex);
                        renderServicesList();
                        updateCurrentServiceInfo();
                    }
                };
                serviceActions.appendChild(deleteBtn);

                // 服务详情
                const serviceDetails = document.createElement('div');
                serviceDetails.className = 'ds-service-details';
                serviceCard.appendChild(serviceDetails);

                // API URL
                const urlRow = document.createElement('div');
                urlRow.className = 'ds-detail-row';
                urlRow.innerHTML = `<span class="ds-detail-label">API地址:</span><span class="ds-detail-value ds-url-value" title="${config.apiUrl}">${config.apiUrl}</span>`;
                serviceDetails.appendChild(urlRow);

                // API Key (部分显示)
                const keyRow = document.createElement('div');
                keyRow.className = 'ds-detail-row';
                const maskedKey = config.apiKey ? `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}` : '未设置';
                keyRow.innerHTML = `<span class="ds-detail-label">API密钥:</span><span class="ds-detail-value">${maskedKey}</span>`;
                serviceDetails.appendChild(keyRow);

                // 模型列表
                const modelsRow = document.createElement('div');
                modelsRow.className = 'ds-detail-row';
                modelsRow.innerHTML = `<span class="ds-detail-label">可用模型:</span><span class="ds-detail-value">${config.models.join(', ')}</span>`;
                serviceDetails.appendChild(modelsRow);

                // 参数信息
                const paramsRow = document.createElement('div');
                paramsRow.className = 'ds-detail-row';
                paramsRow.innerHTML = `<span class="ds-detail-label">参数:</span><span class="ds-detail-value">温度: ${config.temperature} | Token限制: ${config.maxTokens}</span>`;
                serviceDetails.appendChild(paramsRow);
            });
        }

        // 编辑服务配置函数
        function editServiceConfig(index) {
            const config = apiConfigs[index];

            // 创建编辑模态框
            const editOverlay = document.createElement('div');
            editOverlay.className = 'ds-settings-overlay';
            document.body.appendChild(editOverlay);

            const editModal = document.createElement('div');
            editModal.className = 'ds-settings-modal ds-edit-modal';
            editOverlay.appendChild(editModal);

            const editHeader = document.createElement('div');
            editHeader.className = 'ds-settings-header';
            editModal.appendChild(editHeader);

            const editTitle = document.createElement('div');
            editTitle.className = 'ds-settings-title';
            editTitle.innerText = `编辑服务: ${config.name}`;
            editHeader.appendChild(editTitle);

            const editCloseBtn = document.createElement('div');
            editCloseBtn.className = 'ds-settings-close';
            editCloseBtn.innerHTML = '×';
            editCloseBtn.title = '关闭';
            editHeader.appendChild(editCloseBtn);

            const editContent = document.createElement('div');
            editContent.className = 'ds-edit-content';
            editModal.appendChild(editContent);

            // 创建表单
            const form = document.createElement('div');
            form.className = 'ds-config-form';
            editContent.appendChild(form);

            // 表单字段
            const fields = [
                { label: '服务名称', type: 'text', key: 'name', value: config.name, placeholder: '例如: 深度求索' },
                { label: 'API地址', type: 'text', key: 'apiUrl', value: config.apiUrl, placeholder: 'https://api.example.com/v1/chat/completions' },
                { label: 'API密钥', type: 'password', key: 'apiKey', value: config.apiKey, placeholder: '输入您的API密钥' },
                { label: '模型列表', type: 'textarea', key: 'models', value: config.models.join('\n'), placeholder: '每行一个模型名称\ndeepseek-chat\ndeepseek-coder' },
                { label: '温度', type: 'number', key: 'temperature', value: config.temperature, min: 0, max: 2, step: 0.1 },
                { label: 'Token限制', type: 'number', key: 'maxTokens', value: config.maxTokens, min: 1, max: 65535 },
                { label: '上下文Token限制', type: 'number', key: 'maxContextTokens', value: config.maxContextTokens || 256000, min: 1, max: 128000 }
            ];

            // 存储输入框引用
            const editInputRefs = {};

            fields.forEach(field => {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'ds-form-field';
                form.appendChild(fieldDiv);

                const label = document.createElement('label');
                label.className = 'ds-form-label';
                label.innerText = field.label;
                fieldDiv.appendChild(label);

                // 为API密钥字段添加特殊布局（包含获取模型列表按钮）
                if (field.key === 'apiKey') {
                    const inputContainer = document.createElement('div');
                    inputContainer.className = 'ds-input-with-button';
                    inputContainer.style.display = 'flex';
                    inputContainer.style.gap = '8px';
                    inputContainer.style.alignItems = 'stretch';

                    const input = document.createElement('input');
                    input.type = field.type;
                    input.className = 'ds-form-input';
                    input.style.flex = '1';
                    input.value = field.value;
                    input.placeholder = field.placeholder || '';
                    input.dataset.key = field.key;
                    editInputRefs.apiKey = input;

                    // 获取模型列表按钮
                    const fetchBtn = document.createElement('button');
                    fetchBtn.className = 'ds-btn-fetch';
                    fetchBtn.innerText = '获取模型列表';
                    fetchBtn.title = '从服务器获取可用的模型列表';
                    fetchBtn.type = 'button';

                    fetchBtn.onclick = async () => {
                        const apiUrl = editInputRefs.apiUrl ? editInputRefs.apiUrl.value.trim() : '';
                        const apiKey = input.value.trim();

                        if (!apiUrl) {
                            showNotification('请先输入API地址', 'warning');
                            return;
                        }

                        if (!apiKey) {
                            showNotification('请先输入API密钥', 'warning');
                            return;
                        }

                        // 显示加载状态
                        fetchBtn.disabled = true;
                        fetchBtn.innerText = '获取中...';
                        fetchBtn.style.opacity = '0.7';

                        try {
                            const models = await fetchModelList(apiUrl, apiKey);
                            if (models && models.length > 0) {
                                // 将模型列表填充到模型输入框
                                const modelsTextarea = editInputRefs.models;
                                if (modelsTextarea) {
                                    modelsTextarea.value = models.join('\n');
                                }
                                showNotification(`成功获取 ${models.length} 个模型`, 'success');
                            } else {
                                showNotification('未获取到模型列表，请检查API地址和密钥', 'warning');
                            }
                        } catch (error) {
                            console.error('获取模型列表失败:', error);
                            showNotification(`获取模型列表失败: ${error.message}`, 'error');
                        } finally {
                            fetchBtn.disabled = false;
                            fetchBtn.innerText = '获取模型列表';
                            fetchBtn.style.opacity = '1';
                        }
                    };

                    inputContainer.appendChild(input);
                    inputContainer.appendChild(fetchBtn);
                    fieldDiv.appendChild(inputContainer);
                } else if (field.type === 'textarea') {
                    const input = document.createElement('textarea');
                    input.className = 'ds-form-textarea';
                    input.value = field.value;
                    input.placeholder = field.placeholder || '';
                    input.dataset.key = field.key;
                    editInputRefs[field.key] = input;
                    fieldDiv.appendChild(input);
                } else {
                    const input = document.createElement('input');
                    input.type = field.type;
                    input.className = 'ds-form-input';
                    input.value = field.value;
                    input.placeholder = field.placeholder || '';
                    if (field.min !== undefined) input.min = field.min;
                    if (field.max !== undefined) input.max = field.max;
                    if (field.step !== undefined) input.step = field.step;
                    input.dataset.key = field.key;
                    editInputRefs[field.key] = input;
                    fieldDiv.appendChild(input);
                }
            });

            // 按钮区域
            const buttonArea = document.createElement('div');
            buttonArea.className = 'ds-form-buttons';
            editContent.appendChild(buttonArea);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'ds-btn-primary';
            saveBtn.innerText = '保存';
            saveBtn.onclick = () => {
                const inputs = form.querySelectorAll('.ds-form-input, .ds-form-textarea');
                const newConfig = { ...config };

                inputs.forEach(input => {
                    const key = input.dataset.key;
                    if (key === 'models') {
                        newConfig[key] = input.value.split('\n').filter(m => m.trim());
                    } else if (key === 'temperature' || key === 'maxTokens' || key === 'maxContextTokens') {
                        newConfig[key] = parseFloat(input.value) || config[key];
                    } else {
                        newConfig[key] = input.value;
                    }
                });

                // 验证必填字段
                if (!newConfig.name || !newConfig.apiUrl || !newConfig.apiKey) {
                    alert('请填写服务名称、API地址和API密钥');
                    return;
                }

                apiConfigs[index] = newConfig;
                GM_setValue('apiConfigs', apiConfigs);
                renderServicesList();

                // 添加淡出动画
                editOverlay.classList.add('fade-out');
                const modal = editOverlay.querySelector('.ds-settings-modal');
                if (modal) modal.classList.add('fade-out');

                // 动画结束后移除元素
                setTimeout(() => {
                    document.body.removeChild(editOverlay);
                }, 500);
            };
            buttonArea.appendChild(saveBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'ds-btn-secondary';
            cancelBtn.innerText = '取消';
            cancelBtn.onclick = () => {
                // 添加淡出动画
                editOverlay.classList.add('fade-out');
                const modal = editOverlay.querySelector('.ds-settings-modal');
                if (modal) modal.classList.add('fade-out');

                // 动画结束后移除元素
                setTimeout(() => {
                    document.body.removeChild(editOverlay);
                }, 500);
            };
            buttonArea.appendChild(cancelBtn);

            // 关闭事件
            editCloseBtn.addEventListener('click', () => {
                // 添加淡出动画
                editOverlay.classList.add('fade-out');
                const modal = editOverlay.querySelector('.ds-settings-modal');
                if (modal) modal.classList.add('fade-out');

                // 动画结束后移除元素
                setTimeout(() => {
                    document.body.removeChild(editOverlay);
                }, 500);
            });

            editOverlay.addEventListener('click', (e) => {
                if (e.target === editOverlay) {
                    // 添加淡出动画
                    editOverlay.classList.add('fade-out');
                    const modal = editOverlay.querySelector('.ds-settings-modal');
                    if (modal) modal.classList.add('fade-out');

                    // 动画结束后移除元素
                    setTimeout(() => {
                        document.body.removeChild(editOverlay);
                    }, 500);
                }
            });
        }

        // 添加新服务区域
        const addSection = document.createElement('div');
        addSection.className = 'ds-add-section';
        content.appendChild(addSection);

        const addTitle = document.createElement('div');
        addTitle.className = 'ds-section-title';
        addTitle.innerHTML = '➕ 添加新服务';
        addSection.appendChild(addTitle);

        // 从服务器获取模型列表的函数
        async function fetchModelList(apiUrl, apiKey) {
            return new Promise((resolve, reject) => {
                // 根据不同的API端点，使用不同的请求方式
                let requestData, requestUrl, requestMethod, requestHeaders;

                // 检测API类型并构造相应的请求
                if (apiUrl.includes('deepseek.com') || apiUrl.includes('/v1/chat/completions')) {
                    // DeepSeek API 或标准OpenAI格式API
                    requestUrl = apiUrl.replace('/chat/completions', '/models');
                    if (!requestUrl.endsWith('/models')) {
                        requestUrl = apiUrl.replace(/\/chat\/completions$/, '/models');
                    }
                    requestMethod = 'GET';
                    requestHeaders = {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    };
                    requestData = null;
                } else if (apiUrl.includes('dashscope.aliyuncs.com')) {
                    // 阿里云DashScope API
                    requestUrl = 'https://dashscope.aliyuncs.com/api/v1/models';
                    requestMethod = 'GET';
                    requestHeaders = {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    };
                    requestData = null;
                } else if (apiUrl.includes('siliconflow.cn')) {
                    // 硅基流动API
                    requestUrl = 'https://api.siliconflow.cn/v1/models';
                    requestMethod = 'GET';
                    requestHeaders = {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    };
                    requestData = null;
                } else {
                    // 通用API尝试获取模型列表
                    requestUrl = apiUrl.replace(/\/(chat|completions).*$/, '/models');
                    if (requestUrl === apiUrl) {
                        requestUrl = apiUrl + '/models';
                    }
                    requestMethod = 'GET';
                    requestHeaders = {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    };
                    requestData = null;
                }

                console.log('请求模型列表:', requestUrl, requestMethod, requestHeaders);

                GM_xmlhttpRequest({
                    method: requestMethod,
                    url: requestUrl,
                    headers: requestHeaders,
                    data: requestData,
                    timeout: 10000,
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            console.log('模型列表响应:', data);

                            let models = [];

                            // 解析不同格式的响应
                            if (Array.isArray(data)) {
                                // 直接是模型数组
                                models = data.map(item => {
                                    if (typeof item === 'string') return item;
                                    if (item.id) return item.id;
                                    if (item.name) return item.name;
                                    return JSON.stringify(item);
                                }).filter(m => m);
                            } else if (data.data && Array.isArray(data.data)) {
                                // OpenAI格式: {data: [...]}
                                models = data.data.map(item => {
                                    if (item.id) return item.id;
                                    if (item.name) return item.name;
                                    return JSON.stringify(item);
                                }).filter(m => m);
                            } else if (data.models && Array.isArray(data.models)) {
                                // 某些API格式: {models: [...]}
                                models = data.models.map(item => {
                                    if (typeof item === 'string') return item;
                                    if (item.id) return item.id;
                                    if (item.name) return item.name;
                                    return JSON.stringify(item);
                                }).filter(m => m);
                            } else if (data.results && Array.isArray(data.results)) {
                                // 阿里云格式: {results: [...]}
                                models = data.results.map(item => {
                                    if (item.model) return item.model;
                                    if (item.id) return item.id;
                                    return JSON.stringify(item);
                                }).filter(m => m);
                            } else {
                                // 尝试从其他字段中提取模型信息
                                Object.keys(data).forEach(key => {
                                    const value = data[key];
                                    if (Array.isArray(value)) {
                                        value.forEach(item => {
                                            if (typeof item === 'string') models.push(item);
                                            else if (item.id) models.push(item.id);
                                            else if (item.name) models.push(item.name);
                                        });
                                    }
                                });
                            }

                            // 如果还是没有模型，尝试从API地址推断
                            if (models.length === 0) {
                                console.warn('无法从响应中解析模型列表，尝试推断...');
                                if (apiUrl.includes('deepseek')) {
                                    models = ['deepseek-chat', 'deepseek-coder', 'deepseek-v2.5'];
                                } else if (apiUrl.includes('dashscope')) {
                                    models = ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-7b', 'qwen-14b'];
                                } else if (apiUrl.includes('siliconflow')) {
                                    models = ['deepseek-ai/DeepSeek-V2.5', 'BAAI/bge-large-zh-v1.5'];
                                } else {
                                    models = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
                                }
                            }

                            // 去重和排序
                            models = [...new Set(models)].sort();

                            resolve(models);
                        } catch (error) {
                            console.error('解析模型列表响应失败:', error);
                            reject(new Error('解析响应失败: ' + error.message));
                        }
                    },
                    onerror: (error) => {
                        console.error('请求模型列表失败:', error);
                        reject(new Error('网络请求失败: ' + error.statusText));
                    },
                    ontimeout: () => {
                        reject(new Error('请求超时，请检查网络连接'));
                    }
                });
            });
        }

        // 快速添加模板
        const templates = [
            { name: '深度求索', apiUrl: 'https://api.deepseek.com/v1/chat/completions', models: ['deepseek-chat', 'deepseek-coder'] },
            { name: '阿里云', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'] },
            { name: '硅基流动', apiUrl: 'https://api.siliconflow.cn/v1/chat/completions', models: ['deepseek-ai/DeepSeek-V2.5', 'BAAI/bge-large-zh-v1.5'] },
            { name: '小米MiMo', apiUrl: 'https://api.xiaomimimo.com/v1/chat/completions', models: ['mimo-v2-flash', 'mimo-v2-pro'] }
        ];

        const templateContainer = document.createElement('div');
        templateContainer.className = 'ds-template-container';
        addSection.appendChild(templateContainer);

        const templateTitle = document.createElement('div');
        templateTitle.className = 'ds-template-title';
        templateTitle.innerText = '快速模板:';
        templateContainer.appendChild(templateTitle);

        const templateButtons = document.createElement('div');
        templateButtons.className = 'ds-template-buttons';
        templateContainer.appendChild(templateButtons);

        templates.forEach(template => {
            const btn = document.createElement('button');
            btn.className = 'ds-template-btn';
            btn.innerText = template.name;
            btn.onclick = () => {
                addServiceForm.querySelector('[data-key="name"]').value = template.name;
                addServiceForm.querySelector('[data-key="apiUrl"]').value = template.apiUrl;
                addServiceForm.querySelector('[data-key="models"]').value = template.models.join('\n');
            };
            templateButtons.appendChild(btn);
        });

        // 添加表单
        const addServiceForm = document.createElement('div');
        addServiceForm.className = 'ds-config-form ds-add-form';
        addSection.appendChild(addServiceForm);

        const addFields = [
            { label: '服务名称', type: 'text', key: 'name', placeholder: '例如: 自定义服务' },
            { label: 'API地址', type: 'text', key: 'apiUrl', placeholder: 'https://api.example.com/v1/chat/completions' },
            { label: 'API密钥', type: 'password', key: 'apiKey', placeholder: '输入您的API密钥' },
            { label: '模型列表', type: 'textarea', key: 'models', placeholder: '每行一个模型名称\ndeepseek-chat\ndeepseek-coder' },
            { label: '温度', type: 'number', key: 'temperature', value: '0.7', min: 0, max: 2, step: 0.1 },
            { label: 'Token限制', type: 'number', key: 'maxTokens', value: '4000', min: 1, max: 65535 },
            { label: '上下文Token限制', type: 'number', key: 'maxContextTokens', value: '256000', min: 1, max: 128000 }
        ];

        // 存储输入框引用，用于获取模型列表功能
        const inputRefs = {};

        addFields.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'ds-form-field';
            addServiceForm.appendChild(fieldDiv);

            const label = document.createElement('label');
            label.className = 'ds-form-label';
            label.innerText = field.label;
            fieldDiv.appendChild(label);

            // 为API地址字段添加特殊布局
            if (field.key === 'apiUrl') {
                const input = document.createElement('input');
                input.type = field.type;
                input.className = 'ds-form-input';
                input.placeholder = field.placeholder || '';
                input.dataset.key = field.key;
                inputRefs.apiUrl = input;
                fieldDiv.appendChild(input);
            } else if (field.type === 'textarea') {
                const input = document.createElement('textarea');
                input.className = 'ds-form-textarea';
                input.placeholder = field.placeholder || '';
                input.dataset.key = field.key;
                inputRefs[field.key] = input;
                fieldDiv.appendChild(input);
            } else if (field.key === 'apiKey') {
                // 为API密钥字段添加特殊布局（包含获取模型列表按钮）
                const inputContainer = document.createElement('div');
                inputContainer.className = 'ds-input-with-button';
                inputContainer.style.display = 'flex';
                inputContainer.style.gap = '8px';
                inputContainer.style.alignItems = 'stretch';

                const input = document.createElement('input');
                input.type = field.type;
                input.className = 'ds-form-input';
                input.style.flex = '1';
                input.placeholder = field.placeholder || '';
                input.dataset.key = field.key;
                inputRefs.apiKey = input;

                // 获取模型列表按钮
                const fetchBtn = document.createElement('button');
                fetchBtn.className = 'ds-btn-fetch';
                fetchBtn.innerText = '获取模型列表';
                fetchBtn.title = '从服务器获取可用的模型列表';
                fetchBtn.type = 'button'; // 防止触发表单提交

                fetchBtn.onclick = async () => {
                    const apiUrl = inputRefs.apiUrl ? inputRefs.apiUrl.value.trim() : '';
                    const apiKey = input.value.trim();

                    if (!apiUrl) {
                        showNotification('请先输入API地址', 'warning');
                        return;
                    }

                    if (!apiKey) {
                        showNotification('请先输入API密钥', 'warning');
                        return;
                    }

                    // 显示加载状态
                    fetchBtn.disabled = true;
                    fetchBtn.innerText = '获取中...';
                    fetchBtn.style.opacity = '0.7';

                    try {
                        const models = await fetchModelList(apiUrl, apiKey);
                        if (models && models.length > 0) {
                            // 将模型列表填充到模型输入框
                            const modelsTextarea = inputRefs.models;
                            if (modelsTextarea) {
                                modelsTextarea.value = models.join('\n');
                            }
                            showNotification(`成功获取 ${models.length} 个模型`, 'success');
                        } else {
                            showNotification('未获取到模型列表，请检查API地址和密钥', 'warning');
                        }
                    } catch (error) {
                        console.error('获取模型列表失败:', error);
                        showNotification(`获取模型列表失败: ${error.message}`, 'error');
                    } finally {
                        fetchBtn.disabled = false;
                        fetchBtn.innerText = '获取模型列表';
                        fetchBtn.style.opacity = '1';
                    }
                };

                inputContainer.appendChild(input);
                inputContainer.appendChild(fetchBtn);
                fieldDiv.appendChild(inputContainer);
            } else {
                const input = document.createElement('input');
                input.type = field.type;
                input.className = 'ds-form-input';
                input.placeholder = field.placeholder || '';
                if (field.value !== undefined) input.value = field.value;
                if (field.min !== undefined) input.min = field.min;
                if (field.max !== undefined) input.max = field.max;
                if (field.step !== undefined) input.step = field.step;
                input.dataset.key = field.key;
                inputRefs[field.key] = input;
                fieldDiv.appendChild(input);
            }
        });

        // 添加按钮
        const addButtons = document.createElement('div');
        addButtons.className = 'ds-form-buttons';
        addSection.appendChild(addButtons);

        const addBtn = document.createElement('button');
        addBtn.className = 'ds-btn-success';
        addBtn.innerText = '添加服务';
        addBtn.onclick = () => {
            const inputs = addServiceForm.querySelectorAll('.ds-form-input, .ds-form-textarea');
            const newConfig = {
                id: `custom_${Date.now()}`,
                name: '',
                apiUrl: '',
                apiKey: '',
                models: [],
                temperature: 0.7,
                maxTokens: 4000,
                maxContextTokens: 256000
            };

            inputs.forEach(input => {
                const key = input.dataset.key;
                if (key === 'models') {
                    newConfig[key] = input.value.split('\n').filter(m => m.trim());
                } else if (key === 'temperature' || key === 'maxTokens' || key === 'maxContextTokens') {
                    newConfig[key] = parseFloat(input.value) || newConfig[key];
                } else {
                    newConfig[key] = input.value;
                }
            });

            // 验证必填字段
            if (!newConfig.name || !newConfig.apiUrl || !newConfig.apiKey) {
                alert('请填写服务名称、API地址和API密钥');
                return;
            }

            if (newConfig.models.length === 0) {
                alert('请至少填写一个模型名称');
                return;
            }

            apiConfigs.push(newConfig);
            GM_setValue('apiConfigs', apiConfigs);
            renderServicesList();

            // 清空表单
            inputs.forEach(input => {
                if (input.tagName === 'TEXTAREA') {
                    input.value = '';
                } else if (input.type === 'number') {
                    if (input.dataset.key === 'temperature') input.value = '0.7';
                    else if (input.dataset.key === 'maxTokens') input.value = '4000';
                    else if (input.dataset.key === 'maxContextTokens') input.value = '256000';
                    else input.value = '';
                } else {
                    input.value = '';
                }
            });
        };
        addButtons.appendChild(addBtn);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'ds-btn-secondary';
        clearBtn.innerText = '清空表单';
        clearBtn.onclick = () => {
            const inputs = addServiceForm.querySelectorAll('.ds-form-input, .ds-form-textarea');
            inputs.forEach(input => {
                if (input.tagName === 'TEXTAREA') {
                    input.value = '';
                } else if (input.type === 'number') {
                    if (input.dataset.key === 'temperature') input.value = '0.7';
                    else if (input.dataset.key === 'maxTokens') input.value = '4000';
                    else if (input.dataset.key === 'maxContextTokens') input.value = '256000';
                    else input.value = '';
                } else {
                    input.value = '';
                }
            });
        };
        addButtons.appendChild(clearBtn);

        // 当前服务信息区域
        const currentSection = document.createElement('div');
        currentSection.className = 'ds-current-section';
        content.appendChild(currentSection);

        const currentTitle = document.createElement('div');
        currentTitle.className = 'ds-section-title';
        currentTitle.innerHTML = '🎯 当前服务';
        currentSection.appendChild(currentTitle);

        const currentInfo = document.createElement('div');
        currentInfo.className = 'ds-current-info';
        currentSection.appendChild(currentInfo);

        // 更新当前服务信息函数
        function updateCurrentServiceInfo() {
            const currentApi = getCurrentApiConfig();
            if (currentApi) {
                currentInfo.innerHTML = `
                    <div class="ds-current-service">
                        <div class="ds-current-name">${currentApi.name}</div>
                        <div class="ds-current-details">
                            <span>🌐 ${currentApi.apiUrl}</span>
                            <span>🤖 ${currentApi.models.join(', ')}</span>
                            <span>🌡️ 温度: ${currentApi.temperature}</span>
                            <span>🔢 Token限制: ${currentApi.maxTokens}</span>
                        </div>
                    </div>
                `;
            } else {
                currentInfo.innerHTML = '<div class="ds-empty-message">请先添加并选择一个服务</div>';
            }
        }

        // 人格设置区域
        const personalitySection = document.createElement('div');
        personalitySection.className = 'ds-personality-section';
        content.appendChild(personalitySection);

        const personalityTitle = document.createElement('div');
        personalityTitle.className = 'ds-section-title';
        personalityTitle.innerHTML = '🎭 AI人格设置';
        personalitySection.appendChild(personalityTitle);

        // 人格设置表单
        const personalityForm = document.createElement('div');
        personalityForm.className = 'ds-config-form';
        personalitySection.appendChild(personalityForm);

        // 提示文字
        const personalityHint = document.createElement('div');
        personalityHint.className = 'ds-personality-hint';
        personalityHint.style.marginBottom = '15px';
        personalityHint.innerHTML = '💡 编写详细的人格描述，包括性格特点、说话风格、背景信息等。';
        personalityForm.appendChild(personalityHint);

        // 人格描述文本框
        const personalityField = document.createElement('div');
        personalityField.className = 'ds-form-field';
        personalityForm.appendChild(personalityField);

        const personalityLabel = document.createElement('label');
        personalityLabel.className = 'ds-form-label';
        personalityLabel.innerText = '人格描述';
        personalityField.appendChild(personalityLabel);

        const personalityTextarea = document.createElement('textarea');
        personalityTextarea.className = 'ds-form-textarea';
        personalityTextarea.style.minHeight = '150px';
        personalityTextarea.placeholder = '请输入你的人格描述...\n\n例如：\n你是锐锐，一个18岁、热爱数学的可爱女孩。\n性格聪明冷静，内心善良，对朋友真诚。\n说话逻辑清晰，又温柔贴心。';
        personalityTextarea.value = config.personalityPrompt;
        personalityField.appendChild(personalityTextarea);

        // 人格设置按钮组
        const personalityButtonGroup = document.createElement('div');
        personalityButtonGroup.className = 'ds-form-buttons';
        personalityForm.appendChild(personalityButtonGroup);

        // 重置按钮
        const resetPersonalityBtn = document.createElement('button');
        resetPersonalityBtn.className = 'ds-btn-secondary';
        resetPersonalityBtn.innerHTML = '🔄 重置';
        resetPersonalityBtn.title = '重置为默认人格';
        resetPersonalityBtn.onclick = () => {
            if (confirm('确定要重置为默认人格吗？')) {
                const defaultPersonality = '你是锐锐，一个18岁、热爱数学的可爱女孩。你性格聪明冷静，内心善良，对朋友真诚，伙伴遇困定会援手相助。外貌甜美，皮肤白皙，大眼睛灵动有神。说话逻辑清晰，又温柔贴心。';
                personalityTextarea.value = defaultPersonality;
                showNotification('已重置为默认人格', 'success');
            }
        };
        personalityButtonGroup.appendChild(resetPersonalityBtn);

        // 清空按钮
        const clearPersonalityBtn = document.createElement('button');
        clearPersonalityBtn.className = 'ds-btn-secondary';
        clearPersonalityBtn.innerHTML = '🗑️ 清空';
        clearPersonalityBtn.title = '清空内容';
        clearPersonalityBtn.onclick = () => {
            if (personalityTextarea.value.trim() && confirm('确定要清空当前内容吗？')) {
                personalityTextarea.value = '';
                showNotification('已清空', 'success');
            }
        };
        personalityButtonGroup.appendChild(clearPersonalityBtn);

        // 保存人格按钮
        const savePersonalityBtn = document.createElement('button');
        savePersonalityBtn.className = 'ds-btn-primary';
        savePersonalityBtn.innerHTML = '💾 保存人格';
        savePersonalityBtn.title = '保存人格设置';
        savePersonalityBtn.onclick = () => {
            const newPersonality = personalityTextarea.value.trim();
            if (!newPersonality) {
                showNotification('人格描述不能为空', 'warning');
                return;
            }

            config.personalityPrompt = newPersonality;
            GM_setValue('personalityPrompt', newPersonality);
            showNotification('人格设置已保存', 'success');
        };
        personalityButtonGroup.appendChild(savePersonalityBtn);

        // 设置底部
        const footer = document.createElement('div');
        footer.className = 'ds-settings-footer';
        modal.appendChild(footer);

        const footerLeft = document.createElement('div');
        footerLeft.className = 'ds-footer-info';
        footerLeft.innerHTML = `
            <span>📊 共 ${apiConfigs.length} 个服务</span>
            <span>🎯 当前: ${apiConfigs[currentApiIndex]?.name || '未选择'}</span>
        `;
        footer.appendChild(footerLeft);

        const footerButtons = document.createElement('div');
        footerButtons.className = 'ds-footer-buttons';
        footer.appendChild(footerButtons);

        // 导出配置按钮
        const exportBtn = document.createElement('button');
        exportBtn.className = 'ds-btn-secondary';
        exportBtn.innerText = '📤 导出';
        exportBtn.title = '导出当前配置';
        exportBtn.onclick = () => {
            const exportData = {
                apiConfigs: apiConfigs,
                currentApiIndex: currentApiIndex,
                exportTime: new Date().toISOString()
            };
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `api-configs-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        };
        footerButtons.appendChild(exportBtn);

        // 导入配置按钮
        const importBtn = document.createElement('button');
        importBtn.className = 'ds-btn-secondary';
        importBtn.innerText = '📥 导入';
        importBtn.title = '导入配置文件';
        importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const data = JSON.parse(event.target.result);
                            if (data.apiConfigs && Array.isArray(data.apiConfigs)) {
                                if (confirm(`确定要导入 ${data.apiConfigs.length} 个服务配置吗？\n当前配置将被覆盖。`)) {
                                    apiConfigs = data.apiConfigs;
                                    currentApiIndex = data.currentApiIndex || 0;
                                    GM_setValue('apiConfigs', apiConfigs);
                                    GM_setValue('currentApiIndex', currentApiIndex);
                                    renderServicesList();
                                    updateCurrentServiceInfo();
                                    alert('配置导入成功！');
                                }
                            } else {
                                alert('配置文件格式不正确');
                            }
                        } catch (error) {
                            alert('解析配置文件失败: ' + error.message);
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        };
        footerButtons.appendChild(importBtn);

        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.className = 'ds-btn-primary';
        saveBtn.innerText = '💾 保存';
        saveBtn.title = '保存所有配置';
        saveBtn.onclick = () => {
            GM_setValue('apiConfigs', apiConfigs);
            GM_setValue('currentApiIndex', currentApiIndex);

            // 添加淡出动画
            overlay.classList.add('fade-out');
            const modal = overlay.querySelector('.ds-settings-modal');
            if (modal) modal.classList.add('fade-out');

            // 动画结束后移除元素
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 500);
        };
        footerButtons.appendChild(saveBtn);

        // 关闭按钮
        const closeFooterBtn = document.createElement('button');
        closeFooterBtn.className = 'ds-btn-secondary';
        closeFooterBtn.innerText = '❌ 关闭';
        closeFooterBtn.onclick = () => {
            // 添加淡出动画
            overlay.classList.add('fade-out');
            const modal = overlay.querySelector('.ds-settings-modal');
            if (modal) modal.classList.add('fade-out');

            // 动画结束后移除元素
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 500);
        };
        footerButtons.appendChild(closeFooterBtn);

        // 初始渲染
        renderServicesList();
        updateCurrentServiceInfo();

        // 事件监听
        closeBtn.addEventListener('click', () => {
            // 添加淡出动画
            overlay.classList.add('fade-out');
            const modal = overlay.querySelector('.ds-settings-modal');
            if (modal) modal.classList.add('fade-out');

            // 动画结束后移除元素
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 500);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // 添加淡出动画
                overlay.classList.add('fade-out');
                const modal = overlay.querySelector('.ds-settings-modal');
                if (modal) modal.classList.add('fade-out');

                // 动画结束后移除元素
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 500);
            }
        });
    }

    // 检查是否已经存在图标
    if (!document.querySelector('.ds-chat-icon')) {
        // 创建UI元素
        const icon = document.createElement('div');
        icon.className = 'ds-chat-icon';

        // 尝试创建图标
        function createIcon() {
            const iconUrls = [];

            // 尝试获取主图标
            try {
                const mainIconUrl = GM_getResourceURL('icon');
                if (mainIconUrl) iconUrls.push(mainIconUrl);
            } catch (e) {
                console.warn('获取主图标失败:', e);
            }

            // 尝试获取备用图标
            try {
                const backupIconUrl = GM_getResourceURL('icon_backup');
                if (backupIconUrl) iconUrls.push(backupIconUrl);
            } catch (e) {
                console.warn('获取备用图标失败:', e);
            }

            // 添加外部图标URL作为最后备用
            iconUrls.push(
                'https://img.alicdn.com/imgextra/i2/O1CN01bYc1m81RrcSAyOjMu_!!6000000002165-54-tps-60-60.apng',
                'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/deepseek.svg'
            );

            // 尝试加载图标
            function tryLoadIcon(urls, index = 0) {
                if (index >= urls.length) {
                    console.warn('所有图标URL都失败，使用emoji');
                    useEmojiIcon();
                    return;
                }

                const url = urls[index];
                const img = document.createElement('img');
                img.src = url;
                img.alt = '💬';
                img.title = 'Deepseek Chat';

                img.onerror = () => {
                    console.warn(`图标加载失败 [${index}]:`, url);
                    tryLoadIcon(urls, index + 1);
                };

                img.onload = () => {
                    console.log(`图标加载成功 [${index}]:`, url);
                    icon.appendChild(img);
                };

                // 如果3秒内没有加载成功，尝试下一个
                setTimeout(() => {
                    if (!icon.contains(img) && img.parentNode === null) {
                        console.warn(`图标加载超时 [${index}]:`, url);
                        tryLoadIcon(urls, index + 1);
                    }
                }, 3000);
            }

            // 开始尝试加载图标
            tryLoadIcon(iconUrls);
        }

        // 使用emoji图标
        function useEmojiIcon() {
            icon.innerHTML = '💬';
            icon.style.fontSize = '24px';
            icon.style.fontWeight = 'bold';
            icon.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
            icon.style.display = 'flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
        }

        // 创建图标
        createIcon();

        document.body.appendChild(icon);

        // 确保图标位置固定在右下角5px处
        icon.style.position = 'fixed';
        icon.style.bottom = '5px';
        icon.style.right = '5px';
        icon.style.zIndex = '2147483647';
        icon.style.display = 'flex';

        const chatWindow = document.createElement('div');
        chatWindow.className = 'ds-chat-window';
        document.body.appendChild(chatWindow);

        const chatHeader = document.createElement('div');
        chatHeader.className = 'ds-chat-header';
        chatWindow.appendChild(chatHeader);

        const chatTitle = document.createElement('div');
        chatTitle.className = 'ds-chat-title';
        chatTitle.innerText = 'Deepseek Chat';
        chatHeader.appendChild(chatTitle);

        // Agent mode status indicator
        var agentStatus = document.createElement('span');
        agentStatus.className = 'ds-agent-status';
        agentStatus.style.display = 'none';
        chatTitle.appendChild(agentStatus);

        function updateAgentStatus() {
            if (config.browserAgentMode) {
                agentStatus.style.display = 'inline-block';
                agentStatus.textContent = '🤖 Agent';
                chatHeader.classList.add('agent-active');
            } else {
                agentStatus.style.display = 'none';
                chatHeader.classList.remove('agent-active');
            }
        }
        updateAgentStatus();

        const headerButtons = document.createElement('div');
        headerButtons.style.display = 'flex';
        headerButtons.style.alignItems = 'center';
        headerButtons.style.gap = '5px';
        chatHeader.appendChild(headerButtons);

        const fullscreenBtn = document.createElement('div');
        fullscreenBtn.className = 'ds-chat-fullscreen';
        fullscreenBtn.innerText = '🔘';
        fullscreenBtn.title = '全屏/窗口';
        headerButtons.appendChild(fullscreenBtn);

        const closeBtn = document.createElement('div');
        closeBtn.className = 'ds-chat-close';
        closeBtn.innerText = '×';
        closeBtn.title = '关闭';
        headerButtons.appendChild(closeBtn);

        const chatContent = document.createElement('div');
        chatContent.className = 'ds-chat-content';
        chatWindow.appendChild(chatContent);

        // Agent Console Panel
        var consolePanel = document.createElement('div');
        consolePanel.className = 'ds-console-panel';
        chatWindow.appendChild(consolePanel);

        var consoleHeader = document.createElement('div');
        consoleHeader.className = 'ds-console-header';
        consoleHeader.title = '点击展开/收起控制台';
        consolePanel.appendChild(consoleHeader);

        var consoleTitle = document.createElement('div');
        consoleTitle.className = 'ds-console-title';
        consoleTitle.innerHTML = '▶ 终端控制台 <span class="ds-console-badge">Agent</span>';
        consoleHeader.appendChild(consoleTitle);

        var consoleClear = document.createElement('span');
        consoleClear.className = 'ds-console-clear';
        consoleClear.textContent = '✖';
        consoleClear.title = '清空控制台';
        consoleHeader.appendChild(consoleClear);

        var consoleContent = document.createElement('div');
        consoleContent.className = 'ds-console-content';
        consolePanel.appendChild(consoleContent);

        // Console state
        var consoleVisible = false;

        // Toggle console on header click
        consoleHeader.addEventListener('click', function(e) {
            if (e.target === consoleClear) return;
            consoleVisible = !consoleVisible;
            consolePanel.classList.toggle('active', consoleVisible);
            consoleHeader.querySelector('.ds-console-title').innerHTML = (consoleVisible ? '▼' : '▶') + ' 终端控制台 <span class="ds-console-badge">Agent</span>';
        });

        // Clear console
        consoleClear.addEventListener('click', function() {
            consoleContent.innerHTML = '';
        });

        // Console log function
        function consoleLog(cmd, result, type) {
            var line = document.createElement('div');
            line.className = 'ds-console-line';

            var prompt = document.createElement('span');
            prompt.className = 'ds-console-prompt';
            prompt.textContent = '$';
            line.appendChild(prompt);

            var cmdSpan = document.createElement('span');
            cmdSpan.className = 'ds-console-cmd';
            cmdSpan.textContent = cmd;
            line.appendChild(cmdSpan);

            consoleContent.appendChild(line);

            if (result) {
                var resultLine = document.createElement('div');
                resultLine.className = 'ds-console-line';
                var resultSpan = document.createElement('span');
                resultSpan.style.marginLeft = '14px';

                if (type === 'error') {
                    resultSpan.className = 'ds-console-error';
                    resultSpan.textContent = '✖ ' + (result.error || result);
                } else if (type === 'success') {
                    resultSpan.className = 'ds-console-success';
                    resultSpan.textContent = '✓ ' + (result.info || result.success || 'done');
                } else if (type === 'info') {
                    resultSpan.className = 'ds-console-info';
                    resultSpan.textContent = 'ℹ ' + (result.info || result);
                } else if (type === 'snapshot') {
                    resultSpan.className = 'ds-console-info';
                    var count = result.elements ? result.elements.length : 0;
                    resultSpan.textContent = '▶ ' + count + ' interactive elements';
                } else if (type === 'screenshot') {
                    resultSpan.className = 'ds-console-success';
                    resultSpan.textContent = '▶ Screenshot (' + result.size + ')';
                } else {
                    resultSpan.className = 'ds-console-result';
                    var txt = result.text || result.title || result.url || JSON.stringify(result).substring(0, 100);
                    resultSpan.textContent = '▶ ' + txt;
                }

                resultLine.appendChild(resultSpan);
                consoleContent.appendChild(resultLine);

                // Show screenshots inline in console
                if (result.screenshot) {
                    var imgLine = document.createElement('div');
                    imgLine.className = 'ds-console-line';
                    var img = document.createElement('img');
                    img.src = result.screenshot;
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '160px';
                    img.style.borderRadius = '4px';
                    img.style.margin = '4px 0 4px 14px';
                    imgLine.appendChild(img);
                    consoleContent.appendChild(imgLine);
                }

                // Show snapshot formatted output
                if (result.formatted) {
                    var preLine = document.createElement('div');
                    preLine.className = 'ds-console-line';
                    var pre = document.createElement('pre');
                    pre.style.margin = '2px 0 2px 14px';
                    pre.style.color = '#8b949e';
                    pre.style.fontSize = '11px';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.textContent = result.formatted.substring(0, 1500) + (result.formatted.length > 1500 ? '...' : '');
                    preLine.appendChild(pre);
                    consoleContent.appendChild(preLine);
                }
            }

            // Auto-scroll to bottom
            consoleContent.scrollTop = consoleContent.scrollHeight;

            // Auto-show console on first command
            if (!consoleVisible) {
                consoleVisible = true;
                consolePanel.classList.add('active');
                consoleHeader.querySelector('.ds-console-title').innerHTML = '▼ 终端控制台 <span class="ds-console-badge">Agent</span>';
            }
        }

        const inputArea = document.createElement('div');
        inputArea.className = 'ds-chat-input-area';
        chatWindow.appendChild(inputArea);

        const contextToggle = document.createElement('div');
        contextToggle.className = 'ds-context-toggle';
        inputArea.appendChild(contextToggle);

        const contextCheckbox = document.createElement('input');
        contextCheckbox.type = 'checkbox';
        contextCheckbox.id = 'ds-context-checkbox';
        contextCheckbox.checked = config.usePageContext;
        contextToggle.appendChild(contextCheckbox);

        const contextLabel = document.createElement('label');
        contextLabel.htmlFor = 'ds-context-checkbox';
        contextLabel.innerText = '🌐 使用网页上下文';
        contextToggle.appendChild(contextLabel);

        // Browser Agent Mode Toggle
        const agentToggle = document.createElement('div');
        agentToggle.className = 'ds-context-toggle';
        agentToggle.style.marginLeft = '12px';
        contextToggle.appendChild(agentToggle);

        const agentCheckbox = document.createElement('input');
        agentCheckbox.type = 'checkbox';
        agentCheckbox.id = 'ds-agent-checkbox';
        agentCheckbox.checked = config.browserAgentMode;
        agentToggle.appendChild(agentCheckbox);

        const agentLabel = document.createElement('label');
        agentLabel.htmlFor = 'ds-agent-checkbox';
        agentLabel.innerText = '🤖 Agent模式';
        agentLabel.title = '启用后AI可以操控浏览器执行任务，持续执行直到目标达成（参考pi-agent-browser）';
        agentToggle.appendChild(agentLabel);

        agentCheckbox.addEventListener('change', function() {
            config.browserAgentMode = agentCheckbox.checked;
            GM_setValue('browserAgentMode', config.browserAgentMode);
            if (config.browserAgentMode) {
                showNotification('Agent模式已开启 — AI将可以操控浏览器执行任务', 'success');
            } else {
                showNotification('Agent模式已关闭', 'warning');
            }
        });

        const inputBox = document.createElement('textarea');
        inputBox.className = 'ds-chat-input';
        inputBox.placeholder = '输入你的问题...';
        inputBox.rows = 2;
        inputBox.style.padding = '8px 10px';
        inputArea.appendChild(inputBox);

        const settingsArea = document.createElement('div');
        settingsArea.className = 'ds-chat-settings';
        inputArea.appendChild(settingsArea);

        // 服务选择下拉菜单
        const serviceSelect = document.createElement('select');
        serviceSelect.className = 'ds-service-select';
        serviceSelect.title = '选择当前使用的API服务';

        // 模型选择下拉菜单
        const modelSelect = document.createElement('select');
        modelSelect.className = 'ds-model-select';
        modelSelect.title = '选择当前使用的模型';

        // 填充服务选项
        function updateServiceSelect() {
            serviceSelect.innerHTML = '';
            apiConfigs.forEach((config, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${config.name}${index === currentApiIndex ? ' (当前)' : ''}`;
                if (index === currentApiIndex) {
                    option.selected = true;
                }
                serviceSelect.appendChild(option);
            });

            if (apiConfigs.length === 0) {
                const option = document.createElement('option');
                option.value = -1;
                option.textContent = '⚠️ 请先配置服务';
                serviceSelect.appendChild(option);
            }
        }

        // 填充模型选项
        function updateModelSelect() {
            modelSelect.innerHTML = '';
            const currentApi = getCurrentApiConfig();

            if (currentApi && currentApi.models && currentApi.models.length > 0) {
                currentApi.models.forEach((model, index) => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    // 如果当前配置的模型是这个，就选中它
                    if (index === 0) { // 默认选中第一个模型
                        option.selected = true;
                    }
                    modelSelect.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '无可用模型';
                modelSelect.appendChild(option);
            }
        }

        // 更新当前配置的模型
        function updateCurrentModel() {
            const currentApi = getCurrentApiConfig();
            if (currentApi && modelSelect.value) {
                // 更新当前服务的默认模型为选中的模型
                if (currentApi.models && currentApi.models.length > 0) {
                    // 将选中的模型移到第一个位置
                    const selectedModel = modelSelect.value;
                    const modelIndex = currentApi.models.indexOf(selectedModel);
                    if (modelIndex > 0) {
                        currentApi.models.splice(modelIndex, 1);
                        currentApi.models.unshift(selectedModel);
                        GM_setValue('apiConfigs', apiConfigs);
                    }
                }
            }
        }

        // 更新全局的getCurrentModel函数，使其能够获取模型选择器的值
        const originalGetCurrentModel = window.getCurrentModel;
        window.getCurrentModel = function() {
            const currentApi = getCurrentApiConfig();
            if (currentApi && currentApi.models && currentApi.models.length > 0) {
                // 优先使用模型选择器的值，如果没有则使用第一个模型
                if (modelSelect && modelSelect.value) {
                    return modelSelect.value;
                }
                return currentApi.models[0];
            }
            return 'deepseek-chat'; // 默认模型
        };

        updateServiceSelect();
        updateModelSelect();

        serviceSelect.addEventListener('change', (e) => {
            const newIndex = parseInt(e.target.value);
            if (newIndex >= 0 && newIndex < apiConfigs.length) {
                setCurrentApiConfig(newIndex);
                updateServiceSelect();
                updateModelSelect(); // 更新模型选择器
            }
        });

        modelSelect.addEventListener('change', (e) => {
            updateCurrentModel();
        });

        settingsArea.appendChild(serviceSelect);
        settingsArea.appendChild(modelSelect);

        // 设置按钮
        const settingsBtn = document.createElement('span');
        settingsBtn.className = 'ds-chat-settings-btn';
        settingsBtn.innerText = '⚙️';
        settingsBtn.title = 'API配置与人格设置';
        settingsArea.appendChild(settingsBtn);

        const clearBtn = document.createElement('span');
        clearBtn.className = 'ds-chat-settings-btn';
        clearBtn.innerText = '🗑️';
        clearBtn.title = '清空聊天';
        settingsArea.appendChild(clearBtn);

        // 显示通知消息
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'ds-notification';
            notification.textContent = message;
            document.body.appendChild(notification);

            // 3秒后自动移除
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.5s ease-in-out forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 500);
            }, 2500);
        }

        // 显示历史消息 - 异步版本，确保资源加载完成后再渲染
        async function displayHistory() {
            chatContent.innerHTML = '';

            // 先加载Markdown渲染资源
            await loadMarkdownResources();

            // 渲染历史消息
            config.chatHistory.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `ds-chat-message ds-${msg.role}-message`;
                msgDiv.innerHTML = `<div class="ds-message-content">${renderMarkdown(msg.content)}</div>`;
                chatContent.appendChild(msgDiv);
            });

            // 渲染代码高亮和图表
            renderCodeHighlight(chatContent);
            renderMermaidDiagrams(chatContent);

            // 滚动到底部
            setTimeout(() => {
                chatContent.scrollTop = chatContent.scrollHeight;
            }, 0);
        }

        // 渲染所有内容
        function renderAllContent() {
            loadMarkdownResources().then(() => {
                // 渲染代码高亮
                renderCodeHighlight(chatContent);
                // 渲染Mermaid图表
                renderMermaidDiagrams(chatContent);
                // 重新渲染数学公式占位符
                rerenderMathPlaceholders();
            });
        }

        displayHistory();

        // 事件监听
        icon.addEventListener('click', () => {
            chatWindow.classList.toggle('active');
            icon.style.display = 'none';
            setTimeout(() => {
                chatContent.scrollTop = chatContent.scrollHeight;
            }, 0);
        });

        closeBtn.addEventListener('click', () => {
            // 添加关闭动画
            chatWindow.style.animation = 'fadeOut 0.5s ease-in-out forwards';

            // 保存当前是否全屏状态
            const isFullscreen = chatWindow.classList.contains('fullscreen');

            // 动画结束后隐藏窗口并重置样式
            const handleAnimationEnd = () => {
                chatWindow.classList.remove('active');
                // 如果是全屏状态，先移除全屏类
                if (isFullscreen) {
                    chatWindow.classList.remove('fullscreen');
                }
                chatWindow.style.animation = '';
                icon.style.display = 'flex';
                chatWindow.removeEventListener('animationend', handleAnimationEnd);
            };

            chatWindow.addEventListener('animationend', handleAnimationEnd);
        });

        fullscreenBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('fullscreen');
            if (chatWindow.classList.contains('fullscreen')) {
                fullscreenBtn.innerText = '🔳';
                fullscreenBtn.title = '退出全屏';
            } else {
                fullscreenBtn.innerText = '🔘';
                fullscreenBtn.title = '全屏';
            }
            // 重新计算滚动位置
            setTimeout(() => {
                chatContent.scrollTop = chatContent.scrollHeight;
            }, 100);
        });

        contextCheckbox.addEventListener('change', () => {
            config.usePageContext = contextCheckbox.checked;
            GM_setValue('usePageContext', config.usePageContext);
        });

        // 设置按钮点击事件
        settingsBtn.addEventListener('click', () => {
            openSettingsModal();
        });

        clearBtn.addEventListener('click', () => {
            config.chatHistory = [];
            GM_setValue('chatHistory', config.chatHistory);
            chatContent.innerHTML = '';
        });

        /**
         * 获取网页主要内容
         */
        function getPageContent() {
            const metaTags = Array.from(document.querySelectorAll('meta'));
            const metaInfo = metaTags.map(tag => {
                const name = tag.getAttribute('name') || tag.getAttribute('property') || '';
                const content = tag.getAttribute('content') || '';
                return { name, content };
            }).filter(meta => meta.content);

            const allText = document.body.innerText
                .replace(/[\n\r\t]+/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();

            const MAX_LENGTH = 30000;
            let content = `
[网页元信息]
标题: ${document.title}
URL: ${window.location.href}
字符集: ${document.characterSet}
语言: ${document.documentElement.lang || '未指定'}

[元标签]
${metaInfo.map(meta => `${meta.name}: ${meta.content}`).join('\n')}

[主要内容摘要]
${allText.substring(0, MAX_LENGTH / 2)}${allText.length > MAX_LENGTH / 2 ? '...' : ''}
            `;

            if (content.length > MAX_LENGTH) {
                content = content.substring(0, MAX_LENGTH) + '...';
            }

            return {
                url: window.location.href,
                title: document.title,
                content,
                charset: document.characterSet,
                wordCount: content.split(/\s+/).length
            };
        }

        // 流式响应处理
        function handleStreamResponse(response, aiMsgDiv) {
            return new Promise((resolve, reject) => {
                let reasoningMessage = '';
                let contentMessage = '';
                const thinkingMsg = document.querySelector('.ds-thinking');
                if (thinkingMsg && thinkingMsg.parentNode) {
                    thinkingMsg.parentNode.removeChild(thinkingMsg);
                }

                aiMsgDiv.innerHTML = '';

                // 创建思维内容容器
                const reasoningDiv = document.createElement('div');
                reasoningDiv.className = 'ds-reasoning-content';
                aiMsgDiv.appendChild(reasoningDiv);

                // 创建最终内容容器
                const contentDiv = document.createElement('div');
                contentDiv.className = 'ds-message-content';
                aiMsgDiv.appendChild(contentDiv);

                let lastRenderTime = 0;
                const renderDelay = 200;

                const decoder = new TextDecoder();
                let buffer = '';
                const reader = response.response.getReader();

                function readStream() {
                    reader.read().then(({done, value}) => {
                        if (done) {
                            // 确保最终内容被渲染
                            contentDiv.innerHTML = renderMarkdown(contentMessage);
                            chatContent.scrollTop = chatContent.scrollHeight;

                            // 渲染所有内容
                            renderAllContent();

                            if (contentMessage.trim()) {
                                config.chatHistory.push({ role: 'assistant', content: contentMessage });
                                GM_setValue('chatHistory', config.chatHistory);
                            }
                            resolve();
                            return;
                        }

                        buffer += decoder.decode(value, {stream: true});
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (!line.trim() || line === 'data: [DONE]') continue;
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    // 处理思维内容
                                    if (data.choices?.[0]?.delta?.reasoning_content) {
                                        reasoningMessage += data.choices[0].delta.reasoning_content;
                                        reasoningDiv.innerHTML = renderMarkdown(reasoningMessage);
                                    }
                                    // 处理最终内容
                                    if (data.choices?.[0]?.delta?.content) {
                                        contentMessage += data.choices[0].delta.content;
                                        // 性能优化:限制渲染频率
                                        const now = Date.now();
                                        if (now - lastRenderTime > renderDelay) {
                                            contentDiv.innerHTML = renderMarkdown(contentMessage);
                                            lastRenderTime = now;
                                        }
                                    }
                                } catch (e) {
                                    console.warn('解析响应数据失败:', e);
                                }
                            }
                        }

                        // 实时滚动到底部
                        chatContent.scrollTop = chatContent.scrollHeight;
                        readStream();
                    }).catch(error => {
                        reject(error);
                    });
                }

                readStream();
            });
        }

        // 计算消息的 token 数量
        function countTokens(text) {
            return Math.ceil(text.length / 2);
        }

        // 检查并截断上下文
        function truncateContext(messages, maxContextTokens) {
            let totalTokens = 0;
            for (let i = messages.length - 1; i >= 0; i--) {
                const messageTokens = countTokens(messages[i].content);
                if (totalTokens + messageTokens > maxContextTokens) {
                    messages.splice(0, i);
                    break;
                }
                totalTokens += messageTokens;
            }
            return messages;
        }

        // 发送消息函数
        // Browser agent instance
        const browserAgent = new BrowserAgent();
        // Agent loop state
        let agentRunning = false;
        let agentIterationCount = 0;

        // Execute agent loop: run tool commands and feed results back
        async function runAgentLoop(aiResponse, originalMessage, retryCount) {
            if (!config.browserAgentMode) return false;
            if (agentIterationCount >= config.agentMaxIterations) {
                addAIMessage('⚠️ 已达到最大迭代次数 (' + config.agentMaxIterations + ')，任务已停止。');
                agentRunning = false;
                return false;
            }

            var commands = browserAgent.extractCommands(aiResponse);
            if (commands.length === 0) return false;

            agentRunning = true;
            agentIterationCount++;

            // Show which commands are being executed
            var cmdLog = '🔄 Agent 迭代 #' + agentIterationCount + ' — 执行命令:\n';
            commands.forEach(function(c) { cmdLog += '  - ' + c + '\n'; });
            addAIMessage(cmdLog);

            // Execute each command sequentially
            var results = [];
            for (var i = 0; i < commands.length; i++) {
                var cmd = commands[i];
                var cmdLower = cmd.split(/\s+/)[0].toLowerCase();

                // Check for done command
                if (cmdLower === 'done') {
                    agentRunning = false;
                    return true;
                }

                try {
                    var result = await browserAgent.executeCommand(cmd);
                    if (result) {
                        results.push({ command: cmd, result: result });
                        // Show screenshot inline if available
                        if (result.screenshot) {
                            var imgHtml = '<div style="margin:8px 0;max-width:100%;overflow:auto;border-radius:8px;border:1px solid rgba(0,0,0,0.1)">';
                            imgHtml += '<img src="' + result.screenshot + '" style="max-width:100%;height:auto;display:block" />';
                            imgHtml += '</div>';
                            addAIMessage('📸 截图 (' + result.size + '): ' + imgHtml);
                        }
                        // Show formatted snapshot output
                        if (result.formatted) {
                            addAIMessage('🔍 ' + result.info + ':\n```\n' + result.formatted.substring(0, 2000) + '\n```');
                        } else if (result.info) {
                            addAIMessage('ℹ️ ' + result.info);
                        }
                        // Show get title/url/text results
                        if (result.title && !result.formatted && !result.info && !result.screenshot) {
                            addAIMessage('📄 ' + cmd + ' → ' + result.title);
                        }
                        if (result.url && !result.text && !result.title) {
                            addAIMessage('🔗 ' + cmd + ' → ' + result.url);
                        }
                        if (result.text && !result.formatted) {
                            var txt = result.text.substring(0, 500);
                            addAIMessage('📄 页面内容 (' + result.title + '):\n' + txt + (result.text.length > 500 ? '...' : ''));
                        }
                    }
                } catch (e) {
                    results.push({ command: cmd, error: e.message });
                }
            }

            // Build feedback for the AI
            var feedback = '【Browser Agent 执行结果】\n';
            results.forEach(function(r) {
                var res = r.result;
                if (r.error) {
                    feedback += '❌ ' + r.command + ' → 错误: ' + r.error + '\n';
                } else if (res && res.error) {
                    feedback += '❌ ' + r.command + ' → ' + res.error + '\n';
                } else if (res && res.success) {
                    feedback += '✅ ' + r.command + ' → 成功';
                    if (res.text) feedback += ' (text: ' + res.text.substring(0, 50) + ')';
                    if (res.value) feedback += ' (value: ' + res.value.substring(0, 50) + ')';
                    if (res.tag) feedback += ' (tag: ' + res.tag + ')';
                    if (res.screenshot) feedback += ' (截图已显示)';
                    feedback += '\n';
                } else if (res && res.info) {
                    feedback += '📋 ' + r.command + ' → ' + res.info + '\n';
                } else if (res && res.title) {
                    // get title → {title: "..."}
                    feedback += '✅ ' + r.command + ' → ' + res.title + '\n';
                } else if (res && res.url) {
                    // get url → {url: "..."}
                    feedback += '✅ ' + r.command + ' → ' + res.url + '\n';
                } else if (res && res.text) {
                    // get text → {text: "...", title: "...", url: "..."}
                    var txtPreview = res.text.substring(0, 200);
                    feedback += '✅ ' + r.command + ' → ' + res.title + ' | ' + txtPreview + (res.text.length > 200 ? '...' : '') + '\n';
                } else if (res && res.done) {
                    feedback += '✅ ' + r.command + ' → ' + (res.info || '任务完成') + '\n';
                } else {
                    feedback += '➡️ ' + r.command + '\n';
                }
            });
            feedback += '\n当前页面: ' + location.href + ' | 标题: ' + document.title;
            feedback += '\n【请根据以上结果决定下一步操作，或使用 done 结束任务】';

            // Feed back as a system message and continue the loop
            return await continueAgentLoop(feedback, originalMessage, retryCount);
        }

        // Continue the agent loop: send feedback to API and process response
        async function continueAgentLoop(feedback, originalMessage, retryCount) {
            // Add feedback to chat history (as system message)
            config.chatHistory.push({ role: 'system', content: feedback });

            var currentConfig = getCurrentConfig();
            var requestData = {
                model: currentConfig.model,
                messages: [
                    { role: 'system', content: config.personalityPrompt + (config.browserAgentMode ? '\n\n' + BrowserAgent.getToolDescriptions() : '') },
                    ...truncateContext(config.chatHistory, currentConfig.maxContextTokens)
                ],
                temperature: currentConfig.temperature,
                max_tokens: currentConfig.maxTokens,
                stream: true,
            };

            if (config.usePageContext) {
                var pageContent = getPageContent();
                requestData.messages.splice(1, 0, {
                    role: 'system',
                    content: '[当前网页全景信息]\n' + pageContent.content + '\n'
                });
            }

            try {
                return new Promise(function(resolve, reject) {
                    var timeoutId = setTimeout(function() { reject(new Error('Request timeout')); }, 30000);
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: currentConfig.apiUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + currentConfig.apiKey,
                            'Accept': 'text/event-stream'
                        },
                        responseType: 'stream',
                        data: JSON.stringify(requestData),
                        onloadstart: function(response) {
                            clearTimeout(timeoutId);
                            var aiMsgDiv = document.createElement('div');
                            aiMsgDiv.className = 'ds-chat-message ds-ai-message';
                            chatContent.appendChild(aiMsgDiv);
                            chatContent.scrollTop = chatContent.scrollHeight;

                            handleStreamResponse(response, aiMsgDiv).then(function() {
                                var aiText = aiMsgDiv.textContent || aiMsgDiv.innerText || '';
                                // Check if there are more tool commands in the response
                                runAgentLoop(aiText, originalMessage, retryCount).then(function(completed) {
                                    if (completed) {
                                        agentRunning = false;
                                        addAIMessage('✅ 任务完成！');
                                    }
                                    resolve();
                                });
                            }).catch(reject);
                        },
                        onerror: function(error) {
                            clearTimeout(timeoutId);
                            reject(new Error('Request failed: ' + error.statusText));
                        },
                        ontimeout: function() {
                            clearTimeout(timeoutId);
                            reject(new Error('Request timeout'));
                        }
                    });
                });
            } catch (error) {
                addAIMessage('❌ Agent 循环错误: ' + error.message);
                agentRunning = false;
                return false;
            }
        }

        // Helper: add AI message to chat
        // 直接执行浏览器命令（不过AI，即时响应）
        async function executeDirectCommand(cmd) {
            var result = await browserAgent.executeCommand(cmd);
            var resultText = '';

            if (!result) {
                resultText = '❌ 未知命令: ' + cmd + '\n支持的命令: navigate, snapshot -i, click @eN, fill @eN "text", type, select, press, scroll, get, extract, screenshot, wait, done';
                addAIMessage(resultText);
                return;
            }

            if (result.error) {
                resultText = '❌ ' + result.error;
            } else if (result.formatted) {
                resultText = '🔍 ' + result.info + ':\n\n```\n' + result.formatted.substring(0, 3000) + '\\n```';
            } else if (result.screenshot) {
                resultText = '📸 截图 (' + result.size + '):';
                addAIMessage(resultText);
                var imgHtml = '<div style="margin:8px 0;max-width:100%;overflow:auto;border-radius:8px;border:1px solid rgba(0,0,0,0.1)">';
                imgHtml += '<img src="' + result.screenshot + '" style="max-width:100%;height:auto;display:block" />';
                imgHtml += '</div>';
                addAIMessage(imgHtml);
                return;
            } else if (result.info) {
                resultText = 'ℹ️ ' + result.info;
            } else if (result.success) {
                resultText = '✅ ' + cmd + ' 执行成功';
                if (result.text) resultText += '\n  内容: ' + result.text.substring(0, 100);
                if (result.value) resultText += '\n  值: ' + result.value.substring(0, 100);
            } else if (result.text) {
                resultText = '📄 页面: ' + result.title + '\n' + result.text.substring(0, 2000);
            } else if (result.title) {
                resultText = '📄 标题: ' + result.title;
            } else if (result.url) {
                resultText = '🔗 URL: ' + result.url;
            } else if (result.done) {
                resultText = '✅ 任务完成！' + (result.info ? ' ' + result.info : '');
            } else {
                resultText = JSON.stringify(result, null, 2);
            }

            addAIMessage(resultText);
        }

        function addAIMessage(text) {
            var msgDiv = document.createElement('div');
            msgDiv.className = 'ds-chat-message ds-ai-message';
            msgDiv.innerHTML = '<div class="ds-message-content">' + renderMarkdown(text) + '</div>';
            chatContent.appendChild(msgDiv);
            chatContent.scrollTop = chatContent.scrollHeight;
            renderAllContent();
        }

        async function sendMessage(message, retryCount = 0) {
            if (!message.trim()) return;

            // 直接命令模式：在Agent模式下，用户消息匹配浏览器命令时直接执行
            var directCmd = null;
            var browserCmdRegex = /^(navigate|snapshot|click|fill|type|select|press|scroll|get|extract|screenshot|wait|done)(\b|$)/i;
            if (config.browserAgentMode && browserCmdRegex.test(message.trim())) {
                directCmd = message.trim();
            } else if (config.browserAgentMode && message.trim().startsWith('!')) {
                // 也支持 !command 格式
                directCmd = message.trim().substring(1).trim();
            }

            if (directCmd) {
                var result = await executeDirectCommand(directCmd);
                return;
            }

            if (!getCurrentConfig().apiKey) {
                alert('请先设置 API 密钥！');
                settingsBtn.click();
                return;
            }

            if (!navigator.onLine) {
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'ds-chat-message ds-error';
                errorMsgDiv.innerText = '错误: 网络连接已断开,请检查网络后重试';
                chatContent.appendChild(errorMsgDiv);
                chatContent.scrollTop = chatContent.scrollHeight;
                return;
            }

            const userMsg = { role: 'user', content: message };
            config.chatHistory.push(userMsg);
            GM_setValue('chatHistory', config.chatHistory);

            // 自动附加当前网页信息到用户消息
            var pageCtxHtml = '';
            if (config.usePageContext) {
                try {
                    var pgInfo = getPageContent();
                    pageCtxHtml = '<div style="font-size:11px;color:#999;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;margin-bottom:6px;word-break:break-all;text-align:left">';
                    pageCtxHtml += '<span>\ud83d\udcc4</span> ' + pgInfo.title + '<br>';
                    pageCtxHtml += '<span>\ud83d\udd17</span> ' + pgInfo.url;
                    pageCtxHtml += '</div>';
                } catch(e) {}
            }

            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'ds-chat-message ds-user-message';
            userMsgDiv.innerHTML = pageCtxHtml + '<div class="ds-message-content">' + renderMarkdown(message) + '</div>';
            chatContent.appendChild(userMsgDiv);

            const thinkingMsgDiv = document.createElement('div');
            thinkingMsgDiv.className = 'ds-chat-message ds-thinking';
            thinkingMsgDiv.innerText = '思考中...';
            chatContent.appendChild(thinkingMsgDiv);

            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'ds-chat-message ds-ai-message';
            chatContent.appendChild(aiMsgDiv);

            chatContent.scrollTop = chatContent.scrollHeight;

            const currentConfig = getCurrentConfig();
            const requestData = {
                model: currentConfig.model,
                messages: [
                    { role: 'system', content: config.personalityPrompt + (config.browserAgentMode ? '\n\n' + BrowserAgent.getToolDescriptions() : '') },
                    ...truncateContext(config.chatHistory, currentConfig.maxContextTokens)
                ],
                temperature: currentConfig.temperature,
                max_tokens: currentConfig.maxTokens,
                stream: true,
            };

            if (config.usePageContext) {
                const pageContent = getPageContent();
                requestData.messages.splice(1, 0, {
                                            role: 'system',
                                            content: `[当前网页全景信息]
                    ${pageContent.content}

                    以下是AI渲染指南，请严格遵守：

                    ## 📋 AI渲染指南 v2.0


                    #### 1.1 行内公式
                    - **示例**：
                      - → $e^{i\\pi} + 1 = 0$
                      - $\\frac{a}{b} + \\frac{c}{d} = \\frac{ad+bc}{bd}$
                      - $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$

                    #### 1.2 块级公式
                    - **语法**：使用 $$公式$$ 或 \\[公式\\]
                    - **示例**：
                      - $$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$
                      - $$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$
                      - \\[\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\\]

                    # 实验数据分析

                    - **基本结构**：

                      | 表头1 | 表头2 | 表头3 |
                      | :--- | :---: | ---: |
                      | 左对齐 | 居中 | 右对齐 |


                    ## 分析步骤

                    1. **数据清洗**
                       - [x] 去除异常值
                       - [x] 填补缺失值
                       - [ ] 标准化处理

                    2. **统计分析**
                       - 计算描述性统计
                       - 绘制分布图
                       - 假设检验

                    3. **结果解读**
                       - 主要发现
                       - 结论建议
                    ### 6. 文本样式规范

                    #### 6.1 强调文本
                    - **加粗**：**重要文本** 或 __重要文本__
                    - **斜体**：*倾斜文本* 或 _倾斜文本_
                    - **加粗斜体**：***加粗斜体*** 或 ___加粗斜体___

                    #### 6.2 链接和引用
                    - **链接**：[链接文本](URL)
                      - 示例：[Google](https://www.google.com)
                    - **块引用**：> 引用内容

                      > 这是一个引用
                      > 可以多行
                      > 用于强调或引用他人观点

                    #### 6.3 特殊文本效果
                    - **删除线**：~~删除的文本~~（虽然不常用）
                    - **高亮文本**：使用HTML标签
                      - <span style="color: #ff6b6b; font-weight: bold">红色加粗</span>
                      - <span style=background: yellow; padding: 2px 4px;>高亮背景</span>

                    ### 7. 水平线和分隔
                    - **语法**：使用 --- 或 *** 或 ___
                    - **使用场景**：
                      - 不同主题内容之间
                      - 长文档的章节分隔
                      - 强调重要内容的前后分隔
                    - **示例**：

                      第一部分内容...

                      ---

                      第二部分内容...

                    ---

                    ## 结论

                    实验数据符合预期分布，$p < 0.05$，结果具有统计显著性。

                    - **Mermaid图表**：不支持流程图、甘特图等
                    - **HTML嵌入**：不支持复杂HTML结构

                    #### 9.2 替代方案
                    - **代码展示**：使用内联代码或表格
                    - **图表展示**：使用表格或文字描述
                    - **复杂格式**：使用分段说明

                    ### 10. 最佳实践建议

                    #### 10.1 内容组织
                    1. **结构清晰**：使用标题建立层次
                    2. **重点突出**：使用加粗、列表突出关键信息
                    3. **视觉分隔**：使用水平线分隔不同部分
                    4. **数据可视化**：优先使用表格展示数据

                    #### 10.2 数学公式
                    1. **简洁明了**：避免过长公式
                    2. **分步展示**：复杂公式分步推导
                    3. **上下文配合**：公式前后要有文字说明

                    #### 10.3 表格使用
                    1. **对齐一致**：保持列对齐方式统一
                    2. **表头清晰**：表头应明确说明列内容
                    3. **数据准确**：确保数据准确无误
                    4. **适度使用**：避免过多表格造成视觉疲劳

                    ### 11. 响应式建议

                    #### 11.1 根据用户问题类型选择渲染方式
                    - **数学问题**：重点使用公式渲染
                    - **数据问题**：重点使用表格
                    - **步骤说明**：使用有序列表
                    - **概念解释**：使用标题和段落

                    #### 11.2 根据内容长度调整
                    - **简短回答**：使用内联公式和简单列表
                    - **详细解答**：使用标题、表格、多级列表
                    - **综合内容**：混合使用多种渲染方式

                    ---

                    **请根据用户的具体问题，灵活运用上述渲染规范，确保回答既美观又易读。记住：清晰的结构和正确的渲染能显著提升用户体验！**`                });
            }

            try {
                return new Promise((resolve, reject) => {
                    let timeoutId = setTimeout(() => {
                        reject(new Error('请求超时'));
                    }, 30000);

                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: currentConfig.apiUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${currentConfig.apiKey}`,
                            'Accept': 'text/event-stream'
                        },
                        responseType: 'stream',
                        data: JSON.stringify(requestData),
                        onloadstart: (response) => {
                            try {
                                handleStreamResponse(response, aiMsgDiv)
                                    .then(function() {
                                        // After normal response, check for agent commands
                                        if (config.browserAgentMode) {
                                            var aiText = aiMsgDiv.textContent || aiMsgDiv.innerText || '';
                                            runAgentLoop(aiText, message, retryCount).then(function(completed) {
                                                if (completed) {
                                                    addAIMessage('✅ 任务完成！');
                                                }
                                                resolve();
                                            });
                                        } else {
                                            resolve();
                                        }
                                    })
                                    .catch(reject);
                            } catch (error) {
                                reject(error);
                            }
                        },
                        onerror: (error) => {
                            clearTimeout(timeoutId);
                            chatContent.removeChild(thinkingMsgDiv);
                            reject(new Error('请求失败: ' + error.statusText));
                        },
                        ontimeout: () => {
                            clearTimeout(timeoutId);
                            chatContent.removeChild(thinkingMsgDiv);
                            reject(new Error('请求超时'));
                        }
                    });
                });
            } catch (error) {
                if (thinkingMsgDiv.parentNode) {
                    chatContent.removeChild(thinkingMsgDiv);
                }

                let errorMessage = '发生未知错误';
                if (error.message.includes('timeout')) {
                    errorMessage = '请求超时,请检查网络连接';
                } else if (error.message.includes('Failed to fetch') || error.message.includes('请求失败')) {
                    errorMessage = '无法连接到服务器,请检查:\n1. 网络连接\n2. API地址是否正确\n3. 是否开启了代理/VPN';
                } else if (error.message.includes('401')) {
                    errorMessage = 'API密钥无效或已过期,请重新设置';
                } else if (error.message.includes('429')) {
                    errorMessage = '请求过于频繁,请稍后再试';
                } else {
                    errorMessage = `错误: ${error.message}`;
                }

                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'ds-chat-message ds-error';
                errorMsgDiv.innerText = errorMessage;
                chatContent.appendChild(errorMsgDiv);
                chatContent.scrollTop = chatContent.scrollHeight;

                if ((error.message.includes('Failed to fetch') || error.message.includes('请求失败') || error.message.includes('timeout')) && retryCount < 3) {
                    const retryMsgDiv = document.createElement('div');
                    retryMsgDiv.className = 'ds-chat-message ds-thinking';
                    retryMsgDiv.innerText = `连接失败,正在第${retryCount + 1}次重试...`;
                    chatContent.appendChild(retryMsgDiv);

                    setTimeout(() => {
                        chatContent.removeChild(retryMsgDiv);
                        return sendMessage(message, retryCount + 1);
                    }, 2000);
                }
            }
        }

        // 输入框事件
        inputBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = inputBox.value.trim();
                if (message) {
                    sendMessage(message);
                    inputBox.value = '';
                }
            }
        });

        // 注册菜单命令
        GM_registerMenuCommand("设置DeepSeek API", () => settingsBtn.click());
        GM_registerMenuCommand("清空聊天历史", () => clearBtn.click());
        GM_registerMenuCommand("切换网页上下文", () => {
            contextCheckbox.checked = !contextCheckbox.checked;
            config.usePageContext = contextCheckbox.checked;
            GM_setValue('usePageContext', config.usePageContext);
        });
        GM_registerMenuCommand("切换Agent模式", () => {
            agentCheckbox.checked = !agentCheckbox.checked;
            config.browserAgentMode = agentCheckbox.checked;
            GM_setValue('browserAgentMode', config.browserAgentMode);
            updateAgentStatus();
        });
    }
})();
