import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { format, differenceInDays } from 'date-fns';

const EnergyContext = createContext();

export const USERS = {
    JIANG: {
        id: 'jiang',
        name: '我们',
        keywords: ['蛤？这样不好吧', '我们的日常']
    },
    ZHEN: {
        id: 'zhen',
        name: '唐和万',
        keywords: ['狗又干啥了？', '咪在干嘛？']
    }
};

export const SCORE_COLORS = [
    '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560',
    '#ff6b6b', '#f9ca24', '#f0932b', '#6c5ce7', '#a29bfe', '#00cec9',
];

export const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'rgba(255,255,255,0.05)';
    const s = Math.max(0, Math.min(10, Math.round(score)));
    return SCORE_COLORS[s];
};

export const PLANET_METADATA = {
    '蛤？这样不好吧': { en: 'Huh?', desc: '每当TA做出离谱操作时的第一反应。' },
    '狗又干啥了？': { en: 'What did the dog do?', desc: '家里的毛孩子永远不缺节目。' },
    '咪在干嘛？': { en: 'What is the cat doing?', desc: '猫咪的迷惑行为大赏。' },
    '我们的日常': { en: 'Our Daily Life', desc: '平淡又温暖的每一天。' }
};

export function EnergyProvider({ children }) {
    const [currentUser, setCurrentUser] = useState('jiang');
    const [checkins, setCheckins] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCheckins = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('checkins')
            .select('*')
            .order('date', { ascending: true });

        if (error) console.error('Error fetching checkins:', error);
        else setCheckins(data || []);

        setLoading(false);
    };

    useEffect(() => { fetchCheckins(); }, []);

    // 修复版：先查再更新/插入，确保同一天不同关键词各存各的
    const addCheckin = async (dateStr, keyword, quality, note = '', imageUrl = '') => {
        const userId = currentUser;
        const finalQuality = Math.max(0, Math.min(10, Math.round(Number(quality) || 0)));
        const finalNote = note || '';
        const finalImageUrl = imageUrl || '';

        // 先查询是否已有同用户+同日期+同关键词的记录
        const { data: existingRows, error: queryError } = await supabase
            .from('checkins')
            .select('id')
            .eq('user_id', userId)
            .eq('date', dateStr)
            .eq('keyword', keyword);

        if (queryError) {
            console.error('Error querying checkin:', queryError);
            alert('查询失败：' + queryError.message);
            return;
        }

        let result;

        if (existingRows && existingRows.length > 0) {
            // 已存在 → 更新
            result = await supabase
                .from('checkins')
                .update({
                    quality: finalQuality,
                    note: finalNote,
                    image_url: finalImageUrl
                })
                .eq('id', existingRows[0].id);
        } else {
            // 不存在 → 插入新记录
            result = await supabase
                .from('checkins')
                .insert({
                    user_id: userId,
                    date: dateStr,
                    keyword: keyword,
                    quality: finalQuality,
                    note: finalNote,
                    image_url: finalImageUrl
                });
        }

        if (result.error) {
            console.error('Error saving checkin:', result.error);
            alert('保存失败：' + result.error.message);
        } else {
            fetchCheckins();
        }
    };

    const getCheckin = (date, keyword) => {
        const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
        return checkins.find(c =>
            c.user_id === currentUser &&
            c.keyword === keyword &&
            c.date === dateStr
        );
    };

    const computeGravityScores = () => {
        const userInfo = USERS[currentUser === 'jiang' ? 'JIANG' : 'ZHEN'];
        const scoresByKeyword = {};
        const startDate = new Date('2026-01-01');
        const today = new Date();
        const daysDiff = differenceInDays(today, startDate);
        const totalDays = Math.max(daysDiff, 0);

        userInfo.keywords.forEach(kw => {
            const history = [];
            for (let i = 0; i <= totalDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const checkin = checkins.find(c =>
                    c.user_id === currentUser && c.keyword === kw && c.date === dateStr
                );
                history.push({
                    date: dateStr,
                    score: checkin ? (checkin.quality || 0) * 10 : 0
                });
            }
            scoresByKeyword[kw] = history;
        });
        return scoresByKeyword;
    };

    const gravityScores = useMemo(() => computeGravityScores(), [checkins, currentUser]);

    const starshipState = useMemo(() => {
        const userInfo = USERS[currentUser === 'jiang' ? 'JIANG' : 'ZHEN'];
        const userCheckins = checkins.filter(c => c.user_id === currentUser);
        const keywordCount = userInfo.keywords.length || 1;
        const totalPoints = userCheckins.reduce((sum, c) => sum + (c.quality || 0), 0);
        const maxPoints = keywordCount * 365 * 10;

        return {
            totalPoints,
            target: maxPoints,
            progress: maxPoints > 0 ? Math.min(100, (totalPoints / maxPoints) * 100) : 0,
            keywordStats: {},
            status: 'ACTIVE'
        };
    }, [checkins, currentUser]);

    return (
        <EnergyContext.Provider value={{
            currentUser,
            setCurrentUser,
            userInfo: USERS[currentUser === 'jiang' ? 'JIANG' : 'ZHEN'],
            users: USERS,
            checkins,
            addCheckin,
            getCheckin,
            gravityScores,
            loading,
            starshipState,
            PLANET_METADATA,
            SCORE_COLORS,
            getScoreColor
        }}>
            {children}
        </EnergyContext.Provider>
    );
}

export function useEnergy() {
    return useContext(EnergyContext);
}