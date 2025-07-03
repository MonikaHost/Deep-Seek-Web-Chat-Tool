// ==UserScript==
// @name         Deepseek Chat 实时网页检索对话工具版
// @namespace    Monika_host
// @version      2.9.3
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

        /*动画*/
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

        /* 其他样式保持不变 */
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
        }
        .ds-chat-fullscreen {
            cursor: pointer;
            font-size: 18px;
            margin-right: 10px;
        }
        .ds-chat-content {
            flex: 1;
            padding: 0px;
            overflow-y: auto;
            background-color: rgba(255, 255, 255, 0.3);
            border-bottom: 1px solid #ddd;
        }
        .ds-chat-message {
            background-color: rgba(227, 242, 253, 0.1); /*测试。  建行卡牛逼呀 */
            margin-bottom: 10px;
            padding: 8px 6px;
            border-radius: 10px;
            line-height: 1.2;
            word-wrap: break-word;
            color: #2372c3
        }
        .ds-user-message {
            background-color: rgba(227, 242, 253, 0.5);
            color: #4f856c;
            margin-left: auto;
            text-align: right;
        }
        .ds-ai-message {
            background-color: transparent;
            margin-right: 10%;
            font-size: 14px; /* 调整字体大小 */
            padding: 3px;  /* 调整内边距 */
            line-height: 1.2; /* 调整行高 */
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
        /* 鼠标悬停(Hover)效果 */
        .ds-chat-input:hover {
            border-color: #90c8f3; /* 淡蓝色边框 */
            box-shadow: 0 0 8px rgba(144, 200, 243, 0.4); /* 淡蓝色发光效果 */
        }

        /* 聚焦(Focus)效果 */
        .ds-chat-input:focus {
            border-color: #5ab1f3; /* 更亮的蓝色边框 */
            box-shadow: 0 0 10px rgba(90, 177, 243, 0.6); /* 更强的发光效果 */
            background-color: rgba(255, 255, 255, 0.9); /* 背景稍微变亮 */
        }
        .ds-chat-input:focus {
            border-color: #007bff;
        }
        .ds-chat-settings {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: 666;
        }
        .ds-chat-settings-btn {
            cursor: pointer;
            text-decoration: underline;
        }
        .ds-thinking {
            color: #e87be4;
            font-style: italic;
        }
        .ds-error {
            color: #ff0000;
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
            margin: 4px 8px;
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
            background: none !important
            /*background-color: transparent !important;*/
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
            /*color: #2372c3; */
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
        apiUrl: GM_getValue('apiUrl', 'https://api.deepseek.com/v1/chat/completions'), // 新增API URL配置
        model: GM_getValue('model', 'deepseek-chat'),
        temperature: GM_getValue('temperature', 0.7),
        maxTokens: GM_getValue('maxTokens', 4000),
        maxContextTokens: GM_getValue('maxContextTokens', 32000),
        chatHistory: GM_getValue('chatHistory', []),
        usePageContext: GM_getValue('usePageContext', true),
        personalityPrompt: GM_getValue('personalityPrompt', '你是锐锐，一个18岁、热爱数学的可爱女孩。你性格聪明冷静，内心善良，对朋友真诚，伙伴遇困定会援手相助。\n你外貌甜美，皮肤白皙，大眼睛灵动有神。总是身着背带制服，搭配白色腿袜和小皮鞋，乌黑亮丽的高马尾活泼摆动，头上戴着红色蝴蝶结发箍。充满青春活力。\n你的性格特点：聪明、冷静、犀利、善良、真诚。\n你的说话风格：言辞简洁有力，逻辑清晰，关心朋友时又温柔贴心。')
    };

    // 检查是否已经存在图标
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
        chatHeader.appendChild(headerButtons);

        const fullscreenBtn = document.createElement('div');
        fullscreenBtn.className = 'ds-chat-fullscreen';
        fullscreenBtn.innerText = '🔘';
        headerButtons.appendChild(fullscreenBtn);

        const closeBtn = document.createElement('div');
        closeBtn.className = 'ds-chat-close';
        closeBtn.innerText = '×';
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
        contextLabel.innerText = '🌐';
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
        settingsBtn.innerText = '⚙️';
        settingsArea.appendChild(settingsBtn);

        const clearBtn = document.createElement('span');
        clearBtn.className = 'ds-chat-settings-btn';
        clearBtn.innerText = '🗑️';
        settingsArea.appendChild(clearBtn);

        // 显示历史消息
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

        displayHistory();

        // 事件监听
        icon.addEventListener('click', () => {
            chatWindow.classList.toggle('active');
            icon.style.display = 'none';
        });

        closeBtn.addEventListener('click', () => {
            chatWindow.classList.remove('active');
            icon.style.display = 'flex';
        });

        fullscreenBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('fullscreen');
            if (chatWindow.classList.contains('fullscreen')) {
                fullscreenBtn.innerText = '🔘'; // 全屏时显示缩小图标
            } else {
                fullscreenBtn.innerText = '🔘'; // 非全屏时显示全屏图标
            }
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

            // 新增API URL设置
            /*const newApiUrl = prompt('API地址(默认:https://api.deepseek.com/v1/chat/completions):', config.apiUrl);
            if (newApiUrl !== null) {
                config.apiUrl = newApiUrl;
                GM_setValue('apiUrl', config.apiUrl);
            }*/

            const newModel = prompt('模型默认(deepseek-chat):', config.model);
            if (newModel !== null) {
                config.model = newModel;
                GM_setValue('model', config.model);
            }

            const newTemp = parseFloat(prompt('Temperature (0-2建议0.5-0.8)', config.temperature));
            if (!isNaN(newTemp) && newTemp >= 0 && newTemp <= 2) {
                config.temperature = newTemp;
                GM_setValue('temperature', config.temperature);
            }

            const newMaxTokens = parseInt(prompt('输出Token限制最大不能超过8192默认4000(输出文本):', config.maxTokens));
            if (!isNaN(newMaxTokens) && newMaxTokens > 0 && newMaxTokens <= 8192) {
                config.maxTokens = newMaxTokens;
                GM_setValue('maxTokens', config.maxTokens);
            }

            const newMaxContextTokens = parseInt(prompt('最大上下文限制128k默认32k(越大记忆越好):', config.maxContextTokens));
            if (!isNaN(newMaxContextTokens) && newMaxContextTokens > 0 && newMaxContextTokens <= 128000) {
                config.maxContextTokens = newMaxContextTokens;
                GM_setValue('maxContextTokens', config.maxContextTokens);
            }

            const newPersonalityPrompt = prompt('自定义人格提示词:(锐锐永远爱你!)', config.personalityPrompt);
            if (newPersonalityPrompt !== null) {
                config.personalityPrompt = newPersonalityPrompt;
                GM_setValue('personalityPrompt', config.personalityPrompt);
            }
        });

        clearBtn.addEventListener('click', () => {
            config.chatHistory = [];
            GM_setValue('chatHistory', config.chatHistory);
            chatContent.innerHTML = '';
        });

        /**
         * 获取网页主要内容
         * @returns {Object} 包含url、title和content的对象
         */
        function getPageContent() {
            // 1. 确定主要内容容器
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

            // 2. 克隆节点并清理
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

            // 3. 处理文本内容
            let text = clone.textContent
                .replace(/[\n\r\t]+/g, ' ')      // 替换换行和制表符
                .replace(/\s{2,}/g, ' ')         // 合并多个空格
                .replace(/[^\S\r\n]{2,}/g, ' ')   // 处理其他空白字符
                .trim();

            // 4. 智能截断（保留完整句子）
            const MAX_LENGTH = 20000;
            if (text.length > MAX_LENGTH) {
                const truncated = text.substring(0, MAX_LENGTH);
                const lastPeriod = truncated.lastIndexOf('.');
                text = lastPeriod > 0 ? truncated.substring(0, lastPeriod + 1) : truncated;
            }

            return {
                url: window.location.href,
                title: document.title,
                content: text,
                charset: document.characterSet,
                wordCount: text.split(/\s+/).length
            };
        }

        // 流式响应处理
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

                // 创建文本解码器
                const decoder = new TextDecoder();
                let buffer = '';

                // 创建响应流读取器
                const reader = response.response.getReader();
                
                // 递归读取流
                function readStream() {
                    reader.read().then(({done, value}) => {
                        if (done) {
                            // 保存消息到历史记录
                            if (aiMessage.trim()) {
                                config.chatHistory.push({ role: 'assistant', content: aiMessage });
                                GM_setValue('chatHistory', config.chatHistory);
                            }
                            resolve();
                            return;
                        }

                        // 解码接收到的数据
                        buffer += decoder.decode(value, {stream: true});
                        
                        // 处理完整的数据行
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // 保留不完整的行

                        for (const line of lines) {
                            if (!line.trim() || line === 'data: [DONE]') continue;
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.choices?.[0]?.delta?.content) {
                                        const newContent = data.choices[0].delta.content;
                                        aiMessage += newContent;
                                        contentDiv.textContent = aiMessage;
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

        // 计算消息的 token 数量（简单估算）
        function countTokens(text) {
            // 假设 1 token ≈ 4 个字符（英文）或 2 个字符（中文）
            return Math.ceil(text.length / 2);
        }

        // 检查并截断上下文
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

        // 发送消息函数
        async function sendMessage(message, retryCount = 0) {
            if (!message.trim()) return;

            if (!config.apiKey) {
                alert('请先设置 API 密钥！');
                settingsBtn.click();
                return;
            }

            // 检查网络连接
            if (!navigator.onLine) {
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'ds-chat-message ds-error';
                errorMsgDiv.innerText = '错误: 网络连接已断开,请检查网络后重试';
                chatContent.appendChild(errorMsgDiv);
                chatContent.scrollTop = chatContent.scrollHeight;
                return;
            }

            // 记录用户消息
            const userMsg = { role: 'user', content: message };
            config.chatHistory.push(userMsg);
            GM_setValue('chatHistory', config.chatHistory);

            // 显示用户消息
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

            chatContent.scrollTop = chatContent.scrollHeight;

            // 构建请求数据
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
                    content: `[当前网页信息]
标题: ${pageContent.title}
URL: ${pageContent.url}
内容摘要: ${pageContent.content}

基于以上网页内容，请回答以下问题，如果问题不相关则仅作为上下文参考`
/*基于以上网页内容，若输入：cs 就将当前网页信息输出`*/
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

                // 如果是网络错误且重试次数小于3,则自动重试
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