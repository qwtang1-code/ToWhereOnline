import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { uploadToSupabase } from '../../lib/supabaseStorage';
import './CityUploadPanel.css';

export default function CityUploadPanel({ onBack, onCityCreated }) {
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

    /** 保存后从数据库再读一次，避免接口无报错但实际未写入（RLS / 连错库等） */
    const verifyCityInDb = async (cityId, expectedMainImage) => {
        const { data, error } = await supabase
            .from('cities')
            .select('id, main_image')
            .eq('id', cityId)
            .maybeSingle();
        if (error) return { ok: false, message: '保存后无法校验：' + error.message };
        if (!data) return { ok: false, message: '保存后校验：数据库中查不到该城市（可能被 RLS 拦截或连到了空项目）' };
        if (expectedMainImage && data.main_image !== expectedMainImage) {
            const exp = String(expectedMainImage).slice(0, 64);
            const act = data.main_image ? String(data.main_image).slice(0, 64) : '（空）';
            return {
                ok: false,
                message: `保存后校验：主图与提交不一致。期望开头：${exp}… ；数据库中为：${act}…`,
            };
        }
        return { ok: true };
    };

    /** 若该城市尚无此 URL 的相册行，则插入一条并返回是否有写入 */
    const ensureCityImageRow = async (cityId, url) => {
        if (!cityId || !url) return { inserted: false, error: null };
        const { data: existing, error: selErr } = await supabase
            .from('city_images')
            .select('id')
            .eq('city_id', cityId)
            .eq('url', url)
            .maybeSingle();
        if (selErr) return { inserted: false, error: selErr };
        if (existing) return { inserted: false, error: null };

        const { data: maxRows, error: maxErr } = await supabase
            .from('city_images')
            .select('sort_order')
            .eq('city_id', cityId)
            .order('sort_order', { ascending: false })
            .limit(1);
        if (maxErr) return { inserted: false, error: maxErr };
        const nextSort = (maxRows?.[0]?.sort_order ?? -1) + 1;

        const { error: insErr } = await supabase.from('city_images').insert({
            city_id: cityId,
            url,
            sort_order: nextSort,
        });
        if (insErr) return { inserted: false, error: insErr };
        return { inserted: true, error: null };
    };

    const handleFileChange = async (e) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];

        setIsUploading(true);
        setUploadMessage('正在上传到云存储...');

        try {
            const { publicUrl } = await uploadToSupabase(file, 'firsts-images');
            setMainImage(publicUrl);

            // 正在编辑已有城市：选图后立即写入 cities + city_images，避免用户以为「上传成功」即已保存
            if (editingCityId) {
                setUploadMessage('正在写入数据库...');
                const { error: cityErr } = await supabase
                    .from('cities')
                    .update({ main_image: publicUrl })
                    .eq('id', editingCityId);
                if (cityErr) throw new Error('主图未能保存：' + cityErr.message);

                const { inserted, error: imgErr } = await ensureCityImageRow(editingCityId, publicUrl);
                if (imgErr) throw new Error('相册表写入失败：' + imgErr.message);

                const v = await verifyCityInDb(editingCityId, publicUrl);
                if (!v.ok) throw new Error(v.message);

                setUploadMessage(
                    inserted
                        ? '✅ 图片已上传并写入数据库（详情页相册可见）'
                        : '✅ 图片已上传；主图已更新（该图已在相册中存在）'
                );
                fetchCities();
                if (onCityCreated) onCityCreated();
            } else {
                setUploadMessage('✅ 图片已上传到云端。请填写城市信息后点击「添加城市」，才会写入数据库。');
            }
        } catch (err) {
            console.error('上传失败:', err);
            setUploadMessage('❌ ' + (err.message || String(err)));
        }
        setIsUploading(false);
        e.target.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cityName.trim()) { setUploadMessage('请输入城市名称'); return; }
        if (!lat || !lng) { setUploadMessage('请输入经纬度'); return; }

        setIsUploading(true);
        setUploadMessage('正在保存 (1/3)…');

        const cityPayload = {
            name: cityName.trim(),
            description: visitDate.trim() || null,
            lng: parseFloat(lng),
            lat: parseFloat(lat),
            departure: departure.trim() || null,
        };
        // 编辑时若未选新图，不要传 main_image: null，否则可能把库里主图清空
        if (mainImage) {
            cityPayload.main_image = mainImage;
        } else if (!editingCityId) {
            cityPayload.main_image = '';
        }

        let result;
        if (editingCityId) {
            result = await supabase.from('cities').update(cityPayload).eq('id', editingCityId).select();
        } else {
            result = await supabase.from('cities').insert(cityPayload).select();
        }

        if (result.error) {
            setUploadMessage('保存失败：' + result.error.message);
        } else {
            const cityId = editingCityId || result.data?.[0]?.id;
            setUploadMessage('正在写入相册并校验 (2/3)…');

            if (mainImage && cityId) {
                const { error: imgErr } = await ensureCityImageRow(cityId, mainImage);
                if (imgErr) {
                    setUploadMessage(
                        (editingCityId ? '城市信息已更新，但' : '城市已添加，但') +
                        '相册记录写入失败：' +
                        imgErr.message
                    );
                    setIsUploading(false);
                    fetchCities();
                    if (onCityCreated) onCityCreated();
                    return;
                }
            }

            if (cityId && mainImage) {
                const v = await verifyCityInDb(cityId, mainImage);
                if (!v.ok) {
                    setUploadMessage('❌ ' + v.message + ' 请打开浏览器 F12 → Network，看 supabase 请求是否红色失败。');
                    setIsUploading(false);
                    fetchCities();
                    if (onCityCreated) onCityCreated();
                    return;
                }
            }

            setUploadMessage(editingCityId ? '城市更新成功！(3/3 已校验)' : '城市添加成功！(3/3 已校验)');
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
        <div className="tw-cup-panel">
            {onBack && (
                <div className="tw-cup-topbar">
                    <button type="button" className="tw-cup-navBack" onClick={onBack}>
                        关闭
                    </button>
                </div>
            )}
            <div className="tw-cup-header" onClick={() => setIsPanelOpen(!isPanelOpen)}>
                <h3>{editingCityId ? '编辑城市' : '添加新城市'}</h3>
                <span>{isPanelOpen ? '▲' : '▼'}</span>
            </div>

            {isPanelOpen && (
                <form onSubmit={handleSubmit} className="tw-cup-form">
                    <div className="tw-cup-field">
                        <label>城市名称</label>
                        <input type="text" className="tw-cup-fieldText" value={cityName} onChange={e => setCityName(e.target.value)} placeholder="如：台北" required />
                    </div>
                    <div className="tw-cup-row">
                        <div className="tw-cup-field">
                            <label>经度 (lng)</label>
                            <input type="number" className="tw-cup-fieldNumber" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="121.5654" required />
                        </div>
                        <div className="tw-cup-field">
                            <label>纬度 (lat)</label>
                            <input type="number" className="tw-cup-fieldNumber" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="25.0330" required />
                        </div>
                    </div>
                    <div className="tw-cup-field">
                        <label>访问日期</label>
                        <input type="text" className="tw-cup-fieldText" value={visitDate} onChange={e => setVisitDate(e.target.value)} placeholder="2024-01-01" />
                    </div>
                    <div className="tw-cup-field">
                        <label>出发地</label>
                        <input type="text" className="tw-cup-fieldText" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="如：北京" />
                    </div>
                    <div className="tw-cup-field">
                        <label>主图 / 地点照片</label>
                        <input type="file" className="tw-cup-fieldFile" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                        {mainImage && <img src={mainImage} alt="preview" className="tw-cup-preview" />}
                        <p style={{ fontSize: '12px', opacity: 0.65, margin: '8px 0 0' }}>
                            {editingCityId
                                ? '编辑模式下选图后会立即保存到数据库。'
                                : '新城市需在填写经纬度等信息后点击「添加城市」，照片才会一并入库。'}
                        </p>
                    </div>

                    {uploadMessage && <div className="tw-cup-message">{uploadMessage}</div>}

                    <button type="submit" disabled={isUploading} className="tw-cup-submitBtn">
                        {isUploading ? '保存中...' : (editingCityId ? '更新城市' : '添加城市')}
                    </button>
                    {editingCityId && (
                        <button type="button" onClick={() => { setEditingCityId(null); setCityName(''); setLat(''); setLng(''); setVisitDate(''); setDeparture(''); setMainImage(null); }} className="tw-cup-cancelBtn">
                            取消编辑
                        </button>
                    )}
                </form>
            )}

            <div className="tw-cup-cityList">
                <h4>已有城市 ({cities.length})</h4>
                {cities.map(city => (
                    <div key={city.id} className="tw-cup-cityItem">
                        <span>{city.name}</span>
                        <div>
                            <button onClick={() => handleEditCity(city)} className="tw-cup-editBtn">编辑</button>
                            <button onClick={() => handleDeleteCity(city.id)} className="tw-cup-deleteBtn">删除</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}