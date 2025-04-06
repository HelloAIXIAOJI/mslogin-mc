# MsLogin-MC

微软登录模块，专为Minecraft启动器设计。这个模块封装了完整的微软登录流程，包括获取授权URL、处理身份验证回调、刷新令牌等功能。

## 功能特点

- 完整支持微软账户登录
- 支持令牌刷新
- 令牌验证
- 检查Minecraft游戏所有权
- 错误处理和状态通知
- 获取用户资料、皮肤和披风信息

## 安装

### 通过npm安装（推荐）

```bash
npm install mslogin-mc
```

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/HelloAIXIAOJI/mslogin-mc.git

# 进入项目目录
cd mslogin-mc

# 安装依赖
npm install
```

## 前提条件

1. 需要在Microsoft Azure门户注册一个应用程序以获取`clientId`
2. 请参考[这里的指南](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
3. 确保您的应用配置了正确的重定向URI：`https://login.microsoftonline.com/common/oauth2/nativeclient`

## 使用方法

### 初始化

```javascript
const MicrosoftAuthProvider = require('mslogin-mc');

// 创建一个认证提供者实例
const msAuth = new MicrosoftAuthProvider({
    clientId: 'YOUR_AZURE_CLIENT_ID', // 替换为您的Azure应用客户端ID
});

// 监听错误
msAuth.on('error', (error) => {
    console.error('登录出错:', error);
});
```

### 获取授权URL

```javascript
const authUrl = msAuth.getAuthorizationUrl();
// 可以让用户在浏览器中打开此URL
```

### 完整登录流程示例（Electron）

```javascript
const { BrowserWindow } = require('electron');

async function startMicrosoftLogin() {
    // 创建登录窗口
    const authWindow = new BrowserWindow({
        width: 520,
        height: 600,
        backgroundColor: '#222222',
        frame: true
    });
  
    // 获取授权URL
    const authUrl = msAuth.getAuthorizationUrl();
  
    // 记录成功状态
    let authSuccess = false;
  
    // 加载授权URL
    authWindow.loadURL(authUrl);
  
    // 处理授权回调
    return new Promise((resolve, reject) => {
        authWindow.webContents.on('did-navigate', async (_, uri) => {
            // 检查是否为回调URL
            if (uri.startsWith('https://login.microsoftonline.com/common/oauth2/nativeclient')) {
                // 解析URL中的授权码
                const queryString = uri.substring(uri.indexOf('?') + 1);
                const params = new URLSearchParams(queryString);
                const authCode = params.get('code');
              
                if (authCode) {
                    authSuccess = true;
                  
                    try {
                        // 完成登录流程
                        const userData = await msAuth.completeLogin(authCode);
                        // 关闭窗口
                        authWindow.close();
                      
                        resolve(userData);
                    } catch (error) {
                        authWindow.close();
                        reject(error);
                    }
                } else if (params.get('error')) {
                    authSuccess = true;
                    authWindow.close();
                    reject(new Error(`授权错误: ${params.get('error')} - ${params.get('error_description')}`));
                }
            }
        });
      
        // 处理窗口关闭
        authWindow.on('closed', () => {
            if (!authSuccess) {
                reject(new Error('用户取消登录'));
            }
        });
    });
}

// 使用示例
startMicrosoftLogin()
    .then(userData => {
        console.log('登录成功', userData);
        // 存储用户信息和令牌
    })
    .catch(error => {
        console.error('登录失败', error);
    });
```

### 刷新令牌

```javascript
// 假设已经存储了refreshToken
async function refreshTokens(refreshToken) {
    try {
        const newTokens = await msAuth.refreshTokens(refreshToken);
        console.log('令牌已刷新', newTokens);
        // 存储新的令牌
        return newTokens;
    } catch (error) {
        console.error('刷新令牌失败', error);
        // 处理错误，可能需要重新登录
        throw error;
    }
}
```

### 验证令牌

```javascript
async function isTokenValid(minecraftAccessToken) {
    const isValid = await msAuth.validateMinecraftToken(minecraftAccessToken);
    return isValid;
}
```

### 检查游戏所有权

```javascript
async function hasMinecraft(minecraftAccessToken) {
    const ownsGame = await msAuth.checkGameOwnership(minecraftAccessToken);
    return ownsGame;
}
```

## 返回数据结构

成功登录后的返回数据结构示例：

```javascript
{
    microsoft: {
        access_token: 'eyJ0...',  // Microsoft访问令牌
        refresh_token: 'M.R3...',  // Microsoft刷新令牌
        expires_at: 1609459200000  // 过期时间戳
    },
    minecraft: {
        access_token: 'eyJhb...',  // Minecraft访问令牌
        expires_at: 1609459200000  // 过期时间戳
    },
    profile: {
        id: '12345678-1234-1234-1234-123456789012',  // Minecraft UUID
        name: 'PlayerName',  // 玩家名称
        skins: [  // 皮肤信息
            {
                id: 'skin_id',
                state: 'ACTIVE',
                url: 'http://textures.minecraft.net/texture/...',
                variant: 'CLASSIC'
            }
        ],
        capes: []  // 披风信息
    },
    user: {
        username: 'PlayerName',  // 玩家名称
        uuid: '12345678-1234-1234-1234-123456789012',  // Minecraft UUID
        type: 'microsoft'  // 账户类型
    }
}
```

## 错误处理

该模块定义了以下错误代码：

```javascript
const ErrorCode = {
    UNKNOWN: 'unknown_error',
    USER_CANCELLED: 'user_cancelled',
    ACCESS_DENIED: 'access_denied',
    SERVER_ERROR: 'server_error',
    ACCOUNT_NOT_FOUND: 'account_not_found',
    NO_XBOX_ACCOUNT: 'no_xbox_account',
    NO_MINECRAFT: 'no_minecraft_license'
};
```

您可以监听错误事件：

```javascript
msAuth.on('error', (error) => {
    console.error('发生错误:', error);
});
```

## 许可证

MIT

## 贡献

欢迎提交问题和功能请求！

## 参考

- [Microsoft身份验证库 (MSAL)](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Xbox Live认证](https://docs.microsoft.com/en-us/gaming/xbox-live/api-ref/xbox-live-rest/additional/edsauthorization)
- [Minecraft API](https://wiki.vg/Mojang_API)
