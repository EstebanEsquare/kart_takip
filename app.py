import streamlit as st
from streamlit_drawable_canvas import st_canvas
from PIL import Image
import os
import json
from datetime import datetime

# --- HATA ÖNLEYİCİ YAMA ---
try:
    import streamlit.elements.image as st_image
    if not hasattr(st_image, "image_to_url"):
        st_image.image_to_url = lambda *args, **kwargs: "fix"
except Exception:
    pass

# --- AYARLAR ---
st.set_page_config(page_title="Üretim Takip", layout="wide")
DATA_DIR = "veri"
IMAGE_DIR = os.path.join(DATA_DIR, "resimler")
JSON_FILE = os.path.join(DATA_DIR, "kayitlar.json")
os.makedirs(IMAGE_DIR, exist_ok=True)

# --- DURUM YÖNETİMİ (Session State) ---
if "auth" not in st.session_state:
    st.session_state.auth = False
if "step" not in st.session_state:
    st.session_state.step = "baslangic" # baslangic, kamera, isaretleme
if "captured_image" not in st.session_state:
    st.session_state.captured_image = None

# --- ŞİFRE KONTROLÜ ---
if not st.session_state.auth:
    pw = st.text_input("Şifre:", type="password")
    if st.button("Giriş"):
        if pw == "Mekanik2026!":
            st.session_state.auth = True
            st.rerun()
        else:
            st.error("Hatalı şifre.")
    st.stop()

# --- ANA UYGULAMA ---
st.title("🏭 Üretim Takip Sistemi")
tab1, tab2 = st.tabs(["📱 Sahadan Veri Gir", "💻 Kayıtları İzle"])

with tab1:
    # ADIM 1: BAŞLANGIÇ (Sadece bir buton var)
    if st.session_state.step == "baslangic":
        st.info("Yeni bir kayıt oluşturmak için aşağıdaki butona basın.")
        if st.button("📸 Kamera ile Fotoğraf Çek", use_container_width=True):
            st.session_state.step = "kamera"
            st.rerun()

    # ADIM 2: KAMERA AKTİF
    elif st.session_state.step == "kamera":
        st.warning("Arka kamerayı kullanmak için tarayıcı ayarlarınızdan izin verin.")
        img_file = st.camera_input("Parçayı Odaklayın")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("❌ Vazgeç / Geri Dön", use_container_width=True):
                st.session_state.step = "baslangic"
                st.rerun()
        
        if img_file:
            st.session_state.captured_image = Image.open(img_file)
            st.session_state.step = "isaretleme"
            st.rerun()

    # ADIM 3: İŞARETLEME VE AÇIKLAMA
    elif st.session_state.step == "isaretleme":
        st.subheader("İşaretleme ve Not Ekleme")
        
        raw_img = st.session_state.captured_image
        w, h = raw_img.size
        new_w = 600
        new_h = int((new_w/w)*h)
        canvas_img = raw_img.resize((new_w, new_h))

        st.write("1. Hatalı bölgeyi parmağınızla çizin:")
        canvas_res = st_canvas(
            fill_color="rgba(255, 0, 0, 0.2)",
            stroke_width=4,
            stroke_color="red",
            background_image=canvas_img,
            height=new_h,
            width=new_w,
            drawing_mode="freedraw",
            key="canvas_step3"
        )
        
        st.write("2. Açıklama yazın:")
        note = st.text_area("Hata detayı, parça no vb.:", placeholder="Buraya yazın...")
        
        col_save, col_cancel = st.columns(2)
        with col_save:
            if st.button("💾 Merkeze Gönder", use_container_width=True):
                fname = f"img_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                path = os.path.join(IMAGE_DIR, fname)
                
                if canvas_res.image_data is not None:
                    mask = Image.fromarray(canvas_res.image_data.astype('uint8'), 'RGBA')
                    base = canvas_img.convert("RGBA")
                    final = Image.alpha_composite(base, mask).convert("RGB")
                    final.save(path)

                    # JSON Kaydı
                    new_data = {"tarih": datetime.now().strftime("%d/%m/%Y %H:%M"), "resim": path, "not": note}
                    db = []
                    if os.path.exists(JSON_FILE):
                        with open(JSON_FILE, "r") as f:
                            try: db = json.load(f)
                            except: pass
                    db.append(new_data)
                    with open(JSON_FILE, "w") as f:
                        json.dump(db, f)
                    
                    st.success("✅ Veri başarıyla merkeze iletildi!")
                    st.session_state.step = "baslangic"
                    st.session_state.captured_image = None
                    st.rerun()
        
        with col_cancel:
            if st.button("🗑️ İptal Et", use_container_width=True):
                st.session_state.step = "baslangic"
                st.session_state.captured_image = None
                st.rerun()

# --- MERKEZ EKRANI (PC) ---
with tab2:
    if st.button("🔄 Listeyi Yenile"):
        st.rerun()
        
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, "r") as f:
            try: data = json.load(f)
            except: data = []
        for item in reversed(data):
            with st.expander(f"📌 {item['tarih']} - {item['not'][:20]}..."):
                st.image(item['resim'])
                st.info(f"**Açıklama:** {item['not']}")
