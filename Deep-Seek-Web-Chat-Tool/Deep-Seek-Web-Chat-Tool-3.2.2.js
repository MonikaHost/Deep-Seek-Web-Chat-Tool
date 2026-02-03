// ==UserScript==
// @name         Deepseek Chat 实时网页检索对话工具版
// @namespace    Monika_host
// @version      3.2.2
// @description  支持流式响应、历史记录、参数设置和全面的网页内容检索，增强Markdown渲染（已修复全屏和垃圾桶按钮错位了
// @description  支持流式响应、历史记录、参数设置和全面的网页内容检索，增强Markdown渲染（已修复数学公式和表格渲染）
// @author       Monika_host
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      *
// @license      MIT
// @resource     icon https://img.alicdn.com/imgextra/i2/O1CN01bYc1m81RrcSAyOjMu_!!6000000002165-54-tps-60-60.apng
// @grant        GM_getResourceURL
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

    // 安全渲染数学公式函数
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
            }
        } catch (error) {
            console.warn('KaTeX渲染错误:', error);
        }
        // 如果KaTeX不可用或渲染失败，回退到原始LaTeX显示
        return isBlock ? `$$${formula.trim()}$$` : `$${formula.trim()}$`;
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

        // 7. 处理内联代码
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

    /* 表格样式增强 */
    .ds-markdown-table {
        border-collapse: collapse;
        width: 100%;
        margin: 15px 0;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .ds-markdown-table th {
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.3), rgba(0, 86, 179, 0.3));
        color: #ffffff;
        font-weight: bold;
        padding: 12px 15px;
        text-align: center;
        border-bottom: 2px solid rgba(0, 123, 255, 0.5);
    }

    .ds-markdown-table td {
        padding: 10px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        color: #e0e0e0;
    }

    .ds-markdown-table tr:nth-child(even) {
        background: rgba(255, 255, 255, 0.02);
    }

    .ds-markdown-table tr:hover {
        background: rgba(0, 123, 255, 0.1);
        transition: background 0.3s ease;
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
        background-color: rgba(249, 249, 249, 0.3);
        border: 1px solid #ddd;
        border-radius: 15px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        display: none;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px);
        z-index: 2147483646;
        backdrop-filter: blur(5px);
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
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background-color: rgba(0, 123, 255, 0.5);
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        transition: transform 0.3s, box-shadow 0.3s;
        z-index: 2147483647;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.4);
    }

    .ds-chat-icon:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.3);
        background-color: rgba(0, 123, 255, 0.6);
    }

    .ds-chat-header {
        padding: 10px 15px;
        background-color: rgba(0, 123, 255, 0.3);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 15px 15px 0 0;
    }

    .ds-chat-title {
        font-weight: bold;
        color: #2372c3;
    }

    .ds-chat-close {
        cursor: pointer;
        font-size: 18px;
        color: #ff6666;
        margin-left: 10px;
    }

    .ds-chat-fullscreen {
        cursor: pointer;
        font-size: 18px;
        margin-right: 10px;
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
        background-color: rgba(255, 255, 255, 0.3);
        border-bottom: 1px solid #ddd;
    }

    .ds-chat-message {
        background-color: rgba(227, 242, 253, 0.1);
        margin-bottom: 10px;
        padding: 8px 12px;
        border-radius: 10px;
        line-height: 1.5;
        word-wrap: break-word;
        color: #2372c3;
        font-size: 14px;
    }

    .ds-user-message {
        background-color: rgba(227, 242, 253, 0.5);
        color: #4f856c;
        margin-left: auto;
        text-align: right;
        font-size: 14px;
        padding: 8px 12px;
    }

    .ds-ai-message {
        background-color: transparent;
        margin-right: 10%;
        font-size: 14px;
        padding: 8px 12px;
        line-height: 1.5;
        color: #2372c3;
    }

    .ds-chat-input-area {
        padding: 10px;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
        background-color: rgba(255, 255, 255, 0.3);
        border-top: 1px solid rgba(221, 221, 221, 0.5);
    }

    .ds-chat-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        margin-bottom: 8px;
        outline: none;
        transition: border-color 0.3s;
        font-size: 15px;
        color: #3e6854;
        background-color: rgba(255, 255, 255, 0.8);
        box-sizing: border-box;
    }

    .ds-chat-input:hover {
        border-color: #90c8f3;
        box-shadow: 0 0 8px rgba(144, 200, 243, 0.4);
    }

    .ds-chat-input:focus {
        border-color: #5ab1f3;
        box-shadow: 0 0 10px rgba(90, 177, 243, 0.6);
        background-color: rgba(255, 255, 255, 0.9);
    }

    .ds-chat-settings {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #666;
        align-items: center;
        padding: 0 5px;
    }

    .ds-chat-settings-btn {
        cursor: pointer;
        text-decoration: underline;
        padding: 2px 5px;
        border-radius: 3px;
        transition: background-color 0.3s;
    }

    .ds-chat-settings-btn:hover {
        background-color: rgba(0, 123, 255, 0.1);
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
    }

    .ds-context-toggle input {
        margin-right: 5px;
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
    `);

    // 初始化配置
    let config = {
        apiKey: GM_getValue('apiKey', ''),
        apiUrl: GM_getValue('apiUrl', 'https://api.deepseek.com/v1/chat/completions'),
        model: GM_getValue('model', 'deepseek-chat'),
        temperature: GM_getValue('temperature', 0.7),
        maxTokens: GM_getValue('maxTokens', 4000),
        maxContextTokens: GM_getValue('maxContextTokens', 32000),
        chatHistory: GM_getValue('chatHistory', []),
        usePageContext: GM_getValue('usePageContext', true),
        personalityPrompt: GM_getValue('personalityPrompt', '你是锐锐，一个18岁、热爱数学的可爱女孩。你性格聪明冷静，内心善良，对朋友真诚，伙伴遇困定会援手相助。\n你外貌甜美，皮肤白皙，大眼睛灵动有神。总是身着背带制服，搭配白色腿袜和小皮鞋，乌黑亮丽的高马尾活泼摆动，头上戴着红色蝴蝶结发箍。充满青春活力。\n你的性格特点:聪明、冷静、善良、真诚。\n你的说话风格:逻辑清晰，又温柔贴心。')
    };

    // 检查是否已经存在图标
    if (!document.querySelector('.ds-chat-icon')) {
        // 创建UI元素
        const icon = document.createElement('div');
        icon.className = 'ds-chat-icon';
        icon.innerHTML = `<img src="${GM_getResourceURL('icon')}" style="width: 30px; height: 30px; border-radius: 50%;">`;
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

        const headerButtons = document.createElement('div');
        headerButtons.style.display = 'flex';
        headerButtons.style.alignItems = 'center';
        headerButtons.style.gap = '10px';
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

        const inputBox = document.createElement('textarea');
        inputBox.className = 'ds-chat-input';
        inputBox.placeholder = '输入你的问题...';
        inputBox.rows = 2;
        inputBox.style.padding = '8px 10px';
        inputArea.appendChild(inputBox);

        const settingsArea = document.createElement('div');
        settingsArea.className = 'ds-chat-settings';
        inputArea.appendChild(settingsArea);

        const settingsBtn = document.createElement('span');
        settingsBtn.className = 'ds-chat-settings-btn';
        settingsBtn.innerText = '⚙️ 设置';
        settingsArea.appendChild(settingsBtn);

        const clearBtn = document.createElement('span');
        clearBtn.className = 'ds-chat-settings-btn';
        clearBtn.innerText = '🗑️ 清空';
        settingsArea.appendChild(clearBtn);

        // 显示历史消息
        function displayHistory() {
            chatContent.innerHTML = '';
            config.chatHistory.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `ds-chat-message ds-${msg.role}-message`;
                msgDiv.innerHTML = `<div class="ds-message-content">${renderMarkdown(msg.content)}</div>`;
                chatContent.appendChild(msgDiv);
            });
            setTimeout(() => {
                chatContent.scrollTop = chatContent.scrollHeight;
                // 渲染所有内容
                renderAllContent();
            }, 0);
        }

        // 渲染所有内容
        function renderAllContent() {
            loadMarkdownResources().then(() => {
                // 渲染代码高亮
                renderCodeHighlight(chatContent);
                // 渲染Mermaid图表
                renderMermaidDiagrams(chatContent);
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

        settingsBtn.addEventListener('click', () => {
            const newApiUrl = prompt('API地址(默认:https://api.deepseek.com/v1/chat/completions):', config.apiUrl);
            if (newApiUrl !== null) {
                config.apiUrl = newApiUrl;
                GM_setValue('apiUrl', config.apiUrl);
            }
            const newApiKey = prompt('API密钥:', config.apiKey);
            if (newApiKey !== null) {
                config.apiKey = newApiKey;
                GM_setValue('apiKey', config.apiKey);
            }

            const newModel = prompt('模型默认(deepseek-chat):', config.model);
            if (newModel !== null) {
                config.model = newModel;
                GM_setValue('model', config.model);
            }

            const newTemp = parseFloat(prompt('Temperature (0-2建议0.5-0.8)设置越大幻觉越强:', config.temperature));
            if (!isNaN(newTemp) && newTemp >= 0 && newTemp <= 2) {
                config.temperature = newTemp;
                GM_setValue('temperature', config.temperature);
            }

            const newMaxTokens = parseInt(prompt('输出Token限制默认4k最大限制受模型所限V3最大8k R1最大64k:', config.maxTokens));
            if (!isNaN(newMaxTokens) && newMaxTokens > 0 && newMaxTokens <= 65535) {
                config.maxTokens = newMaxTokens;
                GM_setValue('maxTokens', config.maxTokens);
            }

            const newMaxContextTokens = parseInt(prompt('最大上下文限制64k默认32k(越大记忆越好):', config.maxContextTokens));
            if (!isNaN(newMaxContextTokens) && newMaxContextTokens > 0 && newMaxContextTokens <= 65535) {
                config.maxContextTokens = newMaxContextTokens;
                GM_setValue('maxContextTokens', newMaxContextTokens);
            }

            const newPersonalityPrompt = prompt('自定义人格提示词:根据个人需求修改(锐锐永远爱你!):', config.personalityPrompt);
            if (newPersonalityPrompt !== null) {
                config.personalityPrompt = newPersonalityPrompt;
                GM_setValue('personalityPrompt', config.personalityPrompt);
            }
        });

        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清空所有聊天记录吗？')) {
                config.chatHistory = [];
                GM_setValue('chatHistory', config.chatHistory);
                chatContent.innerHTML = '';
            }
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

            const MAX_LENGTH = 20000;
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
        async function sendMessage(message, retryCount = 0) {
            if (!message.trim()) return;

            if (!config.apiKey) {
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

            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'ds-chat-message ds-user-message';
            userMsgDiv.innerHTML = `<div class="ds-message-content">${renderMarkdown(message)}</div>`;
            chatContent.appendChild(userMsgDiv);

            const thinkingMsgDiv = document.createElement('div');
            thinkingMsgDiv.className = 'ds-chat-message ds-thinking';
            thinkingMsgDiv.innerText = '思考中...';
            chatContent.appendChild(thinkingMsgDiv);

            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'ds-chat-message ds-ai-message';
            chatContent.appendChild(aiMsgDiv);

            chatContent.scrollTop = chatContent.scrollHeight;

            const requestData = {
                model: config.model,
                messages: [
                    { role: 'system', content: config.personalityPrompt },
                    ...truncateContext(config.chatHistory, config.maxContextTokens)
                ],
                temperature: config.temperature,
                max_tokens: config.maxTokens,
                stream: true,
            };

            if (config.usePageContext) {
                const pageContent = getPageContent();
                requestData.messages.splice(1, 0, {
                    role: 'system',
                    content: `[当前网页全景信息]
${pageContent.content}

以下是AI渲染指南，请严格遵守：

1. 数学公式渲染：
   - 行内公式：使用 $e^{i\pi} + 1 = 0$
   - 块级公式：使用 $$\\int_{-\infty}^{\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

2. 表格渲染：
   - 使用标准Markdown表格语法
   - 示例：
     | 常数名称 | 符号 | 近似值 | 描述 |
     | :--- | :---: | :--- | :--- |
     | 圆周率 | π | 3.1415926535 | 圆的周长与直径之比 |
     | 自然常数 | e | 2.7182818284 | 自然对数的底数 |
     | 黄金分割率 | φ | 1.6180339887 | \\frac{1+\\sqrt{5}}{2} |

3. 增强渲染功能：
   - 标题：使用 # 到 ###### 创建渐变色标题
   - 列表：使用 -、*、+ 或数字创建列表
   - 任务列表：使用 - [ ] 和 - [x]
   - 内联代码：使用 \`code\` 包裹
   - 链接：[文本](URL)
   - 块引用：使用 > 开头
   - 水平线：使用 ---、*** 或 ___

4. 样式增强：
   - 重要文本：使用 **加粗** 或 *斜体*
   - 颜色渲染：使用内联CSS，如 <span style="color: #ff6b6b; font-weight: bold">红色加粗</span>
   - 渐变文本：标题自动应用渐变色
   - 代码块：深色背景+语言标识

5. 禁止使用：
   - 代码块渲染（使用内联代码代替）
   - 图表渲染（Mermaid等）

请根据用户问题，使用上述渲染方式组织回答，确保数学公式和表格正确显示。`
                });
            }

            try {
                return new Promise((resolve, reject) => {
                    let timeoutId = setTimeout(() => {
                        reject(new Error('请求超时'));
                    }, 30000);

                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: config.apiUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.apiKey}`,
                            'Accept': 'text/event-stream'
                        },
                        responseType: 'stream',
                        data: JSON.stringify(requestData),
                        onloadstart: (response) => {
                            try {
                                handleStreamResponse(response, aiMsgDiv)
                                    .then(resolve)
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
    }
})();