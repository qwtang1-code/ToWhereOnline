import React, { useState } from 'react';
import { useEnergy } from '../../context/EnergyContext';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth,
    addMonths, subMonths, addYears, subYears, addWeeks, subWeeks,
    getYear
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { getScoreColor } from '../../context/EnergyContext';

// ============ 弹窗组件（只显示指定关键词的记录） ============
function DayDetailModal({ date, keyword, checkins, currentUser, onClose }) {
    if (!date || !keyword) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const record = checkins.find(c =>
        c.user_id === currentUser && c.date === dateStr && c.keyword === keyword
    );

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.7)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                backdropFilter: 'blur(5px)'
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                    background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '16px', padding: '28px', maxWidth: '500px',
                    width: '90%',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px'
                }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#4ECDC4' }}>
                        {format(date, 'yyyy年M月d日')} · {keyword}
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: '#fff', width: '32px', height: '32px',
                        borderRadius: '50%', cursor: 'pointer', fontSize: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>×</button>
                </div>

                {/* 单条记录 */}
                {!record ? (
                    <div style={{ textAlign: 'center', color: '#666', padding: '30px 0' }}>
                        这一天还没有记录
                    </div>
                ) : (
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px', padding: '16px',
                        borderLeft: `3px solid ${getScoreColor(record.quality || 0)}`
                    }}>
                        {/* 文字内容 */}
                        {record.note ? (
                            <div style={{
                                color: '#ccc', fontSize: '14px', lineHeight: 1.6,
                                padding: '10px', background: 'rgba(0,0,0,0.2)',
                                borderRadius: '6px', whiteSpace: 'pre-wrap'
                            }}>
                                {record.note}
                            </div>
                        ) : (
                            <div style={{ color: '#555', fontSize: '13px', fontStyle: 'italic' }}>
                                没有文字记录
                            </div>
                        )}

                        {/* 图片 */}
                        {record.image_url && (
                            <div style={{
                                marginTop: '10px', borderRadius: '8px',
                                overflow: 'hidden', maxHeight: '200px'
                            }}>
                                <img
                                    src={record.image_url} alt="记录图片"
                                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// ============ 主组件 ============
export default function EnergyCalendar() {
    const { checkins, userInfo, currentUser } = useEnergy();
    const [viewMode, setViewMode] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCell, setSelectedCell] = useState(null); // { date, keyword }

    const getStatusColor = (date, keyword) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const checkin = checkins.find(c =>
            c.user_id === currentUser && c.keyword === keyword && c.date === dateStr
        );
        if (!checkin) return 'rgba(255,255,255,0.05)';
        return getScoreColor(checkin.quality || 0);
    };

    const getDayScore = (date, keyword) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const checkin = checkins.find(c =>
            c.user_id === currentUser && c.keyword === keyword && c.date === dateStr
        );
        return checkin ? (checkin.quality || 0) : null;
    };

    const next = () => {
        if (viewMode === 'year') setCurrentDate(addYears(currentDate, 1));
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
        if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    };
    const prev = () => {
        if (viewMode === 'year') setCurrentDate(subYears(currentDate, 1));
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
        if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    };

    // 点击指定关键词的方块
    const handleDayClick = (date, keyword) => {
        setSelectedCell({ date, keyword });
    };

    const MiniDayCell = ({ date, monthDate, keyword }) => {
        const isCurrentMonth = isSameMonth(date, monthDate);
        const score = getDayScore(date, keyword);
        return (
            <div onClick={() => isCurrentMonth && score !== null && handleDayClick(date, keyword)}
                style={{
                    width: '100%', paddingTop: '100%', position: 'relative',
                    background: isCurrentMonth ? getStatusColor(date, keyword) : 'transparent',
                    borderRadius: '1px', opacity: isCurrentMonth ? 1 : 0,
                    cursor: isCurrentMonth && score !== null ? 'pointer' : 'default'
                }}
            />
        );
    };

    const MonthBlock = ({ monthDate, keyword }) => {
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        const startDay = startOfWeek(mStart);
        const allDays = eachDayOfInterval({ start: startDay, end: endOfWeek(mEnd) });

        return (
            <div>
                <div style={{ textAlign: 'center', marginBottom: '5px', fontSize: '12px', color: '#888' }}>
                    {format(monthDate, 'MMM')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
                    {allDays.map(d => (
                        <MiniDayCell key={d.toISOString()} date={d} monthDate={monthDate} keyword={keyword} />
                    ))}
                </div>
            </div>
        );
    };

    const FullMonthGrid = ({ monthDate, keyword }) => {
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        const start = startOfWeek(mStart);
        const end = endOfWeek(mEnd);
        const days = eachDayOfInterval({ start, end });

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: '12px', color: '#666', padding: '4px' }}>{d}</div>
                ))}
                {days.map(d => {
                    const isCurrentMonth = isSameMonth(d, monthDate);
                    const color = getStatusColor(d, keyword);
                    const hasData = color !== 'rgba(255,255,255,0.05)';
                    const score = getDayScore(d, keyword);

                    return (
                        <div key={d.toISOString()}
                            onClick={() => isCurrentMonth && score !== null && handleDayClick(d, keyword)}
                            style={{
                                aspectRatio: '1', background: color, borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px',
                                color: hasData ? '#000' : isCurrentMonth ? '#fff' : '#333',
                                fontWeight: hasData ? 'bold' : 'normal',
                                opacity: isCurrentMonth ? 1 : 0.15,
                                cursor: isCurrentMonth && score !== null ? 'pointer' : 'default',
                                border: !hasData && isCurrentMonth ? '1px solid rgba(255,255,255,0.08)' : 'none'
                            }}
                        >{isCurrentMonth ? format(d, 'd') : ''}</div>
                    );
                })}
            </div>
        );
    };

    const WeekGrid = ({ weekDate, keyword }) => {
        const start = startOfWeek(weekDate);
        const end = endOfWeek(weekDate);
        const days = eachDayOfInterval({ start, end });

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
                {days.map(d => {
                    const color = getStatusColor(d, keyword);
                    const hasData = color !== 'rgba(255,255,255,0.05)';
                    const score = getDayScore(d, keyword);

                    return (
                        <div key={d.toISOString()}
                            onClick={() => score !== null && handleDayClick(d, keyword)}
                            style={{
                                height: '80px', background: color, borderRadius: '6px',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                border: !hasData ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                cursor: score !== null ? 'pointer' : 'default'
                            }}
                        >
                            <span style={{ fontSize: '10px', color: hasData ? '#000' : '#888' }}>
                                {format(d, 'EEE')}
                            </span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: hasData ? '#000' : '#fff' }}>
                                {format(d, 'd')}
                            </span>
                            {score !== null && (
                                <span style={{ fontSize: '10px', color: '#333', fontWeight: 'bold' }}>{score}分</span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Controls */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px'
            }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setViewMode('year')} style={{
                        background: viewMode === 'year' ? '#4ECDC4' : 'transparent',
                        color: viewMode === 'year' ? '#000' : '#fff', border: '1px solid #4ECDC4',
                        padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                    }}>Year</button>
                    <button onClick={() => setViewMode('month')} style={{
                        background: viewMode === 'month' ? '#4ECDC4' : 'transparent',
                        color: viewMode === 'month' ? '#000' : '#fff', border: '1px solid #4ECDC4',
                        padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                    }}>Month</button>
                    <button onClick={() => setViewMode('week')} style={{
                        background: viewMode === 'week' ? '#4ECDC4' : 'transparent',
                        color: viewMode === 'week' ? '#000' : '#fff', border: '1px solid #4ECDC4',
                        padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                    }}>Week</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={prev} style={{
                        background: 'transparent', border: 'none',
                        color: '#4ECDC4', cursor: 'pointer', fontSize: '18px'
                    }}>&lt;</button>
                    <span style={{ minWidth: '100px', textAlign: 'center', fontWeight: 'bold' }}>
                        {viewMode === 'year' && format(currentDate, 'yyyy')}
                        {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                        {viewMode === 'week' && `Week ${format(currentDate, 'w, yyyy')}`}
                    </span>
                    <button onClick={next} style={{
                        background: 'transparent', border: 'none',
                        color: '#4ECDC4', cursor: 'pointer', fontSize: '18px'
                    }}>&gt;</button>
                </div>
            </div>

            {/* Keywords */}
            {userInfo.keywords.map(kw => (
                <div key={kw} style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px' }}>
                    <h4 style={{
                        margin: '0 0 15px 0', textTransform: 'uppercase',
                        color: '#4ECDC4', fontSize: '14px', letterSpacing: '1px'
                    }}>{kw}</h4>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={viewMode + currentDate.toString()}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {viewMode === 'year' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px' }}>
                                    {Array.from({ length: 12 }).map((_, i) => {
                                        const mDate = new Date(getYear(currentDate), i, 1);
                                        return <MonthBlock key={i} monthDate={mDate} keyword={kw} />;
                                    })}
                                </div>
                            )}
                            {viewMode === 'month' && <FullMonthGrid monthDate={currentDate} keyword={kw} />}
                            {viewMode === 'week' && <WeekGrid weekDate={currentDate} keyword={kw} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            ))}

            {/* Modal - 只显示被点击的那个关键词 */}
            <AnimatePresence>
                {selectedCell && (
                    <DayDetailModal
                        date={selectedCell.date}
                        keyword={selectedCell.keyword}
                        checkins={checkins}
                        currentUser={currentUser}
                        onClose={() => setSelectedCell(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}