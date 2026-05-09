import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

export default function CityDetail({ cityName, goBack }) {
  const [scrollY, setScrollY] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentCity, setCurrentCity] = useState({ id: null, mainImage: '', description: '', gallery: [] });
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 加载城市数据
  useEffect(() => {
    const loadCityData = async () => {
      setLoading(true);
      try {
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('*')
          .eq('name', cityName.trim())
          .single();

        if (cityError || !cityData) {
          console.error('加载城市失败:', cityError);
          setLoading(false);
          return;
        }

        console.log('城市数据:', cityData);

        const { data: imagesData } = await supabase
          .from('city_images')
          .select('url, sort_order')
          .eq('city_id', cityData.id)
          .order('sort_order', { ascending: true });

        console.log('图片数据:', imagesData);

        setCurrentCity({
          id: cityData.id,
          mainImage: cityData.main_image || '',
          description: cityData.description || '',
          departure: cityData.departure || '',
          lng: cityData.lng,
          lat: cityData.lat,
          gallery: (imagesData || []).map(img => img.url),
        });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    if (cityName) loadCityData();
  }, [cityName]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setIsDarkMode(window.scrollY < window.innerHeight);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ========== 图片上传（base64 直接存数据库）==========
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    console.log('选中文件:', file?.name, '大小:', file?.size, 'city_id:', currentCity.id);

    if (!file) {
      alert('请选择文件');
      return;
    }
    if (!currentCity.id) {
      alert('城市ID为空，请刷新页面');
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      console.log('base64长度:', base64.length);

      try {
        const { data, error } = await supabase
          .from('city_images')
          .insert({
            city_id: currentCity.id,
            url: base64,
            sort_order: currentCity.gallery.length
          })
          .select();

        console.log('插入结果:', { data, error });

        if (error) {
          alert('保存失败：' + error.message);
        } else {
          alert('保存成功！');
          setCurrentCity(prev => ({
            ...prev,
            gallery: [...prev.gallery, base64]
          }));
        }
      } catch (err) {
        alert('上传失败：' + err.message);
        console.error(err);
      }
      setUploading(false);
    };

    reader.onerror = () => {
      alert('文件读取失败');
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };
  // ===================================================

  const handleImageError = (e) => { e.target.style.display = 'none'; };

  const openImageViewer = (image, index) => {
    setSelectedImage(image);
    setCurrentImageIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    document.body.style.overflow = 'auto';
  };

  const showPreviousImage = () => {
    const all = currentCity.gallery;
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : all.length - 1;
    setCurrentImageIndex(newIndex);
    setSelectedImage(all[newIndex]);
  };

  const showNextImage = () => {
    const all = currentCity.gallery;
    const newIndex = currentImageIndex < all.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setSelectedImage(all[newIndex]);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!selectedImage) return;
      if (e.key === 'Escape') closeImageViewer();
      else if (e.key === 'ArrowLeft') showPreviousImage();
      else if (e.key === 'ArrowRight') showNextImage();
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedImage, currentImageIndex]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0f1a 0%, #0d1525 40%, #111d35 100%)', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>加载中...</div>
          <div style={{ fontSize: '1rem', opacity: 0.6 }}>{cityName}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="city-detail">
      {/* 返回 + 编辑按钮 */}
      <div style={{ position: 'fixed', top: '30px', left: '30px', zIndex: 100, display: 'flex', gap: '10px' }}>
        <button className={`back-button ${isDarkMode ? 'dark' : 'light'}`} onClick={goBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          style={{
            padding: '12px 24px',
            borderRadius: '30px',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            background: isEditMode ? '#e94560' : 'rgba(255,255,255,0.1)',
            color: '#fff',
            backdropFilter: 'blur(10px)'
          }}
        >
          {isEditMode ? '退出编辑' : '编辑'}
        </button>
      </div>

      {/* 编辑面板 */}
      {isEditMode && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'fixed',
            top: '90px',
            left: '30px',
            zIndex: 100,
            background: 'rgba(0,0,0,0.8)',
            padding: '20px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            minWidth: '280px'
          }}
        >
          <h4 style={{ margin: '0 0 15px 0', color: '#4ECDC4' }}>添加照片</h4>
          <label style={{
            display: 'block',
            padding: '12px 20px',
            background: '#4ECDC4',
            color: '#000',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            {uploading ? '上传中...' : '+ 选择图片上传'}
            <input type="file" accept="image/*" hidden onChange={handleImageUpload} disabled={uploading} />
          </label>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
            已保存 {currentCity.gallery.length} 张照片
          </p>
        </motion.div>
      )}

      {/* 主页面 */}
      <div className="hero-section">
        <div
          className="hero-background"
          style={{
            backgroundImage: `url("${currentCity.mainImage || currentCity.gallery[0] || ''}")`,
            transform: `translateY(${scrollY * 0.5}px)`,
          }}
          onClick={() => {
            const img = currentCity.mainImage || currentCity.gallery[0];
            if (img) openImageViewer(img, 0);
          }}
        />
        <div className="hero-overlay" />

        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <h1 className="city-name">{cityName}</h1>
          {currentCity.description && (
            <div className="meta-item">{currentCity.description}</div>
          )}
        </motion.div>

        <div className="scroll-indicator">
          <span>向下滑动查看更多</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </div>

      {/* 图片画廊 */}
      <div className="gallery-section">
        <div className="gallery-container">
          <h2 className="gallery-title">精彩瞬间</h2>
          <div className="gallery-grid">
            {currentCity.gallery.length > 0 ? (
              currentCity.gallery.map((image, index) => (
                <motion.div
                  key={index}
                  className="gallery-item"
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  onClick={() => openImageViewer(image, index)}
                >
                  <img src={image} alt={`${cityName} ${index + 1}`} onError={handleImageError} />
                </motion.div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 0', color: '#999' }}>
                {isEditMode ? '点击上方添加照片' : '照片都被藏起来了哦，自己去上传试试吧～'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 图片查看器 */}
      {selectedImage && (
        <div className="