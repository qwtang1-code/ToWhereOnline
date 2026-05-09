import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { uploadToSupabase } from '../lib/supabaseStorage';

export default function CityDetail({ cityName, goBack }) {
  const [scrollY, setScrollY] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentCity, setCurrentCity] = useState({ mainImage: '', description: '', gallery: [] });
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 从 Supabase 加载城市数据
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
          setLoading(false);
          return;
        }

        // 关键：从 city_images 表读取图片
        const { data: imagesData, error: imagesError } = await supabase
          .from('city_images')
          .select('url, sort_order')
          .eq('city_id', cityData.id)
          .order('sort_order', { ascending: true });

        setCurrentCity({
          id: cityData.id,
          mainImage: cityData.main_image,
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

  // 处理图片上传
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentCity.id) return;

    setUploading(true);
    try {
      // 1. 上传到 Supabase Storage
      const { publicUrl } = await uploadToSupabase(file, 'firsts-images');

      // 2. 插入 city_images 表
      const { error } = await supabase
        .from('city_images')
        .insert({
          city_id: currentCity.id,
          url: publicUrl,
          sort_order: currentCity.gallery.length
        });

      if (error) {
        alert('保存到数据库失败：' + error.message);
      } else {
        // 刷新数据
        setCurrentCity(prev => ({
          ...prev,
          gallery: [...prev.gallery, publicUrl]
        }));
      }
    } catch (error) {
      alert('上传失败：' + error.message);
    } finally {
      setUploading(false);
    }
  };

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
    const allImages = currentCity.gallery.length > 0 ? currentCity.gallery : [currentCity.mainImage];
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : allImages.length - 1;
    setCurrentImageIndex(newIndex);
    setSelectedImage(allImages[newIndex]);
  };

  const showNextImage = () => {
    const allImages = currentCity.gallery.length > 0 ? currentCity.gallery : [currentCity.mainImage];
    const newIndex = currentImageIndex < allImages.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setSelectedImage(allImages[newIndex]);
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

      {/* 编辑模式：上传图片 */}
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

      {/* 全屏主页面 */}
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

      {/* 图片流区域 */}
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
                {isEditMode ? '点击上方"选择图片上传"添加照片' : '照片都被藏起来了哦，自己去上传试试吧～'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 图片查看器 */}
      {selectedImage && (
        <div className="image-viewer-overlay" onClick={closeImageViewer}>
          <div className="image-viewer-container" onClick={(e) => e.stopPropagation()}>
            <button className="image-viewer-close" onClick={closeImageViewer}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <button className="image-viewer-nav prev" onClick={showPreviousImage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button className="image-viewer-nav next" onClick={showNextImage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <img src={selectedImage} alt="查看" className="image-viewer-img" onError={handleImageError} />
            <div className="image-viewer-counter">{currentImageIndex + 1} / {currentCity.gallery.length}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .city-detail { width: 100%; height: 100%; overflow-y: auto; }
        .hero-section { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .hero-background { position: absolute; top: -20%; left: -20%; width: 140%; height: 140%; background-size: cover; background-position: center; background-repeat: no-repeat; background-image: linear-gradient(45deg, #1e3c72, #2a5298); cursor: pointer; }
        .hero-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); }
        .back-button { padding: 12px 24px; border-radius: 30px; border: none; font-size: 16px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .back-button.dark { background: rgba(0,0,0,0.7); color: white; backdrop-filter: blur(10px); }
        .back-button.dark:hover { background: rgba(0,0,0,0.9); transform: translateY(-2px); }
        .back-button.light { background: rgba(255,255,255,0.9); color: black; backdrop-filter: blur(10px); }
        .back-button.light:hover { background: rgba(255,255,255,1); }
        .hero-content { position: relative; z-index: 5; text-align: center; color: white; max-width: 80%; display: flex; flex-direction: column; align-items: center; }
        .city-name { font-size: clamp(3rem, 10vw, 6rem); font-weight: 800; margin: 0 0 20px 0; letter-spacing: -2px; text-shadow: 0 2px 20px rgba(0,0,0,0.5); }
        .meta-item { font-size: 1.4rem; opacity: 0.9; font-weight: 300; letter-spacing: 1px; }
        .scroll-indicator { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); color: white; text-align: center; z-index: 10; animation: bounce 2s infinite; }
        .scroll-indicator span { display: block; margin-bottom: 8px; font-size: 14px; opacity: 0.8; }
        @keyframes bounce { 0%,20%,50%,80%,100%{transform:translateX(-50%)translateY(0)}40%{transform:translateX(-50%)translateY(-10px)}60%{transform:translateX(-50%)translateY(-5px)} }
        .gallery-section { background: white; padding: 80px 0; min-height: 100vh; }
        .gallery-container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
        .gallery-title { font-size: 3rem; text-align: center; margin-bottom: 60px; color: #333; }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
        .gallery-item { border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transition: transform 0.3s; cursor: pointer; }
        .gallery-item:hover { transform: translateY(-10px); }
        .gallery-item img { width: 100%; height: 250px; object-fit: cover; display: block; transition: transform 0.3s; }
        .gallery-item:hover img { transform: scale(1.05); }
        .image-viewer-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .image-viewer-container { position: relative; max-width: 90vw; max-height: 90vh; }
        .image-viewer-img { max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px; }
        .image-viewer-close { position: absolute; top: -50px; right: 0; background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .image-viewer-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .image-viewer-nav.prev { left: -70px; }
        .image-viewer-nav.next { right: -70px; }
        .image-viewer-counter { position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px; }
        @media (max-width: 768px) { .gallery-grid { grid-template-columns: 1fr; } .gallery-container { padding: 0 20px; } .image-viewer-nav.prev { left: 10px; } .image-viewer-nav.next { right: 10px; } }
      `}</style>
    </div>
  );
}