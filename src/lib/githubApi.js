/**
 * GitHub REST API utilities for the ToWhere admin panel.
 * Handles token management (localStorage) and file uploads to the GitHub repo.
 */

const OWNER = import.meta.env.VITE_GITHUB_OWNER;
const REPO = import.meta.env.VITE_GITHUB_REPO;
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
const TOKEN_KEY = 'towhere_github_token';

function checkEnvConfig() {
    const missing = [];
    if (!OWNER) missing.push('VITE_GITHUB_OWNER');
    if (!REPO) missing.push('VITE_GITHUB_REPO');
    if (missing.length > 0) {
        return {
            valid: false,
            error: `环境变量未配置: ${missing.join(', ')}。请在 .env 文件中配置这些变量。`
        };
    }
    return { valid: true };
}

// Fallback to .env token if localStorage is empty
export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
        return '';
    }
}

export function setToken(token) {
    try {
        localStorage.setItem(TOKEN_KEY, token.trim());
        return true;
    } catch {
        return false;
    }
}

export function clearToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
}

export function hasToken() {
    return !!getToken();
}

// ========= GitHub API =========

/**
 * Upload a file to the GitHub repo via REST API.
 * @param {string} path - Repo-relative path, e.g. "public/images/cities/北京/photo1.jpg"
 * @param {string} base64Content - Base64-encoded file content (without data URI prefix)
 * @param {string} commitMessage - Git commit message
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadFileToGitHub(path, base64Content, commitMessage = 'Add image via ToWhere admin') {
    const envCheck = checkEnvConfig();
    if (!envCheck.valid) {
        console.error('[GitHub Upload] 环境变量配置错误:', envCheck.error);
        return { success: false, error: envCheck.error };
    }
    
    const token = getToken();
    if (!token) {
        console.error('[GitHub Upload] Token 未配置');
        return { success: false, error: 'GitHub Token 未配置，请在管理员面板配置 GitHub Personal Access Token' };
    }

    console.log('[GitHub Upload] 开始上传:', { path, owner: OWNER, repo: REPO, branch: BRANCH, contentLength: base64Content?.length });

    try {
        // Check if file already exists (to get its SHA for update)
        let sha = null;
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const checkUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}?ref=${BRANCH}`;
        
        console.log('[GitHub Upload] 检查文件是否存在:', checkUrl);
        
        const checkRes = await fetch(
            checkUrl,
            { headers: { Authorization: `token ${token}` } }
        );
        
        console.log('[GitHub Upload] 文件检查状态:', checkRes.status);
        
        if (checkRes.ok) {
            const existing = await checkRes.json();
            sha = existing.sha;
            console.log('[GitHub Upload] 文件已存在, SHA:', sha);
        } else if (checkRes.status !== 404) {
            const errData = await checkRes.json().catch(() => ({}));
            console.error('[GitHub Upload] 文件检查异常:', errData);
        }

        const body = {
            message: commitMessage,
            content: base64Content,
            branch: BRANCH,
        };
        if (sha) body.sha = sha;

        const uploadUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}`;
        console.log('[GitHub Upload] 上传到:', uploadUrl);

        const res = await fetch(
            uploadUrl,
            {
                method: 'PUT',
                headers: {
                    Authorization: `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        console.log('[GitHub Upload] 上传响应状态:', res.status);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('[GitHub Upload] 上传失败详情:', errData);
            
            let errorMsg = errData.message || `HTTP ${res.status}`;
            
            // 提供更友好的错误提示
            if (res.status === 401 || res.status === 403) {
                errorMsg = 'GitHub Token 无效或权限不足，请检查 Token 是否有 repo 权限';
            } else if (res.status === 404) {
                errorMsg = `GitHub 仓库 ${OWNER}/${REPO} 不存在或无权访问`;
            } else if (res.status === 422 && errData.message?.includes('too large')) {
                errorMsg = '图片文件过大，请压缩后重试';
            }
            
            return { success: false, error: errorMsg };
        }

        const data = await res.json();
        const cdnUrl = getJsDelivrUrl(path);
        console.log('[GitHub Upload] 上传成功:', cdnUrl);
        return { success: true, url: cdnUrl, rawUrl: data.content?.download_url };

    } catch (err) {
        console.error('[GitHub Upload] 异常:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Convert a repo-relative path to a jsDelivr CDN URL for instant availability.
 * @param {string} path - e.g. "public/images/cities/北京/photo1.jpg"
 * @returns {string} CDN URL
 */
export function getJsDelivrUrl(path) {
    // Encode each part of the path separately to handle Chinese characters etc.
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${encodedPath}`;
}

/**
 * List files in a specific directory on GitHub.
 * @param {string} dirPath - e.g. "public/images/cities/北京"
 * @returns {Promise<{success: boolean, files?: Array<{name: string, path: string, sha: string, download_url: string}>, error?: string}>}
 */
export async function listFilesInDir(dirPath) {
    const envCheck = checkEnvConfig();
    if (!envCheck.valid) {
        return { success: false, error: envCheck.error };
    }
    
    const token = getToken();
    if (!token) return { success: false, error: 'Token 未配置' };

    try {
        const res = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/contents/${dirPath}?ref=${BRANCH}`,
            { headers: { Authorization: `token ${token}` } }
        );
        if (!res.ok) {
            if (res.status === 404) return { success: true, files: [] };
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.message || `HTTP ${res.status}` };
        }
        const data = await res.json();
        const files = Array.isArray(data) ? data.filter(item => item.type === 'file') : [];
        return { success: true, files };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Delete a file from GitHub.
 * @param {string} path - Full path to the file.
 * @param {string} sha - The blob SHA of the file to delete.
 * @param {string} message - Commit message.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteFileFromGitHub(path, sha, message = 'Delete image via ToWhere admin') {
    const envCheck = checkEnvConfig();
    if (!envCheck.valid) {
        return { success: false, error: envCheck.error };
    }
    
    const token = getToken();
    if (!token) return { success: false, error: 'Token 未配置' };

    try {
        const res = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    sha,
                    branch: BRANCH,
                }),
            }
        );
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.message || `HTTP ${res.status}` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Validate GitHub token by calling the authenticated user endpoint.
 * @returns {Promise<{valid: boolean, username?: string, error?: string}>}
 */
export async function validateToken() {
    const token = getToken();
    if (!token) return { valid: false, error: 'Token 未配置' };

    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            return { valid: true, username: data.login };
        }
        return { valid: false, error: `Token 无效 (HTTP ${res.status})` };
    } catch (err) {
        return { valid: false, error: err.message };
    }
}
