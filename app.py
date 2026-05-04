import streamlit as st
from streamlit_drawable_canvas import st_canvas
from PIL import Image
import os
import json
from datetime import datetime

# --- KRİTİK HATA YAMASI (PATCH) ---
# Yeni Streamlit sürümlerinde canvas kütüphanesinin hata vermesini engeller
import streamlit.elements.image as st_image
if not hasattr(st_image, "image_to_url"):
    def image_to_url(*args, **kwargs):
        return "internal-error-fixed"
    st_image.image_to_url = image_to_url

# --- 1. AYARLAR VE KLASÖR YAPISI ---
st.set_page_config(page_title="Üretim Parça Takibi", layout="wide")
DATA_DIR = "veri"
IMAGE_DIR = os.path.join(DATA_DIR, "resimler")
JSON_FILE = os.path.join(DATA_DIR, "kayitlar.json")
os.makedirs(IMAGE_DIR, exist_ok=True)

# --- 2. GÜVENLİK ---
def check_password():
    if "password_correct" not in st.session_state:
        st.session_state["password_correct"] = False

    if st.session_state["password_correct"]:
        return True

    password = st.text_input("Sisteme Giriş Şifresi:", type="password")
    if st.button("Giriş Yap"):
        if password == "Mekanik2026!":
            st.session_state["password_correct"] = True
            st.rerun()
        else:
            st.error("😕 Yanlış şifre.")
    return False

if check_password():
    st.title("🏭 Üretim Sahası - Parça Kontrol")
    tab1, tab2 = st.tabs(["📱 Sahadan Veri Gir", "💻 Merkez Ekranı"])

    with tab1:
        resim_dosyasi = st.camera_input("Parçanın Fotoğrafını Çek")
        
        if resim_dosyasi:
            bg_image = Image.open(resim_dosyasi)
            # Genişliği 600 yaparak telefon ekranına daha iyi yayılmasını sağlıyoruz
            w, h = bg_image.size
            aspect_ratio = h / w
            new_w = 600
            new_h = int(new_w * aspect_ratio)
            bg_image = bg_image.resize((new_w, new_h))
            
            st.write("Hatalı bölgeyi işaretleyin:")
            canvas_result = st_canvas(
                fill_color="rgba(255, 0, 0, 0.2)",
                stroke_width=3,
                stroke_color="#FF0000",
                background_image=bg_image,
                height=new_h,
                width=new_w,
                drawing_mode="freedraw",
                key="canvas",
            )

            aciklama = st.text_area("Açıklama:")

            if st.button("💾 Kaydet ve Gönder"):
                zaman_damgasi = datetime.now().strftime("%Y%m%d_%H%M%S")
                resim_adi = f"parca_{zaman_damgasi}.png"
                resim_yolu = os.path.join(IMAGE_DIR, resim_adi)
                
                # Çizimi ve resmi birleştir
                if canvas_result.image_data is not None:
                    # Canvas verisini ve arka planı birleştirme işlemi
                    cizim = Image.fromarray(canvas_result.image_data.astype('uint8'), 'RGBA')
                    # Arka planı RGBA yap ve çizimi üzerine bas
                    base = bg_image.convert("RGBA")
                    final_img = Image.alpha_composite(base, cizim)
                    final_img.convert("RGB").save(resim_yolu)

                    # JSON Kaydı
                    yeni_kayit = {"tarih": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "resim": resim_yolu, "aciklama": aciklama}
                    veriler = []
                    if os.path.exists(JSON_FILE):
                        with open(JSON_FILE, "r", encoding="utf-8") as f:
                            try: veriler = json.load(f)
                            except: pass
                    veriler.append(yeni_kayit)
                    with open(JSON_FILE, "w", encoding="utf-8") as f:
                        json.dump(veriler, f, ensure_ascii=False, indent=4)
                    
                    st.success("✅ Başarıyla kaydedildi!")
                    st.rerun()

    with tab2:
        if os.path.exists(JSON_FILE):
            with open(JSON_FILE, "r", encoding="utf-8") as f:
                try: kayitlar = json.load(f)
                except: kayitlar = []
            
            for kayit in reversed(kayitlar):
                with st.expander(f"📅 {kayit['tarih']}"):
                    st.image(kayit['resim'])
                    st.write(f"**Not:** {kayit['aciklama']}")
