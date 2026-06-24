import { createContext, useContext, useState } from "react";

const translations = {
  uz: {
    // Header
    search_placeholder: "iPhone 15 Pro toping",
    favorites: "Sevimlilar",
    my_ads: "E'lonlar",
    messages: "Xabarlar",
    login: "Tizimga kirish",
    logout: "Chiqish",
    
    // Hero
    hero_title: "Soting va xarid qiling Samarqandda",
    hero_subtitle: "Minglab e'lonlar orasidan o'zingizga keraklisini toping",
    create_ad: "E'lon berish",
    
    // Categories
    categories: "Kategoriyalar",
    all_categories: "Barcha kategoriyalar",
    
    // Ads
    recent_ads: "So'nggi e'lonlar",
    view_details: "Batafsil",
    price: "Narx",
    location: "Manzil",
    views: "Ko'rishlar",
    contact_seller: "Sotuvchi bilan bog'lanish",
    chat: "Suhbat",
    description: "Tavsif",
    similar_ads: "O'xshash e'lonlar",
    
    // Auth
    phone_number: "Telefon raqami",
    enter_phone: "Telefon raqamingizni kiriting",
    send_code: "Kod yuborish",
    verify_code: "Kodni tasdiqlash",
    enter_code: "SMS dan kelgan kodni kiriting",
    sent_to: "ga yuborildi",
    enter_name: "Ismingizni kiriting",
    name: "Ism",
    register: "Ro'yxatdan o'tish",
    auth_agreement: "Avtorizatsiyadan o'tib, siz shaxsiy ma'lumotlarni qayta ishlash siyosati va foydalanuvchi shartlariga rozilik bildirasiz.",
    
    // Create Ad
    create_new_ad: "Yangi e'lon berish",
    photos: "Rasmlar",
    upload_photos: "1 dan 10 gacha rasm yuklang",
    drag_drop: "Rasmlarni bu yerga sudrab oling",
    title: "Nom",
    title_placeholder: "Masalan, iPhone 15 Pro",
    category: "Kategoriya",
    select_category: "Kategoriyani tanlang",
    price_label: "Narx (UZS)",
    description_label: "Tavsif",
    description_placeholder: "Mahsulot yoki xizmat haqida gapirib bering",
    deal_location: "Bitim joyi",
    address: "Manzil",
    landmark: "Mo'ljal",
    can_deliver: "Yetkazib berishni tashkil qila olaman",
    contact_info: "Aloqa ma'lumotlari",
    contact_methods: "Aloqa usullari",
    chat_gow: "Chat GOW",
    call: "Qo'ng'iroq orqali",
    telegram: "Telegramda suhbat",
    publish: "E'lonni joylashtirish",
    
    // Profile
    my_profile: "Mening profilim",
    my_listings: "Mening e'lonlarim",
    active: "Faollar",
    drafts: "Qoralamalar",
    pending: "Harakat kutmoqda",
    archive: "Arxiv",
    settings: "Sozlamalar",
    
    // Admin
    admin_panel: "Admin Panel",
    dashboard: "Boshqaruv paneli",
    total_users: "Jami foydalanuvchilar",
    total_ads: "Jami e'lonlar",
    active_ads: "Faol e'lonlar",
    pending_ads: "Kutilayotgan e'lonlar",
    rejected_ads: "Rad etilgan e'lonlar",
    approve: "Tasdiqlash",
    reject: "Rad etish",
    
    // Common
    save: "Saqlash",
    cancel: "Bekor qilish",
    delete: "O'chirish",
    edit: "Tahrirlash",
    close: "Yopish",
    loading: "Yuklanmoqda...",
    error: "Xatolik yuz berdi",
    success: "Muvaffaqiyatli",
    no_results: "Natijalar topilmadi",
  },
  ru: {
    // Header
    search_placeholder: "Найти iPhone 15 Pro",
    favorites: "Избранное",
    my_ads: "Объявления",
    messages: "Сообщения",
    login: "Войти",
    logout: "Выйти",
    
    // Hero
    hero_title: "Покупайте и продавайте в Самарканде",
    hero_subtitle: "Найдите то, что вам нужно среди тысяч объявлений",
    create_ad: "Подать объявление",
    
    // Categories
    categories: "Категории",
    all_categories: "Все категории",
    
    // Ads
    recent_ads: "Последние объявления",
    view_details: "Подробнее",
    price: "Цена",
    location: "Адрес",
    views: "Просмотры",
    contact_seller: "Связаться с продавцом",
    chat: "Чат",
    description: "Описание",
    similar_ads: "Похожие объявления",
    
    // Auth
    phone_number: "Номер телефона",
    enter_phone: "Введите номер телефона",
    send_code: "Отправить код",
    verify_code: "Подтвердить код",
    enter_code: "Введите код из SMS",
    sent_to: "отправлен на",
    enter_name: "Введите ваше имя",
    name: "Имя",
    register: "Зарегистрироваться",
    auth_agreement: "Авторизуясь, вы соглашаетесь с политикой обработки персональных данных и условиями использования.",
    
    // Create Ad
    create_new_ad: "Создать объявление",
    photos: "Фотографии",
    upload_photos: "Загрузите от 1 до 10 фото",
    drag_drop: "Перетащите фото сюда",
    title: "Название",
    title_placeholder: "Например, iPhone 15 Pro",
    category: "Категория",
    select_category: "Выберите категорию",
    price_label: "Цена (UZS)",
    description_label: "Описание",
    description_placeholder: "Расскажите о товаре или услуге",
    deal_location: "Место сделки",
    address: "Адрес",
    landmark: "Ориентир",
    can_deliver: "Могу организовать доставку",
    contact_info: "Контактная информация",
    contact_methods: "Способы связи",
    chat_gow: "Чат GOW",
    call: "Звонок",
    telegram: "Чат в Telegram",
    publish: "Опубликовать объявление",
    
    // Profile
    my_profile: "Мой профиль",
    my_listings: "Мои объявления",
    active: "Активные",
    drafts: "Черновики",
    pending: "Ожидают действия",
    archive: "Архив",
    settings: "Настройки",
    
    // Admin
    admin_panel: "Админ панель",
    dashboard: "Панель управления",
    total_users: "Всего пользователей",
    total_ads: "Всего объявлений",
    active_ads: "Активные объявления",
    pending_ads: "Ожидающие объявления",
    rejected_ads: "Отклоненные объявления",
    approve: "Одобрить",
    reject: "Отклонить",
    
    // Common
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Редактировать",
    close: "Закрыть",
    loading: "Загрузка...",
    error: "Произошла ошибка",
    success: "Успешно",
    no_results: "Результаты не найдены",
  }
};

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("language");
    return saved || "uz";
  });

  const t = (key) => {
    return translations[language][key] || key;
  };

  const switchLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, switchLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
