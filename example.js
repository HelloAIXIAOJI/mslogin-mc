/**
 * MsLogin-MC 使用示例
 */

const MicrosoftAuthProvider = require('./index');
const { BrowserWindow } = require('electron');

// 创建一个授权提供者实例
const msAuth = new MicrosoftAuthProvider({
    clientId: 'YOUR_AZURE_CLIENT_ID', // 替换为您的Azure应用客户端ID
});

// 错误处理
msAuth.on('error', (error) => {
    console.error('微软登录出错:', error);
});

/**
 * 启动微软登录流程
 * @returns {Promise<Object>} 用户信息
 */
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

/**
 * 刷新令牌示例
 * @param {string} refreshToken 微软刷新令牌
 * @returns {Promise<Object>} 新的令牌信息
 */
async function refreshUserTokens(refreshToken) {
    try {
        return await msAuth.refreshTokens(refreshToken);
    } catch (error) {
        console.error('刷新令牌失败', error);
        throw error;
    }
}

/**
 * 验证令牌示例
 * @param {string} accessToken Minecraft访问令牌
 * @returns {Promise<boolean>} 令牌是否有效
 */
async function validateToken(accessToken) {
    return await msAuth.validateMinecraftToken(accessToken);
}

/**
 * 检查是否拥有Minecraft
 * @param {string} accessToken Minecraft访问令牌
 * @returns {Promise<boolean>} 是否拥有Minecraft
 */
async function checkMinecraftOwnership(accessToken) {
    return await msAuth.checkGameOwnership(accessToken);
}

// 使用示例（在实际Electron应用中）:
/*
// 启动登录
startMicrosoftLogin()
    .then(userData => {
        console.log('登录成功', userData);
        
        // 存储用户信息，例如：
        localStorage.setItem('minecraft_user', JSON.stringify({
            username: userData.profile.name,
            uuid: userData.profile.id,
            accessToken: userData.minecraft.access_token,
            accessTokenExpires: userData.minecraft.expires_at,
            msRefreshToken: userData.microsoft.refresh_token
        }));
    })
    .catch(error => {
        console.error('登录失败', error);
    });


// 稍后刷新令牌
const savedUser = JSON.parse(localStorage.getItem('minecraft_user'));
if (savedUser && savedUser.msRefreshToken) {
    refreshUserTokens(savedUser.msRefreshToken)
        .then(newTokens => {
            console.log('令牌已刷新');
            // 更新存储的令牌
            savedUser.accessToken = newTokens.minecraft.access_token;
            savedUser.accessTokenExpires = newTokens.minecraft.expires_at;
            savedUser.msRefreshToken = newTokens.microsoft.refresh_token;
            localStorage.setItem('minecraft_user', JSON.stringify(savedUser));
        })
        .catch(error => {
            console.error('刷新令牌失败，需要重新登录', error);
        });
}
*/

module.exports = {
    startMicrosoftLogin,
    refreshUserTokens,
    validateToken,
    checkMinecraftOwnership
}; 