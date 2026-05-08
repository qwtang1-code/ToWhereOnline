import React, { useState, useEffect } from 'react';
import { useEnergy } from '../../context/EnergyContext';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { getScoreColor } from '../../context/EnergyContext';

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

    // 切换日期时，直接从数据库加载该日期的记录
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
                        note: c.note || ''
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

    const handleSubmit = async () => {
        setSubmitting(true);
        // 逐个保存每个关键词的记录
        for (const kw of userInfo.keywords) {
            const data = records[kw];
            if (!data) continue;
            const quality = data.quality !== undefined ? data.quality : (data.note ? 5 : undefined);
            if (quality === undefined) continue;
            await addCheckin(selectedDate, kw, quality, data.note || '');
        }
        // 保存完成后，直接从数据库重新加载当前日期的记录
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
                    note: c.note || ''
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
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.9em',
                            cursor: 'pointer'
                        }}
                    />
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSubmit}
                    disabled={submitting || !hasAnyInput}
                    style={{
                        background: submitting ? '#333' : '#4ECDC4',
                        color: submitting ? '#888' : '#000',
                        border: 'none',
                        padding: '10px 30px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        cursor: submitting || !hasAnyInput ? 'not-allowed' : 'pointer',
                        boxShadow: submitting || !hasAnyInput ? 'none' : '0 0 15px rgba(78, 205, 196, 0.4)'
                    }}
                >
                    {submitting ? '保存中...' : '保存记录'}
                </motion.button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px'
            }}>
                {userInfo.keywords.map(kw => {
                    const record = records[kw] || {};
                    const score = record.quality || 0;
                    const color = score > 0 ? getScoreColor(score) : 'rgba(255,255,255,0.1)';
                    const scoreLabel = KEYWORD_LABELS[kw];
                    const showScore = scoreLabel !== null;

                    return (
                        <div key={kw} style={{
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '8px',
                            padding: '16px',
                            border: `1px solid ${score > 0 ? color : 'rgba(255,255,255,0.05)'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <h3 style={{
                                margin: 0,
                                color: score > 0 ? color : '#fff',
                                fontSize: '18px'
                            }}>
                                {kw}
                            </h3>

                            {showScore && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '12px', color: '#888', minWidth: '60px' }}>
                                            {scoreLabel}
                                        </span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={score}
                                            onChange={(e) => handleQualityChange(kw, e.target.value)}
                                            style={{
                                                flex: 1,
                                                height: '6px',
                                                cursor: 'pointer',
                                                accentColor: color
                                            }}
                                        />
                                        <span style={{
                                            fontSize: '20px',
                                            fontWeight: 'bold',
                                            color: color,
                                            minWidth: '30px',
                                            textAlign: 'center'
                                        }}>
                                            {score}
                                        </span>
                                    </div>

                                    <div style={{
                                        height: '4px',
                                        borderRadius: '2px',
                                        background: `linear-gradient(to right, ${getScoreColor(0)}, ${getScoreColor(5)}, ${getScoreColor(10)})`,
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            left: `${score * 10}%`,
                                            top: '-3px',
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: color,
                                            transform: 'translateX(-50%)',
                                            boxShadow: `0 0 8px ${color}`
                                        }} />
                                    </div>
                                </>
                            )}

                            <textarea
                                placeholder={KEYWORD_PLACEHOLDERS[kw] || `记录今天关于"${kw}"的趣事...`}
                                value={record.note || ''}
                                onChange={(e) => handleNoteChange(kw, e.target.value)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    padding: '10px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    minHeight: '60px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}