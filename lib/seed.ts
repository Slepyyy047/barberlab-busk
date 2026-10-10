import type { Content } from './types';

export const seedContent: Content = {
  services: [
    { id: 'mens-cut', name: 'Чоловіча стрижка', price: 500, duration: 60, category: 'Стрижки', note: '', visible: true, order: 0 },
    { id: 'clipper-cut', name: 'Стрижка машинкою', price: 350, duration: 30, category: 'Стрижки', note: '', visible: true, order: 1 },
    { id: 'beard-trim', name: 'Стрижка бороди та вусів', price: 400, duration: 30, category: 'Борода', note: 'Експерт-майстер', visible: true, order: 2 },
    { id: 'mens-cut-beard', name: 'Чоловіча стрижка + стрижка бороди та вусів', price: 850, duration: 60, category: 'Комплекси', note: '', visible: true, order: 3 },
    { id: 'clipper-beard', name: 'Стрижка машинкою + стрижка бороди та вусів', price: 650, duration: 60, category: 'Комплекси', note: '', visible: true, order: 4 },
    { id: 'kids-cut', name: 'Дитяча стрижка', price: 450, duration: 60, category: 'Стрижки', note: '', visible: true, order: 5 },
    { id: 'father-son', name: 'Батько та син', price: 850, duration: 120, category: 'Комплекси', note: '', visible: true, order: 6 },
    { id: 'groom-morning', name: 'Ранок нареченого', price: 2000, duration: 60, category: 'Комплекси', note: '', visible: true, order: 7 },
    { id: 'gray-camouflage', name: 'Камуфлювання сивини', price: 450, duration: 30, category: 'Догляд', note: '', visible: true, order: 8 },
    { id: 'beard-camouflage', name: 'Камуфлювання бороди', price: 450, duration: 30, category: 'Догляд', note: '', visible: true, order: 9 },
    { id: 'wax', name: 'Воскова депіляція', price: 150, duration: 15, category: 'Догляд', note: '', visible: true, order: 10 },
  ],
  staff: [
    { id: 'roman-padus', name: 'Роман Падус', level: 'Експерт-майстер', portrait: null, visible: true, order: 0 },
    { id: 'ihor-pavliv', name: 'Ігор Павлів', level: 'Експерт-майстер', portrait: null, visible: true, order: 1 },
    { id: 'andrii', name: 'Андрій', level: 'Топ-майстер', portrait: null, visible: true, order: 2 },
    { id: 'nadia', name: 'Надя', level: 'Топ-майстер', portrait: null, visible: true, order: 3 },
    { id: 'illia', name: 'Ілля', level: 'Майстер', portrait: null, visible: true, order: 4 },
  ],
  gallery: [],
  settings: {
    name: 'BARBERLAB', descriptor: 'Барбершоп у Буську',
    address: 'майдан Незалежності, 1, Буськ, Львівська область, 80500, Україна',
    phone: '068 404 0130', phoneLink: 'tel:+380684040130',
    bookingUrl: 'https://b355607.alteg.io/company/339440/menu?o=',
    instagram: 'https://www.instagram.com/barberlab.busk/',
    tiktok: 'https://www.tiktok.com/@barberlab.barbershop',
    facebook: 'https://www.facebook.com/pages/Barbershop.busk/109759780750938/',
    hours: 'Години роботи: 10:00–20:00. Робочі дні уточнюйте під час запису.',
    weeklyHours: [], amenities: ['Оплата карткою', 'NFC', 'Дитячі послуги', 'Кава', 'Місце для очікування', 'Доступний вхід і паркування'],
    rating: 4.9, reviewCount: 67,
  },
  reviews: [
    { name: 'Олександр Задорожний', text: 'Якість послуг і відношення до клієнтів на висоті. Рекомендую.' },
    { name: 'Yura Malenko', text: 'Стабільно раз в два тижні відвідую даний барбершоп! Без різниці можу записатись до будь-якого майстра і залишаюсь завжди задоволений! Рекомендую!' },
    { name: 'Andriy Malenko', text: 'Прийшов в барбершоп, скинув кілька лишніх років) найдешевший спосіб омолодження! Щира рекомендація!' },
  ],
};
