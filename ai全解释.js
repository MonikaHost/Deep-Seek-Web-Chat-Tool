// ==UserScript==
// @name         Deepseek Chat 实时网页检索对话工具版
// @namespace    Monika_host
// @version      2.9.1
// @description  支持流式响应、历史记录、参数设置和网页内容检索
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
// ==/UserScript==

/**
 * Deepseek Chat 实时网页检索对话工具
 * 
 * 这是一个用户脚本，提供浏览器中与Deepseek API交互的聊天界面
 * 主要功能:
 * - 在任意网页右下角显示聊天图标
 * - 支持与Deepseek API的流式交互
 * - 可检索当前网页内容作为上下文
 * - 保存聊天历史并支持清除
 * - 支持自定义API密钥和URL
 * - 可自定义人格设置
 * - 支持全屏切换
 */
(function() {
    'use strict';

    // 添加CSS样式
    GM_addStyle(`
        /* 定义淡入淡出的动画 */
        @keyframes fadeInOut {
            0% {
                opacity: 0;
            }
            100% {
                opacity: 1;
            }
        }

        /* 图标动画效果 */
        .ds-chat-icon img {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            transition: all 0.3s ease;
            animation: breath 2s infinite alternate;
        }

        /* 图标悬停效果 */
        .ds-chat-icon:hover img {
            transform: scale(1.1);
            filter: drop-shadow(0 0 8px rgba(0, 123, 255, 0.6));
            animation: pulse 0.5s infinite alternate;
        }

        /* 呼吸动画效果 */
        @keyframes breath {
            0% { opacity: 0.9; }
            100% { opacity: 1; }
        }

        /* 脉冲动画效果 */
        @keyframes pulse {
            0% { transform: scale(1); }
            100% { transform: scale(1.15); }
        }

        /* 对话框出现时的动画 */
        .ds-chat-window {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 340px;
            /*height: 50vh*/
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
            animation: fadeInOut 0.5s ease-in-out forwards; /* 添加淡入动画 */
            transition: all 1s ease-in-out; /* 添加过渡效果 */
        }

        /* 对话框激活时的样式 */
        .ds-chat-window.active {
            display: flex;
            opacity: 1;
            transform: translateY(0);
        }

        /* 全屏时的动画 */
        .ds-chat-window.fullscreen {
            width: 100% !important;
            /*height: 100vh !important;*/
            /*wheight: 100vh !important;*/
            max-width: 100vw !important;
            max-height: 100vh !important;
            bottom: 0 !important;
            right: 0 !important;
            border-radius: 0 !important;
            animation: fadeInOut 1.2s ease-in-out forwards; /* 添加淡入动画 */
        }

        /* 聊天图标样式 */
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
        /* 聊天图标悬停效果 */
        .ds-chat-icon:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.3);
            background-color: rgba(0, 123, 255, 0.6);
        }
        /* 聊天窗口头部样式 */
        .ds-chat-header {
            padding: 10px 15px;
            background-color: rgba(0, 123, 255, 0.3);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 15px 15px 0 0;
        }
        /* 聊天标题样式 */
        .ds-chat-title {
            font-weight: bold;
            color: #2372c3;
        }
        /* 关闭按钮样式 */
        .ds-chat-close {
            cursor: pointer;
            font-size: 18px;
            color: #ff6666;
        }
        /* 全屏按钮样式 */
        .ds-chat-fullscreen {
            cursor: pointer;
            font-size: 18px;
            margin-right: 10px;
        }
        /* 聊天内容区域样式 */
        .ds-chat-content {
            flex: 1;
            padding: 0px;
            overflow-y: auto;
            background-color: rgba(255, 255, 255, 0.3);
            border-bottom: 1px solid #ddd;
        }
        /* 聊天消息通用样式 */
        .ds-chat-message {
            background-color: rgba(227, 242, 253, 0.1);
            margin-bottom: 10px;
            padding: 8px 6px;
            border-radius: 10px;
            line-height: 1.2;
            word-wrap: break-word;
            color: #2372c3
        }
        /* 用户消息样式 */
        .ds-user-message {
            background-color: rgba(227, 242, 253, 0.5);
            color: #4f856c;
            margin-left: auto;
            text-align: right;
        }
        /* AI消息样式 */
        .ds-ai-message {
            background-color: transparent;
            margin-right: 10%;
            font-size: 14px; /* 调整字体大小 */
            padding: 3px;  /* 调整内边距 */
            line-height: 1.2; /* 调整行高 */
            color: #2372c3;
        }
        /* 输入区域样式 */
        .ds-chat-input-area {
            padding: 10px;
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(10px);
            background-color: rgba(255, 255, 255, 0.3);
            border-top: 1px solid rgba(221, 221, 221, 0.5);
        }
        /* 输入框样式 */
        .ds-chat-input {
            width: 100%;
            padding: 180px;
            border: 0px solid #dd45;
            border-radius: 8px;
            margin-bottom: 8px;
            outline: none;
            transition: border-color 0.3s;
            font-size: 15px;
            color: #3e6854;
            border-color: #3e6854;
            background-color: rgba(255, 255, 255, 0.8);
            box-sizing: border-box;
        }
        /* 输入框悬停效果 */
        .ds-chat-input:hover {
            border-color: #90c8f3; /* 淡蓝色边框 */
            box-shadow: 0 0 8px rgba(144, 200, 243, 0.4); /* 淡蓝色发光效果 */
        }

        /* 输入框聚焦效果 */
        .ds-chat-input:focus {
            border-color: #5ab1f3; /* 更亮的蓝色边框 */
            box-shadow: 0 0 10px rgba(90, 177, 243, 0.6); /* 更强的发光效果 */
            background-color: rgba(255, 255, 255, 0.9); /* 背景稍微变亮 */
        }
        /* 输入框聚焦边框颜色 */
        .ds-chat-input:focus {
            border-color: #007bff;
        }
        /* 设置区域样式 */
        .ds-chat-settings {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: 666;
        }
        /* 设置按钮样式 */
        .ds-chat-settings-btn {
            cursor: pointer;
            text-decoration: underline;
        }
        /* 思考中提示样式 */
        .ds-thinking {
            color: #e87be4;
            font-style: italic;
        }
        /* 错误消息样式 */
        .ds-error {
            color: #ff0000;
        }
        /* 上下文切换区域样式 */
        .ds-context-toggle {
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            font-size: 12px;
        }
        /* 上下文切换复选框样式 */
        .ds-context-toggle input {
            margin-right: 5px;
        }
        /* 上下文概要样式 */
        .ds-context-summary {
            font-size: 11px;
            color: #666;
            margin-top: 5px;
            font-style: italic;
        }
        /* 确保消息文本正确展示 */
        .ds-chat-message {
            white-space: pre-wrap;
            word-break: break-word;
            visibility: visible !important;
            display: block !important;
            opacity: 1 !important;
        }
        /* AI消息样式增强 */
        .ds-ai-message {
            font-size: 14px;
            line-height: 1.5;
            padding: 8px 12px;
            margin: 4px 8px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            color: #2372c3 !important;
        }
        /* 消息内容样式 */
        .ds-message-content {
            font-size: 14px !important;
            line-height: 1.5 !important;
            color: #2372c3 !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            min-height: 1em;
            background: none !important
            /*background-color: transparent !important;*/
            background-color: transparent !important;
            background-image: none !important;
            text-shadow: none !important;
        }
        /* 文本闪烁动画 */
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }

        /* 消息内容末尾闪烁光标 */
        .ds-message-content::after {
            content: '|';
            position: relative;
            display: inline;
            color: transparent !important;
            /*color: #2372c3; */
            animation: blink 1s infinite;
            margin-left: 2px;
        }

        /* 隐藏非空消息的光标 */
        .ds-message-content:not(:empty)::after {
            display: none;
        }
    `);

    // 初始化配置
    let config = {
        apiKey: GM_getValue('apiKey', ''),                                              // API密钥，从GM存储获取，默认为空
        apiUrl: GM_getValue('apiUrl', 'https://api.deepseek.com/v1/chat/completions'),  // API URL，默认为Deepseek官方接口
        model: GM_getValue('model', 'deepseek-chat'),                                   // 模型名称，默认为deepseek-chat
        temperature: GM_getValue('temperature', 0.7),                                   // 温度参数，控制生成的随机性，默认0.7
        maxTokens: GM_getValue('maxTokens', 4000),                                      // 最大输出token数，默认4000
        maxContextTokens: GM_getValue('maxContextTokens', 32000),                       // 最大上下文token数，默认32000
        chatHistory: GM_getValue('chatHistory', []),                                    // 聊天历史记录，默认为空数组
        usePageContext: GM_getValue('usePageContext', true),                            // 是否使用页面内容作为上下文，默认启用
        personalityPrompt: GM_getValue('personalityPrompt', '你是锐锐，一个18岁、热爱数学的可爱女孩。你性格聪明冷静，内心善良，对朋友真诚，伙伴遇困定会援手相助。\n你外貌甜美，皮肤白皙，大眼睛灵动有神。总是身着背带制服，搭配白色腿袜和小皮鞋，乌黑亮丽的高马尾活泼摆动，头上戴着红色蝴蝶结发箍。充满青春活力。\n你的性格特点：聪明、冷静、犀利、善良、真诚。\n你的说话风格：言辞简洁有力，逻辑清晰，关心朋友时又温柔贴心。') // 人格提示词，默认为"锐锐"角色设定
    };

    // 检查是否已经存在图标，避免重复添加UI元素
    if (!document.querySelector('.ds-chat-icon')) {
        // 创建UI元素 - 只在body元素下添加
        const icon = document.createElement('div');
        icon.className = 'ds-chat-icon';
        icon.innerHTML = `<img src="${GM_getResourceURL('icon')}" style="width: 30px; height: 30px; border-radius: 50%;">`;
        
        // 确保只添加到body元素，而不是其他元素
        document.body.appendChild(icon);

        // 确保图标位置固定在右下角5px处
        icon.style.position = 'fixed';
        icon.style.bottom = '5px';
        icon.style.right = '5px';
        icon.style.zIndex = '2147483647';
        icon.style.display = 'flex'; // 确保图标默认显示

        // 创建聊天窗口
        const chatWindow = document.createElement('div');
        chatWindow.className = 'ds-chat-window';
        document.body.appendChild(chatWindow);

        // 创建聊天窗口头部
        const chatHeader = document.createElement('div');
        chatHeader.className = 'ds-chat-header';
        chatWindow.appendChild(chatHeader);

        // 创建聊天标题
        const chatTitle = document.createElement('div');
        chatTitle.className = 'ds-chat-title';
        chatTitle.innerText = 'Deepseek Chat';
        chatHeader.appendChild(chatTitle);

        // 创建头部按钮容器
        const headerButtons = document.createElement('div');
        headerButtons.style.display = 'flex';
        headerButtons.style.alignItems = 'center';
        chatHeader.appendChild(headerButtons);

        // 创建全屏按钮
        const fullscreenBtn = document.createElement('div');
        fullscreenBtn.className = 'ds-chat-fullscreen';
        fullscreenBtn.innerText = '🔘';
        headerButtons.appendChild(fullscreenBtn);

        // 创建关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.className = 'ds-chat-close';
        closeBtn.innerText = '×';
        headerButtons.appendChild(closeBtn);

        // 创建聊天内容区域
        const chatContent = document.createElement('div');
        chatContent.className = 'ds-chat-content';
        chatWindow.appendChild(chatContent);

        // 创建输入区域
        const inputArea = document.createElement('div');
        inputArea.className = 'ds-chat-input-area';
        chatWindow.appendChild(inputArea);

        // 创建上下文切换区域
        const contextToggle = document.createElement('div');
        contextToggle.className = 'ds-context-toggle';
        inputArea.appendChild(contextToggle);

        // 创建上下文切换复选框
        const contextCheckbox = document.createElement('input');
        contextCheckbox.type = 'checkbox';
        contextCheckbox.id = 'ds-context-checkbox';
        contextCheckbox.checked = config.usePageContext;
        contextToggle.appendChild(contextCheckbox);

        // 创建上下文切换标签
        const contextLabel = document.createElement('label');
        contextLabel.htmlFor = 'ds-context-checkbox';
        contextLabel.innerText = '🌐';
        contextToggle.appendChild(contextLabel);

        // 创建输入框
        const inputBox = document.createElement('textarea');
        inputBox.className = 'ds-chat-input';
        inputBox.placeholder = '输入你的问题...';
        inputBox.rows = 2;
        inputBox.style.padding = '8px 10px';
        inputArea.appendChild(inputBox);

        // 创建设置区域
        const settingsArea = document.createElement('div');
        settingsArea.className = 'ds-chat-settings';
        inputArea.appendChild(settingsArea);

        // 创建设置按钮
        const settingsBtn = document.createElement('span');
        settingsBtn.className = 'ds-chat-settings-btn';
        settingsBtn.innerText = '⚙️';
        settingsArea.appendChild(settingsBtn);

        // 创建清除按钮
        const clearBtn = document.createElement('span');
        clearBtn.className = 'ds-chat-settings-btn';
        clearBtn.innerText = '🗑️';
        settingsArea.appendChild(clearBtn);

        // 显示历史消息函数 - 加载聊天历史记录到UI
        function displayHistory() {
            chatContent.innerHTML = '';
            config.chatHistory.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `ds-chat-message ds-${msg.role}-message`;
                msgDiv.innerText = msg.content;
                chatContent.appendChild(msgDiv);
            });
            chatContent.scrollTop = chatContent.scrollHeight;
        }

        // 显示初始历史记录
        displayHistory();

        // 事件监听器设置
        
        // 点击图标显示聊天窗口
        icon.addEventListener('click', () => {
            chatWindow.classList.toggle('active');
            icon.style.display = 'none';
        });

        // 点击关闭按钮隐藏聊天窗口
        closeBtn.addEventListener('click', () => {
            chatWindow.classList.remove('active');
            icon.style.display = 'flex';
        });

        // 点击全屏按钮切换全屏模式
        fullscreenBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('fullscreen');
            if (chatWindow.classList.contains('fullscreen')) {
                fullscreenBtn.innerText = '🔘'; // 全屏时显示缩小图标
            } else {
                fullscreenBtn.innerText = '🔘'; // 非全屏时显示全屏图标
            }
        });

        // 上下文开关状态变更处理
        contextCheckbox.addEventListener('change', () => {
            config.usePageContext = contextCheckbox.checked;
            GM_setValue('usePageContext', config.usePageContext);
        });

        // 设置按钮点击处理 - 打开设置对话框
        settingsBtn.addEventListener('click', () => {
					  // 获取并设置API URL
					  const newApiUrl = prompt('API地址(默认:https://api.deepseek.com/v1/chat/completions):', config.apiUrl);
            if (newApiUrl !== null) {
                config.apiUrl = newApiUrl;
                GM_setValue('apiUrl', config.apiUrl);
            }
            
            // 获取并设置API密钥
            const newApiKey = prompt('API密钥:', config.apiKey);
            if (newApiKey !== null) {
                config.apiKey = newApiKey;
                GM_setValue('apiKey', config.apiKey);
            }

            // 获取并设置模型名称
            const newModel = prompt('模型默认(deepseek-chat):', config.model);
            if (newModel !== null) {
                config.model = newModel;
                GM_setValue('model', config.model);
            }

            // 获取并设置温度参数
            const newTemp = parseFloat(prompt('Temperature (0-2建议0.5-0.8)', config.temperature));
            if (!isNaN(newTemp) && newTemp >= 0 && newTemp <= 2) {
                config.temperature = newTemp;
                GM_setValue('temperature', config.temperature);
            }

            // 获取并设置最大输出token数
            const newMaxTokens = parseInt(prompt('输出Token限制最大不能超过8192默认4000(输出文本):', config.maxTokens));
            if (!isNaN(newMaxTokens) && newMaxTokens > 0 && newMaxTokens <= 8192) {
                config.maxTokens = newMaxTokens;
                GM_setValue('maxTokens', config.maxTokens);
            }

            // 获取并设置最大上下文token数
            const newMaxContextTokens = parseInt(prompt('最大上下文限制128k默认32k(越大记忆越好):', config.maxContextTokens));
            if (!isNaN(newMaxContextTokens) && newMaxContextTokens > 0 && newMaxContextTokens <= 128000) {
                config.maxContextTokens = newMaxContextTokens;
                GM_setValue('maxContextTokens', config.maxContextTokens);
            }

            // 获取并设置人格提示词
            const newPersonalityPrompt = prompt('自定义人格提示词:(锐锐永远爱你!)', config.personalityPrompt);
            if (newPersonalityPrompt !== null) {
                config.personalityPrompt = newPersonalityPrompt;
                GM_setValue('personalityPrompt', config.personalityPrompt);
            }
        });

        // 清除按钮点击处理 - 清空聊天历史
        clearBtn.addEventListener('click', () => {
            config.chatHistory = [];
            GM_setValue('chatHistory', config.chatHistory);
            chatContent.innerHTML = '';
        });

        /**
         * 获取网页主要内容
         * 此函数提取当前网页的重要文本内容作为AI对话的上下文
         * 它会识别主要内容区域，过滤掉导航、广告等不相关元素
         * 并对文本进行处理和智能截断，确保不超过最大长度
         * 
         * @returns {Object} 包含url、title和content的对象
         */
        function getPageContent() {
            // 1. 确定主要内容容器 - 按优先级尝试不同的选择器
            const mainSelectors = [
                'main',
                'article',
                '.main-content',
                '.article',
                '.post',
                '.content',
                '#content',
                '.entry-content'
            ];

            let mainContent = document.body;
            for (const selector of mainSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    mainContent = el;
                    break;
                }
            }

            // 2. 克隆节点并清理 - 移除不相关的元素
            const clone = mainContent.cloneNode(true);
            const elementsToRemove = clone.querySelectorAll(`
                script, style, noscript, iframe,
                nav, footer, header, aside,
                .sidebar, .ad, .ads, .advertisement,
                .social-share, .comments, .related-posts,
                [role="navigation"], [role="banner"],
                [aria-hidden="true"], .hidden, .d-none,
                img, video, audio, svg, canvas
            `);

            elementsToRemove.forEach(el => el.remove());

            // 3. 处理文本内容 - 清理格式和空白
            let text = clone.textContent
                .replace(/[\n\r\t]+/g, ' ')      // 替换换行和制表符
                .replace(/\s{2,}/g, ' ')         // 合并多个空格
                .replace(/[^\S\r\n]{2,}/g, ' ')   // 处理其他空白字符
                .trim();

            // 4. 智能截断 - 确保不超过最大长度并在句子结束处截断
            const MAX_LENGTH = 20000;
            if (text.length > MAX_LENGTH) {
                const truncated = text.substring(0, MAX_LENGTH);
                const lastPeriod = truncated.lastIndexOf('.');
                text = lastPeriod > 0 ? truncated.substring(0, lastPeriod + 1) : truncated;
            }

            // 返回网页信息对象
            return {
                url: window.location.href,
                title: document.title,
                content: text,
                charset: document.characterSet,
                wordCount: text.split(/\s+/).length
            };
        }

        /**
         * 处理API的流式响应
         * 此函数解析来自Deepseek API的流式响应，并实时更新UI显示
         * 支持逐字显示（打字效果）
         * 
         * @param {Object} response - GM_xmlhttpRequest返回的响应对象
         * @param {HTMLElement} aiMsgDiv - 显示AI回复的DOM元素
         * @returns {Promise} 处理完成的Promise
         */
        function handleStreamResponse(response, aiMsgDiv) {
            return new Promise((resolve, reject) => {
                let aiMessage = '';

                // 移除"思考中..."提示
                const thinkingMsg = document.querySelector('.ds-thinking');
                if (thinkingMsg && thinkingMsg.parentNode) {
                    thinkingMsg.parentNode.removeChild(thinkingMsg);
                }

                // 确保消息容器结构正确
                aiMsgDiv.innerHTML = '';
                const contentDiv = document.createElement('div');
                contentDiv.className = 'ds-message-content';
                aiMsgDiv.appendChild(contentDiv);

                // 创建文本解码器 - 用于解析流数据
                const decoder = new TextDecoder();
                let buffer = '';

                // 创建响应流读取器
                const reader = response.response.getReader();
                
                /**
                 * 递归读取流数据
                 * 处理API返回的流式响应，并更新UI
                 */
                function readStream() {
                    reader.read().then(({done, value}) => {
                        if (done) {
                            // 流结束，保存消息到历史记录
                            if (aiMessage.trim()) {
                                config.chatHistory.push({ role: 'assistant', content: aiMessage });
                                GM_setValue('chatHistory', config.chatHistory);
                            }
                            resolve();
                            return;
                        }

                        // 解码接收到的数据块
                        buffer += decoder.decode(value, {stream: true});
                        
                        // 处理完整的数据行
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // 保留不完整的行用于下次处理

                        // 逐行处理数据
                        for (const line of lines) {
                            if (!line.trim() || line === 'data: [DONE]') continue;
                            if (line.startsWith('data: ')) {
                                try {
                                    // 解析JSON数据
                                    const data = JSON.parse(line.slice(6));
                                    if (data.choices?.[0]?.delta?.content) {
                                        // 获取并显示新内容
                                        const newContent = data.choices[0].delta.content;
                                        aiMessage += newContent;
                                        contentDiv.textContent = aiMessage;
                                        // 保持滚动到最新消息
                                        chatContent.scrollTop = chatContent.scrollHeight;
                                    }
                                } catch (e) {
                                    console.warn('解析响应数据失败:', e);
                                }
                            }
                        }

                        // 继续读取流
                        readStream();
                    }).catch(error => {
                        reject(error);
                    });
                }

                // 开始读取流
                readStream();
            });
        }

        /**
         * 估算文本的token数量
         * 简单估算方法，以字符数为基础
         * 假设平均每个中文字符约等于2个token，英文单词约等于1个token
         * 
         * @param {string} text - 要计算token数的文本
         * @returns {number} 估算的token数量
         */
        function countTokens(text) {
            // 假设 1 token ≈ 4 个字符（英文）或 2 个字符（中文）
            return Math.ceil(text.length / 2);
        }

        /**
         * 截断上下文以符合模型的最大上下文限制
         * 从最新消息开始保留，如果总token数超过限制，则删除最早的消息
         * 
         * @param {Array} messages - 消息数组
         * @param {number} maxContextTokens - 最大上下文token数限制
         * @returns {Array} 截断后的消息数组
         */
        function truncateContext(messages, maxContextTokens) {
            let totalTokens = 0;
            // 从最新消息开始计算
            for (let i = messages.length - 1; i >= 0; i--) {
                const messageTokens = countTokens(messages[i].content);
                if (totalTokens + messageTokens > maxContextTokens) {
                    // 如果超出限制，删除最早的消息
                    messages.splice(0, i);
                    break;
                }
                totalTokens += messageTokens;
            }
            return messages;
        }

        /**
         * 发送消息至Deepseek API并处理响应
         * 支持错误处理和自动重试
         * 
         * @param {string} message - 用户输入的消息
         * @param {number} retryCount - 当前重试次数，默认为0
         * @returns {Promise} 发送结果Promise
         */
        async function sendMessage(message, retryCount = 0) {
            if (!message.trim()) return;

            // 检查API密钥是否已设置
            if (!config.apiKey) {
                alert('请先设置 API 密钥！');
                settingsBtn.click();
                return;
            }

            // 检查网络连接状态
            if (!navigator.onLine) {
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'ds-chat-message ds-error';
                errorMsgDiv.innerText = '错误: 网络连接已断开,请检查网络后重试';
                chatContent.appendChild(errorMsgDiv);
                chatContent.scrollTop = chatContent.scrollHeight;
                return;
            }

            // 记录用户消息到历史记录
            const userMsg = { role: 'user', content: message };
            config.chatHistory.push(userMsg);
            GM_setValue('chatHistory', config.chatHistory);

            // 显示用户消息到UI
            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'ds-chat-message ds-user-message';
            userMsgDiv.innerText = message;
            chatContent.appendChild(userMsgDiv);

            // 显示"思考中..."提示
            const thinkingMsgDiv = document.createElement('div');
            thinkingMsgDiv.className = 'ds-chat-message ds-thinking';
            thinkingMsgDiv.innerText = '思考中...';
            chatContent.appendChild(thinkingMsgDiv);

            // 创建AI消息容器
            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'ds-chat-message ds-ai-message';
            chatContent.appendChild(aiMsgDiv);

            // 滚动到最新消息
            chatContent.scrollTop = chatContent.scrollHeight;

            // 构建API请求数据
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

            // 如果启用了网页上下文，添加当前网页内容
            if (config.usePageContext) {
                const pageContent = getPageContent();
                requestData.messages.splice(1, 0, {
                    role: 'system',
                    content: `[当前网页信息]
标题: ${pageContent.title}
URL: ${pageContent.url}
内容摘要: ${pageContent.content}

基于以上网页内容，请回答以下问题，如果问题不相关则仅作为上下文参考`
/*基于以上网页内容，若输入：cs 就将当前网页信息输出`*/
                });
            }

            // 发送请求并处理响应/错误
            try {
                return new Promise((resolve, reject) => {
                    // 设置请求超时
                    let timeoutId = setTimeout(() => {
                        reject(new Error('请求超时'));
                    }, 30000);

                    // 使用GM_xmlhttpRequest发送请求
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
                                // 处理流式响应
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
                // 移除思考中提示
                if (thinkingMsgDiv.parentNode) {
                    chatContent.removeChild(thinkingMsgDiv);
                }
                
                // 根据错误类型生成用户友好的错误消息
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

                // 显示错误消息
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'ds-chat-message ds-error';
                errorMsgDiv.innerText = errorMessage;
                chatContent.appendChild(errorMsgDiv);
                chatContent.scrollTop = chatContent.scrollHeight;

                // 如果是网络错误且重试次数小于3,则自动重试
                if ((error.message.includes('Failed to fetch') || error.message.includes('请求失败') || error.message.includes('timeout')) && retryCount < 3) {
                    const retryMsgDiv = document.createElement('div');
                    retryMsgDiv.className = 'ds-chat-message ds-thinking';
                    retryMsgDiv.innerText = `连接失败,正在第${retryCount + 1}次重试...`;
                    chatContent.appendChild(retryMsgDiv);
                    
                    // 2秒后重试
                    setTimeout(() => {
                        chatContent.removeChild(retryMsgDiv);
                        return sendMessage(message, retryCount + 1);
                    }, 2000);
                }
            }
        }

        // 输入框事件 - 按Enter发送消息
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

        // 注册脚本菜单命令 - 添加到浏览器右键菜单
        GM_registerMenuCommand("设置DeepSeek API", () => settingsBtn.click());
        GM_registerMenuCommand("清空聊天历史", () => clearBtn.click());
        GM_registerMenuCommand("切换网页上下文", () => {
            contextCheckbox.checked = !contextCheckbox.checked;
            config.usePageContext = contextCheckbox.checked;
            GM_setValue('usePageContext', config.usePageContext);
        });
    }
})();