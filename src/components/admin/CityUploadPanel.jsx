import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import styles from './CityUploadPanel.module.css';

export default function CityUploadPanel({ onCityCreated, githubToken }) {
    const [cityName, setCityName] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [visitDate, setVisitDate] = useState('');
    const [departure, setDeparture] = useState('');
    const [mainImage, setMainImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState('');
    const [cities, setCities] = useState([]);
    const [editingCityId, setEditingCityId] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    useEffect(() => {
        fetchCities();
    }, []);

    const fetchCities = async () => {
        const { data, error } = await supabase
            .from('cities')
            .select('*')
            .order('sort_order', { ascending: true });
        if (!error && data) {
            setCities(data);
        }
    };

    const handleFileChange = async (e) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        
        setIsUploading(true);
        setUploadMessage('正在上传...');
        
        try {
            const { uploadToSupabase } = await import('../../lib/supabaseStorage');
            const { publicUrl } = await uploadToSupabase(file, 'firsts-images');
            
            setMainImage(publicUrl);
            setUploadMessage('✅ 图片上传成功！');
        } catch (err) {
            console.error('上传失败:', err);
            setUploadMessage('❌ 上传失败：' + err.message);
        }
        setIsUploading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cityName.trim()) { setUploadMessage('请输入城市名称'); return; }
        if (!lat || !lng) { setUploadMessage('请输入经纬度'); return; }

        setIsUploading(true);
        setUploadMessage('正在保存...');

        const cityPayload = {
            name: cityName.trim(),
            description: visitDate.trim() || null,
            main_image: mainImage,
            lng: parseFloat(lng),
            lat: parseFloat(lat),
            departure: departure.trim() || null,
        };

        let result;
        if (editingCityId) {
            result = await supabase.from('cities').update(cityPayload).eq('id', editingCityId).select();
        } else {
            result = await supabase.from('cities').insert(cityPayload).select();
        }

        if (result.error) {
            setUploadMessage('保存失败：' + result.error.message);
        } else {
            // 同时写入 city_images 表
            if (mainImage) {
                const cityId = editingCityId || result.data?.[0]?.id;
                if (cityId) {
                    await supabase.from('city_images').insert({
                        city_id: cityId,
                        url: mainImage,
                        sort_order: 0
                    });
                }
            }
            
            setUploadMessage(editingCityId ? '城市更新成功！' : '城市添加成功！');
            setCityName(''); setLat(''); setLng(''); setVisitDate(''); setDeparture(''); setMainImage(null);
            setEditingCityId(null);
            fetchCities();
            if (onCityCreated) onCityCreated();
        }
        setIsUploading(false);
    };

    const handleEditCity = (city) => {
        setEditingCityId(city.id);
        setCityName(city.name || '');
        setLng(city.lng || '');
        setLat(city.lat || '');
        setVisitDate(city.description || '');
        setDeparture(city.departure || '');
        setMainImage(city.main_image || null);
        setIsPanelOpen(true);
    };

    const handleDeleteCity = async (cityId) => {
        if (!window.confirm('确定要删除这个城市吗？')) return;
        const { error } = await supabase.from('cities').delete().eq('id', cityId);
        if (error) { setUploadMessage('删除失败：' + error.message); }
        else { setUploadMessage('删除成功！'); fetchCities(); if (onCityCreated) onCityCreated(); }
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header} onClick={() => setIsPanelOpen(!isPanelOpen)}>
                <h3>{editingCityId ? '编辑城市' : '添加新城市'}</h3>
                <span>{isPanelOpen ? '▲' : '▼'}</span>
            </div>

            {isPanelOpen && (
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label>城市名称</label>
                        <input type="text" value={cityName} onChange={e => setCityName(e.target.value)} placeholder="如：台北" required />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>经度 (lng)</label>
                            <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="121.5654" required />
                        </div>
                        <div className={styles.field}>
                            <label>纬度 (lat)</label>
                            <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="25.0330" required />
                        </div>
                    </div>
                    <div className={styles.field}>
                        <label>访问日期</label>
                        <input type="text" value={visitDate} onChange={e => setVisitDate(e.target.value)} placeholder="2024-01-01" />
                    </div>
                    <div className={styles.field}>
                        <label>出发地</label>
                        <input type="text" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="如：北京" />
                    </div>
                    <div className={styles.field}>
                        <label>主图</label>
                        <input type="file" accept="image/*" onChange={handleFileChange} />
                        {mainImage && <img src={mainImage} alt="preview" className={styles.preview} />}
                    </div>

                    {uploadMessage && <div className={styles.message}>{uploadMessage}</div>}

                    <button type="submit" disabled={isUploading} className={styles.submitBtn}>
                        {isUploading ? '保存中...' : (editingCityId ? '更新城市' : '添加城市')}
                    </button>
                    {editingCityId && (
                        <button type="button" onClick={() => { setEditingCityId(null); setCityName(''); setLat(''); setLng(''); setVisitDate(''); setDeparture(''); setMainImage(null); }} className={styles.cancelBtn}>
                            取消编辑
                        </button>
                    )}
                </form>
            )}

            <div className={styles.cityList}>
                <h4>已有城市 ({cities.length})</h4>
                {cities.map(city => (
                    <div key={city.id} className={styles.cityItem}>
                        <span>{city.name}</span>
                        <div>
                            <button onClick={() => handleEditCity(city)} className={styles.editBtn}>编辑</button>
                            <button onClick={() => handleDeleteCity(city.id)} className={styles.deleteBtn}>删除</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}