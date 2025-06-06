# Deepseek Chat 实时网页检索对话工具
`Deepseek Chat 实时网页检索对话工具` 是一款基于 DeepSeek API 的浏览器用户脚本，能够在任何网页上提供一个智能聊天助手。它支持流式响应、历史记录保存、参数设置和网页内容检索功能。
## 主要功能
✅ **实时网页内容分析** - 可以读取当前网页内容作为上下文  
✅ **流式响应** - 体验流畅的对话交互  
✅ **历史记录保存** - 自动保存聊天记录  
✅ **参数可配置** - 可自定义模型、温度等参数  
✅ **多场景适用** - 适用于各种网页环境  
✅ **美观UI** - 简洁现代的交互界面  
## 使用说明
1. **安装脚本**  
   - 需要安装 Tampermonkey 或 Violentmonkey 等用户脚本管理器
   - 安装此脚本后会自动在浏览器右下角显示悬浮图标
2. **基本使用**  
   - 点击右下角悬浮图标打开聊天窗口
   - 在输入框中输入问题，按Enter发送
   - 勾选"🌐"图标可启用/禁用网页上下文功能
3. **设置选项**  
   - 点击"⚙️"按钮可配置:
     - API密钥 (必填)
     - 模型选择 (默认为deepseek-chat)
     - Temperature参数 (0-2，建议0.5-0.8)
     - Token限制 (输出文本长度)
     - 上下文Token限制 (记忆长度)
     - 人格提示词 (自定义AI角色)
4. **其他功能**  
   - 点击"🗑️"清除聊天历史
   - 点击"🔘"切换全屏模式
   - 右键悬浮图标可快速访问常用设置
## Deep Seek API获取方式
1. **访问官方网站**  
   前往 [**Deep Seek 官网**](https://deepseek.com)
2. **注册/登录账号**  
   - 新用户需要注册账号
   - 已有账号直接登录
3. **获取API Key**  
   - 进入"API管理"
   - 创建新的API Key
   - 复制生成的密钥字符串
4. **设置到脚本中**  
   - 在聊天窗口中点击"⚙️"按钮
   - 在API密钥输入框中粘贴您的密钥
   - 保存设置即可开始使用
## 技术参数
- 支持模型: deepseek-chat 等
- 最大上下文: 128K tokens(可配置)
- 输出限制: 8192 tokens (可配置)
- 流式传输: 支持
## 注意事项
1. 请妥善保管您的API密钥
2. 长时间对话可能消耗较多tokens
3. 网页内容分析功能可能不适用于所有网站
4. 建议设置合理的token限制以避免超额

 ![IMG_3016.png](data/attachment/forum/202504/10/154445vlli4omi5dmvnzvk.png)
希望这款工具能提升您的网页浏览和知识获取体验！如有问题，欢迎反馈。