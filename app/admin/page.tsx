import AdminPanel from '@/components/AdminPanel';
import './admin.css';

export const metadata = {
  title: 'Адмінпанель',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}

