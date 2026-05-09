import React, { useState, useEffect } from 'react';
import { useEnergy, getScoreColor } from '../../context/EnergyContext';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const KEYWORD_LABELS = {
    '蛤？这样不好吧': '离谱程度',
    '狗又干啥了？': '心情',
    '咪在干嘛？': '心情',
    '我们的日常': null
};

const KEYWORD_PLACEHOLDERS = {
    '蛤？这样不好吧': '羞羞o(*////▽////*)q',
    '狗又干啥了？': '毛孩子的日常',
    '咪在干嘛？': '干啥呢喵',
    '我们的日常': '相亲相爱一家人'
};

export default function CheckInPanel() {
    const { userInfo, addCheckin, currentUser } = useEnergy();
    const [records, setRecords] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // 切换日期时加载已有记录（含图片链接）
    useEffect(() => {
        const loadRecords = async () => {
            const { data } = await supabase
                .from('checkins')
                .select('*')
                .eq('user_id', currentUser)
                .eq('date', selectedDate);

            const dayRecords = {};
            data?.forEach(c => {
                if (userInfo.keywords.includes(c.keyword)) {
                    dayRecords[c.keyword] = {
                        quality: c.quality || 0,
                        note: c.note || '',
                        imageUrl: c.image_url || ''
                    };
                }
            });
            setRecords(dayRecords);
        };
        loadRecords();
    }, [selectedDate, currentUser, userInfo.keywords]);

    const handleQualityChange = (keyword, value) => {
        setRecords(prev => ({
            ...prev,
            [keyword]: { ...prev[keyword], quality: Number(value) }
        }));
    };

    const handleNoteChange = (keyword, value) => {
        setRecords(prev => ({
            ...prev,
            [keyword]: { ...prev[keyword], note: value }
        }));
    };

    const handleImageUrlChange = (keyword, value) => {
        setRecords(prev => ({
            ...prev,
            [keyword]: { ...prev[keyword], imageUrl: value }
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        for (const kw of userInfo.keywords) {
            const data = records[kw];
            if (!data) continue;
            const quality = data.quality !== undefined ? data.quality : (data.note ? 5 : undefined);
            if (quality === undefined) continue;
            await addCheckin(selectedDate, kw, quality, data.note || '', data.imageUrl || '');
        }
        // 重新加载确认保存成功
        const { data: freshData } = await supabase
            .from('checkins')
            .select('*')
            .eq('user_id', currentUser)
            .eq('date', selectedDate);

        const dayRecords = {};
        freshData?.forEach(c => {
            if (userInfo.keywords.includes(c.keyword)) {
                dayRecords[c.keyword] = {
                    quality: c.quality || 0,
                    note: c.note || '',
                    imageUrl: c.image_url || ''
                };
            }
        });
        setRecords(dayRecords);
        setSubmitting(false);
    };

    const hasAnyInput = Object.values(records).some(r => r.quality !== undefined || r.note);

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '24px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0 }}>每日记录</h2>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: '8px',
                            color: '#E0E6ED',
                            padding: '8px 12px',
                            fontFamily: 'inherit',
                            outline: 'none',
                        }}
                    />
                </div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!hasAnyInput || submitting}
                    style={{
                        background: hasAnyInput && !submitting ? '#4ECDC4' : 'rgba(255,255,255,0.1)',
                        color: hasAnyInput && !submitting ? '#050B14' : '#8892b0',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: hasAnyInput && !submitting ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit',
                    }}
                >
                    {submitting ? '保存中…' : '保存记录'}
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {userInfo.keywords.map((keyword) => {
                    const rec = records[keyword] || {};
                    const subLabel = KEYWORD_LABELS[keyword];
                    const placeholder = KEYWORD_PLACEHOLDERS[keyword] || '';
                    return (
                        <motion.div
                            key={keyword}
                            layout
                            style={{
                                padding: '20px',
                                borderRadius: '12px',
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderLeft: `4px solid ${getScoreColor(rec.quality)}`,
                            }}
                        >
                            <div style={{ marginBottom: '12px' }}>
                                <h3 style={{ margin: '0 0 4px 0', color: '#4ECDC4', fontSize: '18px' }}>{keyword}</h3>
                                {subLabel && (
                                    <span style={{ fontSize: '13px', color: '#8892b0' }}>{subLabel}</span>
                                )}
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8892b0', marginBottom: '6px' }}>
                                    能量值 (0–10)
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="1"
                                    value={rec.quality !== undefined ? rec.quality : 5}
                                    onChange={(e) => handleQualityChange(keyword, e.target.value)}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: '12px', color: '#8892b0', marginTop: '4px' }}>
                                    当前：{rec.quality !== undefined ? rec.quality : '未选择（拖动滑块以记录）'}
                                </div>
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8892b0', marginBottom: '6px' }}>
                                    备注
                                </label>
                                <textarea
                                    value={rec.note || ''}
                                    onChange={(e) => handleNoteChange(keyword, e.target.value)}
                                    placeholder={placeholder}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        resize: 'vertical',
                                        background: 'rgba(0,0,0,0.35)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        color: '#E0E6ED',
                                        padding: '10px',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#8892b0', marginBottom: '6px' }}>
                                    图片链接（可选）
                                </label>
                                <input
                                    type="text"
                                    value={rec.imageUrl || ''}
                                    onChange={(e) => handleImageUrlChange(keyword, e.target.value)}
                                    placeholder="https://..."
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        background: 'rgba(0,0,0,0.35)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        color: '#E0E6ED',
                                        padding: '10px',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}