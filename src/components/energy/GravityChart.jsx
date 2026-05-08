import React from 'react';
import { useEnergy } from '../../context/EnergyContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const KEYWORD_CONFIG = [
    { key: '蛤？这样不好吧', label: '蛤？这样不好吧（离谱程度）', color: '#e94560' },
    { key: '狗又干啥了？', label: '狗又干啥了？（心情）', color: '#4ECDC4' },
    { key: '咪在干嘛？', label: '咪在干嘛？（心情）', color: '#f9ca24' }
];

export default function GravityChart() {
    const { gravityScores, userInfo } = useEnergy();

    // 只取当前用户有的关键词
    const chartKeywords = KEYWORD_CONFIG.filter(k => userInfo.keywords.includes(k.key));

    if (chartKeywords.length === 0) {
        return <div style={{ color: '#555', textAlign: 'center', padding: '40px' }}>暂无数据</div>;
    }

    const firstKw = chartKeywords[0].key;
    const history = gravityScores[firstKw] || [];

    const chartData = history.map((h, index) => {
        const row = { date: h.date };
        chartKeywords.forEach(({ key }) => {
            const kwHistory = gravityScores[key];
            if (kwHistory && kwHistory[index]) {
                row[key] = kwHistory[index].score / 10;
            }
        });
        return row;
    });

    // ===== 关键：必须包一层有高度的div，ResponsiveContainer才能正常工作 =====
    return (
        <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                        dataKey="date"
                        stroke="#888"
                        tick={{ fill: '#888', fontSize: 12 }}
                        tickFormatter={(str) => str.slice(5)}
                    />
                    <YAxis
                        stroke="#888"
                        domain={[0, 10]}
                        tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#050B14', border: '1px solid #444' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#aaa' }}
                        formatter={(value, name) => {
                            const cfg = KEYWORD_CONFIG.find(k => k.key === name);
                            return [`${value}分`, cfg?.label || name];
                        }}
                    />
                    <Legend
                        formatter={(value) => {
                            const cfg = KEYWORD_CONFIG.find(k => k.key === value);
                            return cfg?.label || value;
                        }}
                    />
                    {chartKeywords.map(({ key, color }) => (
                        <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, fill: color }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}