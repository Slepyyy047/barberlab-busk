export type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
  note: string;
  visible: boolean;
  order: number;
};

export type Staff = {
  id: string;
  name: string;
  level: string;
  portrait: string | null;
  visible: boolean;
  order: number;
};

export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
  category: string;
  visible: boolean;
  order: number;
};

export type WeeklyHours = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}[];

export type Settings = {
  name: string;
  descriptor: string;
  address: string;
  phone: string;
  phoneLink: string;
  bookingUrl: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  hours: string;
  weeklyHours: WeeklyHours;
  amenities: string[];
  rating: number;
  reviewCount: number;
};

export type Review = { name: string; text: string };

export type Content = {
  services: Service[];
  staff: Staff[];
  gallery: GalleryImage[];
  settings: Settings;
  reviews: Review[];
};
