/**
 * MsLogin-MC - Microsoft Login Module for Minecraft
 * 
 * 此模块提供了与微软账户登录相关的功能，专为Minecraft启动器设计
 * 包括获取授权URL、处理授权回调、获取令牌等功能
 */

const axios = require('axios');
const EventEmitter = require('events');

class MicrosoftAuthProvider extends EventEmitter {
    /**
     * 创建Microsoft认证提供者实例
     * @param {Object} options 配置选项
     * @param {string} options.clientId 您的Azure应用程序客户端ID
     * @param {string} options.redirectUri 重定向URI（默认为Microsoft推荐的原生客户端URI）
     */
    constructor(options) {
        super();
        
        if (!options || !options.clientId) {
            throw new Error('必须提供clientId参数');
        }

        this.clientId = options.clientId;
        this.redirectUri = options.redirectUri || 'https://login.microsoftonline.com/common/oauth2/nativeclient';
        
        // 定义错误代码
        this.ErrorCode = {
            UNKNOWN: 'unknown_error',
            USER_CANCELLED: 'user_cancelled',
            ACCESS_DENIED: 'access_denied',
            SERVER_ERROR: 'server_error',
            ACCOUNT_NOT_FOUND: 'account_not_found',
            NO_XBOX_ACCOUNT: 'no_xbox_account',
            NO_MINECRAFT: 'no_minecraft_license'
        };
    }

    /**
     * 获取微软登录授权URL
     * @returns {string} 授权URL
     */
    getAuthorizationUrl() {
        const scopes = 'XboxLive.signin offline_access';
        return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?prompt=select_account&client_id=${this.clientId}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    }

    /**
     * 处理授权码并完成整个登录流程
     * @param {string} authCode 从授权重定向获取的授权码
     * @returns {Promise<Object>} 包含用户信息和令牌的对象
     */
    async completeLogin(authCode) {
        try {
            // 1. 获取Microsoft访问令牌
            const msTokenData = await this.getMicrosoftToken(authCode);
            
            // 2. 获取Xbox Live令牌
            const xblTokenData = await this.getXboxLiveToken(msTokenData.access_token);
            
            // 3. 获取XSTS令牌
            const xstsTokenData = await this.getXSTSToken(xblTokenData.Token);
            
            // 4. 获取Minecraft访问令牌
            const mcTokenData = await this.getMinecraftToken(xstsTokenData);
            
            // 5. 获取Minecraft个人资料
            const mcProfileData = await this.getMinecraftProfile(mcTokenData.access_token);
            
            // 返回完整的用户信息
            return {
                microsoft: {
                    access_token: msTokenData.access_token,
                    refresh_token: msTokenData.refresh_token,
                    expires_at: Date.now() + (msTokenData.expires_in * 1000)
                },
                minecraft: {
                    access_token: mcTokenData.access_token,
                    expires_at: Date.now() + (mcTokenData.expires_in * 1000)
                },
                profile: {
                    id: mcProfileData.id,
                    name: mcProfileData.name,
                    skins: mcProfileData.skins,
                    capes: mcProfileData.capes
                },
                user: {
                    username: mcProfileData.name,
                    uuid: mcProfileData.id,
                    type: 'microsoft'
                }
            };
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 刷新访问令牌
     * @param {string} refreshToken 刷新令牌
     * @returns {Promise<Object>} 包含新令牌的对象
     */
    async refreshTokens(refreshToken) {
        try {
            // 1. 使用刷新令牌获取新的Microsoft访问令牌
            const msTokenData = await this.getMicrosoftToken(refreshToken, true);
            
            // 2. 获取Xbox Live令牌
            const xblTokenData = await this.getXboxLiveToken(msTokenData.access_token);
            
            // 3. 获取XSTS令牌
            const xstsTokenData = await this.getXSTSToken(xblTokenData.Token);
            
            // 4. 获取Minecraft访问令牌
            const mcTokenData = await this.getMinecraftToken(xstsTokenData);
            
            // 返回新的令牌
            return {
                microsoft: {
                    access_token: msTokenData.access_token,
                    refresh_token: msTokenData.refresh_token,
                    expires_at: Date.now() + (msTokenData.expires_in * 1000)
                },
                minecraft: {
                    access_token: mcTokenData.access_token,
                    expires_at: Date.now() + (mcTokenData.expires_in * 1000)
                }
            };
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 获取Microsoft访问令牌
     * @param {string} code 授权码或刷新令牌
     * @param {boolean} isRefresh 是否为刷新令牌
     * @returns {Promise<Object>} Microsoft令牌数据
     * @private
     */
    async getMicrosoftToken(code, isRefresh = false) {
        try {
            const tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
            
            const formData = new URLSearchParams();
            formData.append('client_id', this.clientId);
            formData.append('scope', 'XboxLive.signin offline_access');
            
            if (isRefresh) {
                formData.append('grant_type', 'refresh_token');
                formData.append('refresh_token', code);
            } else {
                formData.append('grant_type', 'authorization_code');
                formData.append('code', code);
                formData.append('redirect_uri', this.redirectUri);
            }
            
            const response = await axios.post(tokenUrl, formData);
            return response.data;
        } catch (error) {
            console.error('获取Microsoft令牌失败', error.response?.data || error.message);
            throw new Error('获取Microsoft令牌失败: ' + (error.response?.data?.error_description || error.message));
        }
    }

    /**
     * 获取Xbox Live令牌
     * @param {string} accessToken Microsoft访问令牌
     * @returns {Promise<Object>} Xbox Live令牌数据
     * @private
     */
    async getXboxLiveToken(accessToken) {
        try {
            const xblUrl = 'https://user.auth.xboxlive.com/user/authenticate';
            
            const response = await axios.post(xblUrl, {
                Properties: {
                    AuthMethod: 'RPS',
                    SiteName: 'user.auth.xboxlive.com',
                    RpsTicket: `d=${accessToken}`
                },
                RelyingParty: 'http://auth.xboxlive.com',
                TokenType: 'JWT'
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('获取Xbox Live令牌失败', error.response?.data || error.message);
            throw new Error('获取Xbox Live令牌失败: ' + (error.response?.data?.message || error.message));
        }
    }

    /**
     * 获取XSTS令牌
     * @param {string} xblToken Xbox Live令牌
     * @returns {Promise<Object>} XSTS令牌数据
     * @private
     */
    async getXSTSToken(xblToken) {
        try {
            const xstsUrl = 'https://xsts.auth.xboxlive.com/xsts/authorize';
            
            const response = await axios.post(xstsUrl, {
                Properties: {
                    SandboxId: 'RETAIL',
                    UserTokens: [xblToken]
                },
                RelyingParty: 'rp://api.minecraftservices.com/',
                TokenType: 'JWT'
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return {
                token: response.data.Token,
                userHash: response.data.DisplayClaims.xui[0].uhs
            };
        } catch (error) {
            console.error('获取XSTS令牌失败', error.response?.data || error.message);
            
            // 特殊处理Xbox Live错误
            if (error.response?.status === 401) {
                const xerr = error.response.data.XErr;
                if (xerr === 2148916233) {
                    throw new Error('此账户没有Xbox账户，您需要创建一个: ' + this.ErrorCode.NO_XBOX_ACCOUNT);
                } else if (xerr === 2148916238) {
                    throw new Error('此账户来自不支持Xbox Live的国家/地区');
                }
            }
            
            throw new Error('获取XSTS令牌失败: ' + (error.response?.data?.message || error.message));
        }
    }

    /**
     * 获取Minecraft访问令牌
     * @param {Object} xstsData XSTS令牌数据
     * @returns {Promise<Object>} Minecraft令牌数据
     * @private
     */
    async getMinecraftToken(xstsData) {
        try {
            const mcTokenUrl = 'https://api.minecraftservices.com/authentication/login_with_xbox';
            
            const response = await axios.post(mcTokenUrl, {
                identityToken: `XBL3.0 x=${xstsData.userHash};${xstsData.token}`
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('获取Minecraft令牌失败', error.response?.data || error.message);
            throw new Error('获取Minecraft令牌失败: ' + (error.response?.data?.message || error.message));
        }
    }

    /**
     * 获取Minecraft用户资料
     * @param {string} accessToken Minecraft访问令牌
     * @returns {Promise<Object>} Minecraft用户资料
     * @private
     */
    async getMinecraftProfile(accessToken) {
        try {
            const profileUrl = 'https://api.minecraftservices.com/minecraft/profile';
            
            const response = await axios.get(profileUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.data || !response.data.id) {
                throw new Error('没有找到Minecraft资料，可能没有购买游戏: ' + this.ErrorCode.NO_MINECRAFT);
            }
            
            return response.data;
        } catch (error) {
            console.error('获取Minecraft资料失败', error.response?.data || error.message);
            
            if (error.response?.status === 404) {
                throw new Error('此账户没有购买Minecraft: ' + this.ErrorCode.NO_MINECRAFT);
            }
            
            throw new Error('获取Minecraft资料失败: ' + (error.response?.data?.message || error.message));
        }
    }

    /**
     * 验证Minecraft令牌是否有效
     * @param {string} accessToken Minecraft访问令牌
     * @returns {Promise<boolean>} 令牌是否有效
     */
    async validateMinecraftToken(accessToken) {
        try {
            const response = await axios.get('https://api.minecraftservices.com/entitlements/mcstore', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查用户是否拥有Minecraft
     * @param {string} accessToken Minecraft访问令牌
     * @returns {Promise<boolean>} 是否拥有Minecraft
     */
    async checkGameOwnership(accessToken) {
        try {
            const response = await axios.get('https://api.minecraftservices.com/entitlements/mcstore', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            // 检查是否有Minecraft产品
            return response.data && 
                   response.data.items && 
                   response.data.items.some(item => item.name === 'game_minecraft');
        } catch (error) {
            console.error('检查游戏所有权失败', error.response?.data || error.message);
            return false;
        }
    }
}

module.exports = MicrosoftAuthProvider; 