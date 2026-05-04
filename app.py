import streamlit as st
from streamlit_drawable_canvas import st_canvas
from PIL import Image
import os
import json
from datetime import datetime
import numpy as np

# --- 1. AYARLAR VE KLASÖR YAPISI ---
st.set_page_config(page_title="Üretim Parça Takibi", layout="wide")
DATA_DIR = "veri"
IMAGE_DIR = os.path.join(DATA_DIR, "resimler")
JSON_FILE = os.path.join(DATA_DIR, "kayitlar.json")

os.makedirs(IMAGE_DIR, exist_ok=True)

# --- 2. GÜVENLİK (SADECE SİZE ÖZEL OLMASI İÇİN) ---
def check_password():
    """Basit bir şifre doğrulama ekranı"""
    def password_entered():
        # ŞİFRENİZİ BURADAN DEĞİŞTİREBİLİRSİNİZ
        if st.session_state["password"] == "Mekanik2026!": 
            st.session_state["password_correct"] = True
            del st.session_state["password"]
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        st.text_input("Sisteme Giriş Şifresi:", type="password", on_change=password_entered, key="password")
        return False
    elif not st.session_state["password_correct"]:
        st.text_input("Sisteme Giriş Şifresi:", type="password", on_change=password_entered, key="password")
        st.error("😕 Yanlış şifre girdiniz.")
        return False
    return True

# Şifre doğruysa uygulamayı çalıştır
if check_password():
    st.title("🏭 Üretim Sahası - Parça Kontrol Sistemi")

    # Mobil ve PC için iki ayrı sekme oluşturuyoruz
    tab1, tab2 = st.tabs(["📱 Sahadan Veri Gir (Mobil)", "💻 Merkez Ekranı (PC)"])

    # --- 3. MOBİL EKRAN (VERİ GİRİŞİ) ---
    with tab1:
        st.header("Yeni Parça Fotoğrafı ve İşaretleme")
        
        # Telefonda doğrudan kamerayı açar, PC'de webcam arar
        resim_dosyasi = st.camera_input("Parçanın Fotoğrafını Çek")
        
        if resim_dosyasi is not None:
            # Fotoğrafı PIL formatında aç
            bg_image = Image.open(resim_dosyasi)
            # Mobil ekrana sığması için yeniden boyutlandır
            bg_image = bg_image.resize((400, 300))
            
            st.write("Hatalı/İncelenecek bölgeyi parmağınızla çizin:")
            
            # Dokunmatik çizim alanı (Canvas)
            canvas_result = st_canvas(
                fill_color="rgba(255, 165, 0, 0)",  # İçi boş
                stroke_width=4,                      # Çizgi kalınlığı
                stroke_color="#FF0000",              # Çizgi rengi (Kırmızı)
                background_image=bg_image,
                height=300,
                width=400,
                drawing_mode="freedraw",
                key="canvas",
            )

            aciklama = st.text_area("Açıklama / Notlar:", placeholder="Örn: Flanş yüzeyinde kılcal çizik mevcut.")

            if st.button("💾 Kaydet ve Merkeze Gönder", use_container_width=True):
                if canvas_result.image_data is not None:
                    # Çizimi ve arka planı birleştirip kaydetme işlemi
                    cizim_katmani = Image.fromarray(canvas_result.image_data.astype('uint8'), 'RGBA')
                    final_img = Image.alpha_composite(bg_image.convert("RGBA"), cizim_katmani)

                    zaman_damgasi = datetime.now().strftime("%Y%m%d_%H%M%S")
                    resim_adi = f"parca_{zaman_damgasi}.png"
                    resim_yolu = os.path.join(IMAGE_DIR, resim_adi)
                    
                    final_img.save(resim_yolu)

                    # Açıklamaları ve dosya yolunu JSON'a kaydet
                    yeni_kayit = {
                        "tarih": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "resim": resim_yolu,
                        "aciklama": aciklama
                    }

                    veriler = []
                    if os.path.exists(JSON_FILE):
                        with open(JSON_FILE, "r", encoding="utf-8") as f:
                            try:
                                veriler = json.load(f)
                            except json.JSONDecodeError:
                                pass

                    veriler.append(yeni_kayit)

                    with open(JSON_FILE, "w", encoding="utf-8") as f:
                        json.dump(veriler, f, ensure_ascii=False, indent=4)

                    st.success("✅ Veri merkeze başarıyla iletildi!")

    # --- 4. PC EKRANI (İZLEME) ---
    with tab2:
        col1, col2 = st.columns([4, 1])
        with col1:
            st.header("Saha Kayıtları")
        with col2:
            if st.button("🔄 Ekranı Yenile"):
                st.rerun()

        if os.path.exists(JSON_FILE):
            with open(JSON_FILE, "r", encoding="utf-8") as f:
                try:
                    kayitlar = json.load(f)
                except json.JSONDecodeError:
                    kayitlar = []
            
            # En son çekilen fotoğraf en üstte görünsün diye listeyi ters çeviriyoruz
            for kayit in reversed(kayitlar):
                with st.expander(f"📅 {kayit['tarih']} - {kayit['aciklama'][:30]}...", expanded=True):
                    col_img, col_text = st.columns([1, 2])
                    with col_img:
                        if os.path.exists(kayit['resim']):
                            st.image(kayit['resim'], use_container_width=True)
                        else:
                            st.error("Görsel bulunamadı.")
                    with col_text:
                        st.markdown(f"**Kayıt Tarihi:** {kayit['tarih']}")
                        st.markdown(f"**Saha Notu:** {kayit['aciklama']}")
        else:
            st.info("Henüz sahadan gelen bir kayıt yok.")
